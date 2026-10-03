// Every chapter module loads (catches syntax errors the browser would hit) and has the shape app.js expects.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir } from 'node:fs/promises';

test('every chapter loads and exports short, title, icon, blurb and mount()', async () => {
  for (const dir of await readdir(new URL('../chapters/', import.meta.url))) {
    const { default: chapter } = await import(`../chapters/${dir}/chapter.js`);
    assert.equal(typeof chapter.short, 'string', dir);
    for (const key of ['title', 'icon', 'blurb']) assert.equal(typeof chapter[key], 'string', `${dir} ${key}`);
    assert.equal(typeof chapter.mount, 'function', dir);
  }
});
