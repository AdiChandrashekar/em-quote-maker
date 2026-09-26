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
