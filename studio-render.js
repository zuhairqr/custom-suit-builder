'use strict';

function studioGarmentPhoto(design) {
  const jacket = composeTryOnJacket(design, design.outfit === 2);
  const trousers = tryOnLayer('studio-trousers');
  if (!jacket || (design.outfit && !paintGarmentPhoto(trousers, design, 'trousers', false, {garmentOnly: true}))) return null;
  const canvas = makeCanvas(650, design.outfit ? 1370 : 770);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#f6f5f1';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.scale(.62, .62);
  ctx.translate(12, -270);
  if (design.outfit) ctx.drawImage(trousers, -36, 1166, 1096, 1380);
  ctx.drawImage(jacket, 0, 0, 1024, 1536);
  return canvas.toDataURL('image/jpeg', .95);
}

function freeGarmentPhotos(design) {
  const jacket = composeTryOnJacket(design, design.outfit === 2, true);
  const trousers = tryOnLayer('studio-trousers');
  if (!jacket || (design.outfit && !paintGarmentPhoto(trousers, design, 'trousers', false, {garmentOnly: true}))) return null;
  function productImage(source, x, y, width, height) {
    const scale = source.width / 1024;
    const canvas = makeCanvas(width, height);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#f6f5f1';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(source, x * scale, y * scale, width * scale, height * scale, 0, 0, width, height);
    return canvas.toDataURL('image/jpeg', .95);
  }
  return {jacket: productImage(jacket, 0, 250, 1024, 1240),
    trousers: design.outfit ? productImage(trousers, 150, 0, 724, 1450) : undefined};
}

function studioFrameMatches(display, generated, pose) {
  const point = (index) => [pose[index].x * generated.width, pose[index].y * generated.height];
  if (Math.abs(generated.width / generated.height / (display.width / display.height) - 1) > .06) return false;
  return [0, 2, 5, 11, 12, 23, 24, 27, 28].every((index) => {
    if (!poseVisibility(pose[index])) return false;
    const original = display.point(index);
    const actual = point(index);
    return Math.hypot(actual[0] / generated.width - original[0] / display.width,
      actual[1] / generated.height - original[1] / display.height) < (index < 10 ? .029 : .057);
  });
}

function restoreStudioFace(output, display, generated, pose) {
  const scaleX = generated.width / display.width;
  const scaleY = generated.height / display.height;
  const point = (index) => [pose[index].x * generated.width, pose[index].y * generated.height];
  const sourceEyes = pointBetween(display.point(2), display.point(5), .5);
  const targetEyes = pointBetween(point(2), point(5), .5);
  const sourceEyeSpan = Math.abs(display.point(2)[0] - display.point(5)[0]) * scaleX;
  const targetEyeSpan = Math.abs(point(2)[0] - point(5)[0]);
  const match = clamp(targetEyeSpan / Math.max(1, sourceEyeSpan), .89, 1.12);
  const earSpan = Math.abs(display.point(7)[0] - display.point(8)[0]) * scaleX * match;
  const chin = targetEyes[1] + (display.safeTop - sourceEyes[1]) * scaleY * match;
  const height = Math.max(1, (chin - targetEyes[1]) * 2.18);
  const halfWidth = Math.max(earSpan * .66, targetEyeSpan * 1.52);
  const centerY = chin - height * .48;
  const face = makeCanvas(generated.width, generated.height);
  const mask = face.getContext('2d');
  mask.drawImage(display.photoFrame, targetEyes[0] - sourceEyes[0] * scaleX * match,
    targetEyes[1] - sourceEyes[1] * scaleY * match, generated.width * match, generated.height * match);
  mask.globalCompositeOperation = 'destination-in';
  mask.translate(targetEyes[0], centerY);
  mask.scale(halfWidth, height / 2);
  const gradient = mask.createRadialGradient(0, 0, .72, 0, 0, 1);
  gradient.addColorStop(0, '#000');
  gradient.addColorStop(1, '#0000');
  mask.fillStyle = gradient;
  mask.fillRect(-1, -1, 2, 2);
  output.width = generated.width;
  output.height = generated.height;
  const ctx = output.getContext('2d');
  ctx.drawImage(generated, 0, 0);
  ctx.drawImage(face, 0, 0);
}

let studioSegmenter;

async function segmentStudioSubject(frame) {
  studioSegmenter ||= (async () => {
    const {FilesetResolver, ImageSegmenter} = await import(bodyPoseRuntime + '/vision_bundle.mjs');
    const fileset = await FilesetResolver.forVisionTasks(bodyPoseRuntime + '/wasm');
    return ImageSegmenter.createFromOptions(fileset, {
      baseOptions: {delegate: 'CPU', modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/1/selfie_segmenter.tflite'},
      runningMode: 'IMAGE', outputConfidenceMasks: true, outputCategoryMask: false,
    });
  })().catch((error) => {
    studioSegmenter = null;
    throw error;
  });
  const segmenter = await studioSegmenter;
  let mask;
  segmenter.segment(frame, ({confidenceMasks}) => {
    const person = confidenceMasks?.[1] || confidenceMasks?.[0];
    if (person) mask = studioSubjectMask(person);
  });
  return mask;
}

function studioSubjectMask(mask) {
  const canvas = makeCanvas(mask.width, mask.height);
  const ctx = canvas.getContext('2d');
  const alpha = ctx.createImageData(mask.width, mask.height);
  const confidence = mask.getAsFloat32Array();
  for (let index = 0; index < confidence.length; index++) {
    alpha.data[index * 4 + 3] = 255 * clamp((confidence[index] - .2) / .6, 0, 1);
  }
  ctx.putImageData(alpha, 0, 0);
  return canvas;
}

function applyStudioBackground(output, mask) {
  const ctx = output.getContext('2d');
  ctx.save();
  ctx.globalCompositeOperation = 'destination-in';
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(mask, 0, 0, output.width, output.height);
  ctx.globalCompositeOperation = 'destination-over';
  ctx.fillStyle = '#f3f1ee';
  ctx.fillRect(0, 0, output.width, output.height);
  ctx.restore();
}

function saveTryOnPhoto(canvas, filename) {
  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, 'image/png');
}

function installInstantFitExport() {
  const dialog = get('fit-export-dialog');
  const result = get('fit-export-result');
  const background = get('fit-export-background');
  const status = get('fit-export-status');
  const download = get('fit-export-download');
  let photo;
  let revision = 0;

  async function update() {
    if (!photo) return;
    const current = ++revision;
    result.width = photo.width;
    result.height = photo.height;
    result.getContext('2d').drawImage(photo, 0, 0);
    status.textContent = `${photo.width} × ${photo.height} PNG`;
    download.disabled = background.checked;
    if (!background.checked) return;
    status.textContent = 'Separating the background…';
    const mask = await segmentStudioSubject(photo).catch(() => null);
    if (current !== revision) return;
    if (mask) applyStudioBackground(result, mask);
    status.textContent = mask ? `${photo.width} × ${photo.height} PNG · Studio background`
      : 'Background separation unavailable. You can save the original preview.';
    download.disabled = false;
  }

  get('open-fit-export').addEventListener('click', () => {
    const model = get('fabric-model');
    if (!showsBodyPhoto() || model.hidden) return;
    photo = makeCanvas(model.width, model.height);
    photo.getContext('2d').drawImage(model, 0, 0);
    dialog.showModal();
    update();
  });
  background.addEventListener('change', update);
  download.addEventListener('click', () => saveTryOnPhoto(result, 'form-atelier-instant-fit.png'));
  dialog.addEventListener('close', () => {
    ++revision;
    photo = null;
    result.width = result.height = 1;
    status.textContent = '';
  });
}

const studioGeneration = {available: false};

function installStudioRender() {
  const trigger = get('open-studio-render');
  const dialog = get('studio-render-dialog');
  const consent = get('studio-render-consent');
  const start = get('studio-render-start');
  const status = get('studio-render-status');
  const canvas = get('studio-render-result');
  const download = get('studio-render-download');
  const zoom = get('studio-render-zoom');
  const background = get('studio-remove-background');
  let request;
  const endpoint = new URL('api/try-on', document.URL);

  fetch(endpoint, {cache: 'no-store'}).then(async (response) => {
    if (response.ok && response.headers.get('content-type')?.includes('application/json')) {
      const config = await response.json();
      studioGeneration.available = config.available === true;
      studioGeneration.free = config.mode === 'free';
      studioGeneration.local = config.local === true;
      if (studioGeneration.free) {
        trigger.textContent = 'Free AI render';
        get('studio-render-title').textContent = 'Generate a free AI try-on';
        get('studio-background-control').hidden = false;
        get('studio-render-provider').textContent = studioGeneration.local
          ? 'FASHN VTON runs on this computer. A full outfit can take a long time on a CPU.'
          : 'The public Hugging Face demo receives your photo and garment references to run FASHN VTON v1.5 on a shared GPU.';
        get('studio-render-consent-text').textContent = studioGeneration.local
          ? 'I agree to use this photo for the local try-on.'
          : 'I consent to sending these images to the public Hugging Face demo.';
        start.textContent = 'Generate free try-on';
      }
      renderPreview();
    }
  }).catch(() => {});

  trigger.addEventListener('click', () => {
    if (!studioGeneration.available || !tryOnSession.capture) return;
    dialog.showModal();
  });
  consent.addEventListener('change', () => { start.disabled = !consent.checked || Boolean(request); });
  start.addEventListener('click', async () => {
    if (!consent.checked || request || !tryOnSession.capture) return;
    const capture = tryOnSession.capture;
    const garment = studioGeneration.free ? freeGarmentPhotos(design) : {garment: studioGarmentPhoto(design)};
    if (!garment || !(garment.jacket || garment.garment) || (photoClothSources[fabrics[design.fabric].code] && !photoCloth(design.fabric))) {
      status.textContent = 'The garment is still loading. Try again in a moment.';
      return;
    }
    const display = prepareTryOnDisplay(capture);
    const replaceBackground = studioGeneration.free && background.checked;
    const job = new AbortController();
    request = job;
    consent.checked = false;
    consent.disabled = true;
    start.disabled = true;
    canvas.hidden = true;
    download.hidden = true;
    zoom.hidden = true;
    status.textContent = 'Generating the studio preview. Keep this tab open.';
    try {
      const response = await fetch(endpoint, {method: 'POST', signal: job.signal,
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({consent: true, outfit: design.outfit, ...garment, person: display.photoFrame.toDataURL('image/jpeg', .94)})});
      const {image, error} = await response.json();
      if (!response.ok) throw new Error(error);
      const generated = new Image();
      generated.src = image;
      await generated.decode();
      if (request !== job || capture !== tryOnSession.capture) return;
      const poseFrame = copyBodyFrame(generated, generated.naturalWidth, generated.naturalHeight, 850);
      const poses = await detectBodyPose(poseFrame);
      if (request !== job || capture !== tryOnSession.capture) return;
      if (poses.length !== 1 || !studioFrameMatches(display, generated, poses[0])) {
        status.textContent = 'This render shifted your face or pose too far to use. Your instant preview is still available.';
        return;
      }
      const mask = replaceBackground ? await segmentStudioSubject(poseFrame).catch(() => null) : null;
      if (request !== job || capture !== tryOnSession.capture) return;
      restoreStudioFace(canvas, display, generated, poses[0]);
      if (mask) applyStudioBackground(canvas, mask);
      canvas.hidden = false;
      download.hidden = false;
      zoom.hidden = false;
      status.textContent = replaceBackground && !mask ? 'Try-on ready. The background could not be separated.'
        : 'Studio preview ready. Use the configurator for exact construction details.';
    } catch (error) {
      if (request === job) status.textContent = /^The free (demo|local model)/.test(error.message) ? error.message
        : 'The studio render could not be completed. Your instant preview is still available.';
    } finally {
      if (request === job) {
        request = null;
        consent.disabled = false;
      }
    }
  });
  function clear() {
    request?.abort();
    request = null;
    consent.checked = false;
    consent.disabled = false;
    start.disabled = true;
    canvas.hidden = true;
    download.hidden = true;
    zoom.hidden = true;
    zoom.setAttribute('aria-pressed', 'false');
    zoom.textContent = 'View full size';
    canvas.classList.remove('full-size');
    canvas.width = canvas.height = 1;
    status.textContent = '';
  }
  zoom.addEventListener('click', () => {
    const expanded = canvas.classList.toggle('full-size');
    zoom.setAttribute('aria-pressed', String(expanded));
    zoom.textContent = expanded ? 'Fit to window' : 'View full size';
    if (expanded) canvas.scrollIntoView({block: 'start'});
  });
  download.addEventListener('click', () => {
    if (!canvas.hidden) saveTryOnPhoto(canvas, 'form-atelier-fashn-try-on.png');
  });
  dialog.addEventListener('close', clear);
  window.addEventListener('pagehide', clear);
}
