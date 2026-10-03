// Offline checks for the shared engine math and runtime rules. Run: node --test tests/
import test from 'node:test';
import assert from 'node:assert/strict';
import { softmax, topK, sample, cosine, mean, nearestGroup, pca, project, halfToFloat } from '../engine/math.js';
import { downloadPlan } from '../engine/runtime.js';

const close = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} ≈ ${b}`);

test('softmax sums to 1 and temperature sharpens or flattens', () => {
  const logits = [3, 1, 0.5];
  close(softmax(logits).reduce((a, b) => a + b), 1);
  assert.ok(softmax(logits, 0.2)[0] > softmax(logits, 1)[0]);
  assert.ok(softmax(logits, 2)[0] < softmax(logits, 1)[0]);
  close(softmax([1000, 1000])[0], 0.5); // no overflow
});

test('topK matches a full sort', () => {
  const values = Float32Array.from({ length: 5000 }, (_, i) => Math.sin(i * 12.9898) * 43758.5453 % 1);
  const expected = [...values.keys()].sort((a, b) => values[b] - values[a]).slice(0, 10);
  assert.deepEqual(topK(values, 10), expected);
  assert.deepEqual(topK([1, 2], 5), [1, 0]);
});

test('sample follows the probabilities', () => {
  assert.equal(sample([0.2, 0.8], () => 0.1), 0);
  assert.equal(sample([0.2, 0.8], () => 0.5), 1);
  assert.equal(sample([0.5, 0.5], () => 0.9999999), 1);
});

test('cosine similarity', () => {
  close(cosine([1, 0], [2, 0]), 1);
  close(cosine([1, 0], [0, 3]), 0);
  close(cosine([1, 0], [-1, 0]), -1);
});

test('mean is the middle of a group', () => {
  assert.deepEqual(mean([[0, 2], [2, 4]]), [1, 3]);
});

test('nearestGroup ranks groups by closeness and flags close calls', () => {
  const g = nearestGroup([1, 0.1], { food: [1, 0], tech: [0, 1] });
  assert.deepEqual(g.ranked.map((r) => r.name), ['food', 'tech']);
  assert.equal(g.closeCall, false);
  assert.equal(nearestGroup([1, 1.01], { food: [1, 0], tech: [0, 1] }).closeCall, true);
  assert.equal(g.far, false);
  assert.equal(nearestGroup([0.05, -1], { food: [1, 0], tech: [0, 1] }).far, true);
});

test('pca finds the direction of most spread, deterministically', () => {
  const pts = [[-3, 0.1, 0], [-1, -0.1, 0], [1, 0.1, 0], [3, -0.1, 0]];
  const basis = pca(pts, 2);
  close(Math.abs(basis.components[0][0]), 1, 1e-3);
  assert.deepEqual(pca(pts, 2), basis);
  const [x] = project([3, -0.1, 0], basis);
  close(Math.abs(x), 3, 1e-2);
});

test('half-precision numbers decode', () => {
  close(halfToFloat(0x3c00), 1);
  close(halfToFloat(0xc000), -2);
  close(halfToFloat(0x3555), 0.333251953125);
  assert.equal(halfToFloat(0x7c00), Infinity);
});

test('download plan: replay only without WebAssembly, bigger runtime with WebGPU', () => {
  assert.equal(downloadPlan({ wasm: false, webgpu: false }), null);
  const gpu = downloadPlan({ wasm: true, webgpu: true });
  const cpu = downloadPlan({ wasm: true, webgpu: false });
  assert.deepEqual(gpu.lm, { device: 'webgpu', dtype: 'q4f16' });
  assert.deepEqual(cpu.lm, { device: 'wasm', dtype: 'q8' });
  assert.ok(gpu.fast && !cpu.fast);
  assert.ok(cpu.embedMB < cpu.starterMB && gpu.embedMB < gpu.starterMB);
});
