import test from 'node:test';
import assert from 'node:assert/strict';
import {
  hasDevanagari, normaliseQuote, wrapLines, fitQuote,
  LAYOUT, planLayout, coverRect, dragFocus, fitWithin, exportName, quoteZone,
} from '../js/layout.js';
import { SIZES } from '../js/presets.js';

const seg = new Intl.Segmenter('hi', { granularity: 'grapheme' });
const graphemes = (s) => [...seg.segment(s)].length;
// Fake measure: every grapheme is `w` units wide.
const fixed = (w) => (text) => graphemes(text) * w;

test('hasDevanagari detects Hindi anywhere in the text', () => {
  assert.equal(hasDevanagari('शिक्षा'), true);
  assert.equal(hasDevanagari('NEP 2020 पर चर्चा'), true);
  assert.equal(hasDevanagari('Learn. Reflect. Grow.'), false);
  assert.equal(hasDevanagari(undefined), false);
});

test('normaliseQuote trims, collapses spaces and blank lines', () => {
  assert.equal(normaliseQuote('  a \t b  c  '), 'a b c');
  assert.equal(normaliseQuote('one\r\n\r\n\r\ntwo\rthree'), 'one\n\ntwo\nthree');
  assert.equal(normaliseQuote('\n\n x \n\n'), 'x');
  assert.equal(normaliseQuote(null), '');
});

test('normaliseQuote keeps ZWJ, ZWNJ and nukta forms (text pasted from WhatsApp)', () => {
  const s = 'क्‍ष र‌र क़ानून ज़रूरी';
  assert.equal(normaliseQuote(s), s);
});

test('wrapLines wraps English at spaces', () => {
  const { lines, overflowWord } = wrapLines('the quick brown fox', 9, fixed(1));
  assert.deepEqual(lines.map((l) => l.text), ['the quick', 'brown fox']);
  assert.ok(lines.every((l) => l.scaleX === 1 && l.width <= 9));
  assert.equal(overflowWord, false);
});

test('wrapLines never splits Hindi words', () => {
  const q = 'शिक्षा वह शस्त्र है जिससे आप दुनिया बदल सकते हैं।';
  const { lines } = wrapLines(q, 8, fixed(1));
  assert.ok(lines.length > 1);
  assert.deepEqual(lines.flatMap((l) => l.text.split(' ')), q.split(' '));
  assert.ok(lines.some((l) => l.text.includes('शिक्षा')));
});

test('wrapLines handles mixed Hindi and English', () => {
  const q = 'NEP 2020 ने foundational literacy को प्राथमिकता दी';
  const { lines } = wrapLines(q, 12, fixed(1));
  assert.ok(lines.length > 1);
  assert.deepEqual(lines.flatMap((l) => l.text.split(' ')), q.split(' '));
});

test('wrapLines keeps typed line breaks and one blank line', () => {
  const { lines } = wrapLines('पहली पंक्ति\n\n\nदूसरी', 100, fixed(1));
  assert.deepEqual(lines.map((l) => l.text), ['पहली पंक्ति', '', 'दूसरी']);
});

test('a word wider than the line gets its own squeezed line', () => {
  const { lines, overflowWord } = wrapLines('see https://educationmirror.org/very/long/path now', 10, fixed(1));
  assert.deepEqual(lines.map((l) => l.text), ['see', 'https://educationmirror.org/very/long/path', 'now']);
  assert.equal(overflowWord, true);
  assert.ok(lines[1].scaleX < 1);
  assert.equal(lines[1].width, 10);
});

test('an empty quote has no lines and fits at the largest size', () => {
  assert.deepEqual(wrapLines('   \n  ', 100, fixed(1)).lines, []);
  const fit = fitQuote('', { width: 100, height: 100 }, (s) => fixed(s), { maxSize: 10, minSize: 4, step: 2 });
  assert.equal(fit.fits, true);
  assert.equal(fit.lines.length, 0);
  assert.equal(fit.size, 10);
});

test('fitQuote picks a smaller size for a longer quote', () => {
  const box = { width: 400, height: 500 };
  const opts = { maxSize: 96, minSize: 40, step: 2 };
  const measureAt = (s) => (t) => graphemes(t) * s * 0.5;
  const short = fitQuote('Learn. Reflect. Grow.', box, measureAt, opts);
  const long = fitQuote(
    'Education is the most powerful weapon which you can use to change the world and every child deserves it',
    box, measureAt, opts,
  );
  assert.equal(short.fits, true);
  assert.equal(long.fits, true);
  assert.ok(long.size < short.size);
  assert.ok(long.lines.length * long.lineHeight <= box.height);
});

test('fitQuote uses 1.5 line height for Hindi and 1.3 for Latin', () => {
  const box = { width: 1000, height: 1000 };
  const opts = { maxSize: 20, minSize: 10, step: 2 };
  assert.equal(fitQuote('शिक्षा', box, (s) => fixed(s), opts).lineHeight, 30);
  assert.equal(fitQuote('Grow', box, (s) => fixed(s), opts).lineHeight, 26);
});

test('fitQuote clips with an ellipsis when nothing fits at minSize', () => {
  const q = Array.from({ length: 60 }, (_, i) => `word${i}`).join(' ');
  const fit = fitQuote(q, { width: 100, height: 60 }, (s) => fixed(s), { maxSize: 20, minSize: 10, step: 2 });
  assert.equal(fit.fits, false);
  assert.equal(fit.size, 10);
  assert.equal(fit.lines.length, 4); // floor(60 / (10 × 1.3))
  assert.ok(fit.lines.at(-1).text.endsWith('…'));
  assert.ok(fit.lines.every((l) => l.width <= 100));
});

// Fake canvas measure: reads the px size out of the CSS font string; half an em per grapheme.
const measure = (text, cssFont) => graphemes(text) * Number(/([\d.]+)px/.exec(cssFont)[1]) * 0.5;
const SAMPLE_Q = 'शिक्षा वह शस्त्र है जिससे आप दुनिया बदल सकते हैं।';

for (const [key, s] of Object.entries(SIZES)) {
  test(`planLayout keeps everything inside the ${key} frame in order`, () => {
    const p = planLayout({ W: s.w, H: s.h, quote: SAMPLE_Q, name: 'कृष्ण कुमार', role: 'प्राथमिक शिक्षक, उत्तराखंड' }, measure);
    const q = p.quote;
    const inner = s.w * (1 - 2 * LAYOUT.sidePad);
    assert.equal(q.fits, true);
    assert.ok(q.top >= p.mark.y, 'quote below the mark');
    assert.ok(q.top + q.lines.length * q.lineHeight < p.divider.y, 'divider below the quote');
    assert.ok(p.divider.y < p.name.y && p.name.y < p.role.y, 'name then role below the divider');
    assert.ok(p.role.y + (p.role.size * LAYOUT.attribLineHeight) / 2 <= p.footer.logo.y, 'role above the footer');
    assert.ok(p.footer.site.y < s.h, 'site line inside the frame');
    const { logo, site } = p.footer;
    assert.ok(logo.x + logo.size <= s.w - LAYOUT.sidePad * s.w + 1e-6 && logo.y + logo.size < s.h, 'logo bottom-right, inside the frame');
    assert.ok(logo.x > s.w / 2, 'logo on the right half');
    assert.equal(site.x, LAYOUT.sidePad * s.w, 'web address starts at the left margin');
    assert.equal(site.y, logo.y + logo.size / 2, 'web address centred on the logo');
    assert.ok(site.x + LAYOUT.siteSize * p.u * 9.5 < logo.x, 'web address never runs into the logo');
    assert.ok(q.lines.every((l) => l.width <= inner + 1e-6), 'lines inside the side padding');
  });
}

test('a very long name or role is squeezed to the frame width', () => {
  const long = 'राजकीय प्राथमिक विद्यालय '.repeat(8);
  const p = planLayout({ W: 1200, H: 630, quote: 'x', name: long, role: long }, measure);
  const inner = 1200 * (1 - 2 * LAYOUT.sidePad);
  assert.ok(p.name.scaleX < 1 && p.name.width <= inner + 1e-6);
  assert.ok(p.role.scaleX < 1 && p.role.width <= inner + 1e-6);
});

test('blank name and role produce no attribution lines', () => {
  const p = planLayout({ W: 1080, H: 1080, quote: 'Grow.', name: '  ', role: '' }, measure);
  assert.equal(p.name, null);
  assert.equal(p.role, null);
  const onlyRole = planLayout({ W: 1080, H: 1080, quote: 'Grow.', name: '', role: 'शिक्षक' }, measure);
  assert.equal(onlyRole.name, null);
  assert.equal(onlyRole.role.text, 'शिक्षक');
});

test('a paragraph-length quote does not fit the landscape link size but stays above the footer', () => {
  const p = planLayout({ W: 1200, H: 630, quote: 'शिक्षा '.repeat(600), name: '', role: '' }, measure);
  assert.equal(p.quote.fits, false);
  assert.ok(p.quote.top + p.quote.lines.length * p.quote.lineHeight <= p.footer.logo.y);
});

test('coverRect crops a portrait photo into a landscape frame', () => {
  // 1000×2000 into 1600×900: scale 1.6, crop 1000×562.5.
  assert.deepEqual(coverRect(1000, 2000, 1600, 900, 0.5, 0.5), { sx: 0, sy: 718.75, sw: 1000, sh: 562.5 });
  assert.equal(coverRect(1000, 2000, 1600, 900, 0.5, 0).sy, 0);
  assert.equal(coverRect(1000, 2000, 1600, 900, 0.5, 1).sy, 1437.5);
});

test('coverRect crops a landscape photo into a story frame and clamps the focal point', () => {
  // 2000×1000 into 1080×1920: scale 1.92, crop 562.5×1000.
  assert.deepEqual(coverRect(2000, 1000, 1080, 1920, 0.5, 0.5), { sx: 718.75, sy: 0, sw: 562.5, sh: 1000 });
  assert.equal(coverRect(2000, 1000, 1080, 1920, 0, 0.5).sx, 0);
  assert.equal(coverRect(2000, 1000, 1080, 1920, 1, 0.5).sx, 1437.5);
  assert.equal(coverRect(2000, 1000, 1080, 1920, 7, 0.5).sx, 1437.5);
});

test('dragFocus moves the focal point opposite to the drag and clamps', () => {
  // 1000×2000 into 1600×900 → drawn 1600×3200, so 2300px of vertical slack and none horizontal.
  const moved = dragFocus(0.5, 0.5, 40, 230, 1000, 2000, 1600, 900);
  assert.equal(moved.fx, 0.5);
  assert.ok(Math.abs(moved.fy - 0.4) < 1e-9);
  assert.deepEqual(dragFocus(0.5, 0.5, 0, 99999, 1000, 2000, 1600, 900), { fx: 0.5, fy: 0 });
  assert.deepEqual(dragFocus(0.5, 0.5, 0, -99999, 1000, 2000, 1600, 900), { fx: 0.5, fy: 1 });
});

test('fitWithin downscales big phone photos and leaves small ones alone', () => {
  assert.deepEqual(fitWithin(8000, 6000, 2400), { w: 2400, h: 1800 });
  assert.deepEqual(fitWithin(3000, 12000, 2400), { w: 600, h: 2400 });
  assert.deepEqual(fitWithin(1200, 800, 2400), { w: 1200, h: 800 });
});

test('exportName uses local date, time and size', () => {
  assert.equal(exportName(new Date(2026, 8, 26, 9, 5), 1080, 1350), 'education-mirror-quote-20260926-0905-1080x1350.png');
});

test('story size keeps the mark and footer out of the 250px Instagram/WhatsApp overlay zones', () => {
  const p = planLayout({ W: 1080, H: 1920, quote: SAMPLE_Q, name: 'कृष्ण कुमार', role: 'शिक्षक' }, measure);
  assert.ok(p.mark.y >= 250, `mark top ${p.mark.y}`);
  const bottom = p.footer.logo.y + p.footer.logo.size;
  assert.ok(bottom <= 1920 - 250, `footer bottom ${bottom}`);
});

test('the web address under the logo is bold and larger', () => {
  const p = planLayout({ W: 1080, H: 1350, quote: 'x', name: '', role: '' }, measure);
  assert.match(p.footer.site.font, /^700 /);
  assert.equal(Number(/([\d.]+)px/.exec(p.footer.site.font)[1]), 34 * p.u);
});

test('quoteZone covers every quote line and the attribution, and is at least as wide as the divider', () => {
  const p = planLayout({ W: 1080, H: 1350, quote: SAMPLE_Q, name: 'कृष्ण कुमार', role: 'शिक्षक' }, measure);
  const z = quoteZone(p);
  for (const l of p.quote.lines) assert.ok(l.width <= z.w + 1e-6);
  assert.ok(z.w >= 2 * p.divider.halfWidth - 1e-6);
  assert.equal(z.y, p.quote.top);
  assert.ok(z.y + z.h > p.role.y);
  const short = quoteZone(planLayout({ W: 1080, H: 1350, quote: 'Grow.', name: '', role: '' }, measure));
  assert.ok(short.w >= 2 * p.divider.halfWidth - 1e-6);
});
