# Image Upload Resizer

A Directus extension that automatically compresses and resizes large images during upload.

By default, images are converted to AVIF to reduce their file size and make them more suitable for the web. Images whose width or height exceeds the configured limit are automatically resized.

This extension can help reduce storage usage and optimize images for web delivery.

It works out of the box without requiring any configuration. However, you can customize its behavior using the following environment variables.

## Settings

By default, the extension uses the following environment variables:

- `EXTENSIONS_IMAGE_UPLOAD_RESIZER_FORMAT = avif`
- `EXTENSIONS_IMAGE_UPLOAD_RESIZER_QUALITY_AVIF = 44`
- `EXTENSIONS_IMAGE_UPLOAD_RESIZER_QUALITY_WEBP = 73`
- `EXTENSIONS_IMAGE_UPLOAD_RESIZER_MAXSIZE = 1920`
- `EXTENSIONS_IMAGE_UPLOAD_RESIZER_KEEP_METADATA = false`
- `EXTENSIONS_IMAGE_UPLOAD_RESIZER_SKIP_SMALL_IMAGES = false`

These variables respectively control:

- the output format;
- the quality of AVIF output files;
- the quality of WebP output files;
- the maximum width or height, in pixels;
- whether metadata* such as EXIF and GPS information should be preserved in the converted images.
- whether images that are already below the maximum dimensions (width and height) will be left unchanged (no format conversion or resizing).

The deprecated `EXTENSIONS_IMAGE_UPLOAD_RESIZER_QUALITY` variable remains supported for backward compatibility and continues to control the quality of WebP output files. New configurations should use `EXTENSIONS_IMAGE_UPLOAD_RESIZER_QUALITY_WEBP` instead.

\* Metadata cannot be preserved when converting HEIC/HEIF source files. See the “Notes and caveats” section below.

Directus also provides the following [environment variables for managing image transformations](https://directus.com/docs/configuration/files):

- `ASSETS_TRANSFORM_IMAGE_MAX_DIMENSION = 6000`  
	The maximum width or height, in pixels, of an image that Directus is allowed to transform.*

- `ASSETS_TRANSFORM_TIMEOUT = 7500ms`  
	The maximum amount of time Directus may spend transforming an asset.*

\* These variables do not apply to HEIC/HEIF source files. See the “Notes and caveats” section below.

If you plan to process particularly large images, such as professional photographs or high-resolution scans, consider increasing `ASSETS_TRANSFORM_IMAGE_MAX_DIMENSION` and adjusting `ASSETS_TRANSFORM_TIMEOUT` accordingly. Otherwise, files exceeding these limits will be safely skipped by the hook and left unchanged.

Keep in mind that setting these values too high may result in increased memory and CPU usage when processing very large images.

Read more in the [Directus file configuration documentation](https://directus.com/docs/configuration/files).

To customize these values, add or update the corresponding environment variables in your Directus instance, and then restart Directus.

## AVIF support

_New feature since v2.2.0._

Support for AVIF input and output has been added. The default output format has been changed from WebP to AVIF because AVIF generally provides better image compression.

To customize AVIF image quality, set the `EXTENSIONS_IMAGE_UPLOAD_RESIZER_QUALITY_AVIF` environment variable. Its default value is `44`.

WebP output quality is controlled by `EXTENSIONS_IMAGE_UPLOAD_RESIZER_QUALITY_WEBP`, whose default value is `73`. Separate variables are used because AVIF and WebP quality values do not produce directly comparable results.

The former `EXTENSIONS_IMAGE_UPLOAD_RESIZER_QUALITY` variable is deprecated but remains supported for backward compatibility to control WebP quality. Existing installations can therefore continue to use it, but migrating to `EXTENSIONS_IMAGE_UPLOAD_RESIZER_QUALITY_WEBP` is recommended.

To retain the previous WebP output behavior, set:

```env
EXTENSIONS_IMAGE_UPLOAD_RESIZER_FORMAT=webp
```

## HEIC/HEIF support

_New feature since v2.1.0._

iPhone photos stored as HEIC/HEIF files are usually HEVC-encoded. Directus refuses to transform them because these formats are not included in its internal `SUPPORTED_IMAGE_TRANSFORM_FORMATS` allowlist. In addition, the prebuilt Sharp/libvips package cannot decode HEVC because it is built without HEVC support, mainly due to patent and licensing restrictions.

This extension therefore:

1. retrieves the original file unchanged through `AssetsService`, independently of the configured storage adapter;
2. decodes it using [heic-decode](https://www.npmjs.com/package/heic-decode), which uses a WebAssembly build of libheif bundled into `dist/index.js`, requiring no server-side changes;
3. resizes the decoded image and encodes it in the configured output format using the Sharp instance already installed by Directus and marked as external in `extension.config.js`.

## Notes and caveats

- The extension resizes and converts only the following image formats: JPEG, PNG, WebP, AVIF, TIFF, HEIC, and HEIF.
- The code has been extensively rewritten to prevent crashes during uploads and improve performance.
- The current version has been tested with Directus 12.
- `EXTENSIONS_IMAGE_UPLOAD_RESIZER_KEEP_METADATA` has no effect on HEIC/HEIF source files. The WebAssembly decoder outputs raw pixels, so EXIF and GPS metadata cannot be preserved. Image orientation is preserved because libheif applies it during decoding.
- `ASSETS_TRANSFORM_IMAGE_MAX_DIMENSION` and `ASSETS_TRANSFORM_TIMEOUT` do not apply to HEIC/HEIF source files because this processing path bypasses the Directus image transformation pipeline.
- Decoding a 12-megapixel HEIC image to raw RGBA data temporarily requires approximately 50 MB of memory.

## Credits

Thanks to [Christian Fuss](https://github.com/directus/directus/discussions/8704#discussioncomment-2820302).
