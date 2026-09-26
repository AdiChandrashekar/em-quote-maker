// Remembered settings. Storage is injected so private mode and bad data can be tested.
import { SIZES } from './presets.js';
import { BACKDROPS } from './backdrops.js';
import { isHex } from './palette.js';

export const SETTINGS_KEY = 'em-quote-maker:v1';
export const DEFAULTS = Object.freeze({ sizeKey: 'portrait', backdropKey: 'plain', colour: '#0A2159', name: '', role: '' });

// Styles saved before backdrops existed become Plain in the same colour.
const LEGACY_STYLES = { navy: '#0A2159', light: '#F5F6FA', red: '#D71920' };

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
  let backdropKey = has(BACKDROPS, s.backdropKey) && s.backdropKey !== 'photo' ? s.backdropKey : DEFAULTS.backdropKey;
  let colour = isHex(s.colour) ? s.colour.trim().toUpperCase() : null;
  if (!has(BACKDROPS, s.backdropKey) && has(LEGACY_STYLES, s.styleKey)) {
    backdropKey = 'plain';
    colour = LEGACY_STYLES[s.styleKey];
  }
  return {
    sizeKey: has(SIZES, s.sizeKey) ? s.sizeKey : DEFAULTS.sizeKey,
    backdropKey,
    colour: colour || BACKDROPS[backdropKey].natural,
    name: text(s.name),
    role: text(s.role),
  };
}

export function writeSettings(storage, { sizeKey, backdropKey, colour, name, role }) {
  try {
    storage.setItem(SETTINGS_KEY, JSON.stringify({ sizeKey, backdropKey, colour, name, role }));
    return true;
  } catch {
    return false;
  }
}
