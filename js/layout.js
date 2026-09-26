// Pure layout helpers. No DOM access, so they run in Node tests.
// Text widths come from an injected measure function.

const DEVANAGARI = /[\u0900-\u097F]/;
// Spaces that collapse to one ASCII space. ZWJ/ZWNJ (U+200D/U+200C) are deliberately not here.
const SPACES = /[ \t\u00A0\u2000-\u200A\u202F\u205F\u3000]+/g;
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
