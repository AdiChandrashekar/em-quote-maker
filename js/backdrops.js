// Backdrops drawn under the quote. Every colour comes from the palette, so any base colour works,
// and every length is in u = min(W, H) / 1080, so every social size works.
// draw(c, W, H, env) — env: { p: palette, u, plan, zone, keep: {mark, footer}, photo, fx, fy }.
import { coverRect } from './layout.js';
import { mix, rgba, WHITE } from './palette.js';
import { SERIF_STACK } from './presets.js';

const TAU = Math.PI * 2;
const NATURAL = { navy: '#0A2159', red: '#D71920', mist: '#F5F6FA', white: '#FFFFFF' };

// ---------- drawing helpers ----------

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const clamp01 = (v) => Math.min(1, Math.max(0, v));

function paint(c, W, H, colour) {
  c.fillStyle = colour;
  c.fillRect(0, 0, W, H);
}

// Flat base with a soft lighter glow behind the quote on dark colours.
function base(c, W, H, p) {
  paint(c, W, H, p.base);
  if (!p.dark) return;
  const cy = H * 0.42;
  const g = c.createRadialGradient(W / 2, cy, 0, W / 2, cy, Math.max(W, H) * 0.7);
  g.addColorStop(0, p.lift);
  g.addColorStop(1, p.base);
  c.fillStyle = g;
  c.fillRect(0, 0, W, H);
}

// Fades busy patterns out behind the quote so it stays readable.
function calm(c, W, H, z, p, alpha) {
  const cx = z.x + z.w / 2;
  const cy = z.y + z.h / 2;
  const r = Math.max(z.w, z.h) * 0.78;
  const g = c.createRadialGradient(cx, cy, r * 0.3, cx, cy, r);
  g.addColorStop(0, rgba(p.base, alpha));
  g.addColorStop(1, rgba(p.base, 0));
  c.fillStyle = g;
  c.fillRect(0, 0, W, H);
}

function grain(c, W, H, amount, seed) {
  const r = rng(seed);
  const img = c.getImageData(0, 0, W, H);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (r() - 0.5) * amount;
    d[i] += n;
    d[i + 1] += n;
    d[i + 2] += n;
  }
  c.putImageData(img, 0, 0);
}

function roundRect(c, x, y, w, h, r) {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}

function poly(c, pts) {
  c.beginPath();
  pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
  c.closePath();
}

function dot(c, x, y, r, colour) {
  c.fillStyle = colour;
  c.beginPath();
  c.arc(x, y, r, 0, TAU);
  c.fill();
}

function line(c, x0, y0, x1, y1) {
  c.beginPath();
  c.moveTo(x0, y0);
  c.lineTo(x1, y1);
  c.stroke();
}

function zigzag(c, x0, y0, x1, y1, step, amp) {
  const len = Math.hypot(x1 - x0, y1 - y0);
  const ux = (x1 - x0) / len;
  const uy = (y1 - y0) / len;
  c.beginPath();
  c.moveTo(x0, y0);
  for (let s = step / 2, k = 0; s <= len; s += step / 2, k++) {
    const o = (k % 2 ? -1 : 1) * amp;
    c.lineTo(x0 + ux * s - uy * o, y0 + uy * s + ux * o);
  }
  c.stroke();
}

function flower(c, x, y, r, petals, colour, centre) {
  c.fillStyle = colour;
  for (let i = 0; i < petals; i++) {
    const a = (i / petals) * TAU;
    c.beginPath();
    c.ellipse(x + Math.cos(a) * r * 0.6, y + Math.sin(a) * r * 0.6, r * 0.28, r * 0.55, a + Math.PI / 2, 0, TAU);
    c.fill();
  }
  if (centre) dot(c, x, y, r * 0.25, centre);
}

const inside = (x, y, rc, pad) => x > rc.x - pad && x < rc.x + rc.w + pad && y > rc.y - pad && y < rc.y + rc.h + pad;
// Pattern density relative to the 1080×1350 portrait the designs were drawn for.
const area = (W, H) => (W * H) / (1080 * 1350);

// ---------- backdrops ----------

export const BACKDROPS = {
  plain: {
    label: 'Plain', natural: NATURAL.navy, usesZone: false,
    draw(c, W, H, { p }) {
      base(c, W, H, p);
    },
  },

  kolam: {
    label: 'Kolam', natural: NATURAL.navy, usesZone: false,
    draw(c, W, H, { p, u }) {
      base(c, W, H, p);
      const cluster = (cx, cy, n, s, centre) => {
        c.save();
        c.translate(cx, cy);
        c.rotate(Math.PI / 4);
        c.strokeStyle = rgba(p.ink, 0.55);
        c.lineWidth = 3 * u;
        const h = s * 0.62;
        for (let i = -n; i <= n; i++) {
          for (let j = -n; j <= n; j++) {
            roundRect(c, i * s - h, j * s - h, 2 * h, 2 * h, h * 0.55);
            c.stroke();
          }
        }
        for (let i = -n; i <= n; i++) for (let j = -n; j <= n; j++) dot(c, i * s, j * s, 4 * u, rgba(p.ink, 0.85));
        if (centre) dot(c, 0, 0, 8 * u, p.accent);
        c.restore();
      };
      cluster(120 * u, 140 * u, 2, 44 * u, true);
      cluster(W - 120 * u, H - 150 * u, 2, 44 * u, true);
      cluster(W - 110 * u, 120 * u, 1, 40 * u, false);
      cluster(110 * u, H - 150 * u, 1, 40 * u, false);
    },
  },

  jaali: {
    label: 'Jaali', natural: NATURAL.navy, usesZone: true,
    draw(c, W, H, { p, u, zone }) {
      base(c, W, H, p);
      const s = 96 * u;
      const r = s * 0.3;
      const d = r * Math.SQRT2;
      c.strokeStyle = rgba(p.ink, 0.13);
      c.lineWidth = 2 * u;
      for (let y = 0; y <= H + s; y += s) {
        for (let x = 0; x <= W + s; x += s) {
          c.strokeRect(x - r, y - r, 2 * r, 2 * r);
          poly(c, [[x, y - d], [x + d, y], [x, y + d], [x - d, y]]);
          c.stroke();
          line(c, x + d, y, x + s - d, y);
          line(c, x, y + d, x, y + s - d);
        }
      }
      calm(c, W, H, zone, p, 0.9);
      c.strokeStyle = p.accent;
      c.lineWidth = 4 * u;
      c.strokeRect(30 * u, 30 * u, W - 60 * u, H - 60 * u);
    },
  },

  blockprint: {
    label: 'Block print', natural: NATURAL.mist, usesZone: true,
    draw(c, W, H, { p, u, zone }) {
      base(c, W, H, p);
      for (let row = 0, y = 40 * u; y < H + 60 * u; y += 104 * u, row++) {
        for (let x = ((row % 2) * 60 + 20) * u; x < W + 60 * u; x += 120 * u) {
          flower(c, x, y, 26 * u, 6, rgba(p.accent, 0.22), rgba(p.text, 0.35));
        }
      }
      calm(c, W, H, zone, p, 0.95);
      c.strokeStyle = p.accent;
      c.lineWidth = 3 * u;
      c.strokeRect(28 * u, 28 * u, W - 56 * u, H - 56 * u);
      c.lineWidth = 1.5 * u;
      c.strokeRect(40 * u, 40 * u, W - 80 * u, H - 80 * u);
    },
  },

  warli: {
    label: 'Warli', natural: NATURAL.navy, usesZone: false,
    draw(c, W, H, { p, u, plan }) {
      base(c, W, H, p);
      // A band of figures holding hands, sitting just above the opening quote mark.
      const ground = plan.mark.y - 14 * u;
      const h = Math.min(76 * u, ground - 8 * u);
      if (h < 12 * u) return;
      const sp = h * 0.8;
      c.strokeStyle = rgba(p.ink, 0.6);
      c.lineWidth = 2 * u;
      line(c, 0, ground + 2 * u, W, ground + 2 * u);
      const sh = ground - h * 0.78;
      const wa = ground - h * 0.5;
      const hip = ground - h * 0.26;
      let k = 0;
      for (let x = sp / 2; x < W; x += sp, k++) {
        const col = k % 6 === 3 ? p.accent : p.ink;
        c.fillStyle = col;
        c.strokeStyle = col;
        c.lineWidth = Math.max(1.5, h * 0.04);
        dot(c, x, ground - h * 0.91, h * 0.09, col);
        poly(c, [[x - h * 0.16, sh], [x + h * 0.16, sh], [x, wa]]);
        c.fill();
        poly(c, [[x, wa], [x - h * 0.15, hip], [x + h * 0.15, hip]]);
        c.fill();
        c.beginPath();
        c.moveTo(x - h * 0.13, hip); c.lineTo(x - h * 0.2, ground);
        c.moveTo(x + h * 0.13, hip); c.lineTo(x + h * 0.2, ground);
        c.moveTo(x - h * 0.16, sh); c.lineTo(x - sp / 2, sh + h * 0.2);
        c.moveTo(x + h * 0.16, sh); c.lineTo(x + sp / 2, sh + h * 0.2);
        c.stroke();
      }
    },
  },

  truckart: {
    label: 'Truck art', natural: NATURAL.navy, usesZone: false,
    draw(c, W, H, { p, u }) {
      base(c, W, H, p);
      const b = 46 * u;
      c.fillStyle = p.accent;
      c.fillRect(0, 0, W, b);
      c.fillRect(0, H - b, W, b);
      c.fillRect(0, 0, b, H);
      c.fillRect(W - b, 0, b, H);
      c.strokeStyle = p.onAccent;
      c.lineWidth = 5 * u;
      const step = 34 * u;
      const amp = 11 * u;
      zigzag(c, b, b / 2, W - b, b / 2, step, amp);
      zigzag(c, b, H - b / 2, W - b, H - b / 2, step, amp);
      zigzag(c, b / 2, b, b / 2, H - b, step, amp);
      zigzag(c, W - b / 2, b, W - b / 2, H - b, step, amp);
      c.strokeStyle = p.ink;
      c.lineWidth = 3 * u;
      c.strokeRect(b + 12 * u, b + 12 * u, W - 2 * b - 24 * u, H - 2 * b - 24 * u);
      for (const [x, y] of [[b / 2, b / 2], [W - b / 2, b / 2], [b / 2, H - b / 2], [W - b / 2, H - b / 2]]) {
        dot(c, x, y, 40 * u, p.base);
        flower(c, x, y, 38 * u, 8, p.onAccent, p.accent);
      }
    },
  },

  swiss: {
    label: 'Swiss', natural: NATURAL.white, usesZone: false,
    draw(c, W, H, { p, u }) {
      paint(c, W, H, p.base);
      c.strokeStyle = rgba(p.text, 0.07);
      c.lineWidth = 1.5 * u;
      for (let i = 1; i < 12; i++) line(c, (W / 12) * i, 0, (W / 12) * i, H);
      c.strokeStyle = rgba(p.text, 0.04);
      for (let y = 45 * u; y < H; y += 45 * u) line(c, 0, y, W, y);
      // A giant opening quote mark as the one dominant graphic.
      c.fillStyle = rgba(p.accent, 0.09);
      c.font = `700 ${900 * u}px ${SERIF_STACK}`;
      c.textAlign = 'left';
      c.textBaseline = 'alphabetic';
      const m = c.measureText('“');
      c.fillText('“', 60 * u + (m.actualBoundingBoxLeft || 0), 40 * u + (m.actualBoundingBoxAscent || 0));
      c.fillStyle = p.accent;
      c.fillRect(0, 0, 22 * u, H);
    },
  },

  destijl: {
    label: 'De Stijl', natural: NATURAL.white, usesZone: false,
    draw(c, W, H, { p, u, plan }) {
      paint(c, W, H, p.base);
      const s = 56 * u;
      const t = 14 * u;
      const top = Math.min(80 * u, plan.mark.y - 20 * u);
      const bot = H - 52 * u;
      const a1 = 0.28 * H;
      const a2 = a1 + 0.17 * H;
      const b1 = bot - 0.19 * H;
      c.fillStyle = p.accent;
      c.fillRect(0, 0, s, top);
      c.fillRect(W - s, a1, s, a2 - a1);
      c.fillStyle = p.text;
      c.fillRect(0, b1, s, bot - b1);
      c.fillRect(W - s, bot, s, H - bot);
      c.fillRect(s - t / 2, 0, t, H);
      c.fillRect(W - s - t / 2, 0, t, H);
      c.fillRect(0, top - t / 2, W, t);
      c.fillRect(0, bot - t / 2, W, t);
      c.fillRect(0, b1 - t / 2, s, t);
      c.fillRect(W - s, a1 - t / 2, s, t);
      c.fillRect(W - s, a2 - t / 2, s, t);
    },
  },

  opart: {
    label: 'Op Art', natural: NATURAL.navy, usesZone: true,
    draw(c, W, H, { p, u, zone }) {
      base(c, W, H, p);
      c.strokeStyle = rgba(p.ink, 0.07);
      c.lineWidth = 7 * u;
      const reach = Math.hypot(W, H) * 1.1;
      for (const [cx, cy] of [[W * 1.05, -H * 0.05], [-W * 0.1, H * 1.05]]) {
        for (let r = 20 * u; r < reach; r += 20 * u) {
          c.beginPath();
          c.arc(cx, cy, r, 0, TAU);
          c.stroke();
        }
      }
      calm(c, W, H, zone, p, 0.85);
    },
  },

  halftone: {
    label: 'Halftone', natural: NATURAL.navy, usesZone: false,
    draw(c, W, H, { p, u }) {
      base(c, W, H, p);
      const step = 24 * u;
      const soft = rgba(p.ink, 0.16);
      for (let y = step / 2; y < H; y += step) {
        for (let x = step / 2; x < W; x += step) {
          const br = clamp01((x / W + y / H - 1.15) / 0.85);
          const tl = clamp01((0.8 - (x / W + y / H)) / 0.8);
          if (br > 0) dot(c, x, y, 11 * u * br ** 1.1, p.accent);
          if (tl > 0) dot(c, x, y, 9 * u * tl, soft);
        }
      }
    },
  },

  letterpress: {
    label: 'Letterpress', natural: NATURAL.mist, usesZone: false,
    draw(c, W, H, { p, u }) {
      paint(c, W, H, p.base);
      const r = rng(3);
      c.strokeStyle = rgba(p.text, 0.05);
      c.lineWidth = u;
      const fibres = Math.round(1600 * area(W, H));
      for (let i = 0; i < fibres; i++) {
        const x = r() * W;
        const y = r() * H;
        const a = r() * Math.PI;
        const l = (6 + r() * 14) * u;
        line(c, x, y, x + Math.cos(a) * l, y + Math.sin(a) * l);
      }
      // Pressed rules: a light edge offset under each line reads as a deboss.
      const highlight = p.dark ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.9)';
      const frame = (inset, lw) => {
        c.lineWidth = lw;
        c.strokeStyle = highlight;
        c.strokeRect(inset + 1.5 * u, inset + 1.5 * u, W - 2 * inset, H - 2 * inset);
        c.strokeStyle = p.text;
        c.strokeRect(inset, inset, W - 2 * inset, H - 2 * inset);
      };
      frame(44 * u, 4 * u);
      frame(58 * u, 1.5 * u);
      const k = 58 * u;
      const d = 12 * u;
      c.fillStyle = p.accent;
      for (const [x, y] of [[k, k], [W - k, k], [k, H - k], [W - k, H - k]]) {
        poly(c, [[x, y - d], [x + d, y], [x, y + d], [x - d, y]]);
        c.fill();
      }
    },
  },

  notebook: {
    label: 'Notebook', natural: NATURAL.white, usesZone: true,
    draw(c, W, H, { p, u, plan }) {
      paint(c, W, H, p.base);
      // Rules follow the quote's own line pitch, so the words sit on them.
      const q = plan.quote;
      const lh = q.lineHeight;
      const start = plan.mark.y + 110 * u;
      const first = q.top + lh / 2 + q.size * 0.36;
      c.strokeStyle = rgba(p.text, 0.11);
      c.lineWidth = 2 * u;
      for (let y = first - Math.floor((first - start) / lh) * lh; y < H; y += lh) line(c, 0, y, W, y);
      c.strokeStyle = rgba(p.accent, 0.6);
      c.lineWidth = 3 * u;
      line(c, 72 * u, 0, 72 * u, H);
      for (const y of [H * 0.18, H * 0.5, H * 0.82]) {
        dot(c, 36 * u, y, 17 * u, rgba(p.text, 0.12));
        dot(c, 36 * u, y + 2 * u, 14 * u, p.base);
      }
    },
  },

  blueprint: {
    label: 'Blueprint', natural: NATURAL.navy, usesZone: true,
    draw(c, W, H, { p, u, zone }) {
      paint(c, W, H, p.base);
      const s = 27 * u;
      const grid = (i) => {
        const major = i % 5 === 0;
        c.strokeStyle = rgba(p.ink, major ? 0.15 : 0.06);
        c.lineWidth = (major ? 2 : 1) * u;
      };
      for (let i = 0, x = 0; x <= W; i++, x += s) { grid(i); line(c, x, 0, x, H); }
      for (let i = 0, y = 0; y <= H; i++, y += s) { grid(i); line(c, 0, y, W, y); }
      calm(c, W, H, zone, p, 0.7);
      c.strokeStyle = rgba(p.ink, 0.55);
      c.lineWidth = 2 * u;
      for (let i = 0, x = 0; x < W; i++, x += s) line(c, x, 0, x, (i % 5 === 0 ? 20 : 9) * u);
      for (let i = 0, y = 0; y < H; i++, y += s) line(c, 0, y, (i % 5 === 0 ? 20 : 9) * u, y);
      c.strokeStyle = p.accent;
      c.lineWidth = 3 * u;
      for (const [x, y] of [[W - 70 * u, 70 * u], [70 * u, H - 70 * u]]) {
        c.beginPath();
        c.arc(x, y, 18 * u, 0, TAU);
        c.moveTo(x - 30 * u, y); c.lineTo(x + 30 * u, y);
        c.moveTo(x, y - 30 * u); c.lineTo(x, y + 30 * u);
        c.stroke();
      }
    },
  },

  aurora: {
    label: 'Aurora', natural: NATURAL.navy, usesZone: false,
    draw(c, W, H, { p }) {
      paint(c, W, H, p.base);
      const glow = (x, y, r, colour, alpha) => {
        const g = c.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, rgba(colour, alpha));
        g.addColorStop(1, rgba(p.base, 0));
        c.fillStyle = g;
        c.fillRect(0, 0, W, H);
      };
      glow(W * 0.05, H * 0.95, W * 0.8, p.accent, 0.55);
      glow(W * 0.95, H * 0.05, W * 0.7, p.ink, 0.14);
      glow(W * 0.9, H * 0.35, W * 0.4, p.accent, 0.22);
      grain(c, W, H, 12, 5);
    },
  },

  grainy: {
    label: 'Grainy', natural: NATURAL.navy, usesZone: false,
    draw(c, W, H, { p }) {
      const g = c.createLinearGradient(0, 0, W * 0.6, H);
      g.addColorStop(0, p.base);
      g.addColorStop(0.55, p.base);
      g.addColorStop(1, p.accent);
      c.fillStyle = g;
      c.fillRect(0, 0, W, H);
      grain(c, W, H, 30, 9);
    },
  },

  memphis: {
    label: 'Memphis', natural: NATURAL.white, usesZone: true,
    draw(c, W, H, { p, u, zone, keep }) {
      paint(c, W, H, p.base);
      const r = rng(21);
      const avoid = [zone, keep.mark, keep.footer];
      const want = Math.max(8, Math.round(26 * area(W, H)));
      c.lineCap = 'round';
      for (let placed = 0, tries = 0; placed < want && tries < 3000; tries++) {
        const x = r() * W;
        const y = r() * H;
        const turn = r() * Math.PI;
        const col = r() < 0.5 ? p.accent : p.text;
        if (avoid.some((rc) => inside(x, y, rc, 70 * u))) continue;
        placed++;
        c.save();
        c.translate(x, y);
        c.rotate(turn);
        c.strokeStyle = col;
        c.fillStyle = col;
        c.lineWidth = 7 * u;
        const kind = placed % 6;
        if (kind === 0) {
          c.beginPath();
          for (let t = 0; t <= 100; t += 5) c.lineTo((t - 50) * u, Math.sin(t / 10) * 12 * u);
          c.stroke();
        } else if (kind === 1) {
          zigzag(c, -50 * u, 0, 50 * u, 0, 22 * u, 10 * u);
        } else if (kind === 2) {
          c.fillRect(-14 * u, -5 * u, 28 * u, 10 * u);
        } else if (kind === 3) {
          for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) dot(c, (i - 1) * 14 * u, (j - 1) * 14 * u, 4 * u, col);
        } else if (kind === 4) {
          poly(c, [[0, -22 * u], [20 * u, 14 * u], [-20 * u, 14 * u]]);
          c.stroke();
        } else {
          c.beginPath();
          c.arc(0, 0, 22 * u, 0, Math.PI);
          c.fill();
        }
        c.restore();
      }
    },
  },

  brutal: {
    label: 'Brutal', natural: NATURAL.mist, usesZone: true,
    draw(c, W, H, { p, u, zone }) {
      paint(c, W, H, p.base);
      const step = 28 * u;
      const dots = rgba(p.text, 0.16);
      for (let y = step / 2; y < H; y += step) for (let x = step / 2; x < W; x += step) dot(c, x, y, 2 * u, dots);
      // A card with a hard offset shadow behind the quote, kept inside the frame.
      const pad = 36 * u;
      const shadow = 18 * u;
      const margin = 34 * u;
      const x = Math.max(margin, zone.x - pad);
      const w = Math.min(zone.x + zone.w + pad, W - margin - shadow) - x;
      const y = zone.y - pad;
      const h = zone.h + 2 * pad;
      c.fillStyle = p.text;
      c.fillRect(x + shadow, y + shadow, w, h);
      c.fillStyle = mix(p.base, WHITE, p.dark ? 0.06 : 0.6);
      c.fillRect(x, y, w, h);
      c.strokeStyle = p.text;
      c.lineWidth = 6 * u;
      c.strokeRect(x, y, w, h);
      dot(c, x + w - 30 * u, y - 6 * u, 30 * u, p.accent);
      c.lineWidth = 5 * u;
      c.beginPath();
      c.arc(x + w - 30 * u, y - 6 * u, 30 * u, 0, TAU);
      c.stroke();
    },
  },

  photo: {
    label: 'Photo', natural: NATURAL.navy, usesZone: false,
    draw(c, W, H, { p, photo, fx, fy }) {
      if (!photo) {
        base(c, W, H, p);
        return;
      }
      const r = coverRect(photo.width, photo.height, W, H, fx, fy);
      c.drawImage(photo, r.sx, r.sy, r.sw, r.sh, 0, 0, W, H);
      const tint = c.createLinearGradient(0, 0, 0, H);
      tint.addColorStop(0, rgba(p.base, 0.55));
      tint.addColorStop(1, rgba(p.base, 0.88));
      c.fillStyle = tint;
      c.fillRect(0, 0, W, H);
    },
  },
};

export const BACKDROP_KEYS = Object.keys(BACKDROPS);
