// The story: "Follow one sentence through AI". Picks a sentence, then walks it through each chapter.
import { h } from './engine/dom.js';
import { detect, downloadPlan, loadReplay, loadTokenizer, loadEmbedder } from './engine/runtime.js';
import tokens from './chapters/01-tokens/chapter.js';
import galaxy from './chapters/02-galaxy/chapter.js';
import theater from './chapters/03-theater/chapter.js';

const CHAPTERS = [tokens, galaxy, theater];
const MAX_SENTENCE = 120;

const state = { story: null, sentence: '', preset: null, plan: null };
const stage = document.getElementById('stage');
const dots = document.getElementById('progress');
const tierBadge = document.getElementById('tier');
let cleanup = null;

function show(index) {
  cleanup?.();
  cleanup = null;
  stage.replaceChildren();
  dots.replaceChildren(...['Start', ...CHAPTERS.map((c) => c.short), 'Done'].map((label, i) =>
    h('li', { class: i === index + 1 ? 'on' : i < index + 1 ? 'done' : '', 'aria-current': i === index + 1 ? 'step' : false }, label)));
  tierBadge.textContent = state.preset ? '▶ Replay' : state.sentence ? '⚡ Live on your device' : '';
  window.scrollTo(0, 0);

  if (index < 0) return intro();
  if (index >= CHAPTERS.length) return finale();

  const chapter = CHAPTERS[index];
  const body = h('div', { class: 'chapter-body' });
  stage.append(
    h('p', { class: 'eyebrow' }, `Chapter ${index + 1} of ${CHAPTERS.length}`),
    h('h2', { tabindex: '-1' }, chapter.title),
    body,
    h('nav', { class: 'story-nav' },
      h('button', { class: 'ghost', onclick: () => show(index - 1) }, '← Back'),
      h('button', { class: 'primary', onclick: () => show(index + 1) }, index + 1 < CHAPTERS.length ? 'Next chapter →' : 'Finish →')),
  );
  stage.querySelector('h2').focus();
  cleanup = chapter.mount(body, { state, restartWith: usePreset }) ?? null;
}

function intro() {
  const input = h('input', { type: 'text', maxlength: String(MAX_SENTENCE), placeholder: 'Type any sentence…', 'aria-label': 'Your own sentence', autocomplete: 'off' });
  const notice = h('div', { class: 'notice', hidden: true });
  const plan = state.plan;

  const ownSentence = (e) => {
    e.preventDefault();
    const text = input.value.trim().slice(0, MAX_SENTENCE);
    if (!text) return input.focus();
    if (!plan) return notice.replaceChildren(h('p', {}, 'This browser can’t run AI models, so pick one of the ready-made sentences above.')), (notice.hidden = false);
    notice.hidden = false;
    notice.replaceChildren(
      h('p', {}, h('strong', {}, 'To use your own words, the AI runs on your device.')),
      h('p', {}, `One-time download: about ${plan.starterMB} MB (Wi-Fi recommended). Nothing you type leaves your device.`),
      h('div', { class: 'row' },
        h('button', { class: 'primary', onclick: () => startLocal(text, notice) }, `Download ${plan.starterMB} MB & start`),
        h('button', { class: 'ghost', onclick: () => (notice.hidden = true) }, 'Not now')),
    );
  };

  stage.append(
    h('h1', {}, 'Follow one sentence', h('br'), 'through AI'),
    h('p', { class: 'lead' }, 'Pick a sentence. Watch what an AI does with it — piece by piece, star by star, guess by guess.'),
    h('div', { class: 'presets', role: 'list' },
      state.story.presets.map((p) => h('button', { class: 'chip', role: 'listitem', onclick: () => usePreset(p) }, p.text))),
    h('form', { class: 'own', onsubmit: ownSentence },
      h('label', {}, 'Or use your own words'),
      h('div', { class: 'row' }, input, h('button', { class: 'primary', type: 'submit' }, 'Go'))),
    notice,
    h('p', { class: 'fineprint' }, 'Ready-made sentences use recorded runs of real AI models — instant, no download.'),
  );
}

function usePreset(preset) {
  Object.assign(state, { preset, sentence: preset.text });
  show(0);
}

async function startLocal(text, notice) {
  const bar = h('progress', { max: '1', value: '0' });
  notice.replaceChildren(h('p', {}, 'Downloading the AI to your device…'), bar);
  try {
    let a = 0, b = 0;
    const update = () => (bar.value = (a + b) / 2);
    await Promise.all([loadTokenizer((p) => ((a = p), update())), loadEmbedder((p) => ((b = p), update()))]);
    Object.assign(state, { preset: null, sentence: text });
    show(0);
  } catch (err) {
    console.error(err);
    notice.replaceChildren(h('p', {}, 'The download didn’t work on this device or network. Pick a ready-made sentence instead — it works the same way.'));
  }
}

function finale() {
  stage.append(
    h('h2', { tabindex: '-1' }, 'What just happened to your sentence'),
    h('ol', { class: 'recap' },
      h('li', {}, h('strong', {}, 'It was chopped into tokens. '), 'AI never sees words — only numbered pieces.'),
      h('li', {}, h('strong', {}, 'It became a place in a galaxy. '), 'Meaning is a position: similar ideas sit close together.'),
      h('li', {}, h('strong', {}, 'A reply was guessed, one token at a time. '), 'The AI doesn’t know answers — it predicts likely next pieces.')),
    h('p', { class: 'lead' }, 'Coming next in the playground: teach a model with your camera, run AI with the internet switched off — and meet Jarvis, an assistant built from these exact pieces.'),
    h('nav', { class: 'story-nav' },
      h('button', { class: 'ghost', onclick: () => show(CHAPTERS.length - 1) }, '← Back'),
      h('button', { class: 'primary', onclick: () => show(-1) }, 'Try another sentence')),
  );
  stage.querySelector('h2').focus();
}

try {
  const [story, caps] = await Promise.all([loadReplay(), detect()]);
  Object.assign(state, { story, plan: downloadPlan(caps) });
  show(-1);
} catch (err) {
  console.error(err);
  stage.replaceChildren(h('p', {}, 'Something went wrong loading the playground. Please refresh the page.'));
}
