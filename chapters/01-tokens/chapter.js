// Chapter 1 — AI doesn't read words. It reads numbered pieces called tokens.
import { h, showToken } from '../../engine/dom.js';
import { tokenize } from '../../engine/ai.js';
import { loadTokenizer } from '../../engine/runtime.js';

export default {
  short: 'Tokens',
  icon: '🧩',
  blurb: 'Your sentence, chopped into numbered pieces.',
  title: 'AI doesn’t read words',
  mount(root, { state }) {
    let asNumbers = false;
    const chips = h('div', { class: 'tokens', 'aria-live': 'polite' });
    const toggle = h('button', { class: 'primary', 'aria-pressed': 'false', onclick: flip }, '👀 See what the AI sees');
    const count = h('p', { class: 'big-number' });

    root.append(
      h('p', { class: 'lead' }, 'Before an AI can do anything with your sentence, it chops it into small pieces called ', h('strong', {}, 'tokens'), '. Each piece has a number. The AI only ever sees the numbers.'),
      h('p', { class: 'quote' }, `“${state.sentence}”`),
      chips, count, toggle,
      h('details', {},
        h('summary', {}, 'Why do some pieces start with ␣?'),
        h('p', {}, 'The ␣ is a space. This AI glues the space onto the front of the next word, so “ rain” and “rain” are two different tokens with two different numbers. Long or rare words get split into several pieces; common words are usually one piece.')),
    );

    const tokensPromise = state.preset
      ? Promise.resolve(state.preset.tokens)
      : loadTokenizer().then((tok) => tokenize(tok, state.sentence));
    let list = [];
    tokensPromise.then((t) => { list = t; state.journey.tokens = t; render(); }, (err) => {
      console.error(err);
      chips.replaceChildren(h('p', {}, 'Couldn’t load the tokenizer. Go back and pick a ready-made sentence.'));
    });

    function render() {
      chips.replaceChildren(...list.map((t, i) => h('span', { class: `token c${i % 6}`, title: `token #${t.id}` },
        asNumbers ? String(t.id) : showToken(t.text))));
      count.replaceChildren(h('strong', {}, String(list.length)), ` tokens · ${state.sentence.length} letters`);
    }

    function flip() {
      asNumbers = !asNumbers;
      toggle.setAttribute('aria-pressed', String(asNumbers));
      toggle.textContent = asNumbers ? '🔤 Back to human view' : '👀 See what the AI sees';
      render();
    }
  },
};
