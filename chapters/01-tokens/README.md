# Chapter 1 — AI doesn't read words

**Analogy:** imagine reading a book where every word has been cut into Lego bricks, and each
brick has a number stamped on it. You never see the words, only the numbers. That's how an AI
reads.

**What you do:** see your sentence split into coloured pieces (tokens), then press
**"See what the AI sees"** to swap every piece for its number.

**What you learn:**
- AI works on tokens, not words or letters.
- Common words are one token, while rare words get split (`grandma` → `grand` + `ma`).
- Spaces stick to the front of the next word (shown as `␣`), so ` rain` and `rain` are different tokens.

**Tiers:** Replay (ready-made sentences) · Local (your own sentence, using the 2 MB
SmolLM2 tokenizer). No API key.

**Engine used:** `tokenize()` in [`engine/ai.js`](../../engine/ai.js).
