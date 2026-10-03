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
| Analytics | Cookie-free GoatCounter, with page views and named events only | No consent banner on a phone, and typed text is never collected. Sent by `engine/analytics.js` (GoatCounter's own script would break our CSP), only on the live `*.github.io` site. Events: `start-ready-made`, `start-own-words`, `chapter-1…3`, `live-model`, `story-done`, `share-card-shared`, `share-card-saved`, all prefixed `k_ai-playground/`. |
| Language | English first | — |
| Sharing | A "my sentence's journey" image on the finish screen, drawn on the visitor's device (`engine/sharecard.js`), shared with the phone's share sheet or saved; plus a link-preview image (`og-image.png`, source `tools/og-image.html`) | Every share brings the next visitor. Nothing is uploaded, so privacy stays simple |
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

`.github/workflows/pages.yml` runs the self-checks, then publishes only the site files (`index.html`, `app.js`, `styles.css`, `og-image.png`, `engine/`, `chapters/`, `replays/`, `vendor/`) to GitHub Pages on every push to `main`. Actions are pinned to commit SHAs; Dependabot (`.github/dependabot.yml`) proposes updates for them and for `tools/`. `vendor/` is upgraded by hand.

## Roadmap

| Phase | Ships | Gate to move on |
|---|---|---|
| **A1** ✅ | Runtime tiers, story chapters 1–3, replays, self-checks, GoatCounter, GitHub Pages workflow, share card, link preview | Works on iPhone, Android and laptop in every tier |
| A2 | Two bonus chapters ("Teach a Model", "Pull the Plug") and museum mode. See [Phase A2 plan](#phase-a2-plan) | The gate above |
| A2.5 | Python twins for the Build door (`python/`, not published to the site) | — |
| C1 | Text-only Jarvis with a live step view you can pause and steer: memory (engine embeddings), reasoning (bring your own key), skills from k_ai-agent-skills | Bring-your-own-key flow passes the security checklist |
| C2 | Tools and the finished non-technical demo | — |

## Phase A2 plan

Decided 2026-10-03.

| Decision | Choice | Why |
|---|---|---|
| Story length | 3 core chapters + 2 **bonus** chapters | The story stays short, so the 40% finish gate stays fair. `story-done` still fires after chapter 3, so numbers before and after A2 compare |
| Webcam | Dropped | Camera prompt, a new vision model and privacy questions, for a lesson sentences can teach |
| Teach a Model | Ready-made **food / tech**, plus **your own two group names** | Ready-made works in Replay; own names are the "wow" for Local |
| Pull the Plug | Try it on real phones first, then build what actually works | Offline behaviour differs between iOS, Android and laptops |
| Python twins | Moved to A2.5 | Own dependencies, CI and review; nothing to do with the site |

### Bonus 1: Teach a Model

The visitor sorts example sentences into two groups. The AI turns each into meaning-numbers (the
chapter 2 embedder, no new model), averages each group, and labels a new sentence by which average
it is closer to (nearest centroid with `cosine` from `engine/math.js`). Shows both similarities as
bars, and gets things wrong sometimes, which is part of the lesson.

- **Replay:** fixed food / tech cards with embeddings recorded by `tools/record-replays.mjs`.
- **Local:** visitor names two groups (max 20 chars each), types at least 2 examples per group and a
  test sentence (each max 120 chars). Text stays on the device and is shown only via `textContent`.

### Bonus 2: Pull the Plug

Shows that the AI runs on your device: turn on airplane mode, and it keeps working.

- Uses whatever is already in memory: at least the embedder (Teach a Model runs offline), plus the
  chapter 3 model if it was loaded. Replay visitors get a note explaining why, and are offered only
  the 23 MB meaning model (plus the runtime), light enough for mobile data. Never the 130 MB one.
- Detects the change with `navigator.onLine` and the `offline` / `online` events. No service worker.
- **Must not reload while offline:** the page itself isn't cached, only the model files are. The
  chapter says so.
- Events sent while offline are lost (GoatCounter beacon fails quietly). Acceptable.
- **Spike result, 2026-10-03** (Android 10 + Chrome, served from the laptop over Wi-Fi, so
  WebAssembly only and no Cache API):
  - The model loaded in about 2.5 s; each guess took about 30 ms, online and offline alike.
  - `offline` fired a few seconds after airplane mode went on, and `navigator.onLine` was
    accurate. Every guess after it still worked.
  - Reloading while offline showed a **blank screen**: everything in memory is gone. So the
    chapter warns before and during offline: "Don't reload until you're back online."
  - Raw similarities between a sentence and a group average are low (about 0.05–0.40) even when
    the guess is right. Teach a Model shows which group is *closer* and by how much, never the raw
    number as a "% sure".

### Museum mode

`#museum` lists all five chapters as exhibits. Each opens directly with a default sentence when no
story is running, so every chapter must mount with an empty `state.journey`.

- **Intro:** a teaser strip of the five exhibits, locked, with "Opens when you finish the story".
  Nothing moves on by itself (no timers, WCAG 2.2.1), and the glow respects reduced motion.
- **Finish screen:** opens the museum and offers the two bonus chapters.
- **Returning visitors:** the `#museum` link works directly (bookmark or share it). The site still
  stores nothing, so "finished" is not remembered between visits. That is deliberate.

### Analytics additions

`bonus-teach`, `bonus-teach-own` (visitor used own group names), `bonus-plug`, `plug-offline`
(the offline event fired), `museum-open`. No typed text, group names or labels are ever sent.

### Share card

Adds a "taught it" line and an "ran offline" badge, only when the visitor did those.

### Build order

1. ✅ Pull the Plug spike on a real phone (throwaway, deleted).
2. Chapters mount on their own (default sentence, empty `journey`), with a test.
3. Bonus 1, Teach a Model, + recorded replay data.
4. Bonus 2, Pull the Plug, from what the spike showed.
5. Museum mode, finish-screen bonus links.
6. Share card, analytics events, chapter READMEs, this file, security checklist. Then review and push.
