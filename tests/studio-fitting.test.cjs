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

test('the light suit recolors opaque dark folds without filling real between-leg background', async t => {
  const page = await studio(t);
  await page.locator('#fabric-search').fill('Blue Rough Linen');
  await page.locator('[data-fabric]').first().click();
  await page.waitForFunction(() => photoCloth(design.fabric));
  await page.evaluate(() => { design.closure=1;design.lapel=2; });
  await dressedView(page,1);
  const patches=await page.locator('#fabric-model').evaluate(canvas=>{
    const ctx=canvas.getContext('2d');
    const sample=([x,y])=>Array.from(ctx.getImageData(Math.round(x*canvas.width/887),Math.round(y*canvas.height/1774),1,1).data);
    return {cloth:[[435,966],[438,975],[333,1644],[526,1645]].map(sample),gap:sample([443,1300])};
  });
  for(const rgba of patches.cloth) {
    assert.ok(rgba[3]>=252, `Actual fabric must remain opaque (${rgba})`);
    assert.ok(rgba[0]>=35 && rgba[2]-rgba[0]>=12, `Deep folds must inherit the selected light-blue cloth (${rgba})`);
  }
  assert.equal(patches.gap[3],0,'The anatomical space between legs remains transparent');
});

test('studio cutouts have no low-alpha chroma specks while keeping antialiased edges', async t=>{
  const page=await studio(t);await dressedView(page,1);
  const matte=await page.evaluate(()=>{
    const c=studioModelCaptures.get('front').photo,d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;
    let stray=0,edges=0,opaque=0;
    for(let i=3;i<d.length;i+=4){if(d[i]>0&&d[i]<12)stray++;else if(d[i]>0&&d[i]<255)edges++;else if(d[i]===255)opaque++;}
    return {stray,edges,opaque};
  });
  assert.equal(matte.stray,0,'Remove nearly invisible source spill before resampling can amplify it');
  assert.ok(matte.edges>100,'Keep a soft antialiased silhouette instead of a hard cutout');
  assert.ok(matte.opaque>100000,'Preserve the original model and cloth interiors');
});

test('every two-piece and three-piece trouser cut stays centered over the photographed ankles', async t=>{
  const page=await studio(t);await dressedView(page,1);
  const shifts=await page.evaluate(()=>{
    const display=prepareTryOnDisplay(studioModelCaptures.get('front'));
    const anchors=bodyPoints.ankles.map(index=>display.point(index)[0]);
    const source=makeCanvas(display.width,display.height),ctx=source.getContext('2d');
    ctx.fillStyle='#89abc9';
    for(const center of anchors)ctx.fillRect(center-20,display.height*.5,40,display.height*.43);
    const results=[];
    for(const outfit of [1,2])for(const trouserFit of [0,1,2,3]){
      const output=makeCanvas(display.width,display.height),target=output.getContext('2d');
      drawStudioTrouserFit(target,source,display,{...design,outfit,trouserFit});
      const y=Math.floor(display.height*.91),row=target.getImageData(0,y,display.width,1).data;
      for(const [leg,center] of anchors.entries()){
        let left=display.width,right=0;
        for(let x=Math.floor(center-45);x<=center+45;x++)if(row[x*4+3]>128){left=Math.min(left,x);right=Math.max(right,x);}
        results.push({outfit,trouserFit,leg,shift:Math.abs((left+right+1)/2-center)});
      }
    }
    return results;
  });
  for(const result of shifts)assert.ok(result.shift<1.6,`Trouser hem must stay over its shoe: ${JSON.stringify(result)}`);
});
