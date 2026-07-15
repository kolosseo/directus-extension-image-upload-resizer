# Image Upload Resizer

Directus extension to automatically lighten and resize large images during upload.  
Formats are automatically converted into `webp` to be more light and _web proof_ and the sizes are decreased if the image is larger than the maximum preset limits.  
That can be a helpful tool to optimize server space.

This extension works out of the box without the need of settings, anyway you can tune it properly with the following environment variables.

## Settings
The extension by default uses three `env` variables:
- `EXTENSIONS_IMAGE_UPLOAD_RESIZER_QUALITY = 73`
- `EXTENSIONS_IMAGE_UPLOAD_RESIZER_MAXSIZE = 1920`
- `EXTENSIONS_IMAGE_UPLOAD_RESIZER_KEEP_METADATA = false`
which respectively set the quality, the maximum size and the keeping of metadata [^1] (EXIF/GPS) about the new converted images.  

Directus also uses the following [env variables to manage images](https://directus.com/docs/configuration/files):
- `ASSETS_TRANSFORM_IMAGE_MAX_DIMENSION = 6000`
	The max pixel dimensions size (width/height) that is allowed to be transformed. [^2]
`- ASSETS_TRANSFORM_TIMEOUT = 7500ms`
	Max time spent trying to transform an asset. [^2]

If you consider working with particularly large images (professional photography, high-resolution scans), I recommend increasing `ASSETS_TRANSFORM_IMAGE_MAX_DIMENSION` and adjusting `ASSETS_TRANSFORM_TIMEOUT` accordingly; otherwise, those files will simply be discarded by the hook (safely, but still not converted).  
Keep in mind that setting this values too high increases the risk of high memory and CPU usage for particularly large images.  
Read more [here](https://directus.com/docs/configuration/files).

To customize the previous values, you have to add/set these `env` variables on your Directus instance (and then restart it).


## Notes
- This extension actually resizes and converts images from the following formats only: _jpeg_, _png_, _webp_, _tiff_, _heic_, _heif_.
- The code was heavily rewritten to fix crashing bugs during upload and to improve performances.
- The actual version is tested working with Directus 12.

## HEIC/HEIF support (new feature)
iPhone photos (`.heic`) are HEVC-encoded: Directus refuses to transform them (they are not in its internal `SUPPORTED_IMAGE_TRANSFORM_FORMATS` whitelist) and the prebuilt sharp/libvips cannot decode HEVC either (AV1-only build, patent reasons). This extension therefore:

1. fetches the original file untouched via `AssetsService` (storage-agnostic);
2. decodes it with [heic-decode](https://www.npmjs.com/package/heic-decode) (libheif compiled to WASM, bundled into `dist/index.js` — no server changes needed);
3. resizes and encodes to WebP with the sharp instance already installed by Directus (marked as external in `extension.config.js`).

Caveats:
[^1] `EXTENSIONS_IMAGE_UPLOAD_RESIZER_KEEP_METADATA` has no effect on HEIC sources: the WASM decoder outputs raw pixels, so EXIF/GPS metadata cannot be carried over. Orientation is preserved (libheif applies it during decode).
[^2] `ASSETS_TRANSFORM_IMAGE_MAX_DIMENSION` and `ASSETS_TRANSFORM_TIMEOUT` do NOT apply to the HEIC path (it bypasses Directus' transform pipeline); decoding a 12 MP HEIC to raw RGBA takes ~50 MB of RAM for a short time.

## Credits
To [Christian Fuss](https://github.com/directus/directus/discussions/8704#discussioncomment-2820302)
