import test from 'node:test';
import assert from 'node:assert/strict';
import { hasDevanagari, normaliseQuote, wrapLines, fitQuote } from '../js/layout.js';

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
