// The story: "Follow one sentence through AI". Picks a sentence, then walks it through each chapter.
import { h } from './engine/dom.js';
import { countPage, countEvent } from './engine/analytics.js';
import { cardContent, drawCard, canvasToFile } from './engine/sharecard.js';
import { detect, downloadPlan, loadReplay, loadTokenizer, loadEmbedder } from './engine/runtime.js';
import tokens from './chapters/01-tokens/chapter.js';
import galaxy from './chapters/02-galaxy/chapter.js';
import theater from './chapters/03-theater/chapter.js';
import teach from './chapters/04-teach/chapter.js';
import plug from './chapters/05-plug/chapter.js';

const CHAPTERS = [tokens, galaxy, theater];
const BONUS = [teach, plug]; // after the story's finish screen; not part of "story-done" (docs/DESIGN.md)
const MAX_SENTENCE = 120;

const state = { story: null, sentence: '', preset: null, plan: null, journey: {} };
const stage = document.getElementById('stage');
const dots = document.getElementById('progress');
const tierBadge = document.getElementById('tier');
let cleanup = null;

// Clears the stage for a new screen. `step` is the position in Start, chapters…, Done.
function reset(step) {
  cleanup?.();
  cleanup = null;
  stage.replaceChildren();
  dots.replaceChildren(...['Start', ...CHAPTERS.map((c) => c.short), 'Done'].map((label, i) =>
    h('li', { class: i === step ? 'on' : i < step ? 'done' : '', 'aria-current': i === step ? 'step' : false }, label)));
  tierBadge.textContent = state.preset ? '▶ Replay' : state.sentence ? '⚡ Live on your device' : '';
  window.scrollTo(0, 0);
}

function show(index) {
  reset(index + 1);
  if (index < 0) return intro();
  if (index >= CHAPTERS.length) return countEvent('story-done'), finale();
  countEvent(`chapter-${index + 1}`);
  page(CHAPTERS[index], `Chapter ${index + 1} of ${CHAPTERS.length}`,
    () => show(index - 1), [index + 1 < CHAPTERS.length ? 'Next chapter →' : 'Finish →', () => show(index + 1)]);
}

function showBonus(index) {
  reset(CHAPTERS.length + 1);
  page(BONUS[index], `Bonus ${index + 1} of ${BONUS.length}`, () => show(CHAPTERS.length),
    index + 1 < BONUS.length ? ['Next bonus →', () => showBonus(index + 1)] : ['Finish →', () => show(CHAPTERS.length)]);
}

function page(chapter, eyebrow, back, [nextLabel, next]) {
  const body = h('div', { class: 'chapter-body' });
  stage.append(
    h('p', { class: 'eyebrow' }, eyebrow),
    h('h2', { tabindex: '-1' }, chapter.title),
    h('section', { class: 'card' }, body),
    h('nav', { class: 'story-nav' },
      h('button', { class: 'ghost', onclick: back }, '← Back'),
      h('button', { class: 'primary', onclick: next }, nextLabel)),
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
    brandHero(),
    h('section', { class: 'card easy' },
      h('p', { class: 'easy-label' }, 'In short'),
      h('p', {}, 'AI is a computer helper you can talk to.'),
      h('p', {}, 'Here you can watch what it does with your words.'),
      h('p', {}, 'Think of a glass-walled factory.'),
      h('p', {}, 'Your sentence goes in. You watch every machine work on it.')),
    h('section', { class: 'card' },
      h('h1', {}, 'Follow one sentence through AI'),
      h('p', {}, 'Pick a sentence. Watch what an AI does with it — piece by piece, star by star, guess by guess.'),
      h('div', { class: 'presets', role: 'list' },
        state.story.presets.map((p) => h('button', { class: 'chip', role: 'listitem', onclick: () => usePreset(p) }, p.text))),
      h('form', { class: 'own', onsubmit: ownSentence },
        h('label', {}, 'Or use your own words'),
        h('div', { class: 'row' }, input, h('button', { class: 'primary', type: 'submit' }, 'Go'))),
      notice,
      h('p', { class: 'muted' }, 'Ready-made sentences use recorded runs of real AI models — instant, no download.')),
    siblingLinks(),
    footer(),
  );
}

// "My sentence's journey": drawn on this device; shared or saved only if the visitor chooses.
function shareCard() {
  const canvas = h('canvas', { class: 'share-preview', role: 'img', 'aria-label': `Your sentence’s journey through AI, as an image: “${state.sentence}”` });
  const status = h('p', { class: 'muted', 'aria-live': 'polite' });
  const buttons = h('div', { class: 'row' });
  let file = null;

  drawCard(canvas, cardContent(state.sentence, state.journey))
    .then(() => canvasToFile(canvas))
    .then((f) => {
      file = f;
      const canShare = navigator.canShare?.({ files: [f] });
      const saveBtn = h('button', { class: canShare ? 'ghost' : 'primary', onclick: save }, '⬇ Save image');
      buttons.replaceChildren(...(canShare ? [h('button', { class: 'primary', onclick: share }, '📤 Share')] : []), saveBtn);
    })
    .catch((err) => { console.error(err); status.textContent = 'Couldn’t make the image on this device.'; });

  async function share() {
    try {
      await navigator.share({ files: [file], title: 'My sentence’s journey through AI', text: 'Follow your own sentence through AI:', url: location.href.split(/[?#]/)[0] });
      countEvent('share-card-shared');
    } catch (err) {
      if (err.name !== 'AbortError') status.textContent = 'Sharing didn’t work here. Try “Save image” instead.';
    }
  }

  function save() {
    const url = URL.createObjectURL(file);
    h('a', { href: url, download: file.name }).click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    countEvent('share-card-saved');
    status.textContent = 'Saved. Nothing was uploaded — the image was made on your device.';
  }

  return h('section', { class: 'card share' },
    h('h2', {}, 'Your sentence’s journey, as a picture'),
    h('p', { class: 'muted' }, 'Made on your device. Nothing is uploaded unless you choose to share it.'),
    canvas, buttons, status);
}

function brandHero() {
  return h('header', { class: 'hero brand compact' },
    h('div', { class: 'brand-frame' }, h('img', { src: 'https://avatars.githubusercontent.com/u/15974849?v=4&s=128', alt: 'Khadir', width: '56', height: '56' })),
    h('div', {},
      h('p', { class: 'brand-name' }, h('span', {}, 'K'), ' the Techman'),
      h('a', { class: 'badge', href: 'https://khadir-syed.github.io/', rel: 'noopener noreferrer' }, '@k_thetechman')));
}

function siblingLinks() {
  return h('section', { class: 'card links' },
    h('p', { class: 'muted' }, 'Want to go further? Everything in the k_ai series is free.'),
    h('a', { class: 'link-card', href: 'https://khadir-syed.github.io/k_ai-basics/web/', rel: 'noopener noreferrer' }, 'AI Basics — 10 small demos of how AI works'),
    h('a', { class: 'link-card', href: 'https://khadir-syed.github.io/k_ai-agent-skills/web/', rel: 'noopener noreferrer' }, 'AI skills, explained — putting AI to work'));
}

const footer = () => h('footer', { class: 'footer' }, 'Learning should not stop.');

function usePreset(preset) {
  Object.assign(state, { preset, sentence: preset.text, journey: {} });
  countEvent('start-ready-made');
  show(0);
}

async function startLocal(text, notice) {
  const bar = h('progress', { max: '1', value: '0' });
  notice.replaceChildren(h('p', {}, 'Downloading the AI to your device…'), bar);
  try {
    let a = 0, b = 0;
    const update = () => (bar.value = (a + b) / 2);
    await Promise.all([loadTokenizer((p) => ((a = p), update())), loadEmbedder((p) => ((b = p), update()))]);
    Object.assign(state, { preset: null, sentence: text, journey: {} });
    countEvent('start-own-words');
    show(0);
  } catch (err) {
    console.error(err);
    notice.replaceChildren(h('p', {}, 'The download didn’t work on this device or network. Pick a ready-made sentence instead — it works the same way.'));
  }
}

function finale() {
  stage.append(
    h('section', { class: 'card' },
      h('h2', { tabindex: '-1' }, 'What just happened to your sentence'),
      h('ol', { class: 'recap' },
        h('li', {}, h('strong', {}, 'It was chopped into tokens. '), 'AI never sees words — only numbered pieces.'),
        h('li', {}, h('strong', {}, 'It became a place in a galaxy. '), 'Meaning is a position: similar ideas sit close together.'),
        h('li', {}, h('strong', {}, 'A reply was guessed, one token at a time. '), 'The AI doesn’t know answers — it predicts likely next pieces.')),
      h('p', { class: 'muted' }, 'Coming later: Jarvis, an assistant built from these exact pieces.')),
    h('section', { class: 'card' },
      h('h2', {}, 'Bonus rounds'),
      h('p', { class: 'muted' }, 'You finished the story. Want more?'),
      h('div', { class: 'presets' }, BONUS.map((b, i) => h('button', { class: 'chip', onclick: () => showBonus(i) }, `Bonus ${i + 1}: ${b.title}`)))),
    shareCard(),
    h('nav', { class: 'story-nav' },
      h('button', { class: 'ghost', onclick: () => show(CHAPTERS.length - 1) }, '← Back'),
      h('button', { class: 'primary', onclick: () => show(-1) }, 'Try another sentence')),
    siblingLinks(),
    footer(),
  );
  stage.querySelector('h2').focus();
}

try {
  const [story, caps] = await Promise.all([loadReplay(), detect()]);
  Object.assign(state, { story, plan: downloadPlan(caps) });
  countPage();
  show(-1);
} catch (err) {
  console.error(err);
  stage.replaceChildren(h('p', {}, 'Something went wrong loading the playground. Please refresh the page.'));
}
