# Image Upload Resizer

Directus extension to automatically lighten and resize large images during upload.
Formats are automatically converted into `webp` to be more light and _web proof_ and the sizes are decreased if the image is larger than the maximum preset limits.
That can be a helpful tool to optimize server space.


## Settings
The extension by default uses two `env` variables:
`EXTENSIONS_REDUCE_ON_UPLOAD_QUALITY = 73`
`EXTENSIONS_REDUCE_ON_UPLOAD_MAXSIZE = 1920`
which respectively set the quality and the maximum size of the images.

To customize the values, you have to add/set these `env` variables on your Directus instance (and then restart it).


## Notes
- This extension actually converts from the following formats only: _jpeg_, _png_, _webp_.
- Fixed crashing bugs during upload
- The actual version is tested working with Directus 11.

## Credits
To [Christian Fuss](https://github.com/directus/directus/discussions/8704#discussioncomment-2820302)
