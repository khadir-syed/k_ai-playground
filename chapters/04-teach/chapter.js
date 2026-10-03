// Bonus 1 — You can teach an AI. Sort examples into two groups; it learns each group's "middle"
// and guesses new sentences by which middle they're closer to.
import { h } from '../../engine/dom.js';
import { mean, nearestGroup } from '../../engine/math.js';
import { embed } from '../../engine/ai.js';
import { loadEmbedder, isReady } from '../../engine/runtime.js';
import { countEvent } from '../../engine/analytics.js';

export const LABEL = { food: '🍕 Food', tech: '💻 Tech' };
const ICON = { food: '🍕', tech: '💻' };
const MIN_EACH = 2;
const MAX_NAME = 20, MAX_TEXT = 120, MAX_EXAMPLES = 8;

export default {
  short: 'Teach',
  icon: '🧠',
  python: '04_teach.py', // its twin in python/
  blurb: 'Sort examples, and the AI learns the pattern.',
  title: 'You can teach an AI',
  mount(root, { state }) {
    countEvent('bonus-teach');
    const { groups, train, test } = state.story.teach;
    const sorted = new Map(); // card index → group the visitor chose
    const status = h('p', { class: 'muted', 'aria-live': 'polite' });
    const cards = h('ul', { class: 'sort-list' });
    const tests = h('div', { class: 'row' });
    const result = h('div', { 'aria-live': 'polite' });

    root.append(
      h('p', { class: 'lead' }, 'How does an AI learn? ', h('strong', {}, 'From examples.'), ' Like teaching a child to sort laundry: show them a few, and they work out the pattern.'),
      h('h3', {}, '1. Sort these for the AI'),
      h('p', { class: 'muted' }, 'Tap 🍕 for food or 💻 for tech.'),
      cards, status,
      h('h3', {}, '2. Now test it'),
      h('p', { class: 'muted' }, 'It has never seen these. Tap one and the AI guesses.'),
      tests, result,
      h('details', {},
        h('summary', {}, 'How did it decide?'),
        h('p', {}, 'Every example turned into meaning-numbers, like the stars in chapter 2. The AI found the middle of each group. A new sentence goes to whichever middle it’s closer to. That’s all “learning” means here.')),
      h('details', {},
        h('summary', {}, 'Why does it get some wrong?'),
        h('p', {}, 'It only knows the examples you gave it. “Cookies” are a snack, but also a website thing, and none of your examples were about websites. Try it: put a card in the wrong group on purpose, then test again. Teach it badly, and it learns badly. Big AIs work the same way.')),
      ...(state.plan ? [ownGroups(state)] : []),
    );

    function renderSort() {
      cards.replaceChildren(...train.map((card, i) => h('li', { class: 'sort-card' },
        h('span', {}, card.text),
        h('div', { class: 'row' }, groups.map((g) => h('button', {
          class: 'toggle', 'aria-pressed': String(sorted.get(i) === g), 'aria-label': `${card.text}: ${g}`,
          onclick: () => { sorted.set(i, g); renderSort(); },
        }, ICON[g]))))));
      const counts = groups.map((g) => [...sorted.values()].filter((v) => v === g).length);
      const ready = counts.every((n) => n >= MIN_EACH);
      status.textContent = ready
        ? `Sorted ${sorted.size} of ${train.length}. Ready to test.`
        : `Sorted ${sorted.size} of ${train.length}. Put at least ${MIN_EACH} in each group.`;
      tests.replaceChildren(...test.map((card) => h('button', { class: 'chip', disabled: !ready, onclick: () => guess(card) }, card.text)));
    }

    function guess(card) {
      const centroids = Object.fromEntries(groups.map((g) => [g, mean(train.filter((_, i) => sorted.get(i) === g).map((c) => c.embedding))]));
      const verdict = nearestGroup(card.embedding, centroids);
      const right = verdict.ranked[0].name === card.group;
      state.journey.taught = { test: card.text, guess: verdict.ranked[0].name };
      result.replaceChildren(showVerdict(card.text, verdict, (n) => LABEL[n]),
        h('p', {}, right ? '✅ Right!' : '❌ Wrong. It only knows what your examples taught it.'));
    }

    renderSort();
  },
};

// Bars show closeness on a fixed scale (0.5 similarity fills the bar), so "far from both" looks
// short. No numbers on screen: they'd read as "% sure", which they aren't (see docs/DESIGN.md).
const FULL_BAR = 0.5;
export function showVerdict(text, { ranked, closeCall, far }, label) {
  return h('div', { class: 'notice' },
    h('p', {}, `“${text}”`),
    h('p', {}, h('strong', {}, `The AI says: ${label(ranked[0].name)}`), far ? ' (a wild guess: it isn’t close to either group)' : closeCall ? ' (a close call)' : ' (a clear call)'),
    h('ol', { class: 'bars', 'aria-label': 'How close the sentence is to each group' },
      ranked.map((r) => h('li', {}, h('div', { class: 'bar' },
        h('span', { class: 'bar-fill', style: { width: `${Math.min(1, Math.max(0, r.sim) / FULL_BAR) * 100}%` } }),
        h('span', { class: 'bar-text' }, label(r.name)),
        h('span', { class: 'bar-pct' }, r === ranked[0] ? 'closer' : ''))))));
}

// Part 3, Local tier only: the visitor names the groups and writes the examples.
function ownGroups(state) {
  const box = h('section', {});
  const field = (placeholder) => h('input', { type: 'text', maxlength: String(MAX_NAME), placeholder, autocomplete: 'off', 'aria-label': placeholder });
  const area = (label) => h('textarea', { rows: '4', maxlength: String(MAX_EXAMPLES * (MAX_TEXT + 1)), placeholder: 'Examples, one per line (at least 2)', 'aria-label': label });
  const names = [field('Group A name, e.g. Cats'), field('Group B name, e.g. Cars')];
  const examples = [area('Group A examples'), area('Group B examples')];
  const msg = h('p', { 'aria-live': 'polite' });
  const testInput = h('input', { type: 'text', maxlength: String(MAX_TEXT), placeholder: 'A new sentence to test', autocomplete: 'off', 'aria-label': 'Test sentence' });
  const testRow = h('form', { class: 'row own', hidden: true, onsubmit: (e) => { e.preventDefault(); guessOwn(); } },
    testInput, h('button', { class: 'primary', type: 'submit' }, 'Guess'));
  const result = h('div', { 'aria-live': 'polite' });
  let extractor = null, centroids = null, counted = false;

  const form = h('form', { class: 'teach-own', onsubmit: (e) => { e.preventDefault(); teach(); } },
    names[0], examples[0], names[1], examples[1],
    h('button', { class: 'primary', type: 'submit' }, '🧠 Teach it'));

  box.append(
    h('h3', {}, '3. Teach it your own groups'),
    h('p', { class: 'muted' }, 'Any two things: cats and cars, happy and sad, your two favourite bands. It runs on your device. Nothing you type leaves it.'));
  if (isReady('embed')) box.append(form);
  else {
    const go = h('button', { class: 'ghost', onclick: async () => {
      const bar = h('progress', { max: '1', value: '0' });
      go.replaceWith(bar);
      try {
        await loadEmbedder((p) => (bar.value = p));
        bar.replaceWith(form);
      } catch (err) {
        console.error(err);
        bar.replaceWith(h('p', {}, 'The download didn’t work. Parts 1 and 2 still work.'));
      }
    } }, `✏️ Use my own groups (~${state.plan.embedMB} MB, once)`);
    box.append(go);
  }
  box.append(msg, testRow, result);

  async function teach() {
    const labels = names.map((n) => n.value.trim().slice(0, MAX_NAME));
    const lists = examples.map((a) => a.value.split('\n').map((l) => l.trim().slice(0, MAX_TEXT)).filter(Boolean).slice(0, MAX_EXAMPLES));
    if (labels.some((l) => !l) || labels[0].toLowerCase() === labels[1].toLowerCase()) return (msg.textContent = 'Give the two groups two different names.');
    if (lists.some((l) => l.length < MIN_EACH)) return (msg.textContent = `Write at least ${MIN_EACH} examples for each group, one per line.`);
    msg.textContent = 'Learning…';
    try {
      extractor ??= await loadEmbedder();
      const vectors = await Promise.all(lists.map((l) => embed(extractor, l)));
      centroids = Object.fromEntries(labels.map((l, i) => [l, mean(vectors[i])]));
      msg.textContent = `Learned “${labels[0]}” from ${lists[0].length} examples and “${labels[1]}” from ${lists[1].length}. Now test it:`;
      testRow.hidden = false;
      testInput.focus();
      if (!counted) countEvent('bonus-teach-own'), (counted = true);
    } catch (err) {
      console.error(err);
      msg.textContent = 'Something went wrong while learning. Try again.';
    }
  }

  async function guessOwn() {
    const text = testInput.value.trim().slice(0, MAX_TEXT);
    if (!text || !centroids) return;
    const [v] = await embed(extractor, [text]);
    const verdict = nearestGroup(v, centroids);
    state.journey.taught = { test: text, guess: verdict.ranked[0].name };
    result.replaceChildren(showVerdict(text, verdict, (n) => n));
  }

  return box;
}
