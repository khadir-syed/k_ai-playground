# Design

What k_ai-playground is, who it's for, and why it's built the way it is. If the code and this
file disagree, the code wins and this file gets fixed in the same PR.

## Goal and audience

- **Primary:** non-technical people, mostly on phones. They should get a "wow" in under a minute
  and understand three ideas in under seven: tokens, meaning-as-distance, and prediction.
- **Secondary:** developers, who read the source. Readable code is part of the lesson, so the
  site has no build step and no framework.

## Decisions

| Area | Decision | Why |
|---|---|---|
| Learning flow | A guided story ("Follow one sentence through AI") that unlocks a museum of exhibits | Beginners learn better on a guided path, and returning or technical visitors want free roaming. Finishing the story is also something we can measure. |
| Layout | Mobile-first, from 360 px up to laptop | That's where the primary audience is |
| Stack | Plain HTML, CSS and ES modules. No build step, served by GitHub Pages | "View source" is the lesson, and there's nothing to keep updated |
| Shared engine | `engine/` is imported by every chapter, and later by Jarvis | A's parts become C's parts, so a fix is made once |
| Runtime tiers | Replay → Local → bring-your-own-key | A visitor never sees a broken screen, only a simpler mode |
| Keys | Claude + OpenAI, in memory only, sent only to the two provider APIs | See [SECURITY_CHECKLIST.md](../SECURITY_CHECKLIST.md) |
| Analytics | Cookie-free GoatCounter, with page views and named events only | No consent banner on a phone, and typed text is never collected. Sent by `engine/analytics.js` (GoatCounter's own script would break our CSP), only on the live `*.github.io` site. Events: `start-ready-made`, `start-own-words`, `chapter-1…3`, `live-model`, `story-done`, all prefixed `k_ai-playground/`. |
| Language | English first | — |
| Look and feel | The same warm stone and amber theme, brand header and "In short" card as [khadir-syed.github.io](https://khadir-syed.github.io/) and the other k_ai sites | One recognisable family across the series |
| Gate to Phase C (Jarvis) | 10K visits a month **and** at least 40% of first-time visitors finishing the story. Stars are a bonus signal. | Measures the non-technical audience and actual learning, not just developer interest |

## Runtime tiers

| Tier | Runs | Needs | Used by |
|---|---|---|---|
| Replay | `replays/story.json`, recorded from real runs by `tools/record-replays.mjs` | Nothing | All chapters, every device |
| Local | Models in the browser via transformers.js + ONNX Runtime (WebGPU if available, else WebAssembly) | The visitor agrees to a one-time download (shown in MB first) | Your own sentence (ch. 1–2), live chapter 3 |
| Bring your own key | Claude or OpenAI | The visitor's key | Planned for Jarvis. Note: Claude doesn't return token odds, so chapter 3's odds bars can only ever use Local or OpenAI. |

Models are pinned to exact Hugging Face commits in [`engine/ai.js`](../engine/ai.js):

| Model | Job | Size |
|---|---|---|
| `Xenova/all-MiniLM-L6-v2` (q8) | Sentence → 384 numbers (meaning) | 23 MB |
| `HuggingFaceTB/SmolLM2-135M-Instruct` | Tokenizer (ch. 1) and next-token odds (ch. 3) | 2 MB tokenizer; 112 MB (q4f16, WebGPU) or 130 MB (q8, WASM) |

Plus the ONNX Runtime `.wasm` file: 27 MB with WebGPU, 14 MB without. Browsers cache all of it
(Cache API), so the download happens only once.

## Security model

- **Scripts:** only this site's files run (`script-src 'self' 'wasm-unsafe-eval'`). transformers.js
  and the ONNX Runtime loader are committed in [`vendor/`](../vendor/) and hash-checked by tests.
- **Images:** `img-src` allows only this site and `avatars.githubusercontent.com` (the maintainer's profile photo).
- **Network:** `connect-src` allows exactly `cdn.jsdelivr.net` (the runtime `.wasm`),
  `huggingface.co` and `*.hf.co` (model files; the first redirects to the second). Bring-your-own-key
  pages will add only `api.anthropic.com` and `api.openai.com`. Visit counts go to `khadir-syed.goatcounter.com`.
- **Output:** everything goes on screen through `engine/dom.js` → `textContent`. Model output
  and visitor text are always treated as untrusted.
- **Storage:** the site itself stores nothing. transformers.js caches downloaded model files
  in the browser's Cache API. Those are public files, not visitor data.
- `transformers.js` would normally turn the runtime loader into a `blob:` script. We switch that
  off (`env.useWasmCache = false`) instead of loosening the CSP.

## Chapter 3 honesty notes

- The odds are each option's share of the model's **top 10** guesses, and the UI says so.
- Replay runs are greedy (always the top guess), so in Replay mode temperature only reshapes the
  bars. Live mode samples with temperature and lets the visitor pick the next token.
- No KV-cache: each step re-reads the whole text, which is O(n²) but simple. Replies are capped
  at 40 tokens.

## Publishing

`.github/workflows/pages.yml` runs the self-checks, then publishes only the site files (`index.html`, `app.js`, `styles.css`, `engine/`, `chapters/`, `replays/`, `vendor/`) to GitHub Pages on every push to `main`. Actions are pinned to commit SHAs; Dependabot (`.github/dependabot.yml`) proposes updates for them and for `tools/`. `vendor/` is upgraded by hand.

## Roadmap

| Phase | Ships | Gate to move on |
|---|---|---|
| **A1** ✅ | Runtime tiers, story chapters 1–3, replays, self-checks, GoatCounter, GitHub Pages workflow | Works on iPhone, Android and laptop in every tier |
| A2 | Chapter 4 "Teach a Model" (webcam), chapter 5 "Pull the Plug" (offline), museum mode, GoatCounter, GitHub Pages workflow, Python twins for the Build door | The gate above |
| C1 | Text-only Jarvis with a live step view you can pause and steer: memory (engine embeddings), reasoning (bring your own key), skills from k_ai-agent-skills | Bring-your-own-key flow passes the security checklist |
| C2 | Tools and the finished non-technical demo | — |
