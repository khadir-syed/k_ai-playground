# Pre-Publish Security Checklist

Run through this before every commit pushed to this repo. Every commit
must pass all seven before it goes in. Boxes are left unticked on purpose —
this file is a template; tick them in your head (or your PR), not here.

- [ ] **Architecture all good?** — chapter logic lives in `engine/`, chapters only wire UI; Replay tier works with no key and no download; no network calls except the origins listed in [Allowed origins](#allowed-origins).
- [ ] **Security all good?** — every section below passes, especially [Visitor API keys](#visitor-api-keys-bring-your-own-key) and [Content-Security-Policy](#content-security-policy).
- [ ] **Code standard wise all good?** — matches this repo's style (plain ES modules, no build step, no frameworks, hand-rolled logic where it teaches the idea), and runs without console errors.
- [ ] **Technically all good?** — `node --test tests/` passes; Replay tier gives the same output for the same input; Local tier falls back cleanly to Replay when the device can't run it; key mode fails with a clear, non-crashing message for a missing or wrong key.
- [ ] **No other tech issues?** — tested end-to-end in a real browser at phone width (360–390px) and laptop width, not just by reading the code.
- [ ] **Documentation is up to date, along with required diagrams** — the relevant README(s) and [docs/DESIGN.md](docs/DESIGN.md) describe what the code does right now (not a planned future state), and any Mermaid diagram still matches the real flow.
- [ ] **The rest of this checklist passes** — every section below.

## Secrets & Credentials
- [ ] No API keys, tokens, or passwords in the diff (run `gitleaks` if installed; otherwise scan the diff for key/token patterns like `sk-`, `sk-ant-`, `AKIA`, `ghp_`, `-----BEGIN`)
- [ ] No hardcoded cloud account IDs, internal hostnames, or employer-identifying data
- [ ] Developer keys for `tools/` or `python/` are read from `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` environment variables only, never written to a file or printed

## Visitor API keys (bring your own key)
- [ ] The key is held in a JavaScript variable only — never in `localStorage`, `sessionStorage`, IndexedDB, cookies, the URL, `console` output, error messages, or analytics events
- [ ] The key is sent only to `https://api.anthropic.com` or `https://api.openai.com`, and the page CSP `connect-src` allows nothing else that could receive it
- [ ] The key input is hidden until the visitor chooses live mode, uses `type="password"` and `autocomplete="off"`, and sits next to a plain-English warning: use a key with a low spend limit, and here is the source code
- [ ] A missing, wrong or rate-limited key shows a friendly message and falls back to Replay — no crash, and the key is never echoed back on screen
- [ ] Provider responses are treated as untrusted text (shown with `textContent` only)

## Content-Security-Policy
- [ ] Every HTML page has the strict CSP `<meta>` tag; no page loosens it beyond [Allowed origins](#allowed-origins)
- [ ] `script-src` is `'self' 'wasm-unsafe-eval'` only — no CDN scripts, no `'unsafe-inline'`, no `'unsafe-eval'`
- [ ] No inline `<script>` blocks and no inline `on…=` event handlers
- [ ] Browser console shows no CSP violations in any tier

## Allowed origins
Adding an origin here needs a reason in the PR. Today the full list is:

| Origin | Directive | Why |
|---|---|---|
| `'self'` | all | the site itself |
| `https://cdn.jsdelivr.net` | `connect-src` | ONNX Runtime `.wasm` binary, exact pinned version (data, not script) |
| `https://huggingface.co`, `https://*.hf.co` | `connect-src` | model files, exact pinned commit; `huggingface.co` redirects to `*.hf.co` |
| `https://api.anthropic.com`, `https://api.openai.com` | `connect-src` | bring-your-own-key only, on pages that offer it |

## Code safety
- [ ] Text is shown with `textContent` only — no `innerHTML`, `outerHTML`, `insertAdjacentHTML`, `eval`, `new Function`, or `document.write`
- [ ] Anything a visitor types or a model produces is treated as untrusted text
- [ ] No third-party code runs except the files in `vendor/`

## Dependencies
- [ ] Every file in `vendor/` matches the exact version and SHA-256 recorded in [vendor/README.md](vendor/README.md), re-checked from the npm tarball when it changes
- [ ] The ONNX Runtime `.wasm` URL pins the exact version the vendored transformers.js was built for
- [ ] Every model is loaded at a pinned Hugging Face commit (`revision`), never `main`
- [ ] `tools/` dependencies are pinned in `package-lock.json`, and `npm audit` there has no unresolved high/critical findings
- [ ] Any `python/` script pins its `requirements.txt`, and `pip-audit` has no unresolved high/critical findings

## Privacy & analytics
- [ ] What a visitor types never leaves their browser, except to the AI provider they chose with their own key
- [ ] Analytics (when enabled) is cookie-free GoatCounter, and records only page views and named events like `chapter-3-done` — never typed text, never keys
- [ ] Model downloads are opt-in and the size is shown before anything large is fetched on a phone

## Data
- [ ] Replays and examples use only made-up sentences (no real names, addresses, IDs or personal data)
- [ ] Replays are recorded from real model runs by a script in `tools/` — never hand-edited

## Publishing (GitHub Pages)
- [ ] The publishing workflow's actions are pinned to full commit SHAs, with least-privilege `permissions:`
- [ ] Checked on the live site at phone and laptop width after publishing

## Repo Hygiene
- [ ] LICENSE present
- [ ] Each chapter README states which tiers it supports and whether it can use a key
- [ ] Documentation matches what the code actually does — no README describing a feature that isn't built yet without saying so
- [ ] `.DS_Store`, `node_modules/`, model caches and `.env` files are git-ignored
