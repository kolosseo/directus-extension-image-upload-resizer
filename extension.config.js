// 1. Keep `sharp` OUT of the bundle: the extension must use the sharp
//    instance already installed by Directus (native binary, cannot be
//    bundled by Rollup). It is resolved at runtime via dynamic import.
// 2. `heic-decode` / `libheif-js` are pure JS + WASM (base64-embedded)
//    and DO get bundled. The embedded emscripten runtime still
//    references the CJS globals `require`, `__filename` and `__dirname`,
//    which do not exist in the ESM output — the banner below (prepended
//    AFTER minification) provides the standard shims.
const cjsShim = `import { createRequire as __ext_createRequire } from 'node:module';
import { fileURLToPath as __ext_fileURLToPath } from 'node:url';
import { dirname as __ext_dirname } from 'node:path';
const require = __ext_createRequire(import.meta.url);
const __filename = __ext_fileURLToPath(import.meta.url);
const __dirname = __ext_dirname(__filename);`

export default {
	plugins: [
		{
			name: 'external-sharp-and-cjs-shim',
			//options(inputOptions) {
				//const external = Array.isArray(inputOptions.external) ? inputOptions.external : []
				//inputOptions.external = [...external, 'sharp']
			//},
			banner: () => cjsShim
		}
	]
}
