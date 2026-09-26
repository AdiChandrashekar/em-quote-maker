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
