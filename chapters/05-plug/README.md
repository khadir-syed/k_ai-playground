# Bonus 2 — Pull the plug

**Analogy:** a calculator works without the internet. Most people think AI lives "in the cloud".
This one lives on your device, and you can prove it.

**What you do:**
1. If the AI isn't on your device yet, download the small meaning model (23 MB plus the runtime).
   Ready-made sentences use recordings, and a recording proves nothing offline.
2. Turn on airplane mode (on a laptop, turn off Wi-Fi). The badge turns 🔴 Offline.
3. Ask: food or tech? It still answers, in tens of milliseconds, with no internet.

**What you learn:**
- A model is a file of numbers. Once it's on your device, your device does the maths.
- Big chat AIs need the internet only because they're too big for a phone.

**Honest limits** (from the A2 spike on Android Chrome, see [docs/DESIGN.md](../../docs/DESIGN.md)):
- **Don't reload while offline.** The model lives in the page's memory; a reload wipes it and
  shows a blank page. The chapter warns about this before and during.
- Offline is detected with `navigator.onLine` and the `online`/`offline` events. No service worker.
- The `plug-offline` count is sent when the visitor is back online, because a beacon sent offline
  is lost.
- If chapter 3's talking model is loaded, it works offline too, and the chapter says so.

**Tiers:** Local only (that's the point). Replay visitors get the download offer. No API key.

**Engine used:** `embed()` in [`engine/ai.js`](../../engine/ai.js); `mean()` and `nearestGroup()`
in [`engine/math.js`](../../engine/math.js); `isReady()` in [`engine/runtime.js`](../../engine/runtime.js).
Reuses the food/tech cards and `showVerdict()` from [Bonus 1](../04-teach/).
