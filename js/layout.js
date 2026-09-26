import { BRAND, SERIF_STACK, font } from './presets.js';

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
