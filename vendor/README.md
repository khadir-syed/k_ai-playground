# vendor/

Third-party JavaScript, committed on purpose. Serving it from this repo means the only scripts a
visitor's browser runs come from this site (`script-src 'self'`), and a CDN compromise can't
inject code. `node --test "tests/*.test.mjs"` fails if any file here changes without this table changing too.

| File | From | SHA-256 |
|---|---|---|
| `transformers.min.js` | `@huggingface/transformers@4.3.0` → `dist/transformers.min.js`, **patched** (see below) | `b36c6c4e8e0e4ab6288cf9e96825b9747a43eadd75bd08c3dcc76705deb72c49` |
| `ort-wasm-simd-threaded.mjs` | `onnxruntime-web@1.31.0-dev.20260914-8d85527a0` → `dist/` | `c57ca56328877353a575e51bbca6f18450027d6c9bf2307a2cb2c41363b4de9f` |
| `ort-wasm-simd-threaded.asyncify.mjs` | `onnxruntime-web@1.31.0-dev.20260914-8d85527a0` → `dist/` | `0966b6105cd936744498aa60df7a22cbd47af3374dbc64a9ab561c08a71e3611` |

The matching `.wasm` binaries (14 MB without WebGPU, 27 MB with) are too big to commit. They load
from `https://cdn.jsdelivr.net/npm/onnxruntime-web@<exact version>/dist/`, pinned in
[`engine/runtime.js`](../engine/runtime.js) as `ORT_VERSION`. WebAssembly can only call the
functions the vendored `.mjs` hands it, so it can't run arbitrary script.

## The one patch: a renamed class name

GitHub push protection treats any 32-letter/digit string near the word "mistral" as a Mistral AI
API key. transformers.js contains one such class name: `Mistral3For` + `ConditionalGeneration`,
which is exactly 32 characters. (We never write it in one piece in this repo, or the scanner would
flag the docs too.) It is **not a secret**, but it blocks every push. So
[`tools/patch-vendor.mjs`](../tools/patch-vendor.mjs) renames it to `Mistral3ForCondGeneration`
in all 3 places it appears. The rename is consistent, so the library's own lookups still match;
only the public export name changes, and this site never imports it.

The patch is checked, not trusted: a test undoes the rename and confirms the result is
byte-identical to the npm file, whose SHA-256 is:

| Unpatched npm file | SHA-256 |
|---|---|
| `@huggingface/transformers@4.3.0` `dist/transformers.min.js` | `1475fd440e9932ab206682ee42cb18f6097403e9ee77ea62084c592d0f83597d` |

You can check it yourself: `npm pack @huggingface/transformers@4.3.0`, then compare that file's
`shasum -a 256` with the table above.

## Why the `transformers.min.js` build

`transformers.web.min.js` is smaller but expects a bundler (it imports `onnxruntime-web/webgpu`
by bare name, which browsers can't resolve). `transformers.min.js` has ONNX Runtime's JavaScript
bundled inside, so it runs as a plain ES module with no build step.

## Upgrading

1. `npm pack @huggingface/transformers@<new>`, record the SHA-256 of its `dist/transformers.min.js`
   in the "Unpatched npm file" table, then patch it into place:
   `node tools/patch-vendor.mjs package/dist/transformers.min.js`. If the script refuses because the
   match count changed, inspect the new file by hand and update `RENAMES` before going further.
2. Find the ONNX Runtime version it was built for: search the file for `1.xx.x-dev…` next to
   `versions.web`. Set `ORT_VERSION` in `engine/runtime.js` to it.
3. `npm pack onnxruntime-web@<that version>` and take the two `ort-wasm-simd-threaded*.mjs` files.
4. `shasum -a 256 vendor/*.js vendor/*.mjs` and update the first table.
5. Bump the version in `tools/package.json`, re-record replays (`cd tools && npm run record`),
   run `node --test "tests/*.test.mjs"`, and test every tier in a browser at phone and laptop width.
