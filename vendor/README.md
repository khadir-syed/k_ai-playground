# vendor/

Third-party JavaScript, committed on purpose. Serving it from this repo means the only scripts a
visitor's browser runs come from this site (`script-src 'self'`), and a CDN compromise can't
inject code. `node --test tests/` fails if any file here changes without this table changing too.

| File | From | SHA-256 |
|---|---|---|
| `transformers.min.js` | `@huggingface/transformers@4.3.0` → `dist/transformers.min.js` | `b36c6c4e8e0e4ab6288cf9e96825b9747a43eadd75bd08c3dcc76705deb72c49` |
| `ort-wasm-simd-threaded.mjs` | `onnxruntime-web@1.31.0-dev.20260914-8d85527a0` → `dist/` | `c57ca56328877353a575e51bbca6f18450027d6c9bf2307a2cb2c41363b4de9f` |
| `ort-wasm-simd-threaded.asyncify.mjs` | `onnxruntime-web@1.31.0-dev.20260914-8d85527a0` → `dist/` | `0966b6105cd936744498aa60df7a22cbd47af3374dbc64a9ab561c08a71e3611` |

The matching `.wasm` binaries (14 MB without WebGPU, 27 MB with) are too big to commit. They load
from `https://cdn.jsdelivr.net/npm/onnxruntime-web@<exact version>/dist/`, pinned in
[`engine/runtime.js`](../engine/runtime.js) as `ORT_VERSION`. WebAssembly can only call the
functions the vendored `.mjs` hands it, so it can't run arbitrary script.

## Why the `transformers.min.js` build

`transformers.web.min.js` is smaller but expects a bundler (it imports `onnxruntime-web/webgpu`
by bare name, which browsers can't resolve). `transformers.min.js` has ONNX Runtime's JavaScript
bundled inside, so it runs as a plain ES module with no build step.

## Upgrading

1. `npm pack @huggingface/transformers@<new>` and take `dist/transformers.min.js`.
2. Find the ONNX Runtime version it was built for: search the file for `1.xx.x-dev…` next to
   `versions.web`. Set `ORT_VERSION` in `engine/runtime.js` to it.
3. `npm pack onnxruntime-web@<that version>` and take the two `ort-wasm-simd-threaded*.mjs` files.
4. `shasum -a 256 vendor/*.js vendor/*.mjs` and update the table above.
5. Bump the version in `tools/package.json`, re-record replays (`cd tools && npm run record`),
   run `node --test tests/`, and test every tier in a browser at phone and laptop width.
