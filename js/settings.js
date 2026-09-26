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
