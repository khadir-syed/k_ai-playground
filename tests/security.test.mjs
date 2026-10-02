// Security rules from SECURITY_CHECKLIST.md that a machine can check.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const root = new URL('../', import.meta.url);
const read = (p) => readFile(new URL(p, root), 'utf8');

async function files(dir, ext) {
  const out = [];
  for (const e of await readdir(new URL(dir, root), { withFileTypes: true })) {
    const p = `${dir}${e.name}`;
    if (e.isDirectory() && !['vendor', 'tools', 'tests', 'node_modules', '.git'].includes(e.name)) out.push(...await files(`${p}/`, ext));
    else if (p.endsWith(ext)) out.push(p);
  }
  return out;
}

const CSP = "default-src 'none'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self'; img-src 'self' data:; connect-src 'self' https://cdn.jsdelivr.net https://huggingface.co https://*.hf.co; worker-src 'self'; base-uri 'none'; form-action 'none'";

test('every page has the strict CSP and no inline scripts or handlers', async () => {
  for (const page of await files('', '.html')) {
    const html = await read(page);
    assert.ok(html.includes(`content="${CSP}"`), `${page}: CSP missing or changed`);
    assert.doesNotMatch(html, /<script(?![^>]*\bsrc=)[^>]*>/, `${page}: inline <script>`);
    assert.doesNotMatch(html, /\son[a-z]+=/i, `${page}: inline event handler`);
  }
});

test('site code never writes HTML or evaluates strings', async () => {
  for (const file of await files('', '.js')) {
    const code = await read(file);
    assert.doesNotMatch(code, /innerHTML|outerHTML|insertAdjacentHTML|document\.write|\beval\(|new Function/, file);
  }
});

test('site code never stores anything in the browser', async () => {
  for (const file of await files('', '.js')) {
    assert.doesNotMatch(await read(file), /localStorage|sessionStorage|indexedDB|document\.cookie/, file);
  }
});

test('vendored files match the hashes in vendor/README.md', async () => {
  const readme = await read('vendor/README.md');
  const rows = [...readme.matchAll(/`([\w.-]+\.m?js)`\s*\|[^|]*\|\s*`([0-9a-f]{64})`/g)];
  const vendored = (await readdir(new URL('vendor/', root))).filter((f) => /\.m?js$/.test(f));
  assert.deepEqual(rows.map((r) => r[1]).sort(), vendored.sort(), 'every vendored file listed');
  for (const [, name, sha] of rows) {
    const actual = createHash('sha256').update(await readFile(new URL(`vendor/${name}`, root))).digest('hex');
    assert.equal(actual, sha, name);
  }
});

test('vendored transformers.js was built for the pinned ONNX Runtime', async () => {
  const { ORT_VERSION } = await import('../engine/runtime.js');
  assert.ok((await read('vendor/transformers.min.js')).includes(`"${ORT_VERSION}"`));
});
