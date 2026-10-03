// Analytics may only ever send a page path or a fixed event name, and only from the live site.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { EVENTS, countURL, isLiveSite } from '../engine/analytics.js';

test('count URL carries only path, event flag and a cache-buster', () => {
  const url = new URL(countURL('k_ai-playground/chapter-1', true));
  assert.equal(url.origin, 'https://khadir-syed.goatcounter.com');
  assert.deepEqual([...url.searchParams.keys()].sort(), ['e', 'p', 'rnd']);
  assert.equal(url.searchParams.get('p'), 'k_ai-playground/chapter-1');
});

test('only the live site counts', () => {
  assert.ok(isLiveSite('khadir-syed.github.io'));
  for (const host of ['localhost', '127.0.0.1', 'github.io.evil.example']) assert.ok(!isLiveSite(host), host);
});

test('every event the code sends is on the allowed list', async () => {
  const used = new Set();
  const chapterDirs = (await readdir(new URL('../chapters/', import.meta.url))).map((d) => `chapters/${d}/`);
  for (const dir of ['', ...chapterDirs]) {
    for (const f of (await readdir(new URL(`../${dir}`, import.meta.url))).filter((n) => n.endsWith('.js'))) {
      const code = await readFile(new URL(`../${dir}${f}`, import.meta.url), 'utf8');
      for (const [, name] of code.matchAll(/countEvent\('([^']+)'\)/g)) used.add(name);
      if (code.includes('countEvent(`chapter-${index + 1}`)')) {
        const chapters = (code.match(/const CHAPTERS = \[([^\]]+)\]/)?.[1].split(',').length) ?? 0;
        for (let i = 1; i <= chapters; i++) used.add(`chapter-${i}`);
      }
    }
  }
  assert.ok(used.size >= 5);
  for (const name of used) assert.ok(EVENTS.has(name), `${name} missing from EVENTS`);
});
