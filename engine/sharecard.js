// "My sentence's journey through AI": a shareable image drawn on the visitor's own device.
// Nothing is uploaded. The visitor chooses to share or save it.
export const SITE_URL = 'khadir-syed.github.io/k_ai-playground';
const AVATAR = 'https://avatars.githubusercontent.com/u/15974849?v=4&s=192';
const W = 1080, H = 1350;
const C = { bg: '#0b0a09', card: '#1c1917', line: '#292524', text: '#f5f5f4', muted: '#a8a29e', soft: '#d6d3d1', amber: '#fbbf24', orange: '#d97706' };
const CHIPS = ['rgba(251,191,36,0.18)', 'rgba(251,146,60,0.18)', 'rgba(214,211,209,0.12)', 'rgba(245,158,11,0.24)', 'rgba(234,88,12,0.2)', 'rgba(253,230,138,0.14)'];
const FONT = '-apple-system, system-ui, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

const clip = (s, n) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);

// What goes on the card. Pure, so tests/ can check it. Missing parts (e.g. a chapter that
// failed to load) are simply left off.
export function cardContent(sentence, journey = {}) {
  const tokens = journey.tokens ?? [];
  return {
    sentence: clip(sentence, 90),
    tokens: tokens.slice(0, 14).map((t) => t.text.replace(/\n/g, '↵').replace(/^ /, '␣')),
    moreTokens: Math.max(0, tokens.length - 14),
    tokenCount: tokens.length,
    neighbour: journey.neighbour ? { text: clip(journey.neighbour.text, 40), pct: Math.round(journey.neighbour.sim * 100) } : null,
    reply: journey.reply?.trim() ? clip(journey.reply.trim().replace(/\s+/g, ' '), 120) : null,
  };
}

// Draws the card. Lays it out once on a scratch canvas to measure, then grows the real canvas
// past the standard 4:5 shape only if the content needs it, so the footer is never covered.
export async function drawCard(canvas, content) {
  const avatar = await loadImage(AVATAR);
  const measured = paint(document.createElement('canvas').getContext('2d'), content, H, avatar);
  canvas.width = W;
  canvas.height = Math.max(H, measured + 190);
  paint(canvas.getContext('2d'), content, canvas.height, avatar);
}

function paint(ctx, content, H, avatar) {
  ctx.canvas.width = W;
  ctx.canvas.height = H;
  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient(W / 2, 0, 0, W / 2, 0, W * 0.8);
  glow.addColorStop(0, 'rgba(217,119,6,0.22)');
  glow.addColorStop(1, 'rgba(11,10,9,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  // Brand row
  if (avatar) {
    roundRect(ctx, 72, 72, 96, 96, 24, '#f59e0b');
    ctx.save(); clipRound(ctx, 75, 75, 90, 90, 21); ctx.drawImage(avatar, 75, 75, 90, 90); ctx.restore();
  }
  const bx = avatar ? 196 : 72;
  text(ctx, 'K', bx, 118, `900 40px ${FONT}`, C.amber);
  text(ctx, ' THE TECHMAN', bx + ctx.measureText('K').width, 118, `900 40px ${FONT}`, '#fff');
  text(ctx, 'AI PLAYGROUND', bx, 156, `700 22px ${FONT}`, 'rgba(253,230,138,0.9)', 2);

  text(ctx, 'MY SENTENCE’S JOURNEY', 72, 262, `900 58px ${FONT}`, '#fff');
  text(ctx, 'THROUGH AI', 72, 326, `900 58px ${FONT}`, C.amber);

  let y = 380;
  y = section(ctx, y, 'THE SENTENCE', (top, draw) => wrap(ctx, `“${content.sentence}”`, 112, top + 40, W - 224, 46, `italic 600 38px ${FONT}`, '#fff', draw));

  if (content.tokens.length) {
    y = section(ctx, y, `1 · CHOPPED INTO ${content.tokenCount} TOKENS`, (top, draw) => {
      ctx.font = `700 30px ui-monospace, Menlo, Consolas, monospace`;
      let x = 112, row = top + 20;
      const chips = content.moreTokens ? [...content.tokens, `+${content.moreTokens}`] : content.tokens;
      chips.forEach((t, i) => {
        const w = ctx.measureText(t).width + 28;
        if (x + w > W - 112) { x = 112; row += 62; }
        roundRect(ctx, x, row, w, 50, 10, CHIPS[i % CHIPS.length], draw);
        text(ctx, t, x + 14, row + 35, ctx.font, '#fde68a', 0, draw);
        x += w + 10;
      });
      return row + 50;
    });
  }
  if (content.neighbour) {
    y = section(ctx, y, '2 · ITS CLOSEST NEIGHBOUR IN MEANING', (top, draw) => {
      const end = wrap(ctx, `“${content.neighbour.text}”`, 112, top + 40, W - 224, 42, `700 34px ${FONT}`, '#fff', draw);
      roundRect(ctx, 112, end + 18, W - 224, 14, 7, C.line, draw);
      roundRect(ctx, 112, end + 18, (W - 224) * Math.max(0.04, content.neighbour.pct / 100), 14, 7, C.amber, draw);
      text(ctx, `${content.neighbour.pct}% similar`, 112, end + 70, `600 26px ${FONT}`, C.muted, 0, draw);
      return end + 76;
    });
  }
  if (content.reply) {
    y = section(ctx, y, '3 · THE AI GUESSED A REPLY', (top, draw) => wrap(ctx, `“${content.reply}”`, 112, top + 40, W - 224, 40, `500 32px ${FONT}`, C.soft, draw));
  }

  // Footer: an invitation, not an ad
  text(ctx, 'Follow your own sentence →', 72, H - 118, `800 34px ${FONT}`, '#fff');
  text(ctx, SITE_URL, 72, H - 72, `700 30px ${FONT}`, C.amber);
  ctx.textAlign = 'right';
  text(ctx, 'LEARNING SHOULD NOT STOP.', W - 72, H - 120, `600 20px ${FONT}`, C.muted, 2);
  ctx.textAlign = 'left';
  return y;
}

export function canvasToFile(canvas) {
  return new Promise((resolve, reject) => canvas.toBlob(
    (blob) => (blob ? resolve(new File([blob], 'my-ai-journey.png', { type: 'image/png' })) : reject(new Error('Could not create image'))),
    'image/png'));
}

// Each body is called twice: once to measure its height (draw = false), then to draw it on its box.
function section(ctx, y, label, body) {
  const top = y + 24;
  const bottom = body(top + 44, false) + 28;
  roundRect(ctx, 72, top, W - 144, bottom - top, 24, C.card);
  ctx.strokeStyle = C.line; ctx.lineWidth = 2; ctx.stroke();
  roundRect(ctx, 72, top, 6, bottom - top, 3, C.amber);
  text(ctx, label, 112, top + 50, `800 22px ${FONT}`, C.amber, 2);
  body(top + 44, true);
  return bottom;
}

function text(ctx, s, x, y, font, color, spacing = 0, draw = true) {
  ctx.font = font;
  if (!draw) return;
  ctx.fillStyle = color;
  ctx.letterSpacing = `${spacing}px`;
  ctx.fillText(s, x, y);
  ctx.letterSpacing = '0px';
}

function wrap(ctx, s, x, y, maxWidth, lineHeight, font, color, draw = true) {
  ctx.font = font;
  let line = '', top = y;
  for (const word of s.split(' ')) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) { text(ctx, line, x, top + lineHeight * 0.8, font, color, 0, draw); line = word; top += lineHeight; }
    else line = test;
  }
  text(ctx, line, x, top + lineHeight * 0.8, font, color, 0, draw);
  return top + lineHeight;
}

function roundRect(ctx, x, y, w, h, r, fill, draw = true) {
  if (!draw) return;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fillStyle = fill;
  ctx.fill();
}

function clipRound(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.clip();
}

function loadImage(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous'; // the avatar host allows this, so the canvas stays exportable
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}
