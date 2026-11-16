const http=require('node:http'),fs=require('node:fs/promises'),path=require('node:path');
const {chromium}=require('playwright');
// Optional visual matrix: set STUDIO_SCREENSHOT_DIR, then run node tests/visual-suit.cjs.
const root=path.resolve(__dirname,'..');
(async()=>{
 const server=http.createServer(async(req,res)=>{
  const name=new URL(req.url,'http://localhost').pathname;
  const file=path.join(root,name==='/'?'index.html':name);
  try{const body=await fs.readFile(file);res.writeHead(200,{'Content-Type':{'.html':'text/html','.js':'text/javascript','.css':'text/css','.jpg':'image/jpeg'}[path.extname(file)]||'application/octet-stream'}).end(body);}catch{res.writeHead(404).end()}
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const origin='http://127.0.0.1:'+server.address().port;
 const owned=await chromium.launchServer({channel:process.env.BROWSER_CHANNEL||'msedge',executablePath:process.env.BROWSER_EXECUTABLE_PATH||undefined,headless:true});
 try{
  const browser=await chromium.connect(owned.wsEndpoint());
  const page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());
  await page.goto(origin);await page.locator('#outfit option').first().waitFor({state:'attached'});
  const out=path.resolve(process.env.STUDIO_SCREENSHOT_DIR||require('node:os').tmpdir()+'/form-atelier-suit-qa');
  await fs.mkdir(out,{recursive:true});
  const capture=async name=>{
   await page.locator('#fabric-model').waitFor({state:'visible'});
   await page.waitForFunction(()=>{
    const view={jacket:outfits[design.outfit].name.toLowerCase(),waistcoat:'waistcoat and trousers',shirt:'shirt and trousers'}[studioModelView()];
    return get('fabric-model').getAttribute('aria-label')?.startsWith(`${fabrics[design.fabric].name} ${view} on the studio model, ${angle} view`);
   });
   await fs.writeFile(out+'/'+name+'.png',Buffer.from(await page.locator('#fabric-model').evaluate(c=>c.toDataURL().split(',')[1]),'base64'));
  };
  const fabricName=process.env.STUDIO_QA_FABRIC||'Blue Rough Linen';
  const index=await page.evaluate(name=>fabrics.findIndex(f=>f.name===name),fabricName);
  if(index<0)throw new Error('Unknown QA fabric: '+fabricName);
  await page.locator('#fabric-search').fill(fabricName);
  await page.locator('[data-fabric="'+index+'"]').click();
  await page.waitForFunction(()=>!fabrics[design.fabric].scan||photoCloth(design.fabric));
  for(const outfit of ['0','1','2']){
   await page.locator('#outfit').selectOption(outfit);
   for(const view of ['front','inside','back']){
    await page.locator('[data-view="'+view+'"]').click();
    await capture('outfit-'+outfit+'-'+view);
   }
  }
  await page.locator('[data-view="front"]').click();
  await page.locator('#toggle-jacket').click();
  await capture('waistcoat-front');
  await page.locator('[data-view="back"]').click();
  await capture('waistcoat-back');
  await page.locator('[data-piece="shirt"]').click();
  for(const color of [0,4])for(const collar of [0,1,2]){
   await page.evaluate(({color,collar})=>{design.shirtColor=color;design.shirtCollar=collar;design.shirtTie=1;renderDesign();},{color,collar});
   await capture('shirt-'+color+'-'+collar);
  }
  await page.locator('#shirt-preview-toggle').click();
  await capture('shirt-with-jacket');
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:out+'/mobile.png',fullPage:true});
  console.log(JSON.stringify({output:out,captures:18,mobileScreenshot:true,errors}));
  if(errors.length)throw new Error(errors.join('; '));

 }finally{await owned.kill();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
})().catch(e=>{console.error(e);process.exitCode=1});
