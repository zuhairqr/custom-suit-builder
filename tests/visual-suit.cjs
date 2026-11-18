'use strict';
const http = require('node:http'), fs = require('node:fs/promises'), path = require('node:path');
const {chromium} = require('playwright');
const root = path.resolve(__dirname, '..');
const output = path.resolve(process.env.STUDIO_SCREENSHOT_DIR || path.join(require('node:os').tmpdir(), 'suitcraft-visual-qa'));
const fabricName = process.env.STUDIO_QA_FABRIC || 'Blue Rough Linen';
(async () => {
  await fs.mkdir(output, {recursive:true});
  const server = http.createServer(async (request, response) => {
    const name = new URL(request.url, 'http://localhost').pathname;
    const file = path.resolve(root, '.' + (name === '/' ? '/index.html' : decodeURIComponent(name)));
    if (!file.startsWith(root + path.sep)) return response.writeHead(403).end();
    try {
      const data = await fs.readFile(file);
      response.writeHead(200, {'Content-Type':{'.html':'text/html','.js':'text/javascript','.css':'text/css','.jpg':'image/jpeg'}[path.extname(file)] || 'application/octet-stream'}).end(data);
    } catch { response.writeHead(404).end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let owned;
  try {
    const origin = `http://127.0.0.1:${server.address().port}`;
    owned = await chromium.launchServer({channel:process.env.BROWSER_CHANNEL || 'msedge', executablePath:process.env.BROWSER_EXECUTABLE_PATH || undefined, headless:true});
    const browser = await chromium.connect(owned.wsEndpoint());
    const page = await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
    const errors = [], cases = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
    await page.goto(origin);
    await page.locator('#outfit option').first().waitFor({state:'attached'});
    const fabric = await page.evaluate(name => fabrics.findIndex(entry => entry.name === name), fabricName);
    if (fabric < 0) throw new Error('Unknown fabric: ' + fabricName);
    await page.locator('#fabric-search').fill(fabricName);
    await page.locator(`[data-fabric="${fabric}"]`).click();
    await page.waitForFunction(() => !fabrics[design.fabric].scan || photoCloth(design.fabric));
    for (const outfit of [0,1,2]) for (const view of ['front','inside','back']) cases.push({name:`outfit-${outfit}-${view}`,outfit,view,closure:1,lapel:2});
    for (const closure of [1,4]) for (const lapel of [0,2,4]) cases.push({name:`lapel-${lapel}-closure-${closure}`,outfit:1,view:'front',closure,lapel});
    for (const silhouette of [0,1,2]) cases.push({name:`cut-${silhouette}`,outfit:1,view:'front',silhouette,closure:1,lapel:2});
    for (const outfit of [1,2]) for (const trouserFit of [0,1,2,3]) cases.push({name:`trouser-${outfit}-${trouserFit}`,outfit,view:'front',trouserFit,closure:1,lapel:2});
    for (const view of ['front','back']) cases.push({name:`waistcoat-${view}`,outfit:2,view,vest:true,closure:1,lapel:2});
    for (const entry of cases) {
      await page.evaluate(entry => {
        Object.assign(design,{outfit:entry.outfit,silhouette:entry.silhouette || 0,trouserFit:entry.trouserFit || 0,lapel:entry.lapel,closure:entry.closure});
        modelPreference='studio'; angle=entry.view; piece=entry.vest?'waistcoat':'jacket';
        lookDetail=''; jacketHidden=Boolean(entry.vest); waistcoatHidden=false; zoomed=false;
        syncPieceControls(); renderDesign();
      },entry);
      await page.waitForFunction(() => {
        const view={jacket:outfits[design.outfit].name.toLowerCase(),waistcoat:'waistcoat and trousers'}[studioModelView()];
        return previewAssets().every(key=>studioPhotos.has(key)) && get('fabric-model').getAttribute('aria-label')?.startsWith(`${fabrics[design.fabric].name} ${view} on the studio model, ${angle} view`);
      });
      await page.evaluate(()=>renderPreview());
      const images=await page.locator('#fabric-model').evaluate(source=>{
        const c=document.createElement('canvas');c.width=source.width;c.height=source.height;
        const ctx=c.getContext('2d');ctx.fillStyle='#edf0ed';ctx.fillRect(0,0,c.width,c.height);ctx.drawImage(source,0,0);
        return {native:source.toDataURL().split(',')[1],neutral:c.toDataURL().split(',')[1]};
      });
      for (const [kind,data] of Object.entries(images)) await fs.writeFile(path.join(output,`${entry.name}-${kind}.png`),Buffer.from(data,'base64'));
    }
    await page.locator('#outfit').selectOption('1');await page.locator('[data-piece="jacket"]').click();await page.locator('[data-view="front"]').click();
    await page.screenshot({path:path.join(output,'desktop.png'),fullPage:true});
    await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.join(output,'mobile.png'),fullPage:true});
    await fs.writeFile(path.join(output,'manifest.json'),JSON.stringify({fabric:fabricName,cases,errors},null,2));
    if(errors.length)throw new Error(errors.join('; '));
    console.log(JSON.stringify({output,fabric:fabricName,cases:cases.length,errors}));
  } finally { await owned?.kill();server.closeAllConnections();await new Promise(resolve=>server.close(resolve)); }
})().catch(error=>{console.error(error);process.exitCode=1});
