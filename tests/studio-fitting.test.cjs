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

async function dressedView(page, outfit, angle = 'front', silhouette = 0) {
  await page.evaluate(({outfit, angle: view, silhouette}) => {
    design.outfit = outfit; design.silhouette = silhouette;
    angle = view; piece = 'jacket'; lookDetail = ''; jacketHidden = false; waistcoatHidden = false;
    syncPieceControls(); renderDesign();
  }, {outfit, angle, silhouette});
  await page.waitForFunction(() => get('fabric-model').getAttribute('aria-label')?.startsWith(
    `${fabrics[design.fabric].name} ${outfits[design.outfit].name.toLowerCase()} on the studio model, ${angle} view`));
}

test('studio jackets cover the seat consistently without transparent gaps across outfits and angles', async t => {
  const page = await studio(t);
  for (const outfit of [0, 1, 2]) for (const angle of ['front', 'inside', 'back']) {
    await dressedView(page, outfit, angle);
    const fit = await page.evaluate(() => {
      const layer = tryOnLayer('studio-outerwear'), pixels = layer.getContext('2d').getImageData(0, 0, layer.width, layer.height).data;
      const display = prepareTryOnDisplay(studioModelCaptures.get(studioModelDirection(angle))), body = studioModelBody(display);
      let bottom = 0, gaps = 0;
      for (let y = 0; y < layer.height; y++) for (const offset of [-.32, .32]) {
        const x = Math.round(body.hipCenter[0] + body.span * offset);
        if (pixels[(y * layer.width + x) * 4 + 3] > 200) bottom = y;
      }
      const c = get('fabric-model'), final = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
      for (let y = Math.ceil(body.hipCenter[1] + body.torsoLength * .05); y < Math.min(...body.wrists.map(p => p[1])); y++) {
        for (let x = Math.ceil(body.hipCenter[0] - body.span * .36); x < body.hipCenter[0] + body.span * .36; x++) if (final[(y * c.width + x) * 4 + 3] < 240) gaps++;
      }
      return {coverage: (bottom - body.hipCenter[1]) / (pointBetween(...body.knees, .5)[1] - body.hipCenter[1]), gaps};
    });
    assert.ok(fit.coverage > .32 && fit.coverage < .55, `${outfit}/${angle}: balanced seat coverage (${fit.coverage})`);
    assert.equal(fit.gaps, 0, `${outfit}/${angle}: trouser underlay fills open quarters`);
  }
});

test('three-piece front keeps a closed jacket silhouette and each cut changes the waist', async t => {
  const page = await studio(t);
  const waist = async () => page.evaluate(() => {
    const c = tryOnLayer('studio-outerwear'), data = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    const body = studioModelBody(prepareTryOnDisplay(studioModelCaptures.get('front')));
    const y = Math.round(pointBetween(body.shoulderCenter, body.hipCenter, .72)[1]);
    // Measure the connected torso panel; the sleeves have their own fit and
    // must not determine the selected waist cut.
    let left = Math.round(body.hipCenter[0]), right = left, holes = 0;
    while (left > 0 && data[(y * c.width + left - 1) * 4 + 3] > 200) left--;
    while (right < c.width - 1 && data[(y * c.width + right + 1) * 4 + 3] > 200) right++;
    for (let x = Math.ceil(body.hipCenter[0] - body.span * .2); x < body.hipCenter[0] + body.span * .2; x++) if (data[(y * c.width + x) * 4 + 3] < 240) holes++;
    return {width: right - left, holes};
  });
  await dressedView(page, 1); const two = await waist();
  await dressedView(page, 2); const three = await waist();
  assert.equal(three.width, two.width, 'Waistcoat cannot spread the closed coat');
  assert.equal(three.holes, 0, 'Waistcoat must stay behind the jacket front');
  const widths = [];
  for (const silhouette of [2, 0, 1]) { await dressedView(page, 2, 'front', silhouette); widths.push((await waist()).width); }
  assert.ok(widths[0] < widths[1] && widths[1] < widths[2], `Slim, tailored, relaxed widths: ${widths}`);
});

test('photographic fitting keeps the neck intact and responsive screens fit their viewport', async t => {
  const page = await studio(t);
  await dressedView(page, 1);
  const difference = await page.evaluate(() => {
    const c = get('fabric-model'), current = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    const original = prepareTryOnDisplay(studioModelCaptures.get('front')).photoFrame.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    let max = 0;
    for (let sy = 235; sy < 265; sy++) for (let sx = 395; sx < 495; sx++) {
      const i = (Math.round(sy * c.height / 1774) * c.width + Math.round(sx * c.width / 887)) * 4;
      for (let channel = 0; channel < 4; channel++) max = Math.max(max, Math.abs(current[i + channel] - original[i + channel]));
    }
    return max;
  });
  assert.ok(difference <= 1, 'Neck and chin remain unchanged');
  for (const width of [1440, 1024, 820, 390, 360]) {
    await page.setViewportSize({width, height: 900});
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Screen fits ${width}px`);
    assert.equal(await page.locator('#fabric-model').isVisible(), true);
    const framing = await page.evaluate(() => ({stage: document.querySelector('.model-stage').getBoundingClientRect().bottom, faces: document.getElementById('studio-faces').getBoundingClientRect().top}));
    assert.ok(framing.faces >= framing.stage, 'Face controls must not cover the trouser hems or shoes');
  }
});
