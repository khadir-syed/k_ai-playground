// The share card's content: short enough to fit, honest when a chapter didn't finish.
import test from 'node:test';
import assert from 'node:assert/strict';
import { cardContent } from '../engine/sharecard.js';

const tokens = (n) => Array.from({ length: n }, (_, i) => ({ id: i, text: i ? ` w${i}` : 'W0' }));

test('full journey fills every part', () => {
  const c = cardContent('Will it rain tomorrow?', { tokens: tokens(5), neighbour: { text: 'umbrella weather', sim: 0.612 }, reply: ' I  don\'t\nknow.' });
  assert.equal(c.tokenCount, 5);
  assert.deepEqual(c.tokens.slice(0, 2), ['W0', '␣w1']);
  assert.deepEqual(c.neighbour, { text: 'umbrella weather', pct: 61 });
  assert.equal(c.reply, 'I don\'t know.');
});

test('long inputs are clipped, extra tokens summarised', () => {
  const c = cardContent('x'.repeat(200), { tokens: tokens(30), reply: 'y'.repeat(300) });
  assert.equal(c.sentence.length, 90);
  assert.ok(c.sentence.endsWith('…'));
  assert.equal(c.tokens.length, 14);
  assert.equal(c.moreTokens, 16);
  assert.ok(c.reply.length <= 120);
});

test('missing chapters are left off, not faked', () => {
  const c = cardContent('Hello', {});
  assert.deepEqual([c.tokens, c.neighbour, c.reply], [[], null, null]);
});
