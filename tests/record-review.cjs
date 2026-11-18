'use strict';
const fs=require('node:fs/promises'),path=require('node:path'),http=require('node:http');
const {execFileSync}=require('node:child_process');
const {chromium}=require('playwright');
// Records the actual local browser UI. No desktop, webcam or microphone is captured.
const root=path.resolve(__dirname,'..');
const mode=process.env.STUDIO_RECORD_MODE||'after';
const reference=process.env.STUDIO_REVIEW_BASE_REF||'HEAD';
const output=path.resolve(process.env.STUDIO_RECORD_DIR||path.join(require('node:os').tmpdir(),'suitcraft-recorded-review',mode));
(async()=>{
 await fs.mkdir(output,{recursive:true});
 const baseline=new Map();
 if(mode==='before')for(const name of ['body-try-on.js','studio-model.js','garment-details.js','fabric-renderer.js'])baseline.set(name,execFileSync('git',['show',reference+':'+name],{cwd:root}));
 const server=http.createServer(async(req,res)=>{
  const name=new URL(req.url,'http://localhost').pathname;const rel=name==='/'?'index.html':name.slice(1);const file=path.resolve(root,rel);
  if(!file.startsWith(root+path.sep))return res.writeHead(403).end();
  try{const data=baseline.get(rel)||await fs.readFile(file);res.writeHead(200,{'Content-Type':{'.html':'text/html','.js':'text/javascript','.css':'text/css'}[path.extname(file)]||'application/octet-stream'}).end(data);}catch{res.writeHead(404).end();}
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
 const owned=await chromium.launchServer({channel:process.env.BROWSER_CHANNEL||'msedge',executablePath:process.env.BROWSER_EXECUTABLE_PATH||undefined,headless:true});
 try{
  const browser=await chromium.connect(owned.wsEndpoint());const context=await browser.newContext({viewport:{width:1440,height:1000},recordVideo:{dir:output,size:{width:1440,height:1000}},reducedMotion:'reduce'});
  const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());
  await page.goto(origin);await page.locator('#outfit option').first().waitFor({state:'attached'});
  await page.locator('#fabric-search').fill('Blue Rough Linen');await page.locator('[data-fabric]').first().click();await page.waitForFunction(()=>photoCloth(design.fabric));
  await page.locator('#outfit').selectOption('1');
  await page.locator('#studio-quick-options [data-style="closure"][data-choice="1"]').click();
  await page.locator('#close-look-detail').click();
  await page.locator('#fabric-model').waitFor({state:'visible'});
  await page.waitForTimeout(1500);
  await fs.writeFile(output+'/native.png',Buffer.from(await page.locator('#fabric-model').evaluate(c=>c.toDataURL().split(',')[1]),'base64'));
  await page.screenshot({path:output+'/screen.png',fullPage:true});
  if(!process.env.STUDIO_CAPTURE_ONLY){
  await page.locator('#zoom').click();await page.waitForTimeout(1600);
  for(const view of ['back','inside','front']){await page.locator('[data-view="'+view+'"]').click();await page.waitForFunction(()=>get('fabric-model').getAttribute('aria-label')?.includes(angle+' view'));await page.waitForTimeout(1400);}
  await page.locator('#zoom').click();await page.waitForTimeout(1400);
  }
  const video=page.video();await context.close();await video.saveAs(output+'/suitcraft-'+mode+'.webm');
  await fs.writeFile(output+'/manifest.json',JSON.stringify({mode,reference:mode==='before'?reference:'working tree',errors},null,2));
  if(errors.length)throw new Error(errors.join('; '));console.log(JSON.stringify({mode,video:output+'/suitcraft-'+mode+'.webm',errors}));
 }finally{await owned.kill();server.closeAllConnections();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1});
