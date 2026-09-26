# Education Mirror Quote Maker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A static GitHub Pages web page where Virjesh types a Hindi/English quote, optionally adds a background photo, picks a social size and a style, and saves or shares a branded Education Mirror PNG.

**Architecture:**
- One static page, with no build step. It uses plain ES modules that draw onto a `<canvas>` at exact output size.
- **Layout maths** lives in pure modules (`layout.js`, `settings.js`) that take an injected `measure()` function, so it is unit-tested in Node.
- **Drawing** (`render.js`) and **DOM wiring** (`app.js`) are thin, and are checked in the in-app browser.

**Tech Stack:**
- Vanilla HTML/CSS/JS (ES modules) and Canvas 2D.
- Node 24 `node --test` for unit tests, with no npm packages.
- Fonts: self-hosted Fontsource WOFF2 files.
- Python `http.server` for local preview.
- `gh` CLI for the repo and Pages.

**Spec:** `docs/superpowers/specs/2026-09-26-quote-maker-design.md`

## Global Constraints

- No build step, no npm dependencies, and no runtime requests to other hosts (fonts and emblem are self-hosted; no CDN, no analytics).
- Browsers: current Chrome, Edge and Firefox, and Safari/iOS ≥ 15.4. Avoid APIs newer than that (use `Object.prototype.hasOwnProperty.call`, not `Object.hasOwn`; no `ctx.roundRect`).
- Colours: `#0A2159`, `#D71920`, `#FFFFFF`, `#F5F6FA`, `#1B2233`, `#5A6275`, `#E3E6EE`, `#AEB6C8`, `#E9ECF4`, and `#12307A` (tonal lift only). No other hues.
- The "Education Mirror" wordmark is always red `#D71920`, in Noto Serif 700, on a white pill.
- Hindi rules:
  - Never letter-space text.
  - Break lines only at spaces.
  - Line height is 1.5× when the quote contains Devanagari (U+0900–U+097F), otherwise 1.3×.
  - Never strip ZWJ/ZWNJ (U+200D/U+200C).
- Sizes: square 1080×1080, portrait 1080×1350, story 1080×1920, link 1200×630, x 1600×900.
- The export PNG is exactly W×H. Filename: `education-mirror-quote-YYYYMMDD-HHMM-<W>x<H>.png` (local time).
- Quote text and photo are never stored or uploaded. `localStorage` key `em-quote-maker:v1` holds only size, plain style, name and role, and every access is wrapped in try/catch.
- Tap targets are ≥ 44px. No horizontal page scroll at 375px width.
- These user messages are used verbatim:
  - too long: `यह कोट इस साइज़ के लिए बहुत लंबा है — छोटा करें या बड़ा साइज़ चुनें / Quote too long for this size — shorten it or pick a taller size`
  - bad file: `यह फ़ाइल खुल नहीं पाई / Could not open this file`
- Commit trailer: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

### Notes on the spec (intentional, minor)

- **No `segmentWords()`.** Lines break only at single spaces after normalisation, so splitting on `' '` gives exactly what the `Intl.Segmenter` route would, and can never cut a grapheme.
- **No Mukta 800.** Nothing in the image or the page draws with weight 800, so it isn't shipped (YAGNI).
- **New `js/settings.js`.** Remembered-settings reading and writing is pulled out of `app.js` so it can be unit-tested with a throwing or garbage storage object.
- **`markBox` is 90u.** This is the visible height reserved for the “ glyph. The spec fixes the glyph size (180u) but not its reserved box.

## Review Focus

1. **Sharing on iPhone Safari.** `navigator.share` must run inside the click's user activation, or Safari throws `NotAllowedError`. The PNG is therefore prepared ahead of time, and a click with a ready file calls `share` synchronously. *Test: Task 3, Step 12 (stubbed `share` records that it was called synchronously).*
2. **Text pasted from WhatsApp or Word.** Handles CRLF, NBSP, tabs and runs of blank lines, while keeping ZWJ/ZWNJ and nukta forms (क़, क्‍ष) intact. *Test: Task 1, `normaliseQuote` tests.*
3. **Long names and roles** (e.g. a full school name). These must shrink to the frame width and never spill off the image. *Test: Task 2, "very long name or role" test.*
4. **Big phone photos and wrong files.** A 48MP photo must be downscaled before drawing. A `.txt` or undecodable file shows the bad-file message and keeps the previous photo. *Tests: Task 2, `fitWithin`; Task 3, Step 10 browser check.*
5. **Blocked or garbage localStorage** (private mode, old data). The page must still load with defaults. *Test: Task 2, `readSettings`/`writeSettings` tests.*

---

## File map

```
.gitignore
.nojekyll                      (Task 4) serve files as-is on Pages
package.json                   {"type":"module"} + test script
README.md                      (Task 4)
.claude/launch.json            local static server for the in-app browser
index.html
css/app.css
js/presets.js                  SIZES, STYLES, BRAND, SAMPLE, font()
js/layout.js                   pure layout: text + geometry
js/settings.js                 remembered settings (storage injected)
js/render.js                   draws one image on a 2D context
js/app.js                      DOM wiring
assets/fonts/*.woff2, OFL-*.txt
assets/img/emblem.png, favicon-32.png
tests/layout.test.mjs, tests/settings.test.mjs
```

---

### Task 1: Presets and quote text layout (normalise, wrap, fit)

**Files:**
- Create: `package.json`, `.gitignore`, `js/presets.js`, `js/layout.js`
- Test: `tests/layout.test.mjs`

**Interfaces:**
- Produces, in `js/presets.js`:
  - `SIZES: {square|portrait|story|link|x: {label, w, h}}`
  - `STYLES: {navy|light|red|photo: {label, bg, lift, text, mark, rule, dot, name, role, pillBorder, photo?, overlayTop?, overlayBottom?}}`
  - `BRAND: {red, white, wordmark, site}`
  - `SAMPLE: {quote, name}`
  - `FONT_STACK`, `SERIF_STACK`
  - `font(weight: number, px: number, stack = FONT_STACK): string` (a CSS font shorthand)
- Produces, in `js/layout.js`:
  - `hasDevanagari(text): boolean`
  - `normaliseQuote(text): string`
  - `wrapLines(text, maxWidth, measure: (str) => number): { lines: Line[], overflowWord: boolean }`, where `Line = {text, width, scaleX}` (`width` ≤ `maxWidth`, `scaleX` ≤ 1)
  - `fitQuote(text, box: {width, height}, measureAt: (size) => (str) => number, {maxSize, minSize, step}): { size, lineHeight, lines: Line[], fits }`

- [ ] **Step 1: Create `package.json` and `.gitignore`**

`package.json`:

```json
{
  "name": "em-quote-maker",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "node --test tests/"
  }
}
```

`.gitignore`:

```
node_modules/
.DS_Store
Thumbs.db
```

- [ ] **Step 2: Create `js/presets.js`**

```js
// Brand data shared by the page and the renderer. Values come from the site's DESIGN.md.

export const SIZES = {
  square: { label: 'Instagram Square', w: 1080, h: 1080 },
  portrait: { label: 'Instagram Portrait', w: 1080, h: 1350 },
  story: { label: 'Story / Reel / WhatsApp Status', w: 1080, h: 1920 },
  link: { label: 'Facebook / LinkedIn', w: 1200, h: 630 },
  x: { label: 'X / Twitter', w: 1600, h: 900 },
};

export const STYLES = {
  navy: {
    label: 'Navy', bg: '#0A2159', lift: '#12307A',
    text: '#FFFFFF', mark: '#D71920', rule: '#D71920', dot: '#D71920',
    name: '#FFFFFF', role: '#AEB6C8', pillBorder: null,
  },
  light: {
    label: 'Light', bg: '#F5F6FA', lift: null,
    text: '#0A2159', mark: '#D71920', rule: '#D71920', dot: '#D71920',
    name: '#1B2233', role: '#5A6275', pillBorder: '#E3E6EE',
  },
  red: {
    label: 'Red', bg: '#D71920', lift: null,
    text: '#FFFFFF', mark: '#0A2159', rule: '#FFFFFF', dot: '#0A2159',
    name: '#FFFFFF', role: 'rgba(255,255,255,0.85)', pillBorder: null,
  },
  photo: {
    label: 'Photo · फ़ोटो', bg: '#0A2159', lift: null, photo: true,
    overlayTop: 'rgba(10,33,89,0.55)', overlayBottom: 'rgba(10,33,89,0.88)',
    text: '#FFFFFF', mark: '#D71920', rule: '#D71920', dot: '#D71920',
    name: '#FFFFFF', role: '#E9ECF4', pillBorder: null,
  },
};

export const BRAND = {
  red: '#D71920',
  white: '#FFFFFF',
  wordmark: 'Education Mirror',
  site: 'educationmirror.org',
};

// Shown in the preview until the user types a quote.
export const SAMPLE = {
  quote: 'शिक्षा वह शस्त्र है जिससे आप दुनिया बदल सकते हैं।',
  name: 'नेल्सन मंडेला',
};

export const FONT_STACK = 'Mukta, system-ui, "Noto Sans Devanagari", sans-serif';
export const SERIF_STACK = '"Noto Serif", Georgia, serif';

export function font(weight, px, stack = FONT_STACK) {
  return `${weight} ${px}px ${stack}`;
}
```

- [ ] **Step 3: Write the failing tests `tests/layout.test.mjs`**

```js
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
```

- [ ] **Step 4: Run the tests to verify they fail**

Run: `node --test tests/`
Expected: FAIL with `Cannot find module '.../js/layout.js'`.

- [ ] **Step 5: Create `js/layout.js` (text part)**

```js
// Pure layout helpers. No DOM access, so they run in Node tests.
// Text widths come from an injected measure function.

const DEVANAGARI = /[ऀ-ॿ]/;
// Spaces that collapse to one ASCII space. ZWJ/ZWNJ (U+200D/U+200C) are deliberately not here.
const SPACES = /[ \t  -   　]+/g;
const ELLIPSIS = '…';

export function hasDevanagari(text) {
  return DEVANAGARI.test(String(text ?? ''));
}

export function normaliseQuote(text) {
  const out = [];
  for (const raw of String(text ?? '').replace(/\r\n?/g, '\n').split('\n')) {
    const line = raw.replace(SPACES, ' ').trim();
    if (line === '' && (out.length === 0 || out[out.length - 1] === '')) continue;
    out.push(line);
  }
  while (out.length && out[out.length - 1] === '') out.pop();
  return out.join('\n');
}

function lineOf(text, maxWidth, measure) {
  const width = measure(text);
  return width > maxWidth
    ? { text, width: maxWidth, scaleX: maxWidth / width }
    : { text, width, scaleX: 1 };
}

export function wrapLines(text, maxWidth, measure) {
  const lines = [];
  const quote = normaliseQuote(text);
  if (quote === '') return { lines, overflowWord: false };
  for (const para of quote.split('\n')) {
    if (para === '') {
      lines.push({ text: '', width: 0, scaleX: 1 });
      continue;
    }
    let current = '';
    for (const word of para.split(' ')) {
      const candidate = current === '' ? word : `${current} ${word}`;
      if (current === '' || measure(candidate) <= maxWidth) {
        current = candidate;
      } else {
        lines.push(lineOf(current, maxWidth, measure));
        current = word;
      }
    }
    lines.push(lineOf(current, maxWidth, measure));
  }
  return { lines, overflowWord: lines.some((l) => l.scaleX < 1) };
}

function ellipsize(text, maxWidth, measure) {
  const words = text.split(' ');
  let t = words.join(' ') + ELLIPSIS;
  while (words.length > 1 && measure(t) > maxWidth) {
    words.pop();
    t = words.join(' ') + ELLIPSIS;
  }
  return lineOf(t, maxWidth, measure);
}

export function fitQuote(text, box, measureAt, { maxSize, minSize, step }) {
  const ratio = hasDevanagari(text) ? 1.5 : 1.3;
  const sizes = [];
  for (let s = maxSize; s > minSize + 1e-6; s -= step) sizes.push(s);
  sizes.push(minSize);

  for (const size of sizes) {
    const { lines } = wrapLines(text, box.width, measureAt(size));
    const lineHeight = size * ratio;
    if (lines.length * lineHeight <= box.height + 1e-6) {
      return { size, lineHeight, lines, fits: true };
    }
  }

  // Nothing fits: keep as many lines as the box holds at minSize and end with an ellipsis.
  const size = minSize;
  const lineHeight = size * ratio;
  const measure = measureAt(size);
  const kept = wrapLines(text, box.width, measure).lines
    .slice(0, Math.max(1, Math.floor((box.height + 1e-6) / lineHeight)));
  kept[kept.length - 1] = ellipsize(kept[kept.length - 1].text, box.width, measure);
  return { size, lineHeight, lines: kept, fits: false };
}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `node --test tests/`
Expected: every test passes (`# fail 0`).

- [ ] **Step 7: Commit**

```bash
git add package.json .gitignore js/presets.js js/layout.js tests/layout.test.mjs
git commit -m "feat: brand presets and Hindi-safe quote wrapping and fitting

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Image geometry, photo maths and remembered settings

**Files:**
- Modify: `js/layout.js` (append geometry functions and add one import line at the top)
- Create: `js/settings.js`
- Test: `tests/layout.test.mjs` (append), `tests/settings.test.mjs`

**Interfaces:**
- Consumes: `wrapLines`, `fitQuote` and the private `lineOf` (Task 1); `font`, `SERIF_STACK`, `BRAND` from `presets.js`.
- Produces, in `js/layout.js`:
  - `LAYOUT` (constants object, multiples of `u`)
  - `planLayout({W, H, quote, name, role}, measure: (text, cssFont) => number)`. It returns:
    - `u`, `W`, `H`
    - `mark: {x, y, font}`
    - `quote: {size, lineHeight, lines, fits, x, top, font}`
    - `divider: {x, y, halfWidth, hole, dotR, thickness}`
    - `name` and `role`: each `{text, width, scaleX, x, y, font, size}`, or `null`
    - `footer: {pill: {x, y, w, h}, emblem: {x, y, size}, wordmark: {x, y, font}, site: {x, y, font}}`
  - `coverRect(imgW, imgH, W, H, fx, fy): {sx, sy, sw, sh}`
  - `dragFocus(fx, fy, dx, dy, imgW, imgH, W, H): {fx, fy}` (`dx`, `dy` in canvas pixels)
  - `fitWithin(w, h, maxEdge): {w, h}`
  - `exportName(date, W, H): string`
- Produces, in `js/settings.js`:
  - `SETTINGS_KEY`
  - `DEFAULTS = {sizeKey:'portrait', styleKey:'navy', name:'', role:''}`
  - `readSettings(storage): {sizeKey, styleKey, name, role}`
  - `writeSettings(storage, settings): boolean`

- [ ] **Step 1: Append the failing geometry tests to `tests/layout.test.mjs`**

Replace the import line at the top of the file with:

```js
import {
  hasDevanagari, normaliseQuote, wrapLines, fitQuote,
  LAYOUT, planLayout, coverRect, dragFocus, fitWithin, exportName,
} from '../js/layout.js';
import { SIZES } from '../js/presets.js';
```

Append:

```js
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
    assert.ok(p.role.y + (p.role.size * LAYOUT.attribLineHeight) / 2 <= p.footer.pill.y, 'role above the footer');
    assert.ok(p.footer.site.y < s.h, 'site line inside the frame');
    assert.ok(p.footer.pill.x > 0 && p.footer.pill.x + p.footer.pill.w < s.w, 'pill inside the frame');
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
  const p = planLayout({ W: 1200, H: 630, quote: 'शिक्षा '.repeat(200), name: '', role: '' }, measure);
  assert.equal(p.quote.fits, false);
  assert.ok(p.quote.top + p.quote.lines.length * p.quote.lineHeight <= p.footer.pill.y);
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
```

- [ ] **Step 2: Create the failing `tests/settings.test.mjs`**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { SETTINGS_KEY, DEFAULTS, readSettings, writeSettings } from '../js/settings.js';

const memory = () => {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)) };
};

test('settings round-trip through storage', () => {
  const storage = memory();
  const s = { sizeKey: 'story', styleKey: 'red', name: 'कृष्ण', role: 'शिक्षक' };
  assert.equal(writeSettings(storage, s), true);
  assert.deepEqual(JSON.parse(storage.getItem(SETTINGS_KEY)), s);
  assert.deepEqual(readSettings(storage), s);
});

test('blocked storage (private mode) falls back to defaults without throwing', () => {
  const blocked = { getItem() { throw new Error('SecurityError'); }, setItem() { throw new Error('QuotaExceeded'); } };
  assert.deepEqual(readSettings(blocked), DEFAULTS);
  assert.equal(writeSettings(blocked, DEFAULTS), false);
});

test('garbage or stale values are ignored field by field', () => {
  assert.deepEqual(readSettings({ getItem: () => '{not json', setItem() {} }), DEFAULTS);
  assert.deepEqual(readSettings({ getItem: () => 'null', setItem() {} }), DEFAULTS);
  const stale = { getItem: () => JSON.stringify({ sizeKey: 'constructor', styleKey: 'photo', name: 5, role: 'शिक्षक' }), setItem() {} };
  assert.deepEqual(readSettings(stale), { ...DEFAULTS, role: 'शिक्षक' });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `node --test tests/`
Expected: FAIL. `layout.test.mjs` reports `does not provide an export named 'LAYOUT'`, and `settings.test.mjs` reports `Cannot find module '.../js/settings.js'`.

- [ ] **Step 4: Add the import to the top of `js/layout.js`**

Insert these as the first lines of the file, above the existing comment:

```js
import { BRAND, SERIF_STACK, font } from './presets.js';

```

- [ ] **Step 5: Append the geometry functions to `js/layout.js`**

```js
// Image geometry. Every value is a multiple of u = min(W, H) / 1080 unless noted.
export const LAYOUT = {
  sidePad: 0.08, // × W
  topPad: 0.09, // × H, square and portrait sizes
  topPadLandscape: 0.08, // × H
  bottomPad: 0.06, // × H
  markSize: 180,
  markBox: 90, // visible height reserved for the “ glyph
  markGap: 24,
  quoteMax: 96,
  quoteMin: 40,
  quoteStep: 2,
  dividerGap: 40,
  dividerWidth: 0.32, // × W
  dividerDot: 8,
  dividerHole: 24,
  dividerThick: 3,
  attribGap: 32,
  nameSize: 40,
  roleSize: 30,
  nameRoleGap: 6,
  attribLineHeight: 1.4, // × font size
  contentGap: 40, // space above the footer
  pillH: 88,
  pillPadL: 14,
  pillPadR: 28,
  emblem: 64,
  emblemGap: 16,
  wordmark: 36,
  siteGap: 12,
  siteSize: 26,
  siteLineHeight: 1.3, // × font size
};

export function planLayout({ W, H, quote, name = '', role = '' }, measure) {
  const L = LAYOUT;
  const u = Math.min(W, H) / 1080;
  const cx = W / 2;
  const innerW = W - 2 * L.sidePad * W;
  const top = (W > H ? L.topPadLandscape : L.topPad) * H;

  // Footer, built from the bottom edge up.
  const pillH = L.pillH * u;
  const wordmarkFont = font(700, L.wordmark * u, SERIF_STACK);
  const pillW = (L.pillPadL + L.emblem + L.emblemGap + L.pillPadR) * u + measure(BRAND.wordmark, wordmarkFont);
  const siteH = L.siteSize * u * L.siteLineHeight;
  const footerTop = H - L.bottomPad * H - (pillH + L.siteGap * u + siteH);
  const pillX = cx - pillW / 2;
  const footer = {
    pill: { x: pillX, y: footerTop, w: pillW, h: pillH },
    emblem: { x: pillX + L.pillPadL * u, y: footerTop + (pillH - L.emblem * u) / 2, size: L.emblem * u },
    wordmark: { x: pillX + (L.pillPadL + L.emblem + L.emblemGap) * u, y: footerTop + pillH / 2, font: wordmarkFont },
    site: { x: cx, y: footerTop + pillH + L.siteGap * u + siteH / 2, font: font(400, L.siteSize * u) },
  };

  const mark = { x: cx, y: top, font: font(700, L.markSize * u, SERIF_STACK) };
  const contentTop = top + (L.markBox + L.markGap) * u;
  const contentBottom = footerTop - L.contentGap * u;

  // Attribution lines never wrap; a long one is squeezed horizontally instead.
  const single = (text, size, weight) => {
    const f = font(weight, size);
    return { ...lineOf(text, innerW, (s) => measure(s, f)), x: cx, y: 0, font: f, size };
  };
  const nameText = String(name ?? '').trim();
  const roleText = String(role ?? '').trim();
  const nameLine = nameText ? single(nameText, L.nameSize * u, 700) : null;
  const roleLine = roleText ? single(roleText, L.roleSize * u, 400) : null;
  const attrib = [nameLine, roleLine].filter(Boolean);
  const attribH = attrib.length
    ? L.attribGap * u
      + attrib.reduce((h, a) => h + a.size * L.attribLineHeight, 0)
      + (attrib.length - 1) * L.nameRoleGap * u
    : 0;
  const dividerH = (L.dividerGap + 2 * L.dividerDot) * u;

  const box = { width: innerW, height: Math.max(0, contentBottom - contentTop - dividerH - attribH) };
  const fit = fitQuote(quote, box, (s) => (str) => measure(str, font(700, s)), {
    maxSize: L.quoteMax * u, minSize: L.quoteMin * u, step: L.quoteStep * u,
  });
  const quoteH = fit.lines.length * fit.lineHeight;

  // Centre the quote + divider + attribution group in the space left between mark and footer.
  let y = contentTop + Math.max(0, (contentBottom - contentTop - (quoteH + dividerH + attribH)) / 2);
  const quoteBlock = { ...fit, x: cx, top: y, font: font(700, fit.size) };
  y += quoteH + (L.dividerGap + L.dividerDot) * u;
  const divider = {
    x: cx, y,
    halfWidth: (L.dividerWidth * W) / 2,
    hole: L.dividerHole * u,
    dotR: L.dividerDot * u,
    thickness: Math.max(2, L.dividerThick * u),
  };
  y += (L.dividerDot + L.attribGap) * u;
  for (const a of attrib) {
    a.y = y + (a.size * L.attribLineHeight) / 2;
    y += a.size * L.attribLineHeight + L.nameRoleGap * u;
  }

  return { u, W, H, mark, quote: quoteBlock, divider, name: nameLine, role: roleLine, footer };
}

const clamp01 = (v) => Math.min(1, Math.max(0, Number.isFinite(v) ? v : 0.5));

// Source rectangle that makes the photo cover a W×H frame, positioned by focal point (fx, fy).
export function coverRect(imgW, imgH, W, H, fx = 0.5, fy = 0.5) {
  const scale = Math.max(W / imgW, H / imgH);
  const sw = W / scale;
  const sh = H / scale;
  return { sx: (imgW - sw) * clamp01(fx), sy: (imgH - sh) * clamp01(fy), sw, sh };
}

// Dragging the preview right/down by (dx, dy) canvas pixels moves the photo right/down.
export function dragFocus(fx, fy, dx, dy, imgW, imgH, W, H) {
  const scale = Math.max(W / imgW, H / imgH);
  const spareX = imgW * scale - W;
  const spareY = imgH * scale - H;
  return {
    fx: spareX > 0.5 ? clamp01(fx - dx / spareX) : 0.5,
    fy: spareY > 0.5 ? clamp01(fy - dy / spareY) : 0.5,
  };
}

export function fitWithin(w, h, maxEdge) {
  const longest = Math.max(w, h);
  if (longest <= maxEdge) return { w, h };
  const k = maxEdge / longest;
  return { w: Math.round(w * k), h: Math.round(h * k) };
}

export function exportName(date, W, H) {
  const p = (n) => String(n).padStart(2, '0');
  const stamp = `${date.getFullYear()}${p(date.getMonth() + 1)}${p(date.getDate())}-${p(date.getHours())}${p(date.getMinutes())}`;
  return `education-mirror-quote-${stamp}-${W}x${H}.png`;
}
```

- [ ] **Step 6: Create `js/settings.js`**

```js
// Remembered settings. Storage is injected so private mode and bad data can be tested.
import { SIZES, STYLES } from './presets.js';

export const SETTINGS_KEY = 'em-quote-maker:v1';
export const DEFAULTS = Object.freeze({ sizeKey: 'portrait', styleKey: 'navy', name: '', role: '' });

const has = (obj, key) => typeof key === 'string' && Object.prototype.hasOwnProperty.call(obj, key);
const text = (v) => (typeof v === 'string' ? v.slice(0, 200) : '');

export function readSettings(storage) {
  let raw = null;
  try {
    raw = JSON.parse(storage.getItem(SETTINGS_KEY) || 'null');
  } catch {
    raw = null;
  }
  const s = raw && typeof raw === 'object' ? raw : {};
  return {
    sizeKey: has(SIZES, s.sizeKey) ? s.sizeKey : DEFAULTS.sizeKey,
    styleKey: has(STYLES, s.styleKey) && s.styleKey !== 'photo' ? s.styleKey : DEFAULTS.styleKey,
    name: text(s.name),
    role: text(s.role),
  };
}

export function writeSettings(storage, { sizeKey, styleKey, name, role }) {
  try {
    storage.setItem(SETTINGS_KEY, JSON.stringify({ sizeKey, styleKey, name, role }));
    return true;
  } catch {
    return false;
  }
}
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `node --test tests/`
Expected: every test passes (`# fail 0`).

- [ ] **Step 8: Commit**

```bash
git add js/layout.js js/settings.js tests/layout.test.mjs tests/settings.test.mjs
git commit -m "feat: image geometry, photo crop/drag maths and remembered settings

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: The working page (assets, markup, styles, renderer, wiring) and browser verification

**Files:**
- Create:
  - `assets/fonts/*` (8 WOFF2 files + 2 licence files)
  - `assets/img/emblem.png`, `assets/img/favicon-32.png`
  - `css/app.css`, `index.html`, `js/render.js`, `js/app.js`, `.claude/launch.json`

**Interfaces:**
- Consumes:
  - `planLayout`, `coverRect`, `dragFocus`, `fitWithin`, `exportName` (Task 2)
  - `readSettings`, `writeSettings` (Task 2)
  - `SIZES`, `STYLES`, `BRAND`, `SAMPLE` (Task 1)
- Produces:
  - `renderQuote(ctx, state, assets): {fits}`, where `state = {quote, name, role, styleKey, photo, fx, fy}`, `photo` is a canvas or `null`, and `assets = {emblem: HTMLImageElement|null}`
  - The page at `/index.html`

- [ ] **Step 1: Fetch the fonts and licences (Fontsource, SIL OFL 1.1)**

Run in Bash from the repo root:

```bash
mkdir -p assets/fonts assets/img
base=https://cdn.jsdelivr.net/npm/@fontsource
for w in 400 700; do
  for s in devanagari latin latin-ext; do
    curl -fsSL -o "assets/fonts/mukta-$s-$w-normal.woff2" "$base/mukta@5/files/mukta-$s-$w-normal.woff2"
  done
done
for s in latin latin-ext; do
  curl -fsSL -o "assets/fonts/noto-serif-$s-700-normal.woff2" "$base/noto-serif@5/files/noto-serif-$s-700-normal.woff2"
done
curl -fsSL -o assets/fonts/OFL-Mukta.txt "$base/mukta@5/LICENSE"
curl -fsSL -o assets/fonts/OFL-NotoSerif.txt "$base/noto-serif@5/LICENSE"
for f in assets/fonts/*.woff2; do printf '%s %s %s\n' "$(head -c4 "$f")" "$(wc -c <"$f")" "$f"; done
```

Expected: 8 lines, each starting `wOF2`, each file larger than 5000 bytes.

Then fetch the official subset ranges and compare them with the `unicode-range` values in Step 3:

```bash
curl -fsSL "$base/mukta@5/700.css" | grep -E "Mukta \(|unicode-range"
curl -fsSL "$base/noto-serif@5/700.css" | grep -B8 unicode-range | grep -E "latin|unicode-range" | head -8
```

If a range differs from Step 3, use Fontsource's value.

- [ ] **Step 2: Copy the emblem and favicon from the site theme**

```bash
theme="/c/Users/adich/Local Sites/educationmirror/app/public/wp-content/themes/education-mirror-journal/assets/img"
cp "$theme/emblem-512.png" assets/img/emblem.png
cp "$theme/favicon-32.png" assets/img/favicon-32.png
ls -l assets/img
```

Expected: `emblem.png` is about 55 KB and `favicon-32.png` about 2 KB.

- [ ] **Step 3: Create `css/app.css`**

```css
/* Fonts: Mukta (Devanagari + Latin) and Noto Serif (wordmark), self-hosted, SIL OFL 1.1. */
@font-face { font-family: Mukta; font-style: normal; font-weight: 400; font-display: swap;
  src: url(../assets/fonts/mukta-devanagari-400-normal.woff2) format("woff2");
  unicode-range: U+0900-097F, U+1CD0-1CF9, U+200C-200D, U+20A8, U+20B9, U+20F0, U+25CC, U+A830-A839, U+A8E0-A8FF, U+11B00-11B09; }
@font-face { font-family: Mukta; font-style: normal; font-weight: 400; font-display: swap;
  src: url(../assets/fonts/mukta-latin-ext-400-normal.woff2) format("woff2");
  unicode-range: U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF; }
@font-face { font-family: Mukta; font-style: normal; font-weight: 400; font-display: swap;
  src: url(../assets/fonts/mukta-latin-400-normal.woff2) format("woff2");
  unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD; }
@font-face { font-family: Mukta; font-style: normal; font-weight: 700; font-display: swap;
  src: url(../assets/fonts/mukta-devanagari-700-normal.woff2) format("woff2");
  unicode-range: U+0900-097F, U+1CD0-1CF9, U+200C-200D, U+20A8, U+20B9, U+20F0, U+25CC, U+A830-A839, U+A8E0-A8FF, U+11B00-11B09; }
@font-face { font-family: Mukta; font-style: normal; font-weight: 700; font-display: swap;
  src: url(../assets/fonts/mukta-latin-ext-700-normal.woff2) format("woff2");
  unicode-range: U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF; }
@font-face { font-family: Mukta; font-style: normal; font-weight: 700; font-display: swap;
  src: url(../assets/fonts/mukta-latin-700-normal.woff2) format("woff2");
  unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD; }
@font-face { font-family: "Noto Serif"; font-style: normal; font-weight: 700; font-display: swap;
  src: url(../assets/fonts/noto-serif-latin-ext-700-normal.woff2) format("woff2");
  unicode-range: U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF; }
@font-face { font-family: "Noto Serif"; font-style: normal; font-weight: 700; font-display: swap;
  src: url(../assets/fonts/noto-serif-latin-700-normal.woff2) format("woff2");
  unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD; }

:root {
  --navy: #0A2159;
  --red: #D71920;
  --white: #FFFFFF;
  --mist: #F5F6FA;
  --text: #1B2233;
  --text-2: #5A6275;
  --hairline: #E3E6EE;
  --muted-on-navy: #AEB6C8;
  --focus: rgba(215, 25, 32, 0.45);
  --shadow: 0 1px 0 var(--hairline), 0 6px 20px rgba(10, 33, 89, 0.08);
  --font: Mukta, system-ui, "Noto Sans Devanagari", sans-serif;
  --serif: "Noto Serif", Georgia, serif;
  color-scheme: light;
}

* { box-sizing: border-box; }

body {
  margin: 0;
  background: var(--mist);
  color: var(--text);
  font: 400 17px/1.6 var(--font);
  -webkit-text-size-adjust: 100%;
}

.visually-hidden {
  position: absolute; width: 1px; height: 1px; margin: -1px; padding: 0; border: 0;
  overflow: hidden; clip: rect(0 0 0 0); clip-path: inset(50%); white-space: nowrap;
}

/* Masthead */
.masthead {
  display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between;
  gap: 8px 16px; max-width: 1240px; margin: 0 auto; padding: 12px 16px;
}
.brand {
  display: inline-flex; align-items: center; gap: 10px; min-height: 48px;
  padding: 6px 18px 6px 6px; background: var(--white); border-radius: 999px;
  box-shadow: var(--shadow); text-decoration: none;
}
.brand img { width: 36px; height: 36px; display: block; }
.brand__word { font: 700 18px/1 var(--serif); color: var(--red); }
.masthead__tool { margin: 0; font-weight: 700; font-size: 17px; color: var(--navy); }

/* Workspace: phone = preview then controls; laptop = controls left, preview right. */
.workspace {
  display: grid; grid-template-columns: minmax(0, 1fr); gap: 16px;
  max-width: 1240px; margin: 0 auto; padding: 0 16px 112px;
}
.preview { display: flex; flex-direction: column; align-items: center; gap: 8px; min-width: 0; }
.preview__frame {
  width: 100%; display: flex; justify-content: center; padding: 12px;
  background: var(--white); border-radius: 16px; box-shadow: var(--shadow);
}
#canvas {
  display: block; max-width: 100%; max-height: 58vh; width: auto; height: auto;
  border-radius: 8px; background: var(--hairline);
}
#canvas.is-draggable { cursor: grab; touch-action: none; }
#canvas.is-draggable:active { cursor: grabbing; }
.status { min-height: 1.5em; margin: 0; font-size: 15px; line-height: 1.5; color: var(--text-2); text-align: center; white-space: pre-line; }
.status.is-warning { color: var(--red); font-weight: 700; }
.hint { margin: 0; font-size: 14px; color: var(--text-2); text-align: center; }

/* Controls */
.controls {
  display: grid; gap: 18px; min-width: 0; padding: 16px;
  background: var(--white); border-radius: 16px; box-shadow: var(--shadow);
}
.field { display: grid; gap: 6px; min-width: 0; margin: 0; padding: 0; border: 0; }
.field__label { padding: 0; font-weight: 700; font-size: 15px; color: var(--navy); }
.field__label em { font-style: normal; font-weight: 400; color: var(--text-2); }
.field-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }

textarea, input[type="text"] {
  width: 100%; min-height: 48px; padding: 10px 12px;
  font: 400 18px/1.6 var(--font); color: var(--text); background: var(--white);
  border: 1.5px solid var(--hairline); border-radius: 10px;
}
textarea { min-height: 140px; resize: vertical; }
textarea:focus-visible, input[type="text"]:focus-visible {
  outline: 3px solid rgba(10, 33, 89, 0.3); outline-offset: 1px; border-color: var(--navy);
}

.choices { display: flex; flex-wrap: wrap; gap: 8px; }
.choice { display: block; }
.choice__text {
  display: flex; flex-direction: column; justify-content: center; min-height: 48px;
  padding: 6px 12px; font-size: 15px; line-height: 1.25; color: var(--navy);
  background: var(--white); border: 1.5px solid var(--hairline); border-radius: 10px; cursor: pointer;
}
.choice__text small { font-size: 13px; color: var(--text-2); }
.choices--styles .choice__text { flex-direction: row; align-items: center; gap: 8px; }
.choice input:checked + .choice__text { background: var(--navy); border-color: var(--navy); color: var(--white); }
.choice input:checked + .choice__text small { color: var(--muted-on-navy); }
.choice input:focus-visible + .choice__text { outline: 3px solid var(--focus); outline-offset: 2px; }
.choice input:disabled + .choice__text { opacity: 0.45; cursor: not-allowed; }

.swatch { width: 18px; height: 18px; flex: none; border-radius: 50%; border: 1.5px solid var(--hairline); }
.swatch[data-style="navy"] { background: #0A2159; }
.swatch[data-style="light"] { background: #F5F6FA; }
.swatch[data-style="red"] { background: #D71920; }
.swatch[data-style="photo"] { background: linear-gradient(135deg, #AEB6C8, #0A2159); }

/* Buttons */
.button {
  display: inline-flex; align-items: center; justify-content: center; gap: 8px;
  min-height: 48px; padding: 0 20px; border: 1.5px solid transparent; border-radius: 999px;
  font: 700 16px/1.2 var(--font); text-align: center; cursor: pointer; text-decoration: none;
}
.button--primary { background: var(--red); color: var(--white); }
.button--secondary { background: var(--navy); color: var(--white); }
.button--ghost { background: var(--white); color: var(--navy); border-color: var(--hairline); }
.button:disabled { opacity: 0.45; cursor: not-allowed; }
.button:focus-visible { outline: 3px solid var(--focus); outline-offset: 2px; }
.photo-row { display: flex; flex-wrap: wrap; gap: 8px; }
.photo-row:focus-within label.button { outline: 3px solid var(--focus); outline-offset: 2px; }

/* Phone: Share / Download stay pinned to the bottom of the screen. */
.actions {
  position: fixed; left: 0; right: 0; bottom: 0; z-index: 10; display: flex; gap: 8px;
  padding: 12px 16px calc(12px + env(safe-area-inset-bottom));
  background: rgba(255, 255, 255, 0.97); border-top: 1px solid var(--hairline);
}
.actions .button { flex: 1 1 0; }

@media (max-width: 480px) {
  .field-row { grid-template-columns: 1fr; }
}

@media (min-width: 768px) {
  .workspace {
    grid-template-columns: 380px minmax(0, 1fr);
    grid-template-areas: "controls preview";
    align-items: start; padding-bottom: 32px;
  }
  .controls { grid-area: controls; }
  .preview { grid-area: preview; position: sticky; top: 16px; }
  #canvas { max-height: calc(100vh - 220px); }
  .actions { position: static; padding: 0; background: none; border: 0; justify-content: center; }
  .actions .button { flex: 0 0 auto; min-width: 180px; }
}
```

- [ ] **Step 4: Create `index.html`**

```html
<!doctype html>
<html lang="hi">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Quote Maker · Education Mirror</title>
  <meta name="description" content="Make branded Education Mirror quote images in Hindi and English.">
  <meta name="theme-color" content="#0A2159">
  <link rel="icon" href="assets/img/favicon-32.png" sizes="32x32" type="image/png">
  <link rel="apple-touch-icon" href="assets/img/emblem.png">
  <link rel="preload" href="assets/fonts/mukta-devanagari-700-normal.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="preload" href="assets/fonts/mukta-latin-700-normal.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="stylesheet" href="css/app.css">
  <script type="module" src="js/app.js"></script>
</head>
<body>
  <header class="masthead">
    <a class="brand" href="https://educationmirror.org" aria-label="Education Mirror website">
      <img src="assets/img/emblem.png" alt="" width="36" height="36">
      <span class="brand__word">Education Mirror</span>
    </a>
    <h1 class="masthead__tool">Quote Maker · कोट मेकर</h1>
  </header>

  <main class="workspace">
    <section class="preview" aria-label="Preview">
      <div class="preview__frame">
        <canvas id="canvas" width="1080" height="1350" role="img" aria-label="Quote image preview"></canvas>
      </div>
      <p id="drag-hint" class="hint" hidden>Drag the preview to move the photo · फ़ोटो खिसकाने के लिए खींचें</p>
      <p id="status" class="status" role="status" aria-live="polite"></p>
      <div class="actions">
        <button type="button" id="share" class="button button--primary" hidden disabled>Share · शेयर</button>
        <button type="button" id="download" class="button button--secondary" disabled>Download PNG</button>
      </div>
    </section>

    <form class="controls" autocomplete="off" onsubmit="return false">
      <label class="field">
        <span class="field__label">Quote · कोट</span>
        <textarea id="quote" rows="5" placeholder="शिक्षा वह शस्त्र है जिससे आप दुनिया बदल सकते हैं।"></textarea>
      </label>

      <div class="field-row">
        <label class="field">
          <span class="field__label">Name · नाम <em>(optional)</em></span>
          <input id="name" type="text" placeholder="कृष्ण कुमार">
        </label>
        <label class="field">
          <span class="field__label">Role · पद <em>(optional)</em></span>
          <input id="role" type="text" placeholder="प्राथमिक शिक्षक, उत्तराखंड">
        </label>
      </div>

      <fieldset class="field">
        <legend class="field__label">Size · साइज़</legend>
        <div id="sizes" class="choices"></div>
      </fieldset>

      <fieldset class="field">
        <legend class="field__label">Style · स्टाइल</legend>
        <div id="styles" class="choices choices--styles"></div>
      </fieldset>

      <div class="field">
        <span class="field__label">Photo · फ़ोटो <em>(optional)</em></span>
        <div class="photo-row">
          <input id="photo" type="file" accept="image/*" class="visually-hidden">
          <label for="photo" class="button button--ghost">Choose photo · फ़ोटो चुनें</label>
          <button type="button" id="remove-photo" class="button button--ghost" hidden>Remove · हटाएँ</button>
        </div>
      </div>
    </form>
  </main>
</body>
</html>
```

- [ ] **Step 5: Create `js/render.js`**

```js
// Draws one quote image onto a 2D context sized W×H. All positions come from planLayout().
import { BRAND, STYLES } from './presets.js';
import { coverRect, planLayout } from './layout.js';

export function measureWith(ctx) {
  return (text, cssFont) => {
    ctx.font = cssFont;
    return ctx.measureText(text).width;
  };
}

export function renderQuote(ctx, state, assets) {
  const { width: W, height: H } = ctx.canvas;
  const style = STYLES[state.styleKey] || STYLES.navy;
  const plan = planLayout({ W, H, quote: state.quote, name: state.name, role: state.role }, measureWith(ctx));

  ctx.save();
  ctx.clearRect(0, 0, W, H);
  drawBackground(ctx, W, H, style, state);
  ctx.textAlign = 'center';
  drawMark(ctx, plan.mark, style);
  drawQuote(ctx, plan.quote, style);
  drawDivider(ctx, plan.divider, style);
  if (plan.name) drawLine(ctx, plan.name, style.name);
  if (plan.role) drawLine(ctx, plan.role, style.role);
  drawFooter(ctx, plan.footer, style, assets.emblem, plan.u);
  ctx.restore();

  return { fits: plan.quote.fits };
}

function drawBackground(ctx, W, H, style, state) {
  if (style.photo && state.photo) {
    const p = state.photo;
    const r = coverRect(p.width, p.height, W, H, state.fx, state.fy);
    ctx.drawImage(p, r.sx, r.sy, r.sw, r.sh, 0, 0, W, H);
    const tint = ctx.createLinearGradient(0, 0, 0, H);
    tint.addColorStop(0, style.overlayTop);
    tint.addColorStop(1, style.overlayBottom);
    ctx.fillStyle = tint;
    ctx.fillRect(0, 0, W, H);
    return;
  }
  ctx.fillStyle = style.bg;
  ctx.fillRect(0, 0, W, H);
  if (style.lift) {
    const cy = H * 0.42;
    const glow = ctx.createRadialGradient(W / 2, cy, 0, W / 2, cy, Math.max(W, H) * 0.7);
    glow.addColorStop(0, style.lift);
    glow.addColorStop(1, style.bg);
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);
  }
}

function drawMark(ctx, mark, style) {
  ctx.font = mark.font;
  ctx.fillStyle = style.mark;
  ctx.textBaseline = 'alphabetic';
  // Put the top of the glyph (not the em box) at mark.y.
  const ascent = ctx.measureText('“').actualBoundingBoxAscent;
  ctx.fillText('“', mark.x, mark.y + ascent);
}

function drawScaled(ctx, text, x, y, scaleX) {
  if (scaleX >= 1) {
    ctx.fillText(text, x, y);
    return;
  }
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scaleX, 1);
  ctx.fillText(text, 0, 0);
  ctx.restore();
}

function drawQuote(ctx, q, style) {
  ctx.font = q.font;
  ctx.fillStyle = style.text;
  ctx.textBaseline = 'middle';
  q.lines.forEach((line, i) => drawScaled(ctx, line.text, q.x, q.top + (i + 0.5) * q.lineHeight, line.scaleX));
}

function drawLine(ctx, line, color) {
  ctx.font = line.font;
  ctx.fillStyle = color;
  ctx.textBaseline = 'middle';
  drawScaled(ctx, line.text, line.x, line.y, line.scaleX);
}

function drawDivider(ctx, d, style) {
  const t = d.thickness;
  ctx.fillStyle = style.rule;
  ctx.fillRect(d.x - d.halfWidth, d.y - t / 2, d.halfWidth - d.hole, t);
  ctx.fillRect(d.x + d.hole, d.y - t / 2, d.halfWidth - d.hole, t);
  ctx.fillStyle = style.dot;
  ctx.beginPath();
  ctx.arc(d.x, d.y, d.dotR, 0, Math.PI * 2);
  ctx.fill();
}

function pillPath(ctx, x, y, w, h) {
  const r = h / 2;
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arc(x + w - r, y + r, r, -Math.PI / 2, Math.PI / 2);
  ctx.lineTo(x + r, y + h);
  ctx.arc(x + r, y + r, r, Math.PI / 2, Math.PI * 1.5);
  ctx.closePath();
}

function drawFooter(ctx, f, style, emblem, u) {
  const { pill } = f;
  pillPath(ctx, pill.x, pill.y, pill.w, pill.h);
  ctx.fillStyle = BRAND.white;
  ctx.fill();
  if (style.pillBorder) {
    ctx.lineWidth = Math.max(2, 2 * u);
    ctx.strokeStyle = style.pillBorder;
    ctx.stroke();
  }
  if (emblem) ctx.drawImage(emblem, f.emblem.x, f.emblem.y, f.emblem.size, f.emblem.size);

  ctx.font = f.wordmark.font;
  ctx.fillStyle = BRAND.red;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(BRAND.wordmark, f.wordmark.x, f.wordmark.y);

  ctx.textAlign = 'center';
  ctx.font = f.site.font;
  ctx.fillStyle = style.role;
  ctx.fillText(BRAND.site, f.site.x, f.site.y);
}
```

- [ ] **Step 6: Create `js/app.js`**

```js
// Page wiring: inputs → state → preview, photo upload and drag, share and download.
import { SAMPLE, SIZES, STYLES } from './presets.js';
import { dragFocus, exportName, fitWithin } from './layout.js';
import { renderQuote } from './render.js';
import { readSettings, writeSettings } from './settings.js';

const MSG = {
  loading: 'Loading fonts… · फ़ॉन्ट लोड हो रहे हैं…',
  fontFail: 'फ़ॉन्ट लोड नहीं हो पाए — हिंदी सही न दिखे / Fonts did not load — Hindi may look wrong',
  tooLong: 'यह कोट इस साइज़ के लिए बहुत लंबा है — छोटा करें या बड़ा साइज़ चुनें / Quote too long for this size — shorten it or pick a taller size',
  badFile: 'यह फ़ाइल खुल नहीं पाई / Could not open this file',
  saveFail: 'इमेज नहीं बन पाई — फिर कोशिश करें / Could not create the image — try again',
  empty: 'Type a quote to save the image · इमेज सेव करने के लिए कोट लिखें',
};
const PHOTO_MAX_EDGE = 2400;

const $ = (id) => document.getElementById(id);
const canvas = $('canvas');
const ctx = canvas.getContext('2d');
const el = {
  quote: $('quote'), name: $('name'), role: $('role'), sizes: $('sizes'), styles: $('styles'),
  photo: $('photo'), removePhoto: $('remove-photo'), status: $('status'), hint: $('drag-hint'),
  share: $('share'), download: $('download'),
};

const storage = (() => {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
})() || { getItem: () => null, setItem() {} };

const saved = readSettings(storage);
const state = {
  quote: '', name: saved.name, role: saved.role,
  sizeKey: saved.sizeKey, styleKey: saved.styleKey, plainStyleKey: saved.styleKey,
  photo: null, fx: 0.5, fy: 0.5,
};
const assets = { emblem: null };
const ui = {
  ready: false, fontFail: false, notice: '', noticeTimer: 0, frame: 0,
  readyFile: null, prepTimer: 0, prepToken: 0, drag: null,
};

// ---------- rendering ----------

function schedule() {
  if (!ui.frame) ui.frame = requestAnimationFrame(draw);
}

function setStatus(text, warn) {
  if (el.status.textContent !== text) el.status.textContent = text;
  el.status.classList.toggle('is-warning', warn);
}

function draw() {
  ui.frame = 0;
  if (!ui.ready) return;
  const { w, h } = SIZES[state.sizeKey];
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  const empty = state.quote.trim() === '';
  const shown = empty
    ? { ...state, quote: SAMPLE.quote, name: state.name || state.role ? state.name : SAMPLE.name }
    : state;
  const { fits } = renderQuote(ctx, shown, assets);

  const warnings = [ui.fontFail && MSG.fontFail, ui.notice, !fits && MSG.tooLong].filter(Boolean);
  setStatus(warnings.length ? warnings.join('\n') : empty ? MSG.empty : '', warnings.length > 0);
  el.download.disabled = empty;
  el.share.disabled = empty;

  // Prepare the PNG ahead of time so Share can call navigator.share inside the tap (iOS Safari).
  ui.readyFile = null;
  ui.prepToken += 1;
  clearTimeout(ui.prepTimer);
  if (!empty) ui.prepTimer = setTimeout(prepareFile, 250);
}

// ---------- export ----------

function canvasFile() {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('PNG export failed'));
        return;
      }
      resolve(new File([blob], exportName(new Date(), canvas.width, canvas.height), { type: 'image/png' }));
    }, 'image/png');
  });
}

function prepareFile() {
  const token = ui.prepToken;
  canvasFile().then((file) => {
    if (token === ui.prepToken) ui.readyFile = file;
  }, () => {});
}

function downloadFile(file) {
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function canShareFiles() {
  try {
    const probe = new File([new Blob(['x'])], 'x.png', { type: 'image/png' });
    return Boolean(navigator.canShare && navigator.canShare({ files: [probe] }));
  } catch {
    return false;
  }
}

// ---------- photo ----------

async function loadPhoto(file) {
  if (file.type && !file.type.startsWith('image/')) throw new Error('not an image');
  let source = null;
  let url = '';
  try {
    if ('createImageBitmap' in window) {
      try {
        source = await createImageBitmap(file, { imageOrientation: 'from-image' });
      } catch {
        source = null;
      }
    }
    if (!source) {
      url = URL.createObjectURL(file);
      source = new Image();
      source.src = url;
      await source.decode();
    }
    const w0 = source.naturalWidth || source.width;
    const h0 = source.naturalHeight || source.height;
    if (!w0 || !h0) throw new Error('empty image');
    const { w, h } = fitWithin(w0, h0, PHOTO_MAX_EDGE);
    const photo = document.createElement('canvas');
    photo.width = w;
    photo.height = h;
    photo.getContext('2d').drawImage(source, 0, 0, w, h);
    return photo;
  } finally {
    if (source && typeof source.close === 'function') source.close();
    if (url) URL.revokeObjectURL(url);
  }
}

// ---------- controls ----------

function persist() {
  writeSettings(storage, { sizeKey: state.sizeKey, styleKey: state.plainStyleKey, name: state.name, role: state.role });
}

function showNotice(text) {
  ui.notice = text;
  clearTimeout(ui.noticeTimer);
  ui.noticeTimer = setTimeout(() => {
    ui.notice = '';
    schedule();
  }, 6000);
  schedule();
}

function buildChoices(container, group, table, withDims) {
  for (const [key, item] of Object.entries(table)) {
    const label = document.createElement('label');
    label.className = 'choice';
    const input = document.createElement('input');
    input.type = 'radio';
    input.name = group;
    input.value = key;
    input.className = 'visually-hidden';
    const text = document.createElement('span');
    text.className = 'choice__text';
    if (!withDims) {
      const swatch = document.createElement('span');
      swatch.className = 'swatch';
      swatch.dataset.style = key;
      text.append(swatch);
    }
    text.append(item.label);
    if (withDims) {
      const dims = document.createElement('small');
      dims.textContent = `${item.w} × ${item.h}`;
      text.append(dims);
    }
    label.append(input, text);
    container.append(label);
  }
}

function syncControls() {
  for (const r of el.sizes.querySelectorAll('input')) r.checked = r.value === state.sizeKey;
  for (const r of el.styles.querySelectorAll('input')) {
    r.checked = r.value === state.styleKey;
    if (r.value === 'photo') r.disabled = !state.photo;
  }
  const photoMode = state.styleKey === 'photo' && Boolean(state.photo);
  el.removePhoto.hidden = !state.photo;
  el.hint.hidden = !photoMode;
  canvas.classList.toggle('is-draggable', photoMode);
}

function setStyle(key) {
  state.styleKey = key;
  if (key !== 'photo') state.plainStyleKey = key;
  persist();
  syncControls();
  schedule();
}

el.quote.addEventListener('input', () => {
  state.quote = el.quote.value;
  schedule();
});
el.name.addEventListener('input', () => {
  state.name = el.name.value;
  persist();
  schedule();
});
el.role.addEventListener('input', () => {
  state.role = el.role.value;
  persist();
  schedule();
});
el.sizes.addEventListener('change', (e) => {
  state.sizeKey = e.target.value;
  persist();
  schedule();
});
el.styles.addEventListener('change', (e) => setStyle(e.target.value));

el.photo.addEventListener('change', async () => {
  const file = el.photo.files && el.photo.files[0];
  el.photo.value = ''; // lets the same file be chosen again
  if (!file) return;
  try {
    state.photo = await loadPhoto(file);
    state.fx = 0.5;
    state.fy = 0.5;
    setStyle('photo');
  } catch {
    showNotice(MSG.badFile);
  }
});

el.removePhoto.addEventListener('click', () => {
  state.photo = null;
  setStyle(state.plainStyleKey);
});

el.download.addEventListener('click', async () => {
  try {
    downloadFile(ui.readyFile || (await canvasFile()));
  } catch {
    showNotice(MSG.saveFail);
  }
});

el.share.addEventListener('click', async () => {
  let file;
  try {
    // With a prepared file there is no await before navigator.share, so the tap still counts.
    file = ui.readyFile || (await canvasFile());
  } catch {
    showNotice(MSG.saveFail);
    return;
  }
  try {
    await navigator.share({ files: [file] });
  } catch (err) {
    if (!err || err.name !== 'AbortError') downloadFile(file);
  }
});

// Drag on the preview to move the photo.
canvas.addEventListener('pointerdown', (e) => {
  if (state.styleKey !== 'photo' || !state.photo) return;
  ui.drag = { id: e.pointerId, x: e.clientX, y: e.clientY };
  try {
    canvas.setPointerCapture(e.pointerId);
  } catch {
    // Synthetic or already-released pointers cannot be captured; dragging still works.
  }
});
canvas.addEventListener('pointermove', (e) => {
  if (!ui.drag || e.pointerId !== ui.drag.id || !state.photo) return;
  const k = canvas.width / canvas.getBoundingClientRect().width;
  const next = dragFocus(
    state.fx, state.fy, (e.clientX - ui.drag.x) * k, (e.clientY - ui.drag.y) * k,
    state.photo.width, state.photo.height, canvas.width, canvas.height,
  );
  state.fx = next.fx;
  state.fy = next.fy;
  ui.drag.x = e.clientX;
  ui.drag.y = e.clientY;
  schedule();
});
const endDrag = (e) => {
  if (ui.drag && e.pointerId === ui.drag.id) ui.drag = null;
};
canvas.addEventListener('pointerup', endDrag);
canvas.addEventListener('pointercancel', endDrag);

// ---------- boot ----------

function loadFonts() {
  const faces = ['400 40px Mukta', '700 40px Mukta', '700 40px "Noto Serif"'];
  const jobs = faces.flatMap((f) => [document.fonts.load(f, 'शिक्षा'), document.fonts.load(f, 'Education “')]);
  const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('font timeout')), 8000));
  return Promise.race([Promise.all(jobs), timeout]);
}

function loadImage(src) {
  const img = new Image();
  img.src = src;
  return img.decode().then(() => img);
}

buildChoices(el.sizes, 'size', SIZES, true);
buildChoices(el.styles, 'style', STYLES, false);
el.name.value = state.name;
el.role.value = state.role;
el.share.hidden = !canShareFiles();
syncControls();
setStatus(MSG.loading, false);

Promise.all([
  loadFonts().then(() => false, () => true),
  loadImage('assets/img/emblem.png').catch(() => null),
]).then(([fontFail, emblem]) => {
  ui.fontFail = fontFail;
  assets.emblem = emblem;
  ui.ready = true;
  schedule();
});
```

- [ ] **Step 7: Create `.claude/launch.json` and start the local server**

```json
{
  "version": "0.0.1",
  "configurations": [
    {
      "name": "quote-maker",
      "runtimeExecutable": "python",
      "runtimeArgs": ["-m", "http.server", "8765", "--bind", "127.0.0.1"],
      "port": 8765
    }
  ]
}
```

Then call `preview_start` with name `quote-maker` and take a screenshot.

Expected:
- The masthead shows the emblem and the red wordmark.
- The preview shows the sample Hindi quote on navy with the status "Type a quote to save the image…".
- `read_console_messages` with `onlyErrors: true` returns nothing.

- [ ] **Step 8: Browser check: fonts loaded, and every size × plain style renders**

Run with `javascript_tool`:

```js
await document.fonts.ready;
const faces = [...document.fonts].filter((f) => f.status === 'loaded').map((f) => `${f.family} ${f.weight}`);
const q = document.getElementById('quote');
q.value = 'शिक्षा वह शस्त्र है जिससे आप दुनिया बदल सकते हैं।';
q.dispatchEvent(new Event('input'));
const out = [];
for (const size of document.querySelectorAll('input[name=size]')) {
  size.click();
  for (const style of document.querySelectorAll('input[name=style]:not([value=photo])')) {
    style.click();
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const c = document.getElementById('canvas');
    out.push(`${size.value}/${style.value} ${c.width}x${c.height} "${document.getElementById('status').textContent}"`);
  }
}
({ hindiReady: document.fonts.check('700 40px Mukta', 'शिक्षा'), faces: [...new Set(faces)], out });
```

Expected:
- `hindiReady: true`.
- `faces` includes `Mukta 400`, `Mukta 700` and `Noto Serif 700`.
- 15 `out` rows with the right W×H per size (square 1080x1080, portrait 1080x1350, story 1080x1920, link 1200x630, x 1600x900), each with an empty status `""`.
- No console errors.

- [ ] **Step 9: Browser check: Hindi shaping, layout and exact export size**

1. Select Portrait + Navy, take a screenshot, and `zoom` into the quote. Confirm:
   - "शिक्षा" shows the क्ष conjunct and the ि matra before श.
   - "शस्त्र" shows the स्त्र conjunct.
   - The danda "।" is present, and no glyph shows as a dotted circle or box.
   - The quote mark, rule-with-dot, name and footer pill (emblem + red "Education Mirror") are all visible and don't overlap.
2. Repeat the screenshot for Light, Red and Story + Navy, and for Link (1200×630) + Navy. Fix any overlap by adjusting only `LAYOUT` constants in `js/layout.js`, re-run `node --test tests/`, and re-check.
3. Run:

```js
const c = document.getElementById('canvas');
const sizes = {};
for (const size of document.querySelectorAll('input[name=size]')) {
  size.click();
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  const blob = await new Promise((r) => c.toBlob(r, 'image/png'));
  const bmp = await createImageBitmap(blob);
  sizes[size.value] = `${bmp.width}x${bmp.height} ${blob.type}`;
}
sizes;
```

Expected: `{square:"1080x1080 image/png", portrait:"1080x1350 image/png", story:"1080x1920 image/png", link:"1200x630 image/png", x:"1600x900 image/png"}`.

- [ ] **Step 10: Browser check: too-long warning, photo upload, bad file, drag**

Run:

```js
const tick = () => new Promise((r) => setTimeout(r, 400));
const status = () => document.getElementById('status').textContent;
const q = document.getElementById('quote');
q.value = 'NEP 2020 ने foundational literacy को प्राथमिकता दी। '.repeat(12);
q.dispatchEvent(new Event('input'));
document.querySelector('input[name=size][value=link]').click();
await tick();
const tooLong = status();

q.value = 'बच्चों की भाषा का सम्मान ही सीखने की पहली सीढ़ी है।';
q.dispatchEvent(new Event('input'));
document.querySelector('input[name=size][value=x]').click();
const art = new OffscreenCanvas(900, 2400);
const g = art.getContext('2d');
const grad = g.createLinearGradient(0, 0, 0, 2400);
grad.addColorStop(0, '#5A6275'); grad.addColorStop(1, '#F5F6FA');
g.fillStyle = grad; g.fillRect(0, 0, 900, 2400);
const put = async (file) => {
  const dt = new DataTransfer(); dt.items.add(file);
  const input = document.getElementById('photo'); input.files = dt.files;
  input.dispatchEvent(new Event('change')); await tick();
};
await put(new File([await art.convertToBlob({ type: 'image/jpeg' })], 'tall.jpg', { type: 'image/jpeg' }));
const afterPhoto = {
  photoChecked: document.querySelector('input[name=style][value=photo]').checked,
  removeVisible: !document.getElementById('remove-photo').hidden,
  hintVisible: !document.getElementById('drag-hint').hidden,
};
await put(new File(['hello'], 'notes.txt', { type: 'text/plain' }));
const badFile = { status: status(), stillPhoto: document.querySelector('input[name=style][value=photo]').checked };
({ tooLong, afterPhoto, badFile });
```

Expected:
- `tooLong` contains `Quote too long for this size`.
- `afterPhoto` is all `true`.
- `badFile.status` contains `Could not open this file`, and `badFile.stillPhoto` is `true`.

Then record a pixel above the quote mark:

```js
const c = document.getElementById('canvas');
[...c.getContext('2d').getImageData(c.width / 2, 20, 1, 1).data];
```

Take a screenshot, then use `computer` `left_click_drag` from the canvas centre to 150px lower. Run the pixel snippet again.

Expected: the RGBA values differ, meaning the photo moved. Screenshot to confirm the photo shows under the navy tint, with the text readable.

Finally, click **Remove · हटाएँ**. Expected: the style returns to the previous plain style, and Photo is disabled again.

- [ ] **Step 11: Browser check: phone width, pinned buttons and remembered settings**

1. `resize_window` preset `mobile`, then reload.
2. Run:

```js
({ noHScroll: document.documentElement.scrollWidth <= window.innerWidth,
   actionsFixed: getComputedStyle(document.querySelector('.actions')).position,
   size: document.querySelector('input[name=size]:checked').value,
   style: document.querySelector('input[name=style]:checked').value,
   name: document.getElementById('name').value });
```

Expected:
- `noHScroll: true` and `actionsFixed: "fixed"`.
- `size: "x"` (remembered from Step 10) and `style` equal to the last plain style.
- The quote box is empty (quotes are never stored).

3. Take a screenshot to confirm the preview sits above the inputs and the buttons are pinned at the bottom.
4. `resize_window` preset `desktop`.

- [ ] **Step 12: Browser check: Share is synchronous and Download names the file**

Type a quote first so the buttons are enabled, then run:

```js
const q = document.getElementById('quote');
q.value = 'Learn. Reflect. Grow.'; q.dispatchEvent(new Event('input'));
document.querySelector('input[name=size][value=portrait]').click();
await new Promise((r) => setTimeout(r, 800)); // the prepared file is ready after ~250ms
Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => true });
Object.defineProperty(navigator, 'share', { configurable: true, value: async (d) => {
  window.__shared = { name: d.files[0].name, type: d.files[0].type, sync: window.__inClick === true };
} });
const share = document.getElementById('share');
share.hidden = false;
window.__inClick = true; share.click(); window.__inClick = false;
let downloaded = null;
const orig = HTMLAnchorElement.prototype.click;
HTMLAnchorElement.prototype.click = function () { downloaded = this.download; };
document.getElementById('download').click();
await new Promise((r) => setTimeout(r, 300));
HTMLAnchorElement.prototype.click = orig;
({ shared: window.__shared, downloaded });
```

Expected:
- `shared.sync: true`, `shared.type: "image/png"`, and `shared.name` matching `/^education-mirror-quote-\d{8}-\d{4}-1080x1350\.png$/`.
- `downloaded` matches the same pattern.

Reload the page afterwards to drop the stubs.

- [ ] **Step 13: Run unit tests and commit**

```bash
node --test tests/
git add assets css index.html js .claude/launch.json
git commit -m "feat: quote maker page with canvas renderer, photo mode, share and download

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

Expected: `# fail 0` before committing.

---

### Task 4: README, publish to GitHub Pages, live check

**Files:**
- Create: `README.md`, `.nojekyll` (empty)

- [ ] **Step 1: Create `README.md`**

````markdown
# Education Mirror Quote Maker

Make branded Education Mirror quote images in Hindi and English, sized for social media.

**Use it:** https://adichandrashekar.github.io/em-quote-maker/

1. Type the quote (Hindi, English or both). Add a name and role if you like.
2. Pick a size (Instagram, Story/WhatsApp Status, Facebook/LinkedIn, X) and a style.
3. Optional: choose a photo for the background and drag the preview to position it.
4. Tap **Share** (phone) or **Download PNG**.

Everything happens in your browser; quotes and photos are never uploaded.

## Develop

No build step. Serve the folder and open it:

```bash
python -m http.server 8765
```

Run the unit tests (Node 18+):

```bash
npm test
```

- Brand colours and sizes: `js/presets.js`
- Layout constants: `LAYOUT` in `js/layout.js`
- Design spec: `docs/superpowers/specs/2026-09-26-quote-maker-design.md`

Fonts: Mukta and Noto Serif, SIL Open Font License 1.1 (see `assets/fonts/OFL-*.txt`).
````

- [ ] **Step 2: Create `.nojekyll` and commit**

```bash
touch .nojekyll
git add README.md .nojekyll
git commit -m "docs: README and Pages config

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 3: STOP and confirm with Adi before publishing**

Ask: "Ready to create the public repo `AdiChandrashekar/em-quote-maker` and turn on GitHub Pages? Everything in this folder becomes public, including `docs/` (spec and plan)." Continue only on a clear yes.

- [ ] **Step 4: Create the repo, push and enable Pages**

```bash
gh repo create AdiChandrashekar/em-quote-maker --public --source . --remote origin --push --description "Education Mirror quote image maker (Hindi + English)"
gh api -X POST repos/AdiChandrashekar/em-quote-maker/pages -f "source[branch]=main" -f "source[path]=/"
gh api repos/AdiChandrashekar/em-quote-maker/pages --jq '.html_url'
```

Expected: the last command prints `https://adichandrashekar.github.io/em-quote-maker/`.

- [ ] **Step 5: Wait for the first Pages build**

```bash
gh api repos/AdiChandrashekar/em-quote-maker/pages/builds/latest --jq '.status'
```

Repeat until it prints `built` (usually 1–2 minutes). If it prints `errored`, read `.error.message` from the same endpoint.

- [ ] **Step 6: Live check**

1. `navigate` to `https://adichandrashekar.github.io/em-quote-maker/`.
2. Run the Step 8 snippet from Task 3.

Expected:
- `hindiReady: true`, with 15 rows at the right sizes.
- `read_network_requests` shows every font and the emblem returning 200 from `adichandrashekar.github.io`, with no other hosts.

Take one screenshot for Adi.
