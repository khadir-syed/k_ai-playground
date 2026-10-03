// The Replay tier depends on replays/story.json being complete and consistent.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { MODELS } from '../engine/ai.js';

const story = JSON.parse(await readFile(new URL('../replays/story.json', import.meta.url), 'utf8'));

test('replay was recorded with the pinned models', () => {
  assert.deepEqual(story.models, MODELS);
});

test('every preset has tokens, a meaning vector and a recorded reply', () => {
  assert.ok(story.presets.length >= 3);
  for (const p of story.presets) {
    assert.equal(p.tokens.map((t) => t.text).join(''), p.text, `tokens rebuild "${p.text}"`);
    assert.equal(p.embedding.length, 384);
    assert.ok(p.theater.steps.length > 3);
    for (const s of p.theater.steps) {
      assert.equal(s.options.length, 10);
      assert.equal(s.picked, s.options[0].id, 'greedy run always picks the top option');
      const logits = s.options.map((o) => o.logit);
      assert.deepEqual(logits, [...logits].sort((a, b) => b - a), 'options sorted by score');
    }
  }
});

test('galaxy stars cover every family with real vectors', () => {
  const groups = new Set(story.stars.map((s) => s.group));
  assert.equal(groups.size, 6);
  for (const s of story.stars) assert.equal(s.embedding.length, 384);
});

test('teach cards: both groups in train and test, with real vectors', () => {
  const { groups, train, test: tests } = story.teach;
  assert.deepEqual(groups, ['food', 'tech']);
  for (const list of [train, tests]) {
    for (const g of groups) assert.ok(list.filter((c) => c.group === g).length >= 2, g);
    for (const c of list) assert.equal(c.embedding.length, 384);
  }
});
