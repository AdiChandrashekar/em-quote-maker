// Brand data shared by the page and the renderer. Values come from the site's DESIGN.md.

export const SIZES = {
  square: { label: 'Instagram Square', w: 1080, h: 1080 },
  portrait: { label: 'Instagram Portrait', w: 1080, h: 1350 },
  story: { label: 'Story / Reel / WhatsApp Status', w: 1080, h: 1920 },
  link: { label: 'Facebook / LinkedIn', w: 1200, h: 630 },
  x: { label: 'X / Twitter', w: 1600, h: 900 },
};

// Brand colours offered first in the colour row; a custom colour wheel follows them.
export const SWATCHES = [
  { key: 'navy', label: 'Navy', hex: '#0A2159' },
  { key: 'red', label: 'Red', hex: '#D71920' },
  { key: 'mist', label: 'Mist', hex: '#F5F6FA' },
  { key: 'white', label: 'White', hex: '#FFFFFF' },
];

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
