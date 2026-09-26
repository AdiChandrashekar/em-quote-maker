import test from 'node:test';
import assert from 'node:assert/strict';
import { BACKDROPS, BACKDROP_KEYS } from '../js/backdrops.js';
import { derivePalette, isHex } from '../js/palette.js';
import { keepRects, planLayout, quoteZone } from '../js/layout.js';
import { SIZES, SWATCHES } from '../js/presets.js';

const seg = new Intl.Segmenter('hi', { granularity: 'grapheme' });
const measure = (text, cssFont) => [...seg.segment(text)].length * Number(/([\d.]+)px/.exec(cssFont)[1]) * 0.5;
const SAMPLE = { quote: 'शिक्षा वह शस्त्र है जिससे आप दुनिया बदल सकते हैं।', name: 'कृष्ण कुमार', role: 'प्राथमिक शिक्षक' };

// A 2D context that records every call and property write, with numbers rounded.
function recordingContext(W, H) {
  const log = [];
  const clean = (v) => (typeof v === 'number' ? Math.round(v * 100) / 100 : typeof v === 'object' && v ? '[obj]' : v);
  const gradient = { addColorStop: (...a) => log.push(['stop', ...a.map(clean)]) };
  const target = {
    canvas: { width: W, height: H },
    createLinearGradient: (...a) => (log.push(['linear', ...a.map(clean)]), gradient),
    createRadialGradient: (...a) => (log.push(['radial', ...a.map(clean)]), gradient),
    getImageData: (x, y, w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }),
    measureText: (t) => ({ width: t.length * 10, actualBoundingBoxAscent: 50, actualBoundingBoxLeft: 0 }),
  };
  const ctx = new Proxy(target, {
    get(t, k) {
      if (k in t) return t[k];
      return (...args) => log.push([String(k), ...args.map(clean)]);
    },
    set(t, k, v) {
      log.push(['set', String(k), clean(v)]);
      t[k] = v;
      return true;
    },
  });
  return { ctx, log };
}

function env(W, H, colour) {
  const plan = planLayout({ W, H, ...SAMPLE }, measure);
  return { p: derivePalette(colour), u: plan.u, plan, zone: quoteZone(plan), keep: keepRects(plan), photo: null, fx: 0.5, fy: 0.5 };
}

function draw(key, W, H, colour) {
  const { ctx, log } = recordingContext(W, H);
  BACKDROPS[key].draw(ctx, W, H, env(W, H, colour));
  return log;
}

test('the registry has Plain, the 16 chosen backdrops and Photo', () => {
  assert.deepEqual(BACKDROP_KEYS, [
    'plain', 'kolam', 'jaali', 'blockprint', 'warli', 'truckart', 'swiss', 'destijl', 'opart',
    'halftone', 'letterpress', 'notebook', 'blueprint', 'aurora', 'grainy', 'memphis', 'brutal', 'photo',
  ]);
  const brand = SWATCHES.map((s) => s.hex);
  for (const [key, b] of Object.entries(BACKDROPS)) {
    assert.ok(b.label, `${key} label`);
    assert.ok(isHex(b.natural) && brand.includes(b.natural), `${key} natural colour is a brand swatch`);
    assert.equal(typeof b.usesZone, 'boolean', `${key} usesZone`);
  }
});

const COLOURS = ['#0A2159', '#D71920', '#FFFFFF', '#FFD400', '#000000'];

for (const key of BACKDROP_KEYS) {
  test(`${key} draws at every size and colour, deterministically and without NaN`, () => {
    for (const [sizeKey, { w, h }] of Object.entries(SIZES)) {
      for (const colour of COLOURS) {
        const first = draw(key, w, h, colour);
        assert.ok(first.some(([op]) => /fill|stroke|putImageData/.test(op)), `${key} ${sizeKey} ${colour} paints something`);
        const text = JSON.stringify(first);
        assert.ok(!first.flat().some((v) => typeof v === 'number' && !Number.isFinite(v)), `${key} ${sizeKey} ${colour} finite`);
        assert.equal(JSON.stringify(draw(key, w, h, colour)), text, `${key} ${sizeKey} ${colour} is deterministic`);
      }
    }
  });
}

test('backdrops that do not use the zone ignore where the text sits', () => {
  const { w, h } = SIZES.portrait;
  for (const [key, b] of Object.entries(BACKDROPS)) {
    if (b.usesZone || key === 'photo') continue;
    const e1 = env(w, h, '#0A2159');
    const e2 = { ...e1, zone: { x: 1, y: 2, w: 3, h: 4 } };
    const a = recordingContext(w, h);
    const bb = recordingContext(w, h);
    b.draw(a.ctx, w, h, e1);
    b.draw(bb.ctx, w, h, e2);
    assert.equal(JSON.stringify(a.log), JSON.stringify(bb.log), `${key} must declare usesZone: true`);
  }
});
