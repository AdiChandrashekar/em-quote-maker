import test from 'node:test';
import assert from 'node:assert/strict';
import { SETTINGS_KEY, DEFAULTS, readSettings, writeSettings } from '../js/settings.js';

const memory = (initial) => {
  const m = new Map(initial ? [[SETTINGS_KEY, JSON.stringify(initial)]] : []);
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)) };
};

test('settings round-trip through storage', () => {
  const storage = memory();
  const s = { sizeKey: 'story', backdropKey: 'kolam', colour: '#FFD400', name: 'कृष्ण', role: 'शिक्षक' };
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
  const stale = memory({ sizeKey: 'constructor', backdropKey: 'photo', colour: 'red', name: 5, role: 'शिक्षक' });
  assert.deepEqual(readSettings(stale), { ...DEFAULTS, role: 'शिक्षक' });
});

test('an unknown backdrop falls back to Plain and a missing colour to the backdrop\'s natural colour', () => {
  assert.deepEqual(readSettings(memory({ backdropKey: 'nope' })), DEFAULTS);
  assert.equal(readSettings(memory({ backdropKey: 'notebook' })).colour, '#FFFFFF');
  assert.equal(readSettings(memory({ backdropKey: 'notebook', colour: '#ffd400' })).colour, '#FFD400');
});

test('styles saved before backdrops existed become Plain in the same colour', () => {
  assert.deepEqual(readSettings(memory({ sizeKey: 'x', styleKey: 'light', name: 'A', role: '' })),
    { sizeKey: 'x', backdropKey: 'plain', colour: '#F5F6FA', name: 'A', role: '' });
  assert.equal(readSettings(memory({ styleKey: 'red' })).colour, '#D71920');
  assert.equal(readSettings(memory({ styleKey: 'navy' })).colour, '#0A2159');
});
