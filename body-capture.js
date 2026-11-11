'use strict';

const tryOnSession = {capture: null, revision: 0};

function copyBodyFrame(source, width, height, limit = Infinity) {
  const scale = Math.min(1, limit / Math.max(width, height));
  const canvas = makeCanvas(Math.max(1, Math.round(width * scale)), Math.max(1, Math.round(height * scale)));
  canvas.getContext('2d').drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas;
}

function downloadBodyFrame(photo) {
  photo.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'form-atelier-capture.jpg';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, 'image/jpeg', .94);
}

function installBodyCapture(onChange) {
  const dialog = get('body-dialog');
  const video = get('body-video');
  const stage = get('body-stage');
  const still = get('body-still');
  const status = get('body-status');
  const indicator = get('body-indicator');
  const countdown = get('body-countdown');
  const start = get('body-start');
  const switchCamera = get('body-switch');
  const manual = get('body-manual');
  const retake = get('body-retake');
  const download = get('body-download');
  const apply = get('body-apply');
  const remove = get('body-remove');
  const file = get('body-file');
  const voice = get('body-voice');
  let stream;
  let facing = 'user';
  let phase = 'idle';
  let epoch = 0;
  let poll;
  let draft;
  let timer = {};
  let attempts = 0;
  let lastFrame = -1;
  let analysisFrame;
  let lastSpoken = '';
  let lastSpokenAt = -Infinity;

  function announce(message, speak = false) {
    if (status.textContent !== message) status.textContent = message;
    if (!speak || !voice.checked || !window.speechSynthesis || message === lastSpoken ||
        performance.now() - lastSpokenAt < 3200 || speechSynthesis.speaking) return;
    lastSpoken = message;
    lastSpokenAt = performance.now();
    speechSynthesis.speak(new SpeechSynthesisUtterance(message));
  }

  function updateState(next) {
    phase = next;
    const active = ['camera-ready', 'detecting', 'position-valid', 'countdown'].includes(next);
    dialog.dataset.phase = next;
    stage.hidden = !active;
    still.hidden = next !== 'ready';
    countdown.hidden = next !== 'countdown';
    manual.hidden = !active;
    manual.disabled = !video.videoWidth || next === 'camera-ready';
    switchCamera.hidden = !active || switchCamera.dataset.available !== 'true';
    start.hidden = active || next === 'ready';
    start.disabled = next === 'starting' || next === 'validating';
    file.disabled = next === 'starting' || next === 'validating';
    retake.hidden = next !== 'ready';
    download.hidden = next !== 'ready';
    apply.disabled = next !== 'ready';
    remove.hidden = !tryOnSession.capture;
    indicator.textContent = ({
      idle: 'CAMERA OFF', starting: 'OPENING CAMERA', 'camera-ready': 'CAMERA READY',
      detecting: 'CHECKING POSE', 'position-valid': 'POSE DETECTED', countdown: 'POSE LOCKED',
      captured: 'PHOTO CAPTURED', validating: 'CHECKING PHOTO', ready: 'PHOTO READY',
    })[next];
  }

  function stop() {
    epoch++;
    clearTimeout(poll);
    stream?.getTracks().forEach((track) => track.stop());
    stream = null;
    video.srcObject = null;
    timer = {};
    lastFrame = -1;
    analysisFrame = null;
  }

  function clearDraft() {
    draft = null;
    still.width = still.height = 1;
  }

  function schedule(request, delay = 115) {
    clearTimeout(poll);
    poll = setTimeout(() => inspectFrame(request), delay);
  }

  async function inspectFrame(request) {
    if (request !== epoch || !dialog.open || !stream || !['detecting', 'position-valid', 'countdown'].includes(phase)) return;
    if (video.readyState < 2 || lastFrame === video.currentTime) {
      schedule(request);
      return;
    }
    lastFrame = video.currentTime;
    analysisFrame ||= copyBodyFrame(video, video.videoWidth, video.videoHeight, 640);
    const frame = analysisFrame;
    frame.getContext('2d').drawImage(video, 0, 0, frame.width, frame.height);
    try {
      const landmarks = await detectBodyPose(frame);
      if (request !== epoch || !stream || phase === 'validating') return;
      const aspect = frame.width / frame.height;
      const fit = bodyFraming(landmarks, aspect, true);
      const problem = fit.message || bodyImageQuality(frame, fit.pose);
      const now = performance.now();
      timer = advanceBodyCountdown(timer, problem ? null : fit.pose, aspect, now);
      if (problem) {
        updateState('detecting');
        announce(problem, true);
      } else if (attempts >= 2) {
        updateState('position-valid');
        announce('Position looks good. Choose Capture now when you are ready.', true);
      } else if (timer.deadline) {
        if (now >= timer.deadline) {
          captureFrame(true);
          return;
        }
        updateState('countdown');
        countdown.textContent = Math.ceil((timer.deadline - now) / 1000);
        announce('Perfect position. Hold still.', true);
      } else {
        updateState('position-valid');
        announce('Hold still to start the countdown.', true);
      }
      schedule(request);
    } catch {
      if (request !== epoch) return;
      stop();
      updateState('idle');
      announce('Pose detection stopped. Restart the camera or choose a full-body photo.');
    }
  }

  async function openCamera(deviceId) {
    stop();
    clearDraft();
    attempts = 0;
    const request = epoch;
    if (!navigator.mediaDevices?.getUserMedia) {
      updateState('idle');
      announce('Camera access needs HTTPS or localhost. You can still choose a full-body photo.');
      return;
    }
    updateState('starting');
    announce('Allow camera access to start the full-body guide.');
    try {
      const granted = await navigator.mediaDevices.getUserMedia({
        audio: false, video: {...(deviceId ? {deviceId: {exact: deviceId}} : {facingMode: {ideal: facing}}),
          width: {ideal: 1920}, height: {ideal: 1920}},
      });
      if (request !== epoch || !dialog.open) {
        granted.getTracks().forEach((track) => track.stop());
        return;
      }
      stream = granted;
      for (const track of stream.getVideoTracks()) track.addEventListener('ended', () => {
        if (request !== epoch) return;
        stop();
        updateState('idle');
        announce('The camera disconnected. Restart it or choose a photo.');
      }, {once: true});
      video.srcObject = stream;
      updateState('camera-ready');
      await video.play();
      if (request !== epoch) return;
      stage.style.setProperty('--body-video-aspect', video.videoWidth / video.videoHeight);
      navigator.mediaDevices.enumerateDevices().then((devices) => {
        if (request !== epoch) return;
        switchCamera.dataset.available = String(devices.filter(({kind}) => kind === 'videoinput').length > 1);
        updateState(phase);
      }).catch(() => {});
      announce('Loading the pose detector. The camera feed stays on this device.');
      await loadBodyPose();
      if (request !== epoch) return;
      updateState('detecting');
      announce('Step back until your head and both feet are in frame.', true);
      schedule(request, 0);
    } catch (error) {
      if (request !== epoch) return;
      stop();
      updateState('idle');
      announce(error.name === 'NotAllowedError' ? 'Camera permission was declined. Allow it in the browser or choose a photo.'
        : 'The camera or pose detector could not start. Check the connection or try again.');
    }
  }

  async function validatePhoto(photo, request, fromCamera, automatic = false) {
    updateState('validating');
    announce('Checking that the photo is sharp and your whole body is visible.');
    // Match the live detector's input size so a locked pose is validated consistently.
    const input = copyBodyFrame(photo, photo.width, photo.height, 640);
    let problem;
    try {
      const landmarks = await detectBodyPose(input);
      if (request !== epoch || !dialog.open) return;
      const fit = bodyFraming(landmarks, input.width / input.height, false);
      problem = fit.message || bodyImageQuality(input, fit.pose);
      if (!problem) {
        draft = {photo, pose: fit.pose, bounds: fit.bounds, faceBottom: fit.faceBottom};
        still.width = photo.width;
        still.height = photo.height;
        still.getContext('2d').drawImage(photo, 0, 0);
        stop();
        updateState('ready');
        announce('Full-body photo ready. Continue to see your current suit on your photo.');
        return;
      }
    } catch {
      problem = 'Photo validation could not start. Check your connection and try again.';
    }
    if (request !== epoch || !dialog.open) return;
    if (fromCamera && stream) {
      attempts += Number(automatic);
      timer = {};
      updateState('detecting');
      announce(attempts >= 2 ? problem + ' Automatic capture is paused. Use Capture now.' : problem, true);
      schedule(request, 1400);
    } else {
      updateState('idle');
      announce(problem);
    }
  }

  function captureFrame(automatic) {
    if (!stream || !video.videoWidth || !['detecting', 'position-valid', 'countdown'].includes(phase)) return;
    clearTimeout(poll);
    const request = epoch;
    const photo = copyBodyFrame(video, video.videoWidth, video.videoHeight);
    updateState('captured');
    dialog.classList.remove('body-shutter');
    void dialog.offsetWidth;
    dialog.classList.add('body-shutter');
    validatePhoto(photo, request, true, automatic);
  }

  get('open-body').addEventListener('click', () => {
    clearDraft();
    updateState('idle');
    announce('Use a front-facing full-body view with your hands relaxed and feet visible.');
    dialog.showModal();
  });
  start.addEventListener('click', () => openCamera());
  retake.addEventListener('click', () => openCamera());
  download.addEventListener('click', () => { if (draft) downloadBodyFrame(draft.photo); });
  switchCamera.addEventListener('click', async () => {
    const request = epoch;
    facing = facing === 'user' ? 'environment' : 'user';
    const current = stream?.getVideoTracks()[0]?.getSettings().deviceId;
    const cameras = await navigator.mediaDevices.enumerateDevices().then(
      (devices) => devices.filter(({kind}) => kind === 'videoinput'), () => []);
    if (request !== epoch || !stream) return;
    const next = (cameras.findIndex(({deviceId}) => deviceId === current) + 1) % cameras.length;
    openCamera(cameras[next]?.deviceId);
  });
  manual.addEventListener('click', () => captureFrame(false));
  file.addEventListener('change', async () => {
    const [selected] = file.files;
    file.value = '';
    if (!selected) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(selected.type) || selected.size > 20 * 1024 * 1024) {
      announce('Choose a JPG, PNG, or WebP photo up to 20 MB.');
      return;
    }
    stop();
    clearDraft();
    const request = epoch;
    updateState('validating');
    announce('Opening the full-body photo…');
    try {
      const bitmap = await createImageBitmap(selected);
      const photo = copyBodyFrame(bitmap, bitmap.width, bitmap.height, 2400);
      bitmap.close();
      if (request === epoch && dialog.open) await validatePhoto(photo, request, false);
    } catch {
      if (request !== epoch) return;
      updateState('idle');
      announce('That photo could not be opened.');
    }
  });
  apply.addEventListener('click', () => {
    if (!draft) return;
    tryOnSession.capture = draft;
    tryOnSession.revision++;
    dialog.close();
    onChange(true);
  });
  remove.addEventListener('click', () => {
    tryOnSession.capture = null;
    tryOnSession.revision++;
    dialog.close();
    onChange(false);
  });
  dialog.addEventListener('close', () => {
    stop();
    clearDraft();
    updateState('idle');
    if (voice.checked && window.speechSynthesis) speechSynthesis.cancel();
  });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden || !dialog.open || (!stream && phase !== 'starting')) return;
    stop();
    updateState('idle');
    announce('Camera paused while this tab was in the background. Start it again to continue.');
  });
  window.addEventListener('hashchange', () => { if (dialog.open) dialog.close(); });
  window.addEventListener('pagehide', () => {
    stop();
    clearDraft();
    const hadPhoto = Boolean(tryOnSession.capture);
    tryOnSession.capture = null;
    tryOnSession.revision++;
    if (dialog.open) dialog.close();
    if (hadPhoto) onChange(false);
  });
}
