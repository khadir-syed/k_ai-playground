// Records real model runs into replays/story.json — the Replay tier and the test data.
// Run from tools/:  npm install && npm run record
// Uses the same engine/ai.js functions as the browser, so replays match what Local tier would show.
import { writeFile } from 'node:fs/promises';
import { AutoTokenizer, AutoModelForCausalLM, pipeline, Tensor } from '@huggingface/transformers';
import { MODELS, tokenize, embed, chatPromptIds, nextTokenOdds, isEndToken } from '../engine/ai.js';

const PRESETS = [
  'Will it rain tomorrow?',
  'My cat thinks she is a lion.',
  'Pizza is the best breakfast.',
  'Can a robot be my friend?',
];

// The "universe" of stars in the Meaning Galaxy. Made-up, everyday phrases in six families.
const STARS = {
  weather: ['sunny day at the beach', 'a heavy thunderstorm', 'snow falling on the mountains', 'the forecast says showers', 'a cold windy morning', 'umbrella weather'],
  animals: ['a sleepy kitten', 'a lion roaring in the savanna', 'my dog loves long walks', 'a parrot that can talk', 'fish swimming in a pond', 'a tiger hunting at night'],
  food: ['a cheesy pizza slice', 'pancakes with syrup', 'a plate of spicy biryani', 'a bowl of fresh fruit', 'chocolate birthday cake', 'morning coffee and toast'],
  tech: ['a helpful robot assistant', 'my phone battery died', 'learning to write code', 'a smart speaker at home', 'computers that can talk', 'the internet is down'],
  feelings: ['I feel so happy today', 'missing my best friend', 'nervous before the exam', 'laughing with my family', 'a lonely quiet evening', 'proud of my hard work'],
  sports: ['scoring the winning goal', 'a cricket match on Sunday', 'running a marathon', 'swimming laps in the pool', 'the crowd cheers loudly', 'learning to ride a bike'],
};

// Bonus "Teach a Model": cards the visitor sorts (train) and cards the AI then guesses (test).
// The last two test cards are tricky on purpose: one word, two meanings.
const TEACH = {
  groups: ['food', 'tech'],
  train: [
    ['a bowl of hot noodles', 'food'], ['my laptop keeps freezing', 'tech'],
    ['strawberry ice cream', 'food'], ['charging my phone overnight', 'tech'],
    ['grilled fish with rice', 'food'], ['a new video game console', 'tech'],
    ['fresh bread from the oven', 'food'], ['the wifi password changed', 'tech'],
  ],
  test: [
    ['I baked a chocolate cake', 'food'], ['My phone screen cracked', 'tech'],
    ['Spicy curry for dinner', 'food'], ['Robots can sort packages', 'tech'],
    ['My Apple watch needs charging', 'tech'], ['This website uses cookies', 'tech'],
  ],
};

const MAX_REPLY_TOKENS = 40;
const TOP_K = 10;

const opts = (m, extra = {}) => ({ revision: m.revision, ...extra });
const tokenizer = await AutoTokenizer.from_pretrained(MODELS.lm.id, opts(MODELS.lm));
const model = await AutoModelForCausalLM.from_pretrained(MODELS.lm.id, opts(MODELS.lm, { dtype: 'q8' }));
const extractor = await pipeline('feature-extraction', MODELS.embed.id, opts(MODELS.embed, { dtype: 'q8' }));
const lm = { tokenizer, model, Tensor };

const stars = Object.entries(STARS).flatMap(([group, texts]) => texts.map((text) => ({ group, text })));
const starVectors = await embed(extractor, stars.map((s) => s.text));
stars.forEach((s, i) => (s.embedding = starVectors[i]));

const cards = async (list) => {
  const vectors = await embed(extractor, list.map(([text]) => text));
  return list.map(([text, group], i) => ({ text, group, embedding: vectors[i] }));
};
const teach = { groups: TEACH.groups, train: await cards(TEACH.train), test: await cards(TEACH.test) };

const presets = [];
for (const text of PRESETS) {
  const promptIds = chatPromptIds(tokenizer, text);
  const ids = [...promptIds];
  const steps = [];
  for (let i = 0; i < MAX_REPLY_TOKENS; i++) {
    const options = await nextTokenOdds(lm, ids, TOP_K);
    const picked = options[0].id; // greedy: the recorded path always takes the most likely token
    steps.push({ options, picked });
    if (isEndToken(tokenizer, picked)) break;
    ids.push(picked);
  }
  presets.push({
    text,
    tokens: tokenize(tokenizer, text),
    embedding: (await embed(extractor, [text]))[0],
    theater: { promptTokens: promptIds.length, steps },
  });
  console.log(`recorded: ${text} → ${tokenizer.decode(ids.slice(promptIds.length))}`);
}

const story = {
  note: 'Recorded from real model runs by tools/record-replays.mjs. Do not hand-edit.',
  models: MODELS,
  recordedWith: { library: '@huggingface/transformers@4.3.0', dtype: 'q8', decoding: 'greedy', topK: TOP_K },
  presets,
  stars,
  teach,
};
await writeFile(new URL('../replays/story.json', import.meta.url), JSON.stringify(story));
console.log('wrote replays/story.json');
