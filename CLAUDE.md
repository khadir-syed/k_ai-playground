# CLAUDE.md

Guidance for AI coding assistants working in this repo. Humans: start with [README.md](README.md).

## What this is

A static, mobile-first site that teaches non-technical people how AI works by following one
sentence through tokens → meaning → prediction. Design and decisions: [docs/DESIGN.md](docs/DESIGN.md).

## Rules

- **Read [SECURITY_CHECKLIST.md](SECURITY_CHECKLIST.md) before every commit**, and pass it.
- No build step, no framework, no new runtime dependency. Plain ES modules served as-is.
- Chapter logic goes in `engine/` (tested). `chapters/*/chapter.js` only wires up the UI.
- Put things on screen only through `engine/dom.js` (`h()` → `textContent`). Never `innerHTML`.
- Never loosen the CSP in `index.html`. A new origin needs the user's approval and a row in
  SECURITY_CHECKLIST.md → Allowed origins.
- Never hand-edit `replays/story.json`. Re-record it: `cd tools && npm run record`.
- Changing a file in `vendor/` means following [vendor/README.md](vendor/README.md) → Upgrading.
- Copy for visitors: a plain-English analogy first, one idea per screen, short enough for a phone.
- Docs describe the code as it is now. Update the README, DESIGN.md and chapter READMEs in the
  same commit.

## Commands

```bash
python3 -m http.server 8000          # serve locally → http://localhost:8000
node --test "tests/*.test.mjs"       # self-checks (offline, no model download)
cd tools && npm install && npm run record   # re-record replays from real models
```

## Git

Work on `main`. Commit freely, but **never push** until the maintainer has reviewed and approved
the change, and the security checklist has been run.
