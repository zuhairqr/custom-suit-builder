'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, 'studio-model.js'), 'utf8');

function collarFunctions(extra = {}) {
  const context = vm.createContext(extra);
  vm.runInContext(source + '\nthis.collarPixel = studioShirtCollarPixel; this.paintCollar = paintStudioShirtCollar;', context);
  return context;
}

test('photographic collar fixtures retain white folds and reject neck and tie pixels', () => {
  const {collarPixel} = collarFunctions();
  // Actual RGBA samples from embedded studioModelImage at natural 768x1536.
  const fixtures = [
    {xy: [340, 270], rgba: [227, 228, 232, 253], collar: true},
    {xy: [343, 289], rgba: [231, 229, 237, 253], collar: true},
    {xy: [335, 250], rgba: [224, 223, 228, 253], collar: true},
    {xy: [422, 283], rgba: [238, 237, 242, 253], collar: true},
    {xy: [427, 251], rgba: [229, 229, 233, 253], collar: true},
    {xy: [383, 275], rgba: [46, 47, 65, 253], collar: false},
    {xy: [383, 243], rgba: [190, 144, 109, 253], collar: false},
    {xy: [359, 233], rgba: [152, 109, 80, 253], collar: false},
  ];
  for (const {xy, rgba, collar} of fixtures) assert.equal(collarPixel(...rgba), collar, `source pixel ${xy}`);
});

test('cached collar foreground preserves its offset, skips rear, and does no output pixel readback', () => {
  const {paintCollar} = collarFunctions({makeCanvas() { throw Error('Cached collar must be reused'); }});
  const canvas = {}, calls = [];
  const output = {drawImage(...args) { calls.push(args); }, getImageData() { throw Error('No output readback'); }};
  paintCollar(output, {}, {rear: false, collarForeground: {canvas, left: 312, top: 207}});
  assert.deepEqual(calls, [[canvas, 312, 207]]);
  paintCollar(output, {}, {rear: true});
  assert.equal(calls.length, 1);
});

test('front waistcoat paints the real shirt collar after the fitted garment', () => {
  const calls = [], display = {width: 750, height: 1500, safeTop: 226}, capture = {};
  const garment = {}, layer = {getContext: () => ({clearRect() {}})};
  const output = {drawImage(image) { assert.equal(image, layer); calls.push('garment'); }};
  const canvas = {getContext: () => output, setAttribute() {}};
  const context = vm.createContext({
    studioModelCaptures: new Map([['front', capture]]), studioModelDirection: () => 'front',
    studioFaces: [], studioPortraits: null, studioRearPortraits: null, renderedCanvases: new Map(),
    clothAppearance: () => [], paintStudioGarment: () => garment, prepareTryOnDisplay: () => display,
    studioModelBody: () => ({}), paintStudioModelTrousers() {},
    studioModelJacketDisplay: value => value, tryOnLayer: () => layer, putJacket() {},
    paintStudioShirtCollar() { calls.push('collar'); }, fabrics: [{name: 'Navy'}], outfits: [{name: 'Jacket'}],
  });
  const start = source.indexOf('function paintStudioModel(');
  vm.runInContext(source.slice(start) + '\nthis.paint = paintStudioModel;', context);
  assert.equal(context.paint(canvas, {outfit: 0, fabric: 0}, 'front', 'waistcoat', ''), true);
  assert.deepEqual(calls, ['garment', 'collar']);
});
