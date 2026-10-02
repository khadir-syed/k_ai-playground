// What the chapters ask a model to do. Each function takes the already-loaded pieces as arguments,
// so the same code runs in the browser (Local tier) and in Node (tools/record-replays.mjs).
import { halfToFloat, topK } from './math.js';

// Exact models, pinned to a Hugging Face commit so a silent upstream change can't alter what visitors see.
export const MODELS = {
  embed: { id: 'Xenova/all-MiniLM-L6-v2', revision: '751bff37182d3f1213fa05d7196b954e230abad9' },
  lm: { id: 'HuggingFaceTB/SmolLM2-135M-Instruct', revision: '12fd25f77366fa6b3b4b768ec3050bf629380bac' },
};

// Chapter 1: how the model chops a sentence into pieces (tokens) and the numbers it actually sees.
export function tokenize(tokenizer, text) {
  const ids = tokenizer.encode(text, { add_special_tokens: false });
  return ids.map((id) => ({ id, text: tokenizer.decode([id]) }));
}

// Chapter 2: a sentence's meaning as 384 numbers (normalised, so cosine = dot product).
export async function embed(extractor, texts) {
  const out = await extractor(texts, { pooling: 'mean', normalize: true });
  return out.tolist().map((row) => row.map((x) => round(x, 4)));
}

// Chapter 3: the prompt the small chat model sees, as token ids.
export function chatPromptIds(tokenizer, sentence) {
  return tokenizer.apply_chat_template([{ role: 'user', content: sentence }], {
    add_generation_prompt: true,
    tokenize: true,
    return_tensor: false,
  }).input_ids;
}

// Chapter 3: the model's top-k guesses for the very next token, with raw scores (logits).
// No KV-cache: each step re-reads the whole text. Slower, but it is exactly what the chapter explains.
// ponytail: O(n²) over generated length; add past_key_values if replies ever exceed ~60 tokens.
export async function nextTokenOdds({ tokenizer, model, Tensor }, ids, k = 10) {
  const n = ids.length;
  const input_ids = new Tensor('int64', BigInt64Array.from(ids, BigInt), [1, n]);
  const attention_mask = new Tensor('int64', new BigInt64Array(n).fill(1n), [1, n]);
  const { logits } = await model({ input_ids, attention_mask });
  const vocab = logits.dims.at(-1);
  const raw = logits.data.subarray((n - 1) * vocab, n * vocab);
  const last = raw instanceof Uint16Array ? Float32Array.from(raw, halfToFloat) : Float32Array.from(raw);
  return topK(last, k).map((id) => ({ id, text: tokenizer.decode([id]), logit: round(last[id], 3) }));
}

export function isEndToken(tokenizer, id) {
  return id === tokenizer.eos_token_id;
}

function round(x, places) {
  const f = 10 ** places;
  return Math.round(x * f) / f;
}
