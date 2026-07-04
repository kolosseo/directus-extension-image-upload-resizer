export default function registerHook({action}, {services, env}) {
	const {AssetsService, FilesService} = services
	const quality = parseInt(env.EXTENSIONS_IMAGE_UPLOAD_RESIZE_QUALITY ?? '73', 10)
	const maxSize = parseInt(env.EXTENSIONS_IMAGE_UPLOAD_RESIZE_MAXSIZE ?? '1920', 10)
	const keepMetadata = env.EXTENSIONS_IMAGE_UPLOAD_RESIZE_KEEP_METADATA === 'true'
	const formats = ['jpeg', 'png', 'webp']

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

			// Only handle JPG/PNG images that are not already WebP
			if (!file.type || !file.type.startsWith('image/')) return
			const format = file.type.split('/')[1]
			if (!formats.includes(format)) return

			const assetsService = new AssetsService(serviceOptions)

			const transformationParams = {
				format: 'webp',
				quality,
				width: maxSize,
				height: maxSize,
				fit: 'inside',
				withoutEnlargement: true,
				// EXIF/GPS data gets stripped by default
				// to enable metadata set `env.EXTENSIONS_REDUCE_ON_UPLOAD_KEEP_METADATA`
				withMetadata: keepMetadata
			}

			// Let Directus run the transformation through its own sharp instance,
			// storage-agnostic (works with local, S3, GCS, Azure, ...)
			const {stream, stat} = await assetsService.getAsset(key, {transformationParams})

			// Skip if the converted file would not actually be smaller
			if (stat.size >= file.filesize) return

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

			console.log('[ReduceOnUpload] success: ' + file.filename_download + ' -> WebP (' + Math.round(stat.size / 1024) + ' kB)')
		} catch (err) {
			console.error('[ReduceOnUpload] error during transformation:', err)
		}
	})
}

// Alternative to "path.parse(str).name",
// since "path" cannot be imported in a sandboxed environment
function getFileName(str) {
	const parts = str.split('/').pop().split('.')
	return parts.length > 1
		? parts.slice(0, -1).join('.')
		: parts[0]
}
