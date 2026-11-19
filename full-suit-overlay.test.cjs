'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const read = file => fs.readFileSync(path.join(__dirname, file), 'utf8');

// A small alpha raster makes the compositing invariant independent of the
// exact seam path: even a seam covering every pixel must stay on the coat.
class AlphaCanvas {
  constructor(alpha = [0, 0, 0, 0]) {
    this.width = 2;
    this.height = 2;
    this.alpha = Uint8Array.from(alpha);
  }

  getContext() {
    return this.context ||= {
      canvas: this,
      globalCompositeOperation: 'source-over',
      scale() {}, save() {}, restore() {}, translate() {}, setTransform() {},
      drawImage(image) {
        for (let i = 0; i < this.canvas.alpha.length; i++) {
          const source = image.alpha[i];
          const destination = this.canvas.alpha[i];
          this.canvas.alpha[i] = this.globalCompositeOperation === 'destination-in'
            ? Math.round(destination * source / 255)
            : Math.round(source + destination * (1 - source / 255));
        }
      },
    };
  }
}

function openingRenderer() {
  const created = [];
  const context = vm.createContext({
    makeCanvas() {
      const canvas = new AlphaCanvas();
      created.push(canvas);
      return canvas;
    },
    ink(ctx) { ctx.canvas.alpha.fill(255); },
  });
  const draw = vm.runInContext(read('full-suit.js') + '\ndrawLookOpening;', context);
  return {draw, created};
}

test('opening seams stay on opaque and antialiased coat pixels without touching the source coat', () => {
  const {draw, created} = openingRenderer();
  const jacket = new AlphaCanvas([255, 0, 128, 64]);
  const original = Array.from(jacket.alpha);
  const output = new AlphaCanvas();
  draw(output.getContext(), 'front', jacket);
  assert.equal(created.length, 1, 'Only an independent seam overlay is allocated');
  assert.deepEqual(Array.from(output.alpha), original,
    'No edge can extend into transparent trousers/background; partial edge alpha is retained');
  assert.deepEqual(Array.from(jacket.alpha), original, 'Masking must not erase the coat itself');
});

test('Back and Inside do not acquire front opening seams', () => {
  const {draw, created} = openingRenderer();
  for (const angle of ['back', 'inside']) {
    const output = new AlphaCanvas();
    draw(output.getContext(), angle, new AlphaCanvas([255, 255, 255, 255]));
    assert.deepEqual(Array.from(output.alpha), [0, 0, 0, 0]);
  }
  assert.equal(created.length, 0);
});

test('the mannequin shirt underlay can omit the extra collar while other shirt views retain it', () => {
  const fills = [], strokes = [];
  const context = vm.createContext({
    fillShape(_ctx, shape, material) { fills.push({shape, material}); },
    ink(_ctx, shape) { strokes.push(shape); },
  });
  const paint = vm.runInContext(read('suit-pieces.js') + '\npaintWaistcoatShirt;', context);
  const gradient = {addColorStop() {}};
  const ctx = {createLinearGradient: () => gradient};
  paint(ctx, false);
  const underlay = fills.slice(), underlaySeam = strokes.slice();
  assert.equal(underlay.length, 1, 'The neckline still has an opaque shirt underlay');
  fills.length = 0;
  strokes.length = 0;
  paint(ctx);
  assert.equal(fills.length, 2, 'Existing standalone shirt views retain their collar');
  assert.deepEqual(fills[0], underlay[0], 'The original underlay is preserved in both views');
  assert.equal(strokes[0], underlaySeam[0], 'The shirt placket remains intact');
});
