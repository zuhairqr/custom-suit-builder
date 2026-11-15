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
