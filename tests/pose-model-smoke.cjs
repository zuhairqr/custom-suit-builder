const http=require('node:http'),fs=require('node:fs/promises'),path=require('node:path');
const {chromium}=require('playwright');
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
  await page.route('**/*',r=>{const u=new URL(r.request().url());return u.origin===origin||u.hostname==='cdn.jsdelivr.net'||u.hostname==='storage.googleapis.com'?r.continue():r.abort();});
  await page.goto(origin);await page.locator('#outfit option').first().waitFor({state:'attached'});
  await page.waitForFunction(()=>studioModelCaptures.has('front'));
  const result=await page.evaluate(async()=>{
   const work=async()=>{
    const capture=studioModelCaptures.get('front');
    const source=capture.photo,c=makeCanvas(320,640),ctx=c.getContext('2d');
    ctx.fillStyle='#edf0ed';ctx.fillRect(0,0,c.width,c.height);ctx.drawImage(source,32,48,256,512);
    const poses=await detectBodyPose(c);const fit=bodyFraming(poses,c.width/c.height,false);
    return {detectedPeople:poses.length,validation:fit.message||'passed',quality:fit.pose?bodyImageQuality(c,fit.pose):'not checked'};
   };
   return Promise.race([work(),new Promise((_,reject)=>setTimeout(()=>reject(new Error('Pose model timed out after 60 seconds')),60000))]);
  });
  if(errors.length)throw new Error(errors.join('; '));
  if(result.detectedPeople!==1||result.validation!=='passed'||result.quality)throw new Error(JSON.stringify(result));
  console.log(JSON.stringify(result));
 }finally{await owned.kill();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
})().catch(e=>{console.error(e);process.exitCode=1});
