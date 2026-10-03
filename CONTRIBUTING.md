# Contributing

Thanks for your interest in contributing. This repository is an interactive,
mobile-first playground that lets anyone — especially people who have never
written code — **see AI from the inside**. Visitors follow one sentence of
their own through tokens, meaning and prediction, right in the browser.
Contributions should keep that goal in mind: no heavyweight frameworks, no
servers or paid hosting (only the static GitHub Pages site), and a default
path that runs on a phone with zero API key and zero config.

## Before you open a pull request

- Read [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) — participation in this
  project means agreeing to it.
- Read [SECURITY_CHECKLIST.md](SECURITY_CHECKLIST.md) — every commit must
  pass it.
- Read [docs/DESIGN.md](docs/DESIGN.md) — it explains the three runtime
  tiers and why the repo is shaped the way it is.
- Search existing issues and pull requests to avoid duplicating work.
- For a change larger than a typo or wording fix, open an issue first to
  discuss the approach before writing it up.

## How the repo is laid out

Unlike [k_ai-basics](https://github.com/khadir-syed/k_ai-basics), demos here
are **not** self-contained. They share one small engine on purpose: the
pieces built for the story today (meaning search, next-token odds) are the
same pieces the Jarvis capstone is built from later. Fix a bug once, in
`engine/`, and every chapter gets the fix.

```text
k_ai-playground/
├── index.html          the story: "Follow one sentence through AI"
├── engine/             shared ES modules — runtime tiers, models, math
├── boot.js             loads app.js; shows a "please refresh" message if a file fails to load
├── app.js              the story controller: picks the sentence, runs the chapters in order
├── chapters/           one folder per story chapter (01-tokens, 02-galaxy, …)
├── replays/            recorded real model runs (Replay tier + test data)
├── vendor/             pinned third-party JS, committed and hash-checked
├── tools/              offline scripts (e.g. recording replays) — never shipped
├── tests/              node --test self-checks, no framework
└── docs/               design notes
```

## The three runtime tiers

Every chapter must work in all tiers it claims, and must fall back silently
— a visitor never sees a broken screen, only a simpler mode.

| Tier | What runs | When |
|---|---|---|
| **Replay** | Recorded real runs from `replays/`, fully interactive | Always available, every device, instant |
| **Local** | A small model inside the visitor's browser | Opt-in; download size shown first |
| **Bring your own key** | Claude or OpenAI, with the visitor's key | Opt-in; only where a chapter truly needs a big model |

## Adding a chapter

```text
chapters/0N-chapter-name/
├── chapter.js          (exports { short, title, icon, blurb, mount(root, ctx) } — UI only; logic belongs in engine/)
└── README.md
```

Then add it to the `CHAPTERS` list in [`app.js`](app.js), or to `BONUS` for a bonus chapter
(shown after the story's finish screen, not counted in `story-done`). Chapters are mounted into the single
story page, `index.html`, which carries the CSP.

A new chapter should:

1. **Run in Replay tier with zero API key and zero download.** Record the
   replay with a script in `tools/`, from a real model run — never hand-write
   or "improve" model output.
2. **Put logic in `engine/`, not in the chapter.** A chapter wires the UI to
   engine functions. Anything with a branch, loop or math belongs in the
   engine where it is tested.
3. **Explain itself like the reader is five years old.** Plain-English
   analogy first, one idea per screen, no jargon without a one-line meaning
   next to it. Short enough to read on a phone in a bus queue. **On screen,
   a 7-year-old should follow it** (deeper detail can go in a "Why…?"
   fold). **READMEs: a 12-year-old should follow the top part**, with
   technical notes under a "For developers" heading at the end.
4. **Work on a 360px-wide phone first**, then scale up to a laptop. Touch
   targets at least 44px. Respect `prefers-reduced-motion`.
5. **Include a Mermaid diagram in its README if it genuinely adds clarity**
   — skip it if the flow is trivially linear.
6. **Leave one runnable self-check behind** in `tests/` (`node:test` +
   `node:assert`, built into Node — no test framework) that exercises the
   real engine logic it relies on and fails if that logic breaks. It runs
   offline, with no model download.
7. **State clearly which tiers it supports**, in its README and in the
   chapter table in the root [README.md](README.md).

## Security rules that are not negotiable

These are summarised here and enforced by
[SECURITY_CHECKLIST.md](SECURITY_CHECKLIST.md).

- **Visitor API keys** live in JavaScript memory only — never in
  `localStorage`, `sessionStorage`, cookies, the URL, logs or analytics —
  and are sent only to `api.anthropic.com` or `api.openai.com`, enforced by
  the page's Content-Security-Policy.
- **What a visitor types** stays in their browser, or goes only to the AI
  provider *they* chose with *their* key. Never to analytics, never to us.
- **No inline scripts, no `innerHTML`, no `eval`.** Text goes on screen with
  `textContent` only. Model output is untrusted text, always.
- **Every third-party origin is named** in the page CSP and in
  [docs/DESIGN.md](docs/DESIGN.md). Adding one needs a reason in the PR.
- **Everything is pinned**: vendored JS by exact version and SHA-256, the
  ONNX runtime by exact version, models by exact Hugging Face commit.
- **Developer keys** (for `tools/` or future `python/` scripts) come from
  `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` environment variables only — never
  a file, never printed, never committed.

## Improving an existing chapter

- Keep changes scoped to one concern per pull request.
- Do not weaken the "works on a phone with no key" guarantee or silently
  add a dependency or third-party origin to make a change "more convenient."
- If you change what a chapter does, update its README (and any diagram) in
  the same pull request — this repo does not allow documentation to
  describe a future or past state of the code.

## Testing your change

1. Run the self-checks: `node --test "tests/*.test.mjs"` — all must pass.
2. Serve the repo locally (`python3 -m http.server 8000`) and actually use
   the chapter in a browser at **phone width (360–390px) and laptop width**,
   in Replay tier and in every other tier it claims.
3. Open the browser console — no errors, and no CSP violations.
4. If a chapter has a key mode, confirm it fails with a clear, non-crashing
   message for a missing or wrong key.
5. If anything in `tools/` changed, run `npm audit` there with no unresolved
   high/critical findings.

## Pull request checklist

This mirrors [SECURITY_CHECKLIST.md](SECURITY_CHECKLIST.md):

- [ ] No API keys, tokens, or passwords committed anywhere in the diff.
- [ ] Visitor keys stay in memory only and reach only the two provider APIs.
- [ ] CSP unchanged, or every new origin justified in the PR.
- [ ] Vendored files, ONNX runtime and model revisions still pinned.
- [ ] `node --test "tests/*.test.mjs"` passes.
- [ ] Tested at phone and laptop width; console free of errors and CSP
      violations.
- [ ] The chapter's README (and any diagram) matches exactly what the code
      does right now.
- [ ] Root [README.md](README.md) chapter table updated if a chapter was
      added, renamed, or removed.

## Reporting a security issue

If you find a security concern (not a general bug), please open an issue
and describe it. This repository has no server and stores no user data, but
it does handle visitor API keys in the browser — so for anything that could
expose a key, do not post details publicly: use **Security → Report a
vulnerability** on the GitHub repo page, which reaches the maintainer
privately.
