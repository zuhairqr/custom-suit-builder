'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const read = (name) => fs.readFileSync(path.join(__dirname, name), 'utf8');
let sample;
const {bodyFraming, advanceBodyCountdown, bodyImageQuality} = vm.runInNewContext(
  read('body-pose.js') + '\n({bodyFraming, advanceBodyCountdown, bodyImageQuality})',
  {makeCanvas: () => ({getContext: () => ({drawImage() {}, getImageData: () => ({data: sample})})})});

function standing() {
  const pose = Array.from({length: 33}, () => ({x: .5, y: .17, visibility: .98}));
  const pairs = [[2, 5, .476, .524, .139], [7, 8, .46, .54, .165], [11, 12, .34, .66, .254],
    [13, 14, .29, .71, .412], [15, 16, .28, .72, .56], [23, 24, .40, .60, .52], [25, 26, .40, .60, .724],
    [27, 28, .39, .61, .895], [29, 30, .389, .611, .914], [31, 32, .375, .625, .934]];
  for (const [a, b, x, other, y] of pairs) {
    pose[a] = {x, y, visibility: .98};
    pose[b] = {x: other, y, visibility: .98};
  }
  return pose;
}

test('front-facing full body passes, cropped and multiple people fail', () => {
  const pose = standing();
  assert.equal(bodyFraming([pose], .69, true).pose, pose);
  assert.match(bodyFraming([pose, pose], .69, true).message, /Only one person/);
  pose[31].y = .99;
  assert.match(bodyFraming([pose], .69, true).message, /below your feet/);
  pose[31].visibility = .3;
  assert.match(bodyFraming([pose], .69, true).message, /feet visible/);
});

test('a turned torso and a staggered stance are rejected before try-on', () => {
  const pose = standing();
  pose[11].z = -.11;
  pose[12].z = .11;
  assert.match(bodyFraming([pose], .69, false).message, /both shoulders and hips/);
  delete pose[11].z;
  delete pose[12].z;
  pose[27].y -= .05;
  assert.match(bodyFraming([pose], .69, false).message, /both feet side by side/);
});

test('a slanted panel maps the fabric continuously through its center', () => {
  const {inversePanel} = vm.runInNewContext(read('body-try-on.js') + '\n({inversePanel})',
    {clamp: (n, lo, hi) => Math.min(hi, Math.max(lo, n))});
  const sample = [0, 0];
  const map = inversePanel([10, 20], [90, 27], [21, 130], [107, 112]);
  assert.equal(map(57, 72.25, sample), true);
  assert.ok(Math.abs(sample[0] - .5) < .001);
  assert.ok(Math.abs(sample[1] - .5) < .001);
  assert.equal(map(3, 70, sample), false);
});

test('countdown requires a stable second, resets on movement and invalid frames', () => {
  const pose = standing();
  let timer = advanceBodyCountdown({}, pose, .69, 0);
  assert.equal(advanceBodyCountdown(timer, pose, .69, 999).deadline, null);
  timer = advanceBodyCountdown(timer, pose, .69, 1000);
  assert.equal(timer.deadline, 4000);
  const shifted = pose.map((point) => ({...point, x: point.x + .065}));
  assert.equal(advanceBodyCountdown(timer, shifted, .69, 1750).deadline, null);
  assert.equal(advanceBodyCountdown(timer, null, .69, 2200).stableSince, null);
});

test('quality gate rejects darkness and blur', () => {
  sample = new Uint8ClampedArray(96 * 96 * 4).fill(14);
  const pose = standing();
  const input = {width: 640, height: 900};
  assert.match(bodyImageQuality(input, pose), /lighting/);
  sample.fill(150);
  assert.match(bodyImageQuality(input, pose), /blurry/);
  for (let i = 0; i < sample.length; i += 4) sample.fill((i / 4) % 2 ? 100 : 190, i, i + 3);
  assert.equal(bodyImageQuality(input, pose), '');
});

test('the library exposes all 105 names and valid suit presets', () => {
  const data = vm.runInNewContext(read('neckline-catalog.js') + '\n' + read('catalog.js') +
    '\n({necklineSections, suitNecklinePresets, styleGroups})');
  assert.equal(data.necklineSections.flatMap(({styles}) => styles).length, 105);
  assert.equal(data.suitNecklinePresets.length, 38);
  for (const preset of data.suitNecklinePresets) {
    for (const [index, group] of ['lapel', 'lapelFinish', 'closure', 'stitching'].entries()) {
      assert.ok(preset[index] == null || data.styleGroups[group][1][preset[index]], group);
    }
  }
});
