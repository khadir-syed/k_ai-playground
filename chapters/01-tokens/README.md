# Chapter 1: AI doesn't read words

**In one line:** before an AI does anything, it chops your sentence into small numbered pieces
called **tokens**.

## Picture this

Imagine a book where every word has been cut into Lego bricks, and each brick has a number
stamped on it. You can't see the words any more, only the numbers. That's how an AI reads.

## Try it

1. Pick a sentence (or type your own).
2. See it split into coloured pieces.
3. Press **👀 See what the AI sees** to swap every piece for its number.

## What you'll find out

- The AI never sees words or letters. It only sees numbered pieces.
- Common words are usually one piece. Long or rare words get chopped up
  (`grandma` → `grand` + `ma`).
- A space sticks to the front of the next word (shown as `␣`). So ` rain` and `rain` are two
  different pieces with two different numbers.

---

### For developers

- **Tiers:** Replay (ready-made sentences) · Local (your own sentence, using the 2 MB SmolLM2
  tokenizer). No API key.
- **Engine used:** `tokenize()` in [`engine/ai.js`](../../engine/ai.js).
- **Python twin:** [`python/01_tokens.py`](../../python/01_tokens.py) does the same thing on your computer.
