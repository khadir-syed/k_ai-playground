// Small, dependency-free math the chapters (and later Jarvis) share.
// Everything here is pure and runs in both the browser and Node, so tests/ can check it offline.

// Turn raw model scores (logits) into probabilities that add up to 1.
// Temperature < 1 sharpens the odds (safer, more boring); > 1 flattens them (more surprising).
export function softmax(logits, temperature = 1) {
  const t = Math.max(temperature, 0.01);
  let max = -Infinity;
  for (const l of logits) if (l > max) max = l;
  const exps = Array.from(logits, (l) => Math.exp((l - max) / t));
  const sum = exps.reduce((a, b) => a + b, 0);
  return exps.map((e) => e / sum);
}

// Indices of the k largest values, biggest first. One pass, fine for a 50k-word vocabulary and small k.
export function topK(values, k) {
  const best = []; // [index, value], kept sorted descending
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    if (best.length === k && v <= best[k - 1][1]) continue;
    let j = best.length < k ? best.length : k - 1;
    while (j > 0 && best[j - 1][1] < v) { best[j] = best[j - 1]; j--; }
    best[j] = [i, v];
  }
  return best.map(([i]) => i);
}

// Pick an index at random, weighted by probs. `rand` is injectable so tests are repeatable.
export function sample(probs, rand = Math.random) {
  let r = rand();
  for (let i = 0; i < probs.length; i++) {
    r -= probs[i];
    if (r <= 0) return i;
  }
  return probs.length - 1;
}

// How similar two meaning-vectors are: 1 = same direction, 0 = unrelated.
export function cosine(a, b) {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  return dot / (Math.sqrt(na * nb) || 1);
}

// Squash 384-dimension meaning-vectors down to a few dimensions we can draw, keeping as much spread as possible.
// PCA by power iteration with deflation: plenty for ~50 points, and readable.
export function pca(vectors, dims = 3, iterations = 100) {
  const d = vectors[0].length;
  const mean = new Array(d).fill(0);
  for (const v of vectors) for (let i = 0; i < d; i++) mean[i] += v[i] / vectors.length;
  let rows = vectors.map((v) => v.map((x, i) => x - mean[i]));
  const components = [];
  for (let c = 0; c < dims; c++) {
    let dir = Array.from({ length: d }, (_, i) => Math.sin(i + 1 + c)); // fixed start: same input, same picture
    for (let it = 0; it < iterations; it++) {
      const scores = rows.map((r) => dot(r, dir));
      const next = new Array(d).fill(0);
      rows.forEach((r, n) => { for (let i = 0; i < d; i++) next[i] += r[i] * scores[n]; });
      dir = normalize(next);
    }
    // Fix the sign so the map never flips between runs.
    const biggest = dir.reduce((m, x) => (Math.abs(x) > Math.abs(m) ? x : m), 0);
    if (biggest < 0) dir = dir.map((x) => -x);
    components.push(dir);
    rows = rows.map((r) => { const s = dot(r, dir); return r.map((x, i) => x - s * dir[i]); });
  }
  return { mean, components };
}

export function project(vector, { mean, components }) {
  const centered = vector.map((x, i) => x - mean[i]);
  return components.map((c) => dot(centered, c));
}

// Some devices hand back half-precision numbers as raw 16-bit integers. Convert one to a normal number.
export function halfToFloat(h) {
  const sign = h & 0x8000 ? -1 : 1;
  const exp = (h >> 10) & 0x1f;
  const frac = h & 0x3ff;
  if (exp === 0) return sign * 2 ** -14 * (frac / 1024);
  if (exp === 31) return frac ? NaN : sign * Infinity;
  return sign * 2 ** (exp - 15) * (1 + frac / 1024);
}

function dot(a, b) {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

function normalize(v) {
  const n = Math.sqrt(dot(v, v)) || 1;
  return v.map((x) => x / n);
}
