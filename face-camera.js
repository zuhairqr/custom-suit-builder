'use strict';

const faceState = {image: null, version: 0};
const faceSize = {width: 224, height: 304};

function drawFaceTexture(canvas, photo, alignment) {
  const ctx = canvas.getContext('2d');
  const {width, height} = canvas;
  const scale = Math.max(width / photo.width, height / photo.height) * alignment.scale;
  const photoWidth = photo.width * scale;
  const photoHeight = photo.height * scale;
  ctx.clearRect(0, 0, width, height);
  ctx.drawImage(photo, (width - photoWidth) / 2 + alignment.x * width * .45,
    (height - photoHeight) / 2 + alignment.y * height * .45, photoWidth, photoHeight);

  ctx.save();
  ctx.globalCompositeOperation = 'destination-in';
  ctx.translate(width / 2, height / 2);
  ctx.scale(1, height / width);
  const oval = ctx.createRadialGradient(0, 0, width * .27, 0, 0, width * .48);
  oval.addColorStop(0, '#000');
  oval.addColorStop(.55, '#000e');
  oval.addColorStop(1, '#0000');
  ctx.fillStyle = oval;
  ctx.fillRect(-width / 2, -width / 2, width, width);
  ctx.restore();
}

function paintPersonalFace(ctx) {
  ctx.drawImage(faceState.image, 400, 5, faceSize.width, faceSize.height);
}

function installFaceCamera(onChange) {
  const element = (id) => document.getElementById(id);
  const dialog = element('face-dialog');
  const video = element('face-video');
  const enable = element('enable-camera');
  const capture = element('capture-face');
  const apply = element('apply-face');
  const remove = element('remove-face');
  const file = element('face-file');
  const adjustments = element('face-adjustments');
  const preview = element('face-draft');
  const status = element('face-status');
  const sliders = {scale: element('face-scale'), x: element('face-x'), y: element('face-y')};
  let stream = null;
  let generation = 0;
  let photo = null;
  let appliedPhoto = null;
  let appliedAlignment = null;

  function stopCamera() {
    generation++;
    stream?.getTracks().forEach((track) => track.stop());
    stream = null;
    video.srcObject = null;
    element('camera-stage').hidden = true;
    capture.hidden = true;
    capture.disabled = true;
    enable.disabled = false;
  }

  function alignment() {
    return Object.fromEntries(Object.entries(sliders).map(([key, slider]) => [key, Number(slider.value)]));
  }

  function setPhoto(image, position = {scale: 1, x: 0, y: 0}) {
    photo = image;
    for (const [key, slider] of Object.entries(sliders)) slider.value = position[key];
    adjustments.hidden = !photo;
    apply.disabled = !photo;
    if (photo) drawFaceTexture(preview, photo, alignment());
  }

  element('open-face').addEventListener('click', () => {
    status.textContent = '';
    remove.hidden = !faceState.image;
    setPhoto(appliedPhoto, appliedAlignment || undefined);
    dialog.showModal();
  });

  enable.addEventListener('click', async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      status.textContent = 'Camera access is unavailable here. Open the studio on localhost or choose a photo.';
      return;
    }
    stopCamera();
    const request = generation;
    enable.disabled = true;
    status.textContent = 'Waiting for camera permission…';
    try {
      const granted = await navigator.mediaDevices.getUserMedia({video: {facingMode: 'user', width: {ideal: 1280}}, audio: false});
      if (request !== generation || !dialog.open) {
        granted.getTracks().forEach((track) => track.stop());
        return;
      }
      stream = granted;
      video.srcObject = stream;
      element('camera-stage').hidden = false;
      capture.hidden = false;
      await video.play();
      if (request !== generation) return;
      capture.disabled = !video.videoWidth;
      status.textContent = 'Centre your face in the oval and select Capture face.';
    } catch (error) {
      if (request !== generation) return;
      stopCamera();
      status.textContent = error.name === 'NotAllowedError'
        ? 'Camera permission is off. Allow it in the browser or choose a photo.'
        : 'The camera could not start. Check the device or choose a photo.';
    }
  });

  capture.addEventListener('click', () => {
    if (!stream || !video.videoWidth) return;
    const frame = video.getBoundingClientRect();
    const cover = Math.max(frame.width / video.videoWidth, frame.height / video.videoHeight);
    const cropHeight = Math.min(frame.height * .86 / cover, video.videoHeight);
    const cropWidth = Math.min(cropHeight * faceSize.width / faceSize.height, video.videoWidth);
    const captured = makeCanvas(360, Math.round(360 * cropHeight / cropWidth));
    const ctx = captured.getContext('2d');
    ctx.translate(captured.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, (video.videoWidth - cropWidth) / 2, (video.videoHeight - cropHeight) / 2,
      cropWidth, cropHeight, 0, 0, captured.width, captured.height);
    stopCamera();
    setPhoto(captured);
    status.textContent = 'Photo captured. Adjust its position, then apply it to the mannequin.';
  });

  video.addEventListener('loadedmetadata', () => {
    if (stream && video.videoWidth) capture.disabled = false;
  });

  file.addEventListener('change', async () => {
    const [selected] = file.files;
    file.value = '';
    if (!selected) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(selected.type) || selected.size > 20 * 1024 * 1024) {
      status.textContent = 'Choose a JPG, PNG, or WebP photo up to 20 MB.';
      return;
    }
    stopCamera();
    const request = generation;
    try {
      const bitmap = await createImageBitmap(selected);
      if (request === generation && dialog.open) {
        const scale = Math.min(1, 1200 / Math.max(bitmap.width, bitmap.height));
        const local = makeCanvas(Math.max(1, Math.round(bitmap.width * scale)), Math.max(1, Math.round(bitmap.height * scale)));
        local.getContext('2d').drawImage(bitmap, 0, 0, local.width, local.height);
        setPhoto(local);
        status.textContent = 'Move and zoom your face into the oval, then select Apply face.';
      }
      bitmap.close();
    } catch {
      if (request === generation) status.textContent = 'That photo could not be opened.';
    }
  });

  for (const slider of Object.values(sliders)) {
    slider.addEventListener('input', () => { if (photo) drawFaceTexture(preview, photo, alignment()); });
  }
  apply.addEventListener('click', () => {
    if (!photo) return;
    appliedPhoto = photo;
    appliedAlignment = alignment();
    const texture = makeCanvas(faceSize.width, faceSize.height);
    drawFaceTexture(texture, appliedPhoto, appliedAlignment);
    faceState.image = texture;
    faceState.version++;
    dialog.close();
    onChange();
  });
  remove.addEventListener('click', () => {
    appliedPhoto = null;
    appliedAlignment = null;
    faceState.image = null;
    faceState.version++;
    dialog.close();
    onChange();
  });
  dialog.addEventListener('close', () => {
    stopCamera();
    setPhoto(null);
    preview.getContext('2d').clearRect(0, 0, preview.width, preview.height);
  });
  window.addEventListener('pagehide', () => {
    stopCamera();
    if (dialog.open) dialog.close();
    appliedPhoto = null;
    appliedAlignment = null;
    setPhoto(null);
    preview.getContext('2d').clearRect(0, 0, preview.width, preview.height);
    if (faceState.image) {
      faceState.image = null;
      faceState.version++;
      onChange();
    }
  });
  window.addEventListener('hashchange', () => { if (dialog.open) dialog.close(); });
}
