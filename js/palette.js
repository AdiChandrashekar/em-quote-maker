// Colour maths for recolourable backdrops. Pure functions, so they run in Node tests.
// One base colour in, every colour a backdrop and the text need out, with readable contrast.

export const NAVY = '#0A2159';
export const RED = '#D71920';
export const WHITE = '#FFFFFF';
export const HAIRLINE = '#E3E6EE';

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export function parseHex(hex) {
  const m = /^#([0-9a-f]{6})$/i.exec(String(hex ?? '').trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function isHex(value) {
  return parseHex(value) !== null;
}

export function toHex(rgb) {
  return `#${rgb.map((v) => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, '0')).join('').toUpperCase()}`;
}

// WCAG 2 relative luminance and contrast ratio.
export function luminance(hex) {
  const [r, g, b] = parseHex(hex).map((v) => {
    const s = v / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a, b) {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

export function mix(a, b, t) {
  const A = parseHex(a);
  const B = parseHex(b);
  return toHex(A.map((v, i) => v + (B[i] - v) * t));
}

export function rgba(hex, alpha) {
  const [r, g, b] = parseHex(hex);
  return `rgba(${r},${g},${b},${alpha})`;
}

const better = (base, a, b) => (contrast(a, base) >= contrast(b, base) ? a : b);

export function derivePalette(baseHex) {
  const base = isHex(baseHex) ? String(baseHex).trim().toUpperCase() : NAVY;
  const text = better(base, WHITE, NAVY);
  const dark = text === WHITE;
  // Brand red first; fall back to navy, then white, when the base is too close to it.
  const accent = [RED, NAVY, WHITE].find((c) => contrast(c, base) >= 2) || text;
  const role = [0.3, 0.15].map((t) => mix(text, base, t)).find((c) => contrast(c, base) >= 3) || text;
  return {
    base,
    dark,
    text,
    ink: text, // pattern lines and dots, always used with low alpha
    lift: dark ? mix(base, WHITE, 0.07) : mix(base, NAVY, 0.035),
    accent,
    onAccent: better(accent, WHITE, NAVY),
    mark: accent,
    rule: accent,
    dot: accent,
    name: text,
    role,
    pillBorder: contrast(WHITE, base) < 1.3 ? HAIRLINE : null,
  };
}
