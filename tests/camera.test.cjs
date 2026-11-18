'use strict';

// Run with: node --test tests/camera.test.cjs (requires Playwright and Edge).
const {test, before, after} = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const {chromium} = require('playwright');
const root = path.resolve(__dirname, '..');
let server, browser, browserServer, origin;

before(async () => {
  if (process.env.STUDIO_SCREENSHOT_DIR) await fs.mkdir(process.env.STUDIO_SCREENSHOT_DIR, {recursive: true});
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
  browserServer = await chromium.launchServer({channel: process.env.BROWSER_CHANNEL || 'msedge', executablePath: process.env.BROWSER_EXECUTABLE_PATH || undefined, headless: true, args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream']});
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
  const context = await browser.newContext({permissions: ['camera']});
  t.after(() => context.close());
  // Tests exercise local assets only; no camera, external models or services.
  await context.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
  if (saved !== undefined) await context.addInitScript(value => localStorage.setItem('form-atelier-v1', value), JSON.stringify(saved));
  await context.addInitScript(() => {
    window.qaStreams = [];
    const original = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = async constraints => {
      const stream = await original(constraints);
      window.qaStreams.push(stream);
      return stream;
    };
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  t.after(() => assert.deepEqual(errors, [], 'No runtime errors'));
  await page.goto(origin);
  await page.locator('#outfit option').first().waitFor({state: 'attached'});
  return page;
}

const stopped = page => page.evaluate(() => window.qaStreams.every(stream => stream.getTracks().every(track => track.readyState === 'ended')));
const closeDialog = (page, id) => page.locator(`#${id} form[method="dialog"] button`).click();
async function faceCamera(page) {
  await page.locator('#open-face').click();
  await page.locator('#enable-camera').click();
  await page.waitForFunction(() => { const v = document.getElementById('face-video'); return v.videoWidth > 0 && !document.getElementById('capture-face').disabled; });
}
async function fixturePose(page) {
  await page.evaluate(() => {
    const pose = Array.from({length: 33}, () => ({x: .5, y: .17, visibility: .98}));
    for (const [a, b, x, other, y] of [[2,5,.476,.524,.139],[7,8,.46,.54,.165],[11,12,.34,.66,.254],[13,14,.29,.71,.412],[15,16,.28,.72,.56],[23,24,.4,.6,.52],[25,26,.4,.6,.724],[27,28,.39,.61,.895],[29,30,.389,.611,.914],[31,32,.375,.625,.934]]) {
      pose[a] = {x, y, visibility: .98}; pose[b] = {x: other, y, visibility: .98};
    }
    // UI integration uses fixture landmarks. Pose and quality algorithms have
    // separate tests; this does not claim a real person was detected.
    loadBodyPose = async () => ({});
    detectBodyPose = async () => [pose];
    bodyImageQuality = () => null;
  });
}

test('native synthetic face camera captures, applies and removes a local face, releasing tracks', async t => {
  const page = await studio(t);
  await faceCamera(page);
  assert.equal(await stopped(page), false);
  if (process.env.STUDIO_SCREENSHOT_DIR) await page.screenshot({path: path.join(process.env.STUDIO_SCREENSHOT_DIR, 'face-camera.png')});
  await page.locator('#capture-face').click();
  assert.equal(await stopped(page), true);
  assert.equal(await page.locator('#face-adjustments').isVisible(), true);
  await page.locator('#apply-face').click();
  assert.equal(await page.evaluate(() => Boolean(faceState.image)), true);
  assert.equal(await page.locator('#face-dialog').isVisible(), false);
  await page.locator('#open-face').click();
  await page.locator('#remove-face').click();
  assert.equal(await page.evaluate(() => faceState.image), null);
});

test('face camera stops on request, disconnect, background and modal close, then restarts', async t => {
  const page = await studio(t);
  await faceCamera(page);
  await page.locator('#stop-face-camera').click();
  assert.equal(await stopped(page), true);
  if (process.env.STUDIO_SCREENSHOT_DIR) await page.screenshot({path: path.join(process.env.STUDIO_SCREENSHOT_DIR, 'camera-stopped.png')});
  assert.equal(await page.locator('#enable-camera').isEnabled(), true);
  await page.locator('#enable-camera').click();
  await page.waitForFunction(() => !document.getElementById('capture-face').disabled);
  await page.evaluate(() => { const track = window.qaStreams.at(-1).getVideoTracks()[0]; track.stop(); track.dispatchEvent(new Event('ended')); });
  assert.match(await page.locator('#face-status').textContent(), /disconnected/);
  assert.equal(await page.locator('#enable-camera').isEnabled(), true);
  await page.locator('#enable-camera').click();
  await page.waitForFunction(() => !document.getElementById('capture-face').disabled);
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', {configurable:true, value:true}); document.dispatchEvent(new Event('visibilitychange')); });
  assert.equal(await stopped(page), true);
  assert.match(await page.locator('#face-status').textContent(), /background/);
  await page.evaluate(() => { delete document.hidden; });
  await page.locator('#enable-camera').click();
  await page.waitForFunction(() => !document.getElementById('capture-face').disabled);
  await closeDialog(page, 'face-dialog');
  await page.waitForFunction(() => document.getElementById('face-video').srcObject === null);
  assert.equal(await stopped(page), true);
});

test('both camera dialogs report denied, missing and busy devices and allow retry', async t => {
  const page = await studio(t);
  for (const [name, pattern] of [['NotAllowedError',/permission/],['NotFoundError',/No camera/],['NotReadableError',/busy/]]) {
    await page.evaluate(name => { navigator.mediaDevices.getUserMedia = async () => { throw new DOMException('Test failure', name); }; }, name);
    for (const [open, start, status, dialog] of [['open-face','enable-camera','face-status','face-dialog'],['open-body','body-start','body-status','body-dialog']]) {
      await page.locator('#'+open).click(); await page.locator('#'+start).click();
      await page.waitForFunction(id => !document.getElementById(id).disabled, start);
      assert.match(await page.locator('#'+status).textContent(), pattern);
      await closeDialog(page, dialog);
    }
  }
});

test('closing or stopping while camera permission is pending stops a late stream', async t => {
  const page = await studio(t);
  for (const mode of ['face','body']) {
    await page.evaluate(() => {
      const c = document.createElement('canvas'); c.width = c.height = 64;
      const stream = c.captureStream(); window.qaStreams.push(stream);
      navigator.mediaDevices.getUserMedia = () => new Promise(resolve => { window.grantLateCamera = () => resolve(stream); });
    });
    await page.locator(mode==='face'?'#open-face':'#open-body').click();
    await page.locator(mode==='face'?'#enable-camera':'#body-start').click();
    await page.locator(mode==='face'?'#stop-face-camera':'#body-stop').click();
    await page.evaluate(() => window.grantLateCamera());
    await page.waitForFunction(() => window.qaStreams.at(-1).getTracks().every(track => track.readyState === 'ended'));
    assert.equal(await page.locator(mode==='face'?'#camera-stage':'#body-stage').isVisible(), false);
    await closeDialog(page, mode+'-dialog');
  }
});

test('full-body camera with fixture pose captures, retakes, applies and removes the local preview', async t => {
  const page = await studio(t);
  await fixturePose(page);
  await page.locator('#open-body').click(); await page.locator('#body-start').click();
  await page.waitForFunction(() => document.getElementById('body-dialog').dataset.phase === 'detecting' || document.getElementById('body-dialog').dataset.phase === 'position-valid');
  await page.locator('#body-manual').click();
  await page.waitForFunction(() => document.getElementById('body-dialog').dataset.phase === 'ready');
  assert.equal(await stopped(page), true);
  if (process.env.STUDIO_SCREENSHOT_DIR) await page.screenshot({path: path.join(process.env.STUDIO_SCREENSHOT_DIR, 'body-camera-ready.png')});
  await page.locator('#body-retake').click();
  await page.waitForFunction(() => !document.getElementById('body-manual').disabled);
  await page.locator('#body-manual').click();
  await page.waitForFunction(() => document.getElementById('body-dialog').dataset.phase === 'ready');
  await page.locator('#body-apply').click();
  assert.equal(await page.evaluate(() => Boolean(tryOnSession.capture)), true);
  await page.locator('#open-body').click(); await page.locator('#body-remove').click();
  assert.equal(await page.evaluate(() => tryOnSession.capture), null);
  assert.equal(await stopped(page), true);
});

test('full-body camera stops when the detector fails and can be cancelled while it loads', async t => {
  const page = await studio(t);
  await page.evaluate(() => { loadBodyPose = async () => { throw new Error('Offline detector fixture'); }; });
  await page.locator('#open-body').click(); await page.locator('#body-start').click();
  await page.waitForFunction(() => document.getElementById('body-dialog').dataset.phase === 'idle');
  assert.match(await page.locator('#body-status').textContent(), /pose detector/);
  assert.equal(await stopped(page), true);
  await page.evaluate(() => { loadBodyPose = () => new Promise(resolve => { window.finishDetector = resolve; }); });
  await page.locator('#body-start').click();
  await page.waitForFunction(() => typeof window.finishDetector === 'function');
  await page.locator('#body-stop').click();
  assert.equal(await stopped(page), true);
  await page.evaluate(() => window.finishDetector({}));
  assert.equal(await page.locator('#body-dialog').getAttribute('data-phase'), 'idle');
});

test('corrupt and unsupported photo uploads show errors without leaving a camera active', async t => {
  const page = await studio(t);
  for (const mode of ['face','body']) {
    await page.locator('#open-'+mode).click();
    const file = page.locator('#'+mode+'-file');
    await file.setInputFiles({name:'invalid.txt',mimeType:'text/plain',buffer:Buffer.from('not an image')});
    assert.match(await page.locator('#'+mode+'-status').textContent(), /JPG, PNG, or WebP/);
    await file.setInputFiles({name:'corrupt.png',mimeType:'image/png',buffer:Buffer.from('not an image')});
    await page.waitForFunction(id => document.getElementById(id).textContent.includes('could not be opened'), mode+'-status');
    assert.equal(await stopped(page), true);
    await closeDialog(page,mode+'-dialog');
  }
});

test('valid face upload replaces a live camera and camera dialogs fit mobile screens', async t => {
  const page = await studio(t);
  await page.setViewportSize({width:390,height:844});
  await faceCamera(page);
  const png = await page.evaluate(() => { const c = document.createElement('canvas'); c.width=160;c.height=220;const ctx=c.getContext('2d');ctx.fillStyle='#4b6c82';ctx.fillRect(0,0,160,220);ctx.fillStyle='#eddbbf';ctx.beginPath();ctx.ellipse(80,90,45,65,0,0,Math.PI*2);ctx.fill();return c.toDataURL().split(',')[1]; });
  await page.locator('#face-file').setInputFiles({name:'synthetic-portrait.png',mimeType:'image/png',buffer:Buffer.from(png,'base64')});
  await page.waitForFunction(() => document.getElementById('face-status').textContent.includes('Move and zoom'));
  assert.equal(await stopped(page), true);
  assert.equal(await page.locator('#apply-face').isEnabled(), true);
  assert.ok(await page.locator('#face-dialog').evaluate(el => el.scrollWidth <= el.clientWidth));
  await page.locator('#apply-face').click();
  assert.equal(await page.evaluate(() => Boolean(faceState.image)), true);
  await page.locator('#open-face').click(); await page.locator('#remove-face').click();
  await page.locator('#open-body').click();
  assert.ok(await page.locator('#body-dialog').evaluate(el => el.scrollWidth <= el.clientWidth));
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
});

test('a failed old live pose inspection cannot cancel a newer manual capture validation', async t => {
  const page = await studio(t);
  await fixturePose(page);
  await page.evaluate(() => {
    const original = detectBodyPose;
    let call = 0;
    detectBodyPose = input => ++call === 1
      ? new Promise((_, reject) => { window.rejectOldInspection = reject; })
      : new Promise(resolve => { window.finishManualValidation = async () => resolve(await original(input)); });
  });
  await page.locator('#open-body').click();
  await page.locator('#body-start').click();
  await page.waitForFunction(() => typeof window.rejectOldInspection === 'function');
  await page.locator('#body-manual').click();
  await page.waitForFunction(() => typeof window.finishManualValidation === 'function');
  await page.evaluate(() => window.rejectOldInspection(new Error('Old inspection failed')));
  // The newer validation owns the UI and camera lifecycle now.
  assert.equal(await page.locator('#body-dialog').getAttribute('data-phase'), 'validating');
  await page.evaluate(() => window.finishManualValidation());
  await page.waitForFunction(() => document.getElementById('body-dialog').dataset.phase === 'ready');
  assert.equal(await stopped(page), true);
  assert.equal(await page.locator('#body-apply').isEnabled(), true);
});

test('decoded photo bitmaps are released even when canvas processing fails', async t => {
  const page = await studio(t);
  await page.evaluate(() => {
    window.closedBitmaps = 0;
    // Simulate a decoded resource that becomes unusable before drawImage.
    createImageBitmap = async () => ({width: 10, height: 10, close() { window.closedBitmaps++; }});
  });
  for (const mode of ['face', 'body']) {
    await page.locator('#open-' + mode).click();
    await page.locator('#' + mode + '-file').setInputFiles({name: 'decoded.png', mimeType: 'image/png', buffer: Buffer.from('decode handled by test fixture')});
    await page.waitForFunction(id => document.getElementById(id).textContent.includes('could not be opened'), mode + '-status');
    assert.equal(await page.evaluate(() => window.closedBitmaps), mode === 'face' ? 1 : 2, 'Release decoded image on processing failure');
    await closeDialog(page, mode + '-dialog');
  }
});

test('a new pending face upload cannot apply the old draft and closes its bitmap after cancellation', async t => {
  const page = await studio(t);
  await faceCamera(page);
  await page.locator('#capture-face').click();
  await page.locator('#apply-face').click();
  const priorVersion = await page.evaluate(() => faceState.version);
  await page.locator('#open-face').click();
  assert.equal(await page.locator('#apply-face').isEnabled(), true);
  const png = await page.evaluate(() => {
    const c = document.createElement('canvas'); c.width=100; c.height=140;
    c.getContext('2d').fillRect(0,0,100,140);
    const decode = createImageBitmap;
    createImageBitmap = selected => new Promise(resolve => {
      window.completeLateFaceUpload = async () => { window.lateFaceBitmap = await decode(selected); resolve(window.lateFaceBitmap); };
    });
    return c.toDataURL().split(',')[1];
  });
  await page.locator('#face-file').setInputFiles({name:'replacement.png',mimeType:'image/png',buffer:Buffer.from(png,'base64')});
  assert.equal(await page.locator('#apply-face').isEnabled(), false, 'Do not apply the old face while a replacement is loading');
  await closeDialog(page,'face-dialog');
  await page.evaluate(() => window.completeLateFaceUpload());
  await page.waitForFunction(() => window.lateFaceBitmap.width === 0);
  assert.equal(await page.evaluate(() => faceState.version), priorVersion, 'Cancelled upload cannot replace the applied face');
  await page.locator('#open-face').click();
  assert.equal(await page.locator('#apply-face').isEnabled(), true, 'Previously applied face remains available');
});

test('an unreadable live video frame releases the camera instead of leaving an unhandled inspection', async t => {
  const page = await studio(t);
  await fixturePose(page);
  await page.evaluate(() => {
    const original = copyBodyFrame;
    copyBodyFrame = (source, ...args) => {
      if (source instanceof HTMLVideoElement) throw new DOMException('Decoded frame lost', 'InvalidStateError');
      return original(source, ...args);
    };
  });
  await page.locator('#open-body').click(); await page.locator('#body-start').click();
  await page.waitForFunction(() => document.getElementById('body-status').textContent.includes('Pose detection stopped'));
  assert.equal(await page.locator('#body-dialog').getAttribute('data-phase'), 'idle');
  assert.equal(await stopped(page), true);
  assert.equal(await page.locator('#body-start').isEnabled(), true);
});

test('manual capture handles a frame lost at the click without leaking the camera', async t => {
  const page = await studio(t);
  await fixturePose(page);
  await page.locator('#open-body').click(); await page.locator('#body-start').click();
  await page.waitForFunction(() => !document.getElementById('body-manual').disabled);
  await page.evaluate(() => {
    const original = copyBodyFrame;
    copyBodyFrame = (source, ...args) => {
      if (source instanceof HTMLVideoElement) throw new DOMException('Frame lost at shutter', 'InvalidStateError');
      return original(source, ...args);
    };
    // Install the failure and click in one task, before another live poll.
    document.getElementById('body-manual').click();
  });
  assert.match(await page.locator('#body-status').textContent(), /frame could not be captured/);
  assert.equal(await page.locator('#body-dialog').getAttribute('data-phase'), 'idle');
  assert.equal(await stopped(page), true);
  assert.equal(await page.locator('#body-start').isEnabled(), true);
  assert.equal(await page.locator('#body-apply').isEnabled(), false);
});
