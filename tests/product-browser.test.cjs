'use strict';

// Run with: node --test tests/product-browser.test.cjs (requires Playwright and Edge).
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

test('autofilled passport fields survive unit switches without precision drift', async t => {
  const page = await studio(t);
  await addJacket(page);
  const chest = page.locator('[data-measurement="chest"]').first();
  await chest.evaluate(input => { input.value = '100'; });
  await page.locator('[data-size-label]').first().evaluate(input => { input.value = 'EU 50'; });
  await page.locator('#passport-unit').selectOption('in');
  assert.equal(await chest.inputValue(), '39.37');
  assert.equal(await page.locator('[data-size-label]').first().inputValue(), 'EU 50');
  await page.locator('#passport-unit').selectOption('cm');
  await chest.fill('100.1234');
  for (let i = 0; i < 3; i++) {
    await page.locator('#passport-unit').selectOption('in');
    assert.equal(await chest.inputValue(), '39.42');
    await page.locator('#passport-unit').selectOption('cm');
    assert.equal(await chest.inputValue(), '100.12');
  }
  assert.equal(await page.evaluate(() => bag[0].passport.jacket.measurements.chest), 100.1234);
  await page.reload();
  assert.equal(await chest.inputValue(), '100.12');
  assert.equal(await page.locator('[data-size-label]').first().inputValue(), 'EU 50');
});

test('invalid passport values remain editable when switching units is rejected', async t => {
  const page = await studio(t);
  await addJacket(page);
  await page.locator('[data-measurement="chest"]').first().fill('501');
  await page.locator('#passport-unit').selectOption('in');
  assert.equal(await page.locator('#passport-unit').inputValue(), 'cm');
  assert.equal(await page.locator('[data-measurement="chest"]').first().inputValue(), '501');
});

test('editing a saved bag line restores garments and default framing', async t => {
  const page = await studio(t);
  await page.locator('#outfit').selectOption('2');
  await page.locator('#toggle-jacket').click();
  await page.locator('#toggle-waistcoat').click();
  await page.locator('#zoom').click();
  await page.locator('#add').click();
  await page.locator('[data-edit="0"]').click();
  assert.equal(await page.locator('#toggle-jacket').textContent(), 'Hide jacket');
  assert.equal(await page.locator('#zoom').getAttribute('aria-pressed'), 'false');
  assert.equal(await page.evaluate(() => jacketHidden || waistcoatHidden), false);
  await page.locator('#add').click();
  assert.equal(await page.locator('.cart-line').count(), 1, 'Editing updates the item rather than adding another');
});

test('Save Design persists current construction and reports blocked storage honestly', async t => {
  const page = await studio(t);
  await page.locator('#outfit').selectOption('2');
  await page.locator('#save-design').click();
  assert.match(await page.locator('#studio-action-message').textContent(), /saved on this device/);
  await page.reload();
  assert.equal(await page.locator('#outfit').inputValue(), '2');
  await page.evaluate(() => { Storage.prototype.setItem = () => { throw new DOMException('Full', 'QuotaExceededError'); }; });
  await page.locator('#save-design').click();
  assert.match(await page.locator('#studio-action-message').textContent(), /could not save/);
});

test('a saved mobile passport completes demo checkout and its export survives refresh', async t => {
  const page = await studio(t);
  await page.setViewportSize({width:390,height:844});
  await addJacket(page);
  for (const input of await page.locator('[data-measurement]').all()) await input.fill('80');
  for (const name of ['shoulders','chest','posture']) await page.locator(`[name="${name}"]`).first().check();
  await page.locator('#fit-form [type="submit"]').click();
  await page.waitForURL('**/#checkout');
  for (const [name,value] of Object.entries({first:'Demo',last:'Customer',email:'demo@example.invalid',address:'1 Test Street',city:'Test City',postal:'12345',country:'Pakistan'})) await page.locator(`#checkout-form [name="${name}"]`).fill(value);
  await page.locator('#checkout-form [type="submit"]').click();
  await page.waitForURL('**/#complete');
  await page.reload();
  await page.locator('#download').waitFor({state:'visible'});
  assert.equal(await page.locator('#bag-count').textContent(), '0');
  const download = page.waitForEvent('download');
  await page.locator('#download').click();
  const downloaded = await download;
  const exportedFile = path.join(require('node:os').tmpdir(), `suitcraft-demo-order-${Date.now()}.json`);
  t.after(() => fs.unlink(exportedFile).catch(() => {}));
  await downloaded.saveAs(exportedFile);
  const order = JSON.parse(await fs.readFile(exportedFile, 'utf8'));
  assert.equal(order.items[0].pieces[0].measurements['Chest circumference'], 80);
  assert.equal(order.shipping.email, 'demo@example.invalid');
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
});

test('passport autofill survives navigation and reload before submitting', async t => {
  const page = await studio(t);
  await addJacket(page);
  const chest = page.locator('[data-measurement="chest"]').first();
  await chest.evaluate(input => { input.value = '103.5'; });
  await page.locator('#fit a[href="#cart"]').click();
  await page.locator('#to-fit').click();
  await chest.waitFor({state:'visible'});
  assert.equal(await chest.inputValue(), '103.5');
  await chest.evaluate(input => { input.value = '104.75'; });
  await page.reload();
  assert.equal(await chest.inputValue(), '104.75');
});

test('changing the silhouette keeps the dressed model visible for comparing fit', async t=>{
  const page=await studio(t);
  await page.locator('#advanced-jacket-options summary').first().click();
  await page.locator('#style-jump').selectOption('silhouette');
  const price=await page.locator('#price').textContent();
  await page.locator('[data-style="silhouette"][data-choice="2"]').click();
  assert.equal(await page.locator('[data-style="silhouette"][data-choice="2"]').getAttribute('aria-pressed'),'true');
  assert.equal(await page.locator('#look-detail').isVisible(),false);
  assert.equal(await page.locator('#fabric-model').isVisible(),true);
  assert.equal(await page.locator('#price').textContent(),price);
  assert.equal(await page.evaluate(()=>lookDetail),'');
});

test('mobile fabric and construction panels use readable full-width controls', async t=>{
  const page=await studio(t);await page.setViewportSize({width:390,height:844});
  for(const selector of ['.cloth','.tailoring'])assert.ok(await page.locator(selector).evaluate(el=>el.getBoundingClientRect().width)>300,'Do not squeeze mobile controls into narrow sidebars');
  const widths=await page.locator('.studio-quick-option').evaluateAll(buttons=>buttons.map(button=>button.getBoundingClientRect().width));
  assert.ok(widths.every(width=>width>75),'Quick option labels need readable widths');
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  if(process.env.STUDIO_SCREENSHOT_DIR){await fs.mkdir(process.env.STUDIO_SCREENSHOT_DIR,{recursive:true});await page.screenshot({path:path.join(process.env.STUDIO_SCREENSHOT_DIR,'mobile-product.png'),fullPage:true});}
});

test('the Single quick preset selects and reflects the two-button jacket configuration', async t=>{
  const page=await studio(t);
  const quick=page.locator('#studio-quick-options [data-style="closure"][data-choice="1"]');
  await quick.click();
  assert.equal(await quick.getAttribute('aria-pressed'),'true');
  assert.equal(await page.locator('#choice-closure').textContent(),'Single two');
  assert.equal(await page.locator('#style-groups [data-style="closure"][data-choice="1"]').getAttribute('aria-pressed'),'true');
});
