import {Readable} from 'node:stream'
import {createRequire} from 'node:module'
import {readdirSync, realpathSync} from 'node:fs'
import {join} from 'node:path'
import decode from 'heic-decode'

const requireFromHere = createRequire(import.meta.url)

// Resolve the sharp instance already installed by Directus.
// Strategy 1: standard Node resolution (works when sharp is hoisted,
// e.g. npm/yarn installs or `node_modules/sharp` symlinked at top level).
// Strategy 2: require anchored INSIDE the `directus` package (its realpath
// lives in the pnpm virtual store, where its `sharp` dependency is a sibling).
// Strategy 3: scan the pnpm virtual store (`node_modules/.pnpm/sharp@*`)
// directly — this is the layout of the official Directus Docker image.
function loadSharp() {
	try {
		return requireFromHere('sharp')
	} catch {}

	const roots = [...new Set([process.cwd(), '/directus'])]

	for (const root of roots) {
		for (const pkg of ['directus', '@directus/api']) {
			try {
				const anchor = realpathSync(join(root, 'node_modules', pkg, 'package.json'))
				return createRequire(anchor)('sharp')
			} catch {}
		}
	}

	for (const root of roots) {
		try {
			const pnpmDir = join(root, 'node_modules', '.pnpm')
			for (const entry of readdirSync(pnpmDir)) {
				if (!entry.startsWith('sharp@')) continue
				try {
					return requireFromHere(join(pnpmDir, entry, 'node_modules', 'sharp'))
				} catch {}
			}
		} catch {}
	}

	throw new Error('sharp could not be resolved: not hoisted, not reachable via the directus package, and not found in any pnpm virtual store (' + roots.join(', ') + ')')
}

export default function registerHook({action}, {services, env}) {
	const {AssetsService, FilesService} = services
	const quality = parseInt(env.EXTENSIONS_IMAGE_UPLOAD_RESIZER_QUALITY ?? '73', 10)
	const maxSize = parseInt(env.EXTENSIONS_IMAGE_UPLOAD_RESIZER_MAXSIZE ?? '1920', 10)
	const keepMetadata = env.EXTENSIONS_IMAGE_UPLOAD_RESIZER_KEEP_METADATA === 'true'
	// Formats handled natively by Directus' own transformation pipeline
	const directusFormats = ['jpeg', 'png', 'webp', 'tiff']
	// Formats Directus refuses to transform (not in its internal
	// SUPPORTED_IMAGE_TRANSFORM_FORMATS whitelist): handled manually below.
	// Real iPhone .heic files are HEVC-encoded, which the prebuilt
	// sharp/libvips cannot decode either (AV1-only build), so decoding
	// is done via the bundled libheif WASM (heic-decode) and only the
	// resize + WebP encode is delegated to sharp.
	const heicFormats = ['heic', 'heif']

	// Lazy + cached so a resolution failure degrades gracefully
	// (logged per upload) instead of preventing the extension from loading.
	let sharpInstance = null
	const getSharp = () => (sharpInstance ??= loadSharp())

	action('files.upload', async function onFileUpload({key, payload}, eventContext) {
		try {
			// Skip files already processed by this hook
			if (payload.optimized) return

			const serviceOptions = {
				schema: eventContext.schema,
				accountability: {admin: true},
				knex: eventContext.database
			}

			const filesService = new FilesService(serviceOptions)

			// Read the full record instead of trusting the payload,
			// since it does not always include every field (e.g. filename_disk)
			const file = await filesService.readOne(key, {
				fields: ['id', 'type', 'filename_disk', 'filename_download', 'filesize']
			})

			// Only handle known image formats
			if (!file.type || !file.type.startsWith('image/')) return
			const format = file.type.split('/')[1]
			const isHeic = heicFormats.includes(format)
			if (!directusFormats.includes(format) && !isHeic) return

			const assetsService = new AssetsService(serviceOptions)

			let stream
			let newSize

			if (isHeic) {
				const sharp = await getSharp()

				// Fetch the ORIGINAL untouched file (storage-agnostic).
				// Called without transformationParams, otherwise Directus'
				// whitelist silently returns the original for HEIC sources.
				const {stream: originalStream} = await assetsService.getAsset(key)
				const chunks = []
				for await (const chunk of originalStream) chunks.push(chunk)

				// Decode HEVC via WASM; libheif already applies the
				// irot/imir orientation transforms, no .rotate() needed.
				// NOTE: EXIF/GPS metadata cannot survive this path since
				// sharp receives raw pixels (keepMetadata has no effect).
				const {width, height, data} = await decode({buffer: Buffer.concat(chunks)})

				const buffer = await sharp(Buffer.from(data), {raw: {width, height, channels: 4}})
					.resize({
						width: maxSize,
						height: maxSize,
						fit: 'inside',
						withoutEnlargement: true
					})
					.webp({quality})
					.toBuffer()

				stream = Readable.from(buffer)
				newSize = buffer.length
			} else {
				const transformationParams = {
					format: 'webp',
					quality,
					width: maxSize,
					height: maxSize,
					fit: 'inside',
					withoutEnlargement: true,
					// EXIF/GPS data gets stripped by default,
					// to enable metadata set `env.EXTENSIONS_IMAGE_UPLOAD_RESIZER_KEEP_METADATA`
					withMetadata: keepMetadata
				}

				// Let Directus run the transformation through its own sharp instance,
				// storage-agnostic (works with local, S3, GCS, Azure, ...)
				const {stream: transformedStream, stat} = await assetsService.getAsset(key, {transformationParams})
				stream = transformedStream
				newSize = stat.size
			}

			// Skip if the converted file would not actually be smaller
			if (newSize >= file.filesize) return

			const newFilenameDownload = getFileName(file.filename_download)
			const newFilenameDisk = getFileName(file.filename_disk)

			// Upload the processed file back through the standard pipeline,
			// width/height are omitted so Directus recalculates them automatically
			await filesService.uploadOne(stream, {
				type: 'image/webp',
				filename_download: newFilenameDownload,
				filename_disk: newFilenameDisk,
				optimized: true
			}, key)

			console.log('[ReduceOnUpload] success: ' + file.filename_download + ' -> WebP (' + Math.round(newSize / 1024) + ' kB)')
		} catch (err) {
			console.error('[ReduceOnUpload] error during transformation:', err)
		}
	})
}

// Alternative to "path.parse(str).name" (useful for "sandbox" mode)
function getFileName(str) {
	const parts = str.split('/').pop().split('.')
	return parts.length > 1
		? parts.slice(0, -1).join('.')
		: parts[0]
}
