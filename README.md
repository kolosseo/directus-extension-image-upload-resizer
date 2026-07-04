# Image Upload Resizer

Directus extension to automatically lighten and resize large images during upload.
Formats are automatically converted into `webp` to be more light and _web proof_ and the sizes are decreased if the image is larger than the maximum preset limits.
That can be a helpful tool to optimize server space.


## Settings
The extension by default uses three `env` variables:
`EXTENSIONS_IMAGE_UPLOAD_RESIZER_QUALITY = 73`
`EXTENSIONS_IMAGE_UPLOAD_RESIZER_MAXSIZE = 1920`
`EXTENSIONS_IMAGE_UPLOAD_RESIZER_KEEP_METADATA = false`
which respectively set the quality, the maximum size and the keeping of metadata (EXIF/GPS) about the new converted images.

Directus also uses the following [env variables to manage images](https://directus.com/docs/configuration/files):
`ASSETS_TRANSFORM_IMAGE_MAX_DIMENSION = 6000`
	The max pixel dimensions size (width/height) that is allowed to be transformed.
`ASSETS_TRANSFORM_TIMEOUT = 7500ms`
	Max time spent trying to transform an asset.

If you consider working with particularly large images (professional photography, high-resolution scans), I recommend increasing `ASSETS_TRANSFORM_IMAGE_MAX_DIMENSION` and adjusting `ASSETS_TRANSFORM_TIMEOUT` accordingly; otherwise, those files will simply be discarded by the hook (safely, but still not converted).
Keep in mind that setting this values too high increases the risk of high memory and CPU usage for particularly large images.
Read more [here](https://directus.com/docs/configuration/files).

To customize the previous values, you have to add/set these `env` variables on your Directus instance (and then restart it).


## Notes
- This extension actually resizes and converts images from the following formats only: _jpeg_, _png_, _webp_.
- The code was heavily rewritten to fix crashing bugs during upload and to improve performances.
- The actual version is tested working with Directus 12.

## Credits
To [Christian Fuss](https://github.com/directus/directus/discussions/8704#discussioncomment-2820302)
