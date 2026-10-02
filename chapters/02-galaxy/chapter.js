// Chapter 2 — Meaning is a place. Every sentence becomes a star; similar ideas sit close together.
import { h, prefersReducedMotion } from '../../engine/dom.js';
import { cosine, pca, project } from '../../engine/math.js';
import { embed } from '../../engine/ai.js';
import { loadEmbedder } from '../../engine/runtime.js';

const COLORS = { weather: '#5ec8ff', animals: '#ffb454', food: '#ff7a9a', tech: '#9d8cff', feelings: '#5ee6a0', sports: '#ffe066' };

export default {
  short: 'Meaning',
  title: 'Meaning is a place',
  mount(root, { state }) {
    const canvas = h('canvas', { class: 'galaxy', role: 'img', 'aria-label': 'A star map of sentences. Your sentence is the bright white star.' });
    const caption = h('p', { class: 'caption', 'aria-live': 'polite' }, 'Drag to spin the galaxy. Tap a star to read it.');
    const neighbours = h('ol', { class: 'neighbours' });
    root.append(
      h('p', { class: 'lead' }, 'Next, the AI turns your whole sentence into a list of 384 numbers — its ', h('strong', {}, 'meaning'), '. Think of those numbers as an address in a giant galaxy. Sentences that mean similar things live in the same neighbourhood.'),
      canvas, caption,
      h('ul', { class: 'legend' }, Object.entries(COLORS).map(([g, c]) => h('li', {}, h('span', { class: 'dot', style: { background: c } }), g))),
      h('h3', {}, 'Your sentence’s closest neighbours'),
      neighbours,
      h('details', {},
        h('summary', {}, 'Wait — 384 dimensions on a flat screen?'),
        h('p', {}, 'We squash 384 directions down to the 3 that spread the stars out the most (a trick called PCA). Some distance gets lost in the squash, so the neighbour list below uses the full 384 numbers — that’s what an AI search actually uses. This is exactly how “search by meaning” (RAG) finds the right document.')),
    );

    const stars = state.story.stars;
    const basis = pca(stars.map((s) => s.embedding), 3);
    const points = stars.map((s) => ({ ...s, pos: project(s.embedding, basis) }));
    const scale = Math.max(...points.flatMap((p) => p.pos.map(Math.abs)));
    let you = null, selected = null, placed = [], angle = 0.6, tilt = 0.35, raf = 0, dragging = null;

    const embeddingPromise = state.preset
      ? Promise.resolve(state.preset.embedding)
      : loadEmbedder().then((ex) => embed(ex, [state.sentence])).then(([v]) => v);
    embeddingPromise.then((v) => {
      you = { text: state.sentence, pos: project(v, basis), you: true };
      const ranked = points.map((p) => ({ p, sim: cosine(v, p.embedding) })).sort((a, b) => b.sim - a.sim).slice(0, 3);
      you.near = ranked.map((r) => r.p);
      neighbours.replaceChildren(...ranked.map(({ p, sim }) => h('li', {},
        h('span', { class: 'n-text' }, p.text),
        h('span', { class: 'meter' }, h('span', { style: { width: `${Math.max(0, sim) * 100}%`, background: COLORS[p.group] } })),
        h('span', { class: 'n-pct' }, `${Math.round(sim * 100)}% similar`))));
      draw();
    }, (err) => {
      console.error(err);
      caption.textContent = 'Couldn’t load the meaning model. Go back and pick a ready-made sentence.';
    });

    const ctx = canvas.getContext('2d');
    const screen = (pos, w, hgt) => {
      const [x, y, z] = pos.map((v) => v / scale);
      const x1 = x * Math.cos(angle) - z * Math.sin(angle);
      const z1 = x * Math.sin(angle) + z * Math.cos(angle);
      const y1 = y * Math.cos(tilt) - z1 * Math.sin(tilt);
      const z2 = y * Math.sin(tilt) + z1 * Math.cos(tilt);
      const persp = 2.4 / (2.4 + z2);
      const r = Math.min(w, hgt) * 0.4;
      return { x: w / 2 + x1 * r * persp, y: hgt / 2 + y1 * r * persp, s: persp, z: z2 };
    };

    function draw() {
      const dpr = devicePixelRatio || 1;
      const w = canvas.clientWidth, hgt = canvas.clientHeight;
      if (canvas.width !== w * dpr) { canvas.width = w * dpr; canvas.height = hgt * dpr; }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, hgt);
      const all = you ? [...points, you] : points;
      placed = all.map((p) => ({ p, ...screen(p.pos, w, hgt) })).sort((a, b) => b.z - a.z);
      if (you) {
        const yp = placed.find((q) => q.p.you);
        ctx.strokeStyle = 'rgba(255,255,255,0.45)';
        ctx.lineWidth = 1;
        for (const n of you.near) {
          const q = placed.find((t) => t.p === n);
          ctx.beginPath(); ctx.moveTo(yp.x, yp.y); ctx.lineTo(q.x, q.y); ctx.stroke();
        }
      }
      ctx.font = '12px system-ui, sans-serif';
      for (const q of placed) {
        const isYou = q.p.you;
        const r = (isYou ? 9 : 4) * q.s;
        ctx.shadowBlur = isYou ? 24 : 10;
        ctx.shadowColor = ctx.fillStyle = isYou ? '#ffffff' : COLORS[q.p.group];
        ctx.beginPath(); ctx.arc(q.x, q.y, r, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;
        if (you?.near.includes(q.p)) {
          ctx.strokeStyle = COLORS[q.p.group];
          ctx.beginPath(); ctx.arc(q.x, q.y, r + 5, 0, Math.PI * 2); ctx.stroke();
        }
        if (isYou || q.p === selected) {
          const label = isYou ? '★ your sentence' : q.p.text;
          const tw = ctx.measureText(label).width;
          ctx.fillStyle = '#ffffff';
          ctx.fillText(label, q.x + r + 4 + tw > w ? q.x - r - 4 - tw : q.x + r + 4, q.y + 4);
        }
      }
    }

    function spin() {
      if (!dragging) angle += 0.0025;
      draw();
      raf = requestAnimationFrame(spin);
    }

    canvas.addEventListener('pointerdown', (e) => { dragging = { x: e.clientX, y: e.clientY, moved: false }; canvas.setPointerCapture(e.pointerId); });
    canvas.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      const dx = e.clientX - dragging.x, dy = e.clientY - dragging.y;
      if (Math.abs(dx) + Math.abs(dy) > 3) dragging.moved = true;
      angle += dx * 0.01; tilt = Math.max(-1.2, Math.min(1.2, tilt + dy * 0.01));
      dragging.x = e.clientX; dragging.y = e.clientY;
      draw();
    });
    canvas.addEventListener('pointerup', (e) => {
      if (dragging && !dragging.moved) {
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left, y = e.clientY - rect.top;
        const hit = placed.reduce((best, q) => {
          const d = Math.hypot(q.x - x, q.y - y);
          return d < 28 && (!best || d < best.d) ? { q, d } : best;
        }, null);
        selected = hit?.q.p ?? null;
        caption.textContent = selected ? (selected.you ? `★ “${selected.text}”` : `“${selected.text}” · ${selected.group}`) : 'Drag to spin the galaxy. Tap a star to read it.';
        draw();
      }
      dragging = null;
    });

    const onResize = () => draw();
    addEventListener('resize', onResize);
    if (prefersReducedMotion()) draw(); else spin();
    return () => { cancelAnimationFrame(raf); removeEventListener('resize', onResize); };
  },
};
