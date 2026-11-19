'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, 'fabric-renderer.js'), 'utf8');
const context = vm.createContext({clamp: (n, lo, hi) => Math.min(hi, Math.max(lo, n))});
// The helper is pure; loading it separately avoids starting photo/network loads.
const start = source.indexOf('function isolatedClothAlpha(');
const end = source.indexOf('\nfunction isolatePhotoCloth(', start);
assert.ok(start >= 0 && end > start);
const alpha = vm.runInContext(source.slice(start, end) + '\nisolatedClothAlpha;', context);

test('cool porcelain at the source waistcoat armhole cannot become selected-fabric fringe', () => {
  // Measured original waistcoat photograph pixels, including false positives
  // with strong hue masks that the old confidence-only isolation kept opaque.
  for (const [rgba, mask] of [
    [[187, 193, 202, 253], 45],
    [[196, 196, 210, 253], 74],
    [[192, 197, 207, 253], 53],
    [[208, 211, 219, 253], 23],
  ]) {
    assert.equal(alpha(rgba, 0, mask, true), 0);
    assert.ok(alpha(rgba, 0, mask, false) > 0, 'Other garment isolation retains its previous behavior');
  }
});

test('original navy cloth retains its source opacity and antialiased boundary', () => {
  for (const [rgba, mask] of [
    [[78, 87, 114, 147], 127],
    [[24, 31, 44, 249], 98],
    [[53, 61, 81, 255], 127],
    [[49, 53, 70, 90], 127],
  ]) {
    assert.equal(alpha(rgba, 0, mask, true), rgba[3]);
  }
  assert.equal(alpha([230, 232, 235, 253], 0, 0, true), 0);
  assert.equal(alpha([78, 87, 114, 0], 0, 127, true), 0);
});
