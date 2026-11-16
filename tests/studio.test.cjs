'use strict';

// Run with: node --test tests/studio.test.cjs (requires Playwright and Edge).
const {test, before, after} = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const {chromium} = require('playwright');
const root = path.resolve(__dirname, '..');
let server, browser, browserServer, origin;

before(async () => {
  server = http.createServer(async (request, response) => {
    const pathname = new URL(request.url, 'http://localhost').pathname;
    const file = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : decodeURIComponent(pathname)));
    if (!file.startsWith(root + path.sep)) return response.writeHead(403).end();
    try {
      const content = await fs.readFile(file);
      const type = {'.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css'}[path.extname(file)] || 'application/octet-stream';
      response.writeHead(200, {'Content-Type': type}).end(content);
    } catch { response.writeHead(404).end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  origin = `http://127.0.0.1:${server.address().port}`;
  browserServer = await chromium.launchServer({channel: process.env.BROWSER_CHANNEL || 'msedge', executablePath: process.env.BROWSER_EXECUTABLE_PATH || undefined, headless: true});
  browser = await chromium.connect(browserServer.wsEndpoint());
});
after(async () => {
  // Edge can keep its background process alive after Browser.close on Windows.
  // Stop only the browser process owned by this test run.
  await browserServer?.kill();
  server?.closeAllConnections();
  await new Promise(resolve => server ? server.close(resolve) : resolve());
});

async function studio(t, saved) {
  const context = await browser.newContext();
  t.after(() => context.close());
  // Tests exercise local assets only; no camera, external models or services.
  await context.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
  if (saved !== undefined) await context.addInitScript(value => localStorage.setItem('form-atelier-v1', value), JSON.stringify(saved));
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  t.after(() => assert.deepEqual(errors, [], 'No runtime errors'));
  await page.goto(origin);
  await page.locator('#outfit option').first().waitFor({state: 'attached'});
  return page;
}

async function addJacket(page) {
  await page.locator('#add').click();
  await page.waitForURL('**/#cart');
  await page.locator('#to-fit').click();
  await page.waitForURL('**/#fit');
  // The hash changes before its route handler mounts the passport fields.
  // Wait before callers enumerate inputs with .all(), which does not auto-wait.
  await page.locator('[data-measurement]').first().waitFor({state: 'visible'});
}

test('body features survive reloading an unfinished passport', async t => {
  const page = await studio(t);
  await addJacket(page);
  await page.locator('[name="shoulders"]').first().check();
  await page.locator('[name="chest"]').nth(1).check();
  await page.reload();
  assert.equal(await page.locator('[name="shoulders"]').first().isChecked(), true);
  assert.equal(await page.locator('[name="chest"]').nth(1).isChecked(), true);
});

test('unit changes retain browser-filled values and measurement precision', async t => {
  const page = await studio(t);
  await addJacket(page);
  // Autofill can set values without dispatching input events.
  await page.locator('[data-measurement="chest"]').evaluate(input => { input.value = '100'; });
  await page.locator('[data-size-label]').evaluate(input => { input.value = 'EU 50'; });
  await page.locator('#passport-unit').selectOption('in');
  assert.equal(await page.locator('[data-measurement="chest"]').inputValue(), '39.37');
  assert.equal(await page.locator('[data-size-label]').inputValue(), 'EU 50');
  for (let i = 0; i < 3; i++) {
    await page.locator('#passport-unit').selectOption('cm');
    assert.equal(await page.locator('[data-measurement="chest"]').inputValue(), '100');
    await page.locator('#passport-unit').selectOption('in');
  }
});

test('invalid measurements block unit changes without discarding input', async t => {
  const page = await studio(t);
  await addJacket(page);
  await page.locator('[data-measurement="chest"]').fill('501');
  await page.locator('#passport-unit').selectOption('in');
  assert.equal(await page.locator('#passport-unit').inputValue(), 'cm');
  assert.equal(await page.locator('[data-measurement="chest"]').inputValue(), '501');
});

test('editing a bag item starts with visible garments and default zoom', async t => {
  const page = await studio(t);
  await page.locator('#outfit').selectOption('2');
  await page.locator('#toggle-jacket').click();
  await page.locator('#toggle-waistcoat').click();
  await page.locator('#zoom').click();
  await page.locator('#add').click();
  await page.locator('[data-edit="0"]').click();
  assert.equal(await page.locator('#toggle-jacket').textContent(), 'Hide jacket');
  assert.equal(await page.locator('#zoom').getAttribute('aria-pressed'), 'false');
});

test('malformed saved data falls back to a usable studio', async t => {
  const page = await studio(t, {design: {outfit: 999, fabric: -1}, bag: [null, {outfit: 2, passport: {jacket: {measurements: {chest: -1}}}}]});
  assert.equal(await page.locator('#outfit').inputValue(), '0');
  await page.locator('.bag').click();
  assert.equal(await page.locator('.cart-line').count(), 2);
  await page.locator('[data-remove="0"]').click();
  assert.equal(await page.locator('.cart-line').count(), 1);
});

test('passport, review and demo order work on mobile without overflow', async t => {
  const page = await studio(t);
  await page.setViewportSize({width: 390, height: 844});
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'Studio fits mobile width');
  if (process.env.STUDIO_SCREENSHOT_DIR) await page.screenshot({path: path.join(process.env.STUDIO_SCREENSHOT_DIR, 'studio-mobile.png'), fullPage: true});
  await addJacket(page);
  for (const input of await page.locator('[data-measurement]').all()) await input.fill('80');
  for (const name of ['shoulders', 'chest', 'posture']) await page.locator(`[name="${name}"]`).first().check();
  await page.locator('#fit-form [type="submit"]').click();
  await page.waitForURL('**/#checkout');
  assert.equal(await page.locator('#review .order-item').count(), 1);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  if (process.env.STUDIO_SCREENSHOT_DIR) await page.screenshot({path: path.join(process.env.STUDIO_SCREENSHOT_DIR, 'checkout-mobile.png'), fullPage: true});
  for (const [name, value] of Object.entries({first: 'Test', last: 'Customer', email: 'test@example.invalid', address: '1 Test Road', city: 'Test City', postal: '12345', country: 'Pakistan'})) await page.locator(`#checkout-form [name="${name}"]`).fill(value);
  await page.locator('#checkout-form [type="submit"]').click();
  await page.waitForURL('**/#complete');
  assert.equal(await page.locator('#confirmation .order-item').count(), 1);
  assert.equal(await page.locator('#bag-count').textContent(), '0');
  const download = page.waitForEvent('download');
  await page.locator('#download').click();
  assert.match((await download).suggestedFilename(), /^FA-.*\.json$/);
});

test('saved measurements survive configuration editing and remain isolated by item', async t => {
  const page = await studio(t);
  await addJacket(page);
  await page.locator('[data-measurement="chest"]').fill('101');
  await page.locator('#fit .steps a').click();
  await page.locator('[data-edit="0"]').click();
  await page.locator('#outfit').selectOption('2');
  await page.locator('#add').click();
  assert.equal(await page.locator('.cart-line').count(), 1);
  await page.locator('#to-fit').click();
  assert.equal(await page.locator('[data-passport-piece="jacket"] [data-measurement="chest"]').inputValue(), '101');
  assert.equal(await page.locator('[data-passport-piece="waistcoat"] [data-measurement="chest"]').inputValue(), '');
});

test('garment views, construction and fabric filters remain usable', async t => {
  const page = await studio(t);
  for (const mode of ['studio', 'mannequin']) {
    await page.locator('#preview-model').selectOption(mode);
    await page.locator('#outfit').selectOption('2');
    for (const angle of ['front', 'inside', 'back']) {
      await page.locator(`[data-view="${angle}"]`).click();
      assert.equal(await page.locator(`[data-view="${angle}"]`).getAttribute('aria-pressed'), 'true');
    }
    for (const piece of ['jacket', 'trousers', 'waistcoat']) {
      await page.locator(`[data-piece="${piece}"]`).click();
      assert.equal(await page.locator(`[data-piece="${piece}"]`).getAttribute('aria-pressed'), 'true');
    }
  }
  await page.locator('#fabric-search').fill('no-such-fabric-12345');
  assert.equal(await page.locator('#fabric-page').textContent(), 'No matches');
  assert.equal(await page.locator('#next-fabrics').isDisabled(), true);
  await page.locator('#reset').click();
  assert.equal(await page.locator('#outfit').inputValue(), '0');
  assert.equal(await page.locator('#fabric-search').inputValue(), '');
  assert.equal(await page.locator('.swatch').count(), 12);
  await page.locator('#style-jump').selectOption('lapel');
  await page.locator('[data-style="lapel"][data-choice="1"]').click();
  assert.equal(await page.locator('[data-style="lapel"][data-choice="1"]').getAttribute('aria-pressed'), 'true');
});

test('studio jackets cover the seat across outfits and angles', async t => {
  const page = await studio(t);
  for (const outfit of ['0', '1', '2']) {
    await page.locator('#outfit').selectOption(outfit);
    for (const view of ['front', 'inside', 'back']) {
      await page.locator(`[data-view="${view}"]`).click();
      await page.locator('#fabric-model').waitFor({state: 'visible'});
      const fit = await page.evaluate(() => {
        const layer = tryOnLayer('studio-outerwear');
        const pixels = layer.getContext('2d').getImageData(0, 0, layer.width, layer.height);
        const body = studioModelBody(prepareTryOnDisplay(studioModelCaptures.get(studioModelDirection(angle))));
        // Sample rendered panels away from the opening and sleeves, so the
        // regression measures coat coverage rather than the canvas dimensions.
        let bottom = 0;
        for (let y = 0; y < layer.height; y++) {
          for (const offset of [-.32, .32]) {
            const x = Math.round(body.hipCenter[0] + body.span * offset);
            if (pixels.data[(y * layer.width + x) * 4 + 3] > 200) bottom = y;
          }
        }
        // The quarters/vents must show trousers rather than the page background.
        const composite = get('fabric-model');
        const finalPixels = composite.getContext('2d').getImageData(0, 0, composite.width, composite.height).data;
        let gaps = 0;
        for (let y = Math.ceil(body.hipCenter[1] + body.torsoLength * .05); y < Math.min(...body.wrists.map(point => point[1])); y++) {
          for (let x = Math.ceil(body.hipCenter[0] - body.span * .36); x < body.hipCenter[0] + body.span * .36; x++) {
            if (finalPixels[(y * composite.width + x) * 4 + 3] < 240) gaps++;
          }
        }
        return {bottom, gaps, hip: body.hipCenter[1], knee: pointBetween(...body.knees, .5)[1]};
      });
      assert.ok(fit.bottom > fit.hip + (fit.knee - fit.hip) * .32, `${outfit}/${view} jacket covers the seat`);
      assert.equal(fit.gaps, 0, `${outfit}/${view} has no transparent slits below the waistcoat`);
    }
  }
});

test('shirt styling changes cloth without recoloring skin or trousers and survives bag editing', async t => {
  const page = await studio(t);
  await page.locator('[data-piece="shirt"]').click();
  await page.locator('#fabric-model').waitFor({state: 'visible'});
  const samples = () => page.evaluate(() => {
    const canvas = get('fabric-model'), ctx = canvas.getContext('2d');
    const pixel = (x, y) => [...ctx.getImageData(Math.round(x * canvas.width), Math.round(y * canvas.height), 1, 1).data];
    return {shirt: pixel(.42, .3), skin: pixel(.5, .045), trousers: pixel(.44, .65), belowTie: pixel(.5, .45)};
  });
  const before = await samples();
  await page.locator('[data-style="shirtColor"][data-choice="1"]').click();
  const blue = await samples();
  assert.notDeepEqual(blue.shirt, before.shirt);
  assert.deepEqual(blue.skin, before.skin);
  assert.deepEqual(blue.trousers, before.trousers);
  await page.locator('#style-jump').selectOption('shirtTie');
  await page.locator('[data-style="shirtTie"][data-choice="1"]').click();
  assert.deepEqual((await samples()).belowTie, blue.belowTie, 'Burgundy tie does not recolor the trousers below its tip');
  await page.locator('#style-jump').selectOption('shirtCollar');
  await page.locator('[data-style="shirtCollar"][data-choice="2"]').click();
  await page.locator('#style-jump').selectOption('shirtTie');
  assert.equal(await page.locator('[data-style="shirtTie"][data-choice="0"]').isDisabled(), true);
  assert.equal(await page.locator('[data-style="shirtTie"][data-choice="2"]').getAttribute('aria-pressed'), 'true');
  await page.reload();
  await page.locator('[data-piece="shirt"]').click();
  assert.equal(await page.locator('[data-style="shirtColor"][data-choice="1"]').getAttribute('aria-pressed'), 'true');
  assert.match(await page.locator('#choice-shirtTie').textContent(), /No tie/);
  await page.locator('#add').click();
  await page.locator('[data-edit="0"]').click();
  await page.locator('[data-piece="shirt"]').click();
  assert.equal(await page.locator('[data-style="shirtCollar"][data-choice="2"]').getAttribute('aria-pressed'), 'true');
  assert.equal(await page.locator('#price').textContent(), '$400');
  assert.deepEqual(await page.evaluate(() => orderItem(bag[0], fitUnit).shirtStyling), {
    'Shirt color': 'Sky blue', 'Shirt collar': 'Band collar', 'Shirt cuffs': 'Standard reveal', Tie: 'No tie',
  });
});

test('shirt cuff control extends jacket sleeves and switching model exits shirt controls', async t => {
  const page = await studio(t);
  await page.locator('[data-piece="shirt"]').click();
  await page.locator('#shirt-preview-toggle').click();
  const standard = await page.locator('#fabric-model').evaluate(canvas => canvas.toDataURL());
  await page.locator('#style-jump').selectOption('shirtCuff');
  await page.locator('[data-style="shirtCuff"][data-choice="1"]').click();
  assert.notEqual(await page.locator('#fabric-model').evaluate(canvas => canvas.toDataURL()), standard);
  assert.equal(await page.locator('#shirt-preview-toggle').getAttribute('aria-pressed'), 'true');
  await page.locator('#preview-model').selectOption('mannequin');
  assert.equal(await page.locator('[data-piece="shirt"]').isVisible(), false);
  assert.equal(await page.locator('#tailoring-title').textContent(), 'Jacket details');
  await page.locator('#preview-model').selectOption('studio');
  assert.equal(await page.locator('[data-piece="shirt"]').isVisible(), true);
});

test('three-piece jacket stays closed and uses the same balanced cut as the two-piece', async t => {
  const page = await studio(t);
  const waistPixels = () => page.evaluate(() => {
    const canvas = get('fabric-model');
    const body = studioModelBody(prepareTryOnDisplay(studioModelCaptures.get('front')));
    return Array.from(canvas.getContext('2d').getImageData(
      Math.round(body.hipCenter[0] - body.span * .35),
      Math.round(body.shoulderCenter[1] + body.torsoLength * .65),
      Math.round(body.span * .7), Math.round(body.torsoLength * .4)).data);
  });
  await page.locator('#outfit').selectOption('1');
  await page.locator('#fabric-model').waitFor({state: 'visible'});
  const twoPiece = await waistPixels();
  await page.locator('#outfit').selectOption('2');
  await page.locator('#fabric-model').waitFor({state: 'visible'});
  const threePiece = await waistPixels();
  // The extra compositing pass can round premultiplied color by one level.
  const maxDifference = threePiece.reduce((max, value, index) => Math.max(max, Math.abs(value - twoPiece[index])), 0);
  assert.ok(maxDifference <= 2, 'Waistcoat must not replace the front of the closed jacket');
  const proportions = await page.evaluate(() => {
    const layer = tryOnLayer('studio-outerwear');
    const pixels = layer.getContext('2d').getImageData(0, 0, layer.width, layer.height).data;
    const body = studioModelBody(prepareTryOnDisplay(studioModelCaptures.get('front')));
    const widthAt = y => {
      const row = Math.round(y), center = Math.round(body.shoulderCenter[0]);
      let left = center, right = center;
      while (left > 0 && pixels[(row * layer.width + left - 1) * 4 + 3] > 240) left--;
      while (right < layer.width - 1 && pixels[(row * layer.width + right + 1) * 4 + 3] > 240) right++;
      return right - left + 1;
    };
    return {
      chest: widthAt(body.shoulderCenter[1] + body.torsoLength * .48),
      waist: widthAt(body.shoulderCenter[1] + body.torsoLength * .72),
      skirt: widthAt(body.hipCenter[1] + (body.knees[0][1] - body.hipCenter[1]) * .33),
    };
  });
  assert.ok(proportions.waist / proportions.chest >= .87, 'Waist must not be pinched');
  assert.ok(proportions.skirt / proportions.chest <= 1.12, 'Jacket skirt must not flare out from the chest');
});

test('shirt shoulders are masked without raising the jacket collar or erasing the neck', async t => {
  const page = await studio(t);
  for (const outfit of ['0', '1', '2']) {
    await page.locator('#outfit').selectOption(outfit);
    for (const collar of ['0', '1', '2']) {
      await page.locator('[data-piece="shirt"]').click();
      await page.locator('#style-jump').selectOption('shirtCollar');
      await page.locator(`[data-style="shirtCollar"][data-choice="${collar}"]`).click();
      await page.locator('[data-piece="jacket"]').click();
      await page.locator('#fabric-model').waitFor({state: 'visible'});
      const pixels = await page.evaluate(() => {
        const canvas = get('fabric-model');
        const data = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
        let whiteShoulder = 0;
        // Photo-space patches outside the collar, where exposed shirt formed
        // the two white wings reported by the user. Allow the collar's fine edge.
        for (const [left, right] of [[350, 370], [519, 539]]) {
          for (let sy = 275; sy < 315; sy++) for (let sx = left; sx < right; sx++) {
            const i = (Math.round(sy * canvas.height / 1774) * canvas.width + Math.round(sx * canvas.width / 887)) * 4;
            const min = Math.min(data[i], data[i + 1], data[i + 2]);
            const max = Math.max(data[i], data[i + 1], data[i + 2]);
            if (min > 175 && max - min < 40 && data[i + 3] > 200) whiteShoulder++;
          }
        }
        const coat = tryOnLayer('studio-outerwear');
        const cloth = coat.getContext('2d').getImageData(0, 0, coat.width, coat.height).data;
        let raisedCollar = 0;
        for (const [left, right] of [[350, 380], [506, 536]]) {
          for (let sy = 268; sy < 283; sy++) for (let sx = left; sx < right; sx++) {
            const i = (Math.round(sy * coat.height / 1774) * coat.width + Math.round(sx * coat.width / 887)) * 4;
            if (cloth[i + 3] > 200) raisedCollar++;
          }
        }
        const original = prepareTryOnDisplay(studioModelCaptures.get('front')).photoFrame
          .getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
        let faceDifference = 0;
        for (let sy = 235; sy < 265; sy++) for (let sx = 395; sx < 495; sx++) {
          const i = (Math.round(sy * canvas.height / 1774) * canvas.width + Math.round(sx * canvas.width / 887)) * 4;
          for (let channel = 0; channel < 4; channel++) faceDifference = Math.max(faceDifference, Math.abs(data[i + channel] - original[i + channel]));
        }
        return {whiteShoulder, raisedCollar, faceDifference};
      });
      assert.ok(pixels.whiteShoulder < 5, `${outfit}/${collar}: fabric outside the shirt collar must be removed (saw ${pixels.whiteShoulder} white pixels)`);
      assert.equal(pixels.raisedCollar, 0, 'Hiding the shirt must not create a standing coat collar');
      assert.ok(pixels.faceDifference <= 1, 'Shirt masking must preserve the original chin and neck pixels');
    }
  }
});

test('garment materials keep fabric colors and patterns without magnified wool noise', async t => {
  const page = await studio(t);
  const materials = await page.evaluate(() => {
    const stats = pixels => {
      let sum = 0, square = 0;
      for (let i = 0; i < pixels.length; i += 4) {
        const value = (pixels[i] + pixels[i + 1] + pixels[i + 2]) / 3;
        sum += value; square += value * value;
      }
      const count = pixels.length / 4, mean = sum / count;
      return {mean, variance: square / count - mean * mean};
    };
    return [fabrics.findIndex(fabric => fabric.name === 'Deep Navy Worsted Twill'), 0].map(index => ({
      swatch: stats(clothTile(index).pixels), garment: stats(garmentCloth(index).pixels),
    }));
  });
  for (const material of materials) assert.ok(Math.abs(material.swatch.mean - material.garment.mean) < 1, 'Cloth color must remain faithful to its swatch');
  assert.ok(materials[0].garment.variance < materials[0].swatch.variance * .15, 'Fine worsted wool must not look pebbled at garment scale');
  assert.ok(materials[1].garment.variance > materials[1].swatch.variance * .2, 'Windowpane checks must remain visible');
  const exposure = await page.evaluate(() => [15, 45, 90, 170, 235].map(value => ({
    value, shadow: exposeCloth(value, .5), neutral: exposeCloth(value, 1), highlight: exposeCloth(value, 1.5),
  })));
  for (const sample of exposure) {
    assert.equal(sample.neutral, sample.value, 'Neutral lighting must preserve the selected color');
    assert.ok(sample.shadow < sample.neutral && sample.highlight > sample.neutral, 'Photographic exposure must retain shadows and highlights');
  }
});

test('Studio Navy look loads its local preview and applies a complete editable configuration', async t => {
  const page = await studio(t);
  await page.locator('#open-collections').click();
  await page.locator('#collection-looks img[src="assets/studio-navy-preview.jpg"]').evaluate(image => image.decode());
  assert.equal(await page.locator('#collection-looks a[href="undefined"]').count(), 0);
  await page.getByRole('button', {name: 'Apply Studio Navy', exact: true}).click();
  assert.equal(await page.locator('#source-dialog').isVisible(), false);
  assert.equal(await page.locator('#outfit').inputValue(), '1');
  assert.match(await page.locator('#fabric-detail').textContent(), /Deep Navy Worsted Twill/);
  assert.equal(await page.locator('#price').textContent(), '$565');
  await page.locator('#add').click();
  assert.equal(await page.locator('.cart-line').count(), 1);
  assert.match(await page.locator('.cart-line').textContent(), /Deep Navy Worsted Twill/);
});

test('mobile panels expose fabric and tailoring without covering configuration controls', async t => {
  const page = await studio(t);
  await page.setViewportSize({width: 390, height: 844});
  assert.equal(await page.locator('.cloth').isVisible(), true);
  assert.equal(await page.locator('.tailoring').isVisible(), false);
  await page.locator('[data-panel="tailoring"]').click();
  assert.equal(await page.locator('.tailoring').isVisible(), true);
  assert.equal(await page.locator('.cloth').isVisible(), false);
  await page.locator('#style-jump').selectOption('silhouette');
  await page.locator('[data-style="silhouette"][data-choice="1"]').click();
  assert.equal(await page.locator('[data-style="silhouette"][data-choice="1"]').getAttribute('aria-pressed'), 'true');
  assert.equal(await page.evaluate(() => lookDetail), '', 'Fit changes retain the dressed studio model');
  assert.equal(await page.locator('.order-bar').evaluate(el => getComputedStyle(el).position), 'static');
  await page.locator('[data-panel="cloth"]').click();
  assert.equal(await page.locator('.cloth').isVisible(), true);
  for (const width of [360, 390, 820, 1024, 1440]) {
    await page.setViewportSize({width, height: 900});
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `No horizontal overflow at ${width}px`);
  }
});

test('spread collar retains the photographed tie knot below the neck opening', async t => {
  const page = await studio(t);
  await page.waitForFunction(() => studioModelCaptures.has('front'));
  const comparison = await page.evaluate(() => {
    const capture = studioModelCaptures.get('front'), display = prepareTryOnDisplay(capture);
    const options = {...design, shirtColor: 4, shirtTie: 1, shirtCollar: 0};
    const classic = studioShirtOverlay(display, capture, options).getContext('2d').getImageData(0, 0, display.width, display.height).data;
    options.shirtCollar = 1;
    const spread = studioShirtOverlay(display, capture, options).getContext('2d').getImageData(0, 0, display.width, display.height).data;
    const source = display.photoFrame.getContext('2d').getImageData(0, 0, display.width, display.height).data;
    let knotPixels = 0, difference = 0, redAboveNeck = 0;
    for (let y = 290; y < 350; y++) for (let x = 420; x < 467; x++) {
      const i = (Math.round(y * display.height / 1774) * display.width + Math.round(x * display.width / 887)) * 4;
      if (y >= 303 && source[i + 2] > source[i] + 3 && Math.max(...source.slice(i, i + 3)) < 145) {
        knotPixels++;
        for (let c = 0; c < 4; c++) difference = Math.max(difference, Math.abs(classic[i+c] - spread[i+c]));
      }
      if (y < 302 && spread[i] > spread[i+1] * 1.5 && spread[i] > spread[i+2] * 1.3 && spread[i+3]) redAboveNeck++;
    }
    return {knotPixels, difference, redAboveNeck};
  });
  assert.ok(comparison.knotPixels > 100);
  assert.equal(comparison.difference, 0, 'Collar changes preserve knot position, shape and texture');
  assert.equal(comparison.redAboveNeck, 0, 'Burgundy knot cannot rise into the neck');
});

test('named looks persist, compare differences and restore designs without changing bag measurements', async t => {
  const page = await studio(t);
  await page.locator('#outfit').selectOption('2');
  await addJacket(page);
  await page.locator('[data-measurement="chest"]').first().fill('101');
  await page.locator('a[href="#studio"]').first().click();
  await page.locator('#open-saved-looks').click();
  await page.locator('#look-name').fill('Wedding navy');
  await page.locator('#save-look-form button').click();
  assert.match(await page.locator('#saved-look-status').textContent(), /saved on this browser/);
  await page.getByRole('button', {name: 'Close saved looks', exact: true}).click();
  await page.locator('#outfit').selectOption('0');
  await page.locator('#open-saved-looks').click();
  assert.ok(await page.locator('.look-difference').count() > 0);
  assert.match(await page.locator('#look-comparison').textContent(), /Not included/);
  await page.reload();
  assert.equal(await page.locator('#saved-look-count').textContent(), '1');
  await page.locator('#open-saved-looks').click();
  await page.locator('[data-use-look="0"]').click();
  assert.equal(await page.locator('#outfit').inputValue(), '2');
  assert.equal(await page.evaluate(() => bag[0].passport.jacket.measurements.chest), 101);
  const persisted = await page.evaluate(() => JSON.parse(localStorage.getItem('form-atelier-looks-v1')));
  assert.equal(persisted[0].design.passport, undefined);
  assert.equal(Object.keys(persisted[0]).sort().join(','), 'design,name');
  await page.locator('#open-saved-looks').click();
  for (const name of ['Option two', 'Option three', 'Option four']) {
    await page.locator('#look-name').fill(name);
    await page.locator('#save-look-form button').click();
  }
  assert.equal(await page.locator('[data-use-look]').count(), 3);
  assert.match(await page.locator('#saved-look-status').textContent(), /Remove one/);
  await page.locator('[data-remove-look="0"]').click();
  assert.equal(await page.locator('#saved-look-count').textContent(), '2');
  await page.reload();
  assert.equal(await page.locator('#saved-look-count').textContent(), '2');
});

test('notebook handles damaged data, unsafe labels and storage denial honestly', async t => {
  const page = await studio(t);
  await page.evaluate(() => localStorage.setItem('form-atelier-looks-v1', '[null,{"name":"<img src=x onerror=alert(1)>","design":{"outfit":99,"fabric":-1}}]'));
  await page.reload();
  await page.locator('#open-saved-looks').click();
  assert.equal(await page.locator('.saved-look-copy img').count(), 0);
  assert.match(await page.locator('.saved-look-copy').nth(1).textContent(), /<img/);
  await page.locator('[data-use-look="0"]').click();
  assert.equal(await page.locator('#outfit').inputValue(), '0');
  await page.locator('#open-saved-looks').click();
  await page.evaluate(() => { Storage.prototype.setItem = () => { throw new DOMException('Full', 'QuotaExceededError'); }; });
  await page.locator('#look-name').fill('Cannot persist');
  await page.locator('#save-look-form button').click();
  assert.match(await page.locator('#saved-look-status').textContent(), /could not save/);
  assert.equal(await page.locator('#saved-look-count').textContent(), '1');
});

test('design review shows real price components, effective choices and links back to editing', async t => {
  const page = await studio(t);
  await page.locator('#open-studio-looks').click();
  await page.getByRole('button', {name: 'Apply Studio Navy', exact: true}).click();
  await page.locator('#open-design-details').click();
  assert.match(await page.locator('.design-pricing').textContent(), /Base two-piece suit.*\$565.*Cloth upgrade.*Included.*Configuration total.*\$565/s);
  assert.equal(await page.locator('[data-edit-design="trousers"]').count(), 1);
  assert.equal(await page.locator('[data-edit-design="waistcoat"]').count(), 0);
  assert.match(await page.locator('#design-details-content').textContent(), /not included in your suit order/);
  await page.locator('[data-edit-design="trousers"]').click();
  assert.equal(await page.locator('#design-details-dialog').isVisible(), false);
  assert.equal(await page.locator('[data-piece="trousers"]').getAttribute('aria-pressed'), 'true');
  await page.setViewportSize({width: 390, height: 844});
  await page.locator('#open-design-details').click();
  assert.ok(await page.locator('#design-details-dialog').evaluate(el => el.scrollWidth <= el.clientWidth));
  await page.getByRole('button', {name: 'Close design details', exact: true}).click();
  await page.locator('#open-saved-looks').click();
  await page.locator('#look-name').fill('Mobile look');
  await page.locator('#save-look-form button').click();
  assert.ok(await page.locator('#saved-looks-dialog').evaluate(el => el.scrollWidth <= el.clientWidth));
  const layout = await page.evaluate(() => {
    const form = document.getElementById('save-look-form').getBoundingClientRect();
    const card = document.querySelector('.saved-look-card').getBoundingClientRect();
    return {formBottom: form.bottom, cardTop: card.top, cardWidth: card.width};
  });
  assert.ok(layout.cardTop >= layout.formBottom, 'The save form must sit above the comparison cards');
  assert.ok(layout.cardWidth > 300, 'Mobile look cards must use the available panel width');
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
});

test('fabric season shortcuts stay in sync with facets and clearing filters', async t => {
  const page = await studio(t);
  await page.locator('[data-season="warm"]').click();
  assert.equal(await page.locator('#fabric-season').inputValue(), 'warm');
  assert.equal(await page.locator('[data-season="warm"]').getAttribute('aria-pressed'), 'true');
  const warm = await page.locator('[data-fabric]').evaluateAll(buttons => buttons.map(button => Number(button.dataset.fabric)));
  assert.ok(warm.length > 0);
  assert.equal(await page.evaluate(indices => indices.every(index => fabricTraits(fabrics[index]).season === 'warm'), warm), true);
  await page.locator('.fabric-filters summary').click();
  await page.locator('#fabric-season').selectOption('cool');
  assert.equal(await page.locator('[data-season="cool"]').getAttribute('aria-pressed'), 'true');
  await page.locator('#clear-fabric-filters').click();
  assert.equal(await page.locator('[data-season="all"]').getAttribute('aria-pressed'), 'true');
});

test('white collar variants blend into the photographed shirt without a horizontal bib edge', async t => {
  const page = await studio(t);
  await page.waitForFunction(() => studioModelCaptures.has('front'));
  const seams = await page.evaluate(() => {
    const capture = studioModelCaptures.get('front'), display = prepareTryOnDisplay(capture);
    const options = {...design, shirtColor: 0, shirtTie: 1, shirtCollar: 0};
    const composite = config => {
      const c = makeCanvas(display.width, display.height), ctx = c.getContext('2d');
      ctx.drawImage(display.photoFrame, 0, 0);
      ctx.globalCompositeOperation = 'source-atop';
      ctx.drawImage(studioShirtOverlay(display, capture, config), 0, 0);
      return ctx.getImageData(0, 0, c.width, c.height).data;
    };
    const classic = composite(options);
    return [1, 2].map(collar => {
      options.shirtCollar = collar;
      const variant = composite(options);
      const differenceAt = y => {
        let difference = 0, count = 0;
        for (let x = 370; x < 516; x++) {
          if (x > 410 && x < 476) continue; // Exclude the tie/placket.
          const i = (Math.round(y * display.height / 1774) * display.width + Math.round(x * display.width / 887)) * 4;
          for (let c = 0; c < 3; c++) { difference += variant[i+c] - classic[i+c]; count++; }
        }
        return difference / count;
      };
      return {collar, seam: Math.abs(differenceAt(348) - differenceAt(353))};
    });
  });
  for (const result of seams) assert.ok(result.seam < 8, `Collar ${result.collar} must not create a flat bib edge (difference ${result.seam})`);
});
