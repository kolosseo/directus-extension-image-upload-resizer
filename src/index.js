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
			//['composite', [{ // <-- Watermark feature (TODO)
				//input: __dirname+'/img/logo.png',
				//gravity: 'southeast',
				//blend: 'screen'
			//}]]
		]
		//if (format === 'jpeg' || format === 'png')
			//transforms.push([format, { progressive: true }])

		const transformationParams = {
			format: 'webp',
			quality,
			width: maxSize,
			height: maxSize,
			fit: 'inside',
			withoutEnlargement: false,
			transforms
		}

		const serviceOptions = { ...context, knex: context.database }
		const assets = new AssetsService(serviceOptions)
		const files = new FilesService(serviceOptions)
		// Get transformed file
		const { stream, file, stat } = await assets.getAsset(key, { transformationParams })

		// Stop if new file would be bigger (useless process)
		if (stat.size >= payload.filesize)
			return

		// Convert to "webp"
		if (format !== 'webp') {
			payload.type = payload.type.replace(format, 'webp')
			payload.filename_download = getFileName(payload.filename_download)+'.webp'
			payload.filename_disk = getFileName(payload.filename_disk)+'.webp'
		}

		// Delete image sizes, to restore them dynamically
		delete payload.height
		delete payload.width

		await sleep(4000) // Just wait a bit...

		// Finally upload processed and optimized file
		files.uploadOne(stream, {
			...payload,
			optimized: true
		}, key)
	})
}


// Alternative to "path.parse(str).name"
// (because "path" can't be imported in a "sandboxed" env, actually)
function getFileName(str) {
	str = str.split('/').pop().split('.')
	return str.length > 1
		? str.slice(0, -1).join('.')
		: str[0]
}

// Just sleep...
async function sleep(ms) {
	return new Promise(r => setTimeout(r, ms))
}
