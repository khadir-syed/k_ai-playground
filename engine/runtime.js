// The three runtime tiers. Replay always works; Local runs models in the visitor's browser (opt-in);
// bring-your-own-key arrives with the first chapter that needs a big model.
import { MODELS } from './ai.js';

// The exact ONNX Runtime build the vendored transformers.js was compiled against (see vendor/README.md).
export const ORT_VERSION = '1.31.0-dev.20260914-8d85527a0';

// Approximate first-download sizes in MB, shown to the visitor before anything large is fetched.
const MB = { tokenizer: 2, embed: 23, runtimeGpu: 27, runtimeCpu: 14, lmGpu: 112, lmCpu: 130 };

export async function detect() {
  let webgpu = false;
  try {
    webgpu = !!(navigator.gpu && (await navigator.gpu.requestAdapter()));
  } catch { /* no WebGPU: fine, we use WebAssembly */ }
  return { wasm: typeof WebAssembly === 'object', webgpu };
}

// What Local tier will download on this device. Pure, so tests/ can check it.
export function downloadPlan({ wasm, webgpu }) {
  if (!wasm) return null; // only Replay tier is possible
  const runtime = webgpu ? MB.runtimeGpu : MB.runtimeCpu;
  return {
    starterMB: MB.tokenizer + MB.embed + runtime, // chapters 1–2 with your own sentence
    lmMB: webgpu ? MB.lmGpu : MB.lmCpu,           // chapter 3 live
    lm: webgpu ? { device: 'webgpu', dtype: 'q4f16' } : { device: 'wasm', dtype: 'q8' },
    fast: webgpu,
  };
}

let lib, caps;
const loading = {};

async function library() {
  if (lib) return lib;
  caps ??= await detect();
  const l = await import('../vendor/transformers.min.js');
  const onnx = l.env.backends.onnx;
  if (onnx.versions?.web !== ORT_VERSION) throw new Error(`Unexpected ONNX Runtime ${onnx.versions?.web}`);
  l.env.allowLocalModels = false;
  l.env.useWasmCache = false; // otherwise it turns the runtime into a blob: script, which our CSP forbids
  const variant = caps.webgpu ? '.asyncify' : '';
  onnx.wasm.wasmPaths = {
    mjs: new URL(`../vendor/ort-wasm-simd-threaded${variant}.mjs`, import.meta.url).href,
    wasm: `https://cdn.jsdelivr.net/npm/onnxruntime-web@${ORT_VERSION}/dist/ort-wasm-simd-threaded${variant}.wasm`,
  };
  return (lib = l);
}

// Each loader runs once; later calls get the same promise. `onProgress(0..1)` is optional.
function once(key, load) {
  loading[key] ??= load().catch((err) => { delete loading[key]; throw err; });
  return loading[key];
}

function progressTracker(onProgress) {
  const files = {};
  return (e) => {
    if (e.status !== 'progress' || !e.total) return;
    files[e.file] = [e.loaded, e.total];
    const [done, all] = Object.values(files).reduce(([a, b], [x, y]) => [a + x, b + y], [0, 0]);
    onProgress?.(done / all);
  };
}

export const loadTokenizer = (onProgress) => once('tokenizer', async () => {
  const { AutoTokenizer } = await library();
  return AutoTokenizer.from_pretrained(MODELS.lm.id, { revision: MODELS.lm.revision, progress_callback: progressTracker(onProgress) });
});

export const loadEmbedder = (onProgress) => once('embed', async () => {
  const { pipeline } = await library();
  return pipeline('feature-extraction', MODELS.embed.id, {
    revision: MODELS.embed.revision, dtype: 'q8', device: 'wasm', progress_callback: progressTracker(onProgress),
  });
});

export const loadLM = (onProgress) => once('lm', async () => {
  const l = await library();
  const { device, dtype } = downloadPlan(caps).lm;
  const [tokenizer, model] = await Promise.all([
    loadTokenizer(),
    l.AutoModelForCausalLM.from_pretrained(MODELS.lm.id, {
      revision: MODELS.lm.revision, device, dtype, progress_callback: progressTracker(onProgress),
    }),
  ]);
  return { tokenizer, model, Tensor: l.Tensor };
});

export async function loadReplay() {
  const res = await fetch(new URL('../replays/story.json', import.meta.url));
  if (!res.ok) throw new Error(`replays/story.json: HTTP ${res.status}`);
  return res.json();
}
