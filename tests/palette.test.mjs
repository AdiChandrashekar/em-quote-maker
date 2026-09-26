import test from 'node:test';
import assert from 'node:assert/strict';
import { contrast, derivePalette, isHex, mix, rgba, NAVY, RED, WHITE } from '../js/palette.js';

test('contrast matches WCAG reference values', () => {
  assert.equal(Math.round(contrast('#000000', '#FFFFFF') * 100) / 100, 21);
  assert.equal(contrast('#777777', '#777777'), 1);
  assert.ok(contrast(WHITE, NAVY) > 14);
});

test('isHex accepts only #rrggbb', () => {
  assert.equal(isHex('#0a2159'), true);
  assert.equal(isHex('#0A2159'), true);
  assert.equal(isHex('0A2159'), false);
  assert.equal(isHex('#fff'), false);
  assert.equal(isHex('red'), false);
  assert.equal(isHex(undefined), false);
});

test('mix and rgba', () => {
  assert.equal(mix('#000000', '#FFFFFF', 0.5), '#808080');
  assert.equal(rgba('#D71920', 0.5), 'rgba(215,25,32,0.5)');
});

test('brand colours keep today\'s look', () => {
  const navy = derivePalette(NAVY);
  assert.equal(navy.text, WHITE);
  assert.equal(navy.accent, RED);

  const mist = derivePalette('#F5F6FA');
  assert.equal(mist.text, NAVY);
  assert.equal(mist.accent, RED);

  const red = derivePalette(RED);
  assert.equal(red.text, WHITE);
  assert.equal(red.accent, NAVY, 'red on red is invisible, so the accent falls back to navy');
  assert.equal(red.onAccent, WHITE);

  const white = derivePalette(WHITE);
  assert.equal(white.text, NAVY);
});

test('custom colours pick readable text and a visible accent', () => {
  assert.equal(derivePalette('#FFD400').text, NAVY, 'yellow gets navy text');
  assert.equal(derivePalette('#000000').text, WHITE, 'black gets white text');
  assert.equal(derivePalette('#777777').accent, NAVY, 'mid grey is too close to red');
  assert.equal(derivePalette('#4A4A4A').accent, WHITE, 'dark grey is too close to red and navy');
});

test('every base colour keeps large-text contrast for the quote and 3:1 for the role line', () => {
  for (let r = 0; r <= 255; r += 51) {
    for (let g = 0; g <= 255; g += 51) {
      for (let b = 0; b <= 255; b += 51) {
        const hex = `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
        const p = derivePalette(hex);
        assert.ok(contrast(p.text, p.base) >= 3.9, `${hex} text ${contrast(p.text, p.base).toFixed(2)}`);
        assert.ok(contrast(p.role, p.base) >= 3, `${hex} role ${contrast(p.role, p.base).toFixed(2)}`);
        assert.ok(contrast(p.accent, p.base) >= 2 || p.accent === p.text, `${hex} accent`);
      }
    }
  }
});

test('an invalid colour falls back to navy', () => {
  assert.equal(derivePalette('not a colour').base, NAVY);
  assert.equal(derivePalette('#0a2159').base, NAVY);
});
