# Bonus 2: Pull the plug

**In one line:** turn the internet off, and the AI on your device keeps working.

## Picture this

A calculator works without the internet. Lots of people think AI only lives far away, on the
internet. This one lives on your phone, and you can prove it.

## Try it

1. If the AI isn't on your device yet, download it (about 37–50 MB, once). Use Wi-Fi if you can.
2. Turn on **airplane mode** (on a laptop, turn off Wi-Fi). The badge turns 🔴 **Offline**.
3. Ask it: food or tech? It still answers, in a few hundredths of a second. 🎉
4. **Don't reload the page while you're offline.** The AI lives in the page's memory. A reload
   wipes it, and with no internet it can't come back.

## What you'll find out

- An AI is a file of numbers. Once it's on your device, your device does all the maths.
- Big chat AIs need the internet only because they're too big for a phone.

---

### For developers

- Offline is detected with `navigator.onLine` and the `online`/`offline` events. No service
  worker. Tested on Android Chrome in airplane mode (see [docs/DESIGN.md](../../docs/DESIGN.md)).
- The `plug-offline` count is sent once the visitor is back online, because a beacon sent
  offline is lost.
- If chapter 3's talking model is loaded, it works offline too, and the chapter says so.
- **Tiers:** Local only (that's the point). Replay visitors get the download offer. No API key.
- **Engine used:** `embed()` in [`engine/ai.js`](../../engine/ai.js); `mean()` and
  `nearestGroup()` in [`engine/math.js`](../../engine/math.js); `isReady()` in
  [`engine/runtime.js`](../../engine/runtime.js). Reuses the cards and `showVerdict()` from
  [Bonus 1](../04-teach/).
