// Chapter 3 — AI is a guessing machine. Watch a reply get built one token at a time, with the odds on screen.
import { h, showToken, prefersReducedMotion } from '../../engine/dom.js';
import { softmax, sample } from '../../engine/math.js';
import { chatPromptIds, nextTokenOdds, isEndToken } from '../../engine/ai.js';
import { loadLM } from '../../engine/runtime.js';
import { countEvent } from '../../engine/analytics.js';

const SHOW = 5;
const MAX_TOKENS = 40;

export default {
  short: 'Guessing',
  icon: '🎲',
  blurb: 'A reply guessed one piece at a time.',
  title: 'AI is a guessing machine',
  mount(root, { state, restartWith }) {
    const replay = state.preset?.theater;
    let lm = null, temperature = 1, busy = false, playing = false, stopped = false;
    let step = 0, ids = [], options = null, done = false;

    const reply = h('p', { class: 'bubble ai', 'aria-live': 'polite' });
    const bars = h('ol', { class: 'bars', 'aria-label': 'The AI’s top guesses for the next token' });
    const tempLabel = h('output', {}, '1.0');
    const slider = h('input', { type: 'range', min: '0.1', max: '2', step: '0.1', value: '1', 'aria-label': 'Temperature',
      oninput: () => { temperature = Number(slider.value); tempLabel.textContent = temperature.toFixed(1); renderBars(); } });
    const nextBtn = h('button', { class: 'primary', onclick: () => commit() }, 'Next token');
    const playBtn = h('button', { class: 'ghost', onclick: togglePlay }, '▶ Play');
    const mode = h('div', { class: 'notice' });

    root.append(
      h('p', { class: 'lead' }, 'Now the AI writes a reply. Here’s the secret: it doesn’t know the answer. At every step it scores every possible next token, then ', h('strong', {}, 'picks one'), '. Then it does it again. And again.'),
      h('p', { class: 'bubble you' }, state.sentence),
      reply,
      h('h3', {}, 'Its top guesses for the next token'),
      h('p', { class: 'fineprint' }, 'Percentages are shares of its 10 favourite guesses. It scored all 49,152 tokens it knows.'),
      bars,
      h('div', { class: 'temp' },
        h('label', {}, 'Temperature ', tempLabel),
        h('div', { class: 'row slider-row' }, h('span', {}, '🧊 calm'), slider, h('span', {}, '🔥 wild'))),
      h('div', { class: 'row controls' }, nextBtn, playBtn, h('button', { class: 'ghost', onclick: restart }, '↺ Restart')),
      mode,
      h('details', {},
        h('summary', {}, 'Why does it repeat itself?'),
        h('p', {}, 'This is a tiny model (135 million numbers inside — big chat AIs have about a thousand times more). If it always takes the tallest bar, it can fall into a loop like “I don’t know. I don’t know.” Temperature adds a little randomness so it can escape. Big AIs do the same thing, they’re just much better at guessing.')),
    );

    function renderMode() {
      if (lm) {
        mode.replaceChildren(h('p', {}, '⚡ Live on your device. Slide the temperature, or tap any bar to choose the next token yourself.'));
      } else if (!state.plan) {
        mode.replaceChildren(h('p', {}, 'This browser can’t run the model live. Try a recorded run instead:'),
          h('div', { class: 'row' }, state.story.presets.map((p) => h('button', { class: 'chip', onclick: () => restartWith(p) }, p.text))));
      } else {
        const go = h('button', { class: replay ? 'ghost' : 'primary', onclick: goLive }, `⚡ Make it live (~${state.plan.lmMB} MB, once)`);
        mode.replaceChildren(
          h('p', {}, replay
            ? '▶ Replay of a real run. The AI took the tallest bar every time, so temperature only changes the odds here. Go live to see the story branch.'
            : 'Your own sentence needs the talking model on your device.'),
          go,
          ...(state.plan.fast ? [] : [h('p', { class: 'fineprint' }, 'This device has no WebGPU, so live mode will be slow.')]));
      }
    }

    async function goLive() {
      const bar = h('progress', { max: '1', value: '0' });
      mode.replaceChildren(h('p', {}, 'Downloading the talking model…'), bar);
      try {
        lm = await loadLM((p) => (bar.value = p));
        countEvent('live-model');
        await restart();
      } catch (err) {
        console.error(err);
        lm = null;
        renderMode();
        mode.prepend(h('p', {}, 'The live model couldn’t start on this device. Replay still works.'));
      }
    }

    async function restart() {
      if (stopped) return;
      playing = false;
      playBtn.textContent = '▶ Play';
      step = 0; done = false; options = null;
      reply.replaceChildren(h('span', { class: 'cursor' }, '▍'));
      state.journey.reply = '';
      ids = lm ? chatPromptIds(lm.tokenizer, state.sentence) : [];
      renderMode();
      await loadOptions();
    }

    async function loadOptions() {
      if (lm) options = await nextTokenOdds(lm, ids, 10);
      else options = replay?.steps[step]?.options ?? null;
      renderBars();
    }

    function renderBars() {
      nextBtn.disabled = busy || done || !options;
      playBtn.disabled = done || !options;
      if (!options) return bars.replaceChildren(h('li', { class: 'empty' }, done ? 'That’s the whole reply. Press ↺ Restart to watch again.' : 'Go live to watch your sentence get an answer.'));
      const probs = softmax(options.map((o) => o.logit), temperature);
      bars.replaceChildren(...options.slice(0, SHOW).map((o, i) => h('li', {},
        h('button', { class: 'bar', disabled: !lm || busy || done, onclick: () => commit(i), 'aria-label': `${showToken(o.text)}, ${Math.round(probs[i] * 100)} percent` },
          h('span', { class: 'bar-fill', style: { width: `${probs[i] * 100}%` } }),
          h('span', { class: 'bar-text' }, showToken(o.text)),
          h('span', { class: 'bar-pct' }, `${(probs[i] * 100).toFixed(probs[i] < 0.1 ? 1 : 0)}%`)))));
    }

    async function commit(choice) {
      if (busy || done || !options || stopped) return;
      busy = true;
      let pick;
      if (choice != null) pick = options[choice];
      else if (lm) pick = options[sample(softmax(options.map((o) => o.logit), temperature))];
      else pick = options.find((o) => o.id === replay.steps[step].picked);
      step++;
      const isEnd = lm ? isEndToken(lm.tokenizer, pick.id) : pick.text === '<|im_end|>';
      if (!isEnd) {
        reply.querySelector('.new')?.classList.remove('new');
        reply.lastChild.before(h('span', { class: 'new' }, pick.text));
        ids.push(pick.id);
        state.journey.reply += pick.text;
      }
      done = isEnd || step >= MAX_TOKENS || (!lm && !replay.steps[step]);
      if (done) { reply.lastChild.remove(); playing = false; playBtn.textContent = '▶ Play'; options = null; }
      else await loadOptions();
      busy = false;
      renderBars();
    }

    async function togglePlay() {
      playing = !playing;
      playBtn.textContent = playing ? '⏸ Pause' : '▶ Play';
      while (playing && !done && !stopped) {
        await commit();
        await new Promise((r) => setTimeout(r, prefersReducedMotion() ? 600 : 250));
      }
    }

    restart();
    return () => { stopped = true; playing = false; };
  },
};
