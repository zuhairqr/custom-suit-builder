'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function fixture(scale = 1, offset = 0, silhouette = 0) {
  const panels = [];
  let edgeScans = 0;
  const context = vm.createContext({
    clamp: (n, low, high) => Math.min(high, Math.max(low, n)),
    jacketSilhouetteStretch: () => 0,
  });
  for (const file of ['body-try-on.js', 'studio-model.js']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, file), 'utf8'), context);
  }
  context.warpPanels = (ctx, image, source, target) => panels.push({source, target});
  context.putSleeve = () => {};
  const point = (x, y) => [x * scale + offset, y * scale + offset];
  const body = {
    shoulderCenter: point(440, 364), hipCenter: point(440, 832),
    elbows: [point(222, 638), point(657, 638)],
    wrists: [point(223, 912), point(654, 912)],
    knees: [point(337, 1250), point(540, 1250)],
    span: 346 * scale, torsoLength: 468 * scale,
  };
  const display = {
    safeTop: 245 * scale + offset,
    silhouetteEdge(center, direction, size) { edgeScans++; return size; },
  };
  const design = {silhouette, shoulder: 0, outfit: 2};
  return {context, panels, body, display, design, edgeScans: () => edgeScans};
}

const centerY = row => (row[0][1] + row[1][1]) / 2;
const halfWidth = row => (row[1][0] - row[0][0]) / 2;
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-7, `${actual} != ${expected}`);

for (const view of ['front', 'back']) {
  test(`studio waistcoat ${view} stays on the torso across size, translation and silhouette`, () => {
    for (const scale of [.5, 1, 1.4]) for (const offset of [0, 31]) for (const cut of [0, 1, 2]) {
      const f = fixture(scale, offset, cut);
      // Studio waistcoats are passed with studioFit=false, just like the app.
      f.context.putJacket({}, {}, f.display, f.body, f.design, true, false, false, view);
      assert.equal(f.panels.length, 1, 'one continuous torso without jacket sleeves');
      assert.equal(f.edgeScans(), 0, 'shirt creases must not be scanned as vest side edges');
      const {source, target} = f.panels[0];
      assert.equal(source.length, target.length);
      assert.equal(centerY(source[0]), view === 'back' ? 309 : 325);
      assert.equal(centerY(source.at(-1)), view === 'back' ? 1252 : 1315);
      for (let i = 0; i < target.length; i++) {
        for (const value of [...source[i].flat(), ...target[i].flat()]) assert.ok(Number.isFinite(value));
        assert.ok(target[i][1][0] > target[i][0][0]);
        if (i) {
          assert.ok(centerY(source[i]) > centerY(source[i - 1]));
          assert.ok(centerY(target[i]) > centerY(target[i - 1]));
        }
      }
      assert.ok(centerY(target[2]) > f.body.shoulderCenter[1], 'outer strap follows downward shirt shoulder');
      assert.ok(halfWidth(target[2]) < f.body.span * .5, 'vest strap ends inside the shirt shoulder');
      assert.ok(halfWidth(target[7]) / halfWidth(target[6]) > .94, 'waist cannot pinch into detected shirt folds');
      near(centerY(target.at(-1)), f.body.shoulderCenter[1] + f.body.torsoLength * (view === 'back' ? 1.035 : 1.08));
      near((target[7][0][0] + target[7][1][0]) / 2, f.body.shoulderCenter[0]);
    }
  });
}

test('rear jacket meets its photographed collar landmark while front mapping stays unchanged', () => {
  for (const scale of [.5, 1, 1.4]) for (const offset of [0, 31]) {
    const f = fixture(scale, offset);
    const front = f.context.studioModelJacketDisplay(f.display, f.body, false);
    assert.equal(front, f.display, 'front helper preserves the existing display');
    f.context.putJacket({}, {}, front, f.body, f.design, false, false, true, 'front');
    const frontNeck = centerY(f.panels[0].target[0]);
    near(frontNeck, (364 - 468 * .21) * scale + offset);
    f.panels.length = 0;
    const rear = f.context.studioModelJacketDisplay(f.display, f.body, true);
    f.context.putJacket({}, {}, rear, f.body, f.design, false, false, true, 'back');
    const rearNeck = centerY(f.panels[0].target[0]);
    near(rearNeck, 252 * scale + offset);
    assert.ok(rearNeck < frontNeck, 'rear coat removes the old excess white collar band');
    assert.ok(rearNeck > f.display.safeTop, 'coat cannot cross the protected face boundary');
  }
});

test('front waistcoat strap meets the shirt collar instead of projecting above it', () => {
  for (const scale of [.5, 1, 1.4]) for (const offset of [0, 31]) {
    const f = fixture(scale, offset);
    f.context.putJacket({}, {}, f.display, f.body, f.design, true, false, false, 'front');
    const {source, target} = f.panels[0];
    const sourceY = 331;
    const fraction = (sourceY - centerY(source[0])) / (centerY(source[1]) - centerY(source[0]));
    const tipY = centerY(target[0]) + (centerY(target[1]) - centerY(target[0])) * fraction;
    near(tipY, 343 * scale + offset);
    near(centerY(target[2]), 373 * scale + offset);
    // The whole upper strap must share one transform, rather than stretching
    // its neckline independently of the shoulder it joins.
    for (let row = 0; row < 4; row++) {
      near(halfWidth(target[row]) / halfWidth(source[row]), f.body.span * .435 / 280);
      near(centerY(target[row]), (343 + (centerY(source[row]) - 331) * 30 / 101) * scale + offset);
    }
  }
});

test('rear jacket collar remains below an unusually low protected face boundary', () => {
  const f = fixture();
  f.display.safeTop = 280;
  const rear = f.context.studioModelJacketDisplay(f.display, f.body, true);
  f.context.putJacket({}, {}, rear, f.body, f.design, false, false, true, 'back');
  near(centerY(f.panels[0].target[0]), 281);
});

test('personal-photo waistcoat retains its adaptive body edge fitting', () => {
  const f = fixture();
  f.context.putJacket({}, {}, f.display, f.body, f.design, true, false, false, '');
  assert.ok(f.edgeScans() > 0);
  near(halfWidth(f.panels[0].source[7]), 270);
  near(halfWidth(f.panels[0].source[8]), 280);
});
