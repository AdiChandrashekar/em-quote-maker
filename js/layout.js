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
  tallSafe: 0.132, // × H: stories get top/bottom padding clear of Instagram/WhatsApp overlays (250px of 1920)
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
  logo: 240, // the full Education Mirror logo, bottom right
  logoMat: 12, // white border around the logo
  siteSize: 60, // educationmirror.org, bottom left (shrinks only if it would reach the logo)
  siteGap: 40, // minimum space between the web address and the logo
  siteLineHeight: 1.3, // × font size
};

export function planLayout({ W, H, quote, name = '', role = '' }, measure) {
  const L = LAYOUT;
  const u = Math.min(W, H) / 1080;
  const cx = W / 2;
  const innerW = W - 2 * L.sidePad * W;
  const tall = H / W >= 1.7;
  const top = (tall ? L.tallSafe : W > H ? L.topPadLandscape : L.topPad) * H;
  const bottomPad = (tall ? L.tallSafe : L.bottomPad) * H;

  // Footer: the logo on a white mat in the bottom-right corner, the web address bottom-left on its centre line.
  const side = L.sidePad * W;
  const logoSize = L.logo * u;
  const mat = L.logoMat * u;
  const footerH = logoSize + 2 * mat;
  const footerTop = H - bottomPad - footerH;
  const logo = { x: W - side - mat - logoSize, y: footerTop + mat, size: logoSize, mat };
  let siteSize = L.siteSize * u;
  let siteW = measure(BRAND.site, font(700, siteSize));
  const room = logo.x - mat - L.siteGap * u - side;
  if (siteW > room) {
    siteSize *= room / siteW;
    siteW = room;
  }
  const footer = {
    logo,
    site: { x: side, y: footerTop + footerH / 2, font: font(700, siteSize), size: siteSize, w: siteW },
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

// Box around the quote, divider and attribution: patterns keep this area calm or clear.
export function quoteZone(plan) {
  const widths = plan.quote.lines.map((l) => l.width);
  if (plan.name) widths.push(plan.name.width);
  if (plan.role) widths.push(plan.role.width);
  const widest = Math.max(2 * plan.divider.halfWidth, ...widths);
  const last = plan.role || plan.name;
  const bottom = last ? last.y + last.size * 0.7 : plan.divider.y + plan.divider.dotR;
  return { x: plan.W / 2 - widest / 2, y: plan.quote.top, w: widest, h: bottom - plan.quote.top };
}

// Other areas decorations must stay out of: the opening quote mark, the logo and the web address.
export function keepRects(plan) {
  const { u, footer } = plan;
  const { logo, site } = footer;
  const siteH = site.size * LAYOUT.siteLineHeight;
  return {
    mark: { x: plan.W / 2 - 80 * u, y: plan.mark.y, w: 160 * u, h: LAYOUT.markBox * u },
    logo: { x: logo.x - logo.mat, y: logo.y - logo.mat, w: logo.size + 2 * logo.mat, h: logo.size + 2 * logo.mat },
    site: { x: site.x, y: site.y - siteH / 2, w: site.w, h: siteH },
  };
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
