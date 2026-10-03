// Bonus 2 — Pull the Plug. Switch the internet off; the AI on this device keeps working.
import { h } from '../../engine/dom.js';
import { mean, nearestGroup } from '../../engine/math.js';
import { embed } from '../../engine/ai.js';
import { loadEmbedder, isReady } from '../../engine/runtime.js';
import { countEvent } from '../../engine/analytics.js';
import { LABEL, showVerdict } from '../04-teach/chapter.js';

const MAX_TEXT = 120;

export default {
  short: 'Offline',
  icon: '🔌',
  python: '05_plug.py', // its twin in python/
  blurb: 'Airplane mode on. The AI keeps working.',
  title: 'Pull the plug',
  mount(root, { state }) {
    countEvent('bonus-plug');
    const { groups, train } = state.story.teach;
    const centroids = Object.fromEntries(groups.map((g) => [g, mean(train.filter((c) => c.group === g).map((c) => c.embedding))]));
    const net = h('p', { class: 'net', 'aria-live': 'polite' });
    const stage = h('div', {});
    const result = h('div', { 'aria-live': 'polite' });
    let extractor = null, offlineWin = false, owed = false;

    root.append(
      h('p', { class: 'lead' }, 'A calculator works without the internet. Does AI? Lots of people think AI lives far away, on the internet. ', h('strong', {}, 'This one lives on your device.'), ' Let’s prove it.'),
      net, stage, result,
      h('details', {},
        h('summary', {}, 'Why can it work offline?'),
        h('p', {}, 'This AI is just a file of numbers. Once it’s on your device, your device does all the maths itself. Big chat AIs are too big for a phone, so they live in huge computer buildings. That’s why they need the internet.')),
    );

    function renderNet() {
      net.replaceChildren(navigator.onLine ? '🟢 Online' : '🔴 Offline');
      net.className = `net ${navigator.onLine ? 'on' : 'off'}`;
    }

    function renderStage() {
      if (!state.plan) return stage.replaceChildren(h('p', { class: 'notice' }, 'This browser can’t run the AI, so you can’t try this here. Try a newer phone or laptop.'));
      if (!isReady('embed')) return stage.replaceChildren(offerDownload());
      const input = h('input', { type: 'text', maxlength: String(MAX_TEXT), placeholder: 'e.g. My phone screen cracked', autocomplete: 'off', 'aria-label': 'A sentence for the AI' });
      stage.replaceChildren(
        h('div', { class: 'notice warn' },
          h('p', {}, h('strong', {}, '⚠️ Don’t reload this page while you’re offline.')),
          h('p', {}, 'The AI lives in this page’s memory. A reload wipes it, and with no internet it can’t come back.')),
        h('ol', { class: 'steps' },
          h('li', {}, 'Turn on ', h('strong', {}, 'airplane mode'), ' and make sure Wi-Fi is off too. On a laptop, just turn off Wi-Fi.'),
          h('li', {}, 'Ask the AI: food or tech?')),
        h('form', { class: 'row own', onsubmit: (e) => { e.preventDefault(); ask(input.value); } },
          input, h('button', { class: 'primary', type: 'submit' }, 'Ask')),
        ...(isReady('lm') ? [h('p', { class: 'muted' }, 'The talking AI from chapter 3 is on this device too. Go back to it while offline, and it still writes.')] : []));
    }

    function offerDownload() {
      const go = h('button', { class: 'primary', onclick: async () => {
        if (!navigator.onLine) return (msg.textContent = 'You’re offline. Turn the internet back on, download, then pull the plug.');
        const bar = h('progress', { max: '1', value: '0' });
        go.replaceWith(bar);
        try {
          extractor = await loadEmbedder((p) => (bar.value = p));
          renderStage();
        } catch (err) {
          console.error(err);
          bar.replaceWith(h('p', {}, 'The download didn’t work. Try again later.'));
        }
      } }, `Download the AI (~${state.plan.embedMB} MB, once)`);
      const msg = h('p', { 'aria-live': 'polite' });
      return h('div', { class: 'notice' },
        h('p', {}, h('strong', {}, 'First, the AI has to be on your device.')),
        h('p', {}, 'Ready-made sentences are saved results, so they can’t prove anything. You need the real AI on your device first, while you still have internet.'),
        h('p', {}, 'Use Wi-Fi if you can. What you type stays on your device.'),
        go, msg);
    }

    async function ask(raw) {
      const text = raw.trim().slice(0, MAX_TEXT);
      if (!text) return;
      extractor ??= await loadEmbedder();
      const start = performance.now();
      const [v] = await embed(extractor, [text]);
      const ms = Math.round(performance.now() - start);
      const offline = !navigator.onLine;
      const parts = [showVerdict(text, nearestGroup(v, centroids), (n) => LABEL[n]),
        h('p', { class: 'muted' }, `Answered in ${(ms / 1000).toFixed(2)} seconds, ${offline ? 'with no internet ✈️' : 'online. Now pull the plug and ask again.'}`)];
      if (offline) {
        state.journey.offline = true;
        if (!offlineWin) owed = true; // counted when the internet is back: a beacon sent now would be lost
        offlineWin = true;
        parts.unshift(h('p', { class: 'win' }, '🎉 No internet, and the AI still answered. It’s running on your device.'));
      }
      result.replaceChildren(...parts);
    }

    const onChange = () => {
      renderNet();
      if (navigator.onLine && owed) { countEvent('plug-offline'); owed = false; }
    };
    addEventListener('online', onChange);
    addEventListener('offline', onChange);
    renderNet();
    renderStage();
    return () => { removeEventListener('online', onChange); removeEventListener('offline', onChange); };
  },
};
