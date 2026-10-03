// Cookie-free visit counting with GoatCounter (https://www.goatcounter.com).
// Sends only a page path or one of the fixed event names below — never anything a visitor types.
// We don't load GoatCounter's own script: our CSP allows only this site's scripts.
const ENDPOINT = 'https://khadir-syed.goatcounter.com/count';
const PREFIX = 'k_ai-playground/'; // one counter serves every k_ai site; this keeps the playground's events apart

export const EVENTS = new Set([
  'start-ready-made', 'start-own-words',
  'chapter-1', 'chapter-2', 'chapter-3',
  'live-model', 'story-done',
  'share-card-shared', 'share-card-saved',
  'bonus-teach', 'bonus-teach-own', 'bonus-plug', 'plug-offline', 'museum-open',
]);

export function countURL(path, event = false) {
  const q = new URLSearchParams({ p: path, rnd: Math.random().toString(36).slice(2) });
  if (event) q.set('e', 'true');
  return `${ENDPOINT}?${q}`;
}

export const isLiveSite = (host) => host.endsWith('.github.io'); // local testing never counts

function send(url) {
  if (!isLiveSite(location.hostname)) return false;
  try { return navigator.sendBeacon(url); } catch { return false; }
}

export const countPage = () => send(countURL(location.pathname));

export function countEvent(name) {
  if (!EVENTS.has(name)) return console.warn(`Unknown analytics event: ${name}`), false; // never break the story
  return send(countURL(PREFIX + name, true));
}
