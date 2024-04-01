import path from 'path'
import { sleep } from 'directus:api'


export default ({ filter, action }, { services, env }) => {
	const { AssetsService, FilesService } = services
	const quality = env.EXTENSIONS_REDUCE_ON_UPLOAD_QUALITY || 73
	const maxSize = env.EXTENSIONS_REDUCE_ON_UPLOAD_MAXSIZE || 1920

	action('files.upload', async ({ payload, key }, context) => {
		// Stop if already optimized
		if (payload.optimized)
			return

		// Get file type and format (i.e. "image/jpeg")
		const [ filetype, format ] = payload.type.split('/') ?? ''

		// Stop if not handled
		if (filetype !== 'image'
		 && format !== 'jpeg'
		 && format !== 'webp'
		 && format !== 'png')
			return

		// TODO - Improve different format's management
		let transforms = [
			['withMetadata'],
			['composite', [{ // <-- if you want a watermark
				input: __dirname+'/img/logo-reverse.png',
				gravity: 'southeast',
				blend: 'screen'
			}]]
		]
		//if (format === 'jpeg' || format === 'png')
			//transforms.push([format, { progressive: true }])

		const transformation = {
			//format,
			format: 'webp',
			quality,
			width: maxSize,
			height: maxSize,
			fit: 'inside',
			withoutEnlargement: false,
			transforms,
		}

		const serviceOptions = { ...context, knex: context.database }
		const assets = new AssetsService(serviceOptions)
		const files = new FilesService(serviceOptions)
		// Get transformed file
		const { stream, file, stat } = await assets.getAsset(key, transformation)

		// Stop if new file would be bigger (useless process)
		if (stat.size >= payload.filesize)
			return

		// Convert to "webp"
		if (format !== 'webp') {
			payload.type = payload.type.replace(format, 'webp')
			payload.filename_download = path.parse(payload.filename_download).name+'.webp'
			payload.filename_disk = path.parse(payload.filename_disk).name+'.webp'
		}

		// Delete image sizes, to restore them dynamically
		delete payload.height
		delete payload.width

		await sleep(1000) // Just wait a bit...

		// Finally upload processed and optimized file
		await files.uploadOne(stream, {
			...payload,
			optimized: true
		}, key)
	})
}
