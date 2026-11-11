'use strict';

const bodyPoseRuntime = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.32';
const bodyPoseModel = 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task';
let bodyPoseLoader;
let poseOperations = Promise.resolve();

function loadBodyPose() {
  bodyPoseLoader ||= (async () => {
    const {FilesetResolver, PoseLandmarker} = await import(bodyPoseRuntime + '/vision_bundle.mjs');
    const fileset = await FilesetResolver.forVisionTasks(bodyPoseRuntime + '/wasm');
    return PoseLandmarker.createFromOptions(fileset, {
      baseOptions: {modelAssetPath: bodyPoseModel, delegate: 'CPU'},
      runningMode: 'IMAGE', numPoses: 2, outputSegmentationMasks: false,
      minPoseDetectionConfidence: .55, minPosePresenceConfidence: .55,
    });
  })().catch((error) => {
    bodyPoseLoader = null;
    throw error;
  });
  return bodyPoseLoader;
}

function detectBodyPose(input) {
  const operation = poseOperations.then(async () => {
    const detector = await loadBodyPose();
    let frame;
    detector.detect(input, ({landmarks}) => { frame = landmarks; });
    return frame;
  });
  poseOperations = operation.catch(() => {});
  return operation;
}

const bodyPoints = {nose: 0, eyes: [2, 5], ears: [7, 8], shoulders: [11, 12], elbows: [13, 14],
  wrists: [15, 16], hips: [23, 24], knees: [25, 26], ankles: [27, 28], heels: [29, 30], toes: [31, 32]};
const stablePoints = [0, 11, 12, 15, 16, 23, 24, 25, 26, 27, 28, 31, 32];

function poseVisibility(point) {
  return Number.isFinite(point?.x) && Number.isFinite(point?.y) && (point.visibility ?? 1) >= .55;
}

function bodyFraming(poses, aspect, live) {
  if (poses.length > 1) return {message: 'Only one person should be in the frame.'};
  const [pose] = poses;
  if (!pose) return {message: 'Step back until your full body is visible.'};
  const groups = [bodyPoints.eyes, bodyPoints.ears, bodyPoints.shoulders, bodyPoints.elbows, bodyPoints.wrists,
    bodyPoints.hips, bodyPoints.knees, bodyPoints.ankles, bodyPoints.heels, bodyPoints.toes];
  const visible = (indices) => indices.every((index) => poseVisibility(pose[index]));
  if (!visible([bodyPoints.nose, ...groups[0]])) return {message: 'Face the camera and keep your head visible.'};
  if (!visible([...bodyPoints.ankles, ...bodyPoints.toes]) ||
      !bodyPoints.heels.some((index) => poseVisibility(pose[index]))) return {message: 'Step back and keep both feet visible.'};
  if (!visible([...bodyPoints.elbows, ...bodyPoints.wrists])) return {message: 'Keep both arms and hands visible, slightly away from your sides.'};
  if (!visible([...bodyPoints.shoulders, ...bodyPoints.hips, ...bodyPoints.knees])) return {message: 'Keep your shoulders, hips and knees in the frame.'};
  const nose = pose[bodyPoints.nose];
  const [a, b] = bodyPoints.shoulders.map((index) => pose[index]);
  const [c, d] = bodyPoints.hips.map((index) => pose[index]);
  const shoulderY = (a.y + b.y) / 2;
  const hipY = (c.y + d.y) / 2;
  const head = nose.y - (shoulderY - nose.y) * .85;
  const foot = Math.max(...[...bodyPoints.ankles, ...bodyPoints.toes, ...bodyPoints.heels]
    .filter((index) => poseVisibility(pose[index])).map((index) => pose[index].y));
  const body = [...bodyPoints.shoulders, ...bodyPoints.elbows, ...bodyPoints.wrists, ...bodyPoints.hips,
    ...bodyPoints.knees, ...bodyPoints.ankles, ...bodyPoints.toes].map((index) => pose[index]);
  const left = Math.min(...body.map(({x}) => x));
  const right = Math.max(...body.map(({x}) => x));
  const center = (left + right) / 2;
  if (head < .025) return {message: 'Step back and keep space above your head.'};
  if (foot > .976) return {message: 'Step back and keep space below your feet.'};
  if (left < .022 || (live && center < .34)) return {message: 'Move slightly right.'};
  if (right > .978 || (live && center > .66)) return {message: 'Move slightly left.'};
  if (foot - head < .45) return {message: 'Move closer while keeping your head and feet visible.'};
  const shoulderWidth = Math.abs(a.x - b.x) * aspect;
  if (shoulderWidth < (hipY - shoulderY) * .54 || (pose[2].x - nose.x) * (pose[5].x - nose.x) > 0) {
    return {message: 'Turn to face the camera straight on.'};
  }
  const depthTilt = (left, right) => Math.abs((left.z ?? 0) - (right.z ?? 0)) / Math.max(.01, Math.abs(left.x - right.x));
  const eyeDistances = bodyPoints.eyes.map((index) => Math.abs(pose[index].x - nose.x));
  if (depthTilt(a, b) > .44 || depthTilt(c, d) > .58 || Math.min(...eyeDistances) < Math.max(...eyeDistances) * .29) {
    return {message: 'Face the camera squarely with both shoulders and hips facing forward.'};
  }
  if (hipY - shoulderY < .1 || Math.abs(a.y - b.y) > shoulderWidth * .23 ||
      Math.abs((c.x + d.x - a.x - b.x) / 2) * aspect > shoulderWidth * .35) {
    return {message: 'Stand upright with your shoulders level.'};
  }
  for (const index of [0, 1]) {
    const wrist = pose[bodyPoints.wrists[index]];
    const shoulder = pose[bodyPoints.shoulders[index]];
    const hip = pose[bodyPoints.hips[index]];
    const direction = Math.sign(shoulder.x - (a.x + b.x) / 2);
    if ((wrist.x - hip.x) * direction * aspect < shoulderWidth * .13 || wrist.y < shoulderY + .12) {
      return {message: 'Relax your arms down, a little away from your body.'};
    }
    const knee = pose[bodyPoints.knees[index]];
    const ankle = pose[bodyPoints.ankles[index]];
    if (knee.y < hip.y + .06 || ankle.y < knee.y + .07) return {message: 'Stand with both legs straight and feet on the floor.'};
  }
  const [ankleA, ankleB] = bodyPoints.ankles.map((index) => pose[index]);
  if ((ankleA.x - ankleB.x) * (a.x - b.x) <= 0 || Math.abs(ankleA.y - ankleB.y) > (hipY - shoulderY) * .14) {
    return {message: 'Place both feet side by side, the same distance from the camera.'};
  }
  return {pose, bounds: {left, right, head, foot}, faceBottom: nose.y + (shoulderY - nose.y) * .56};
}

let qualityCanvas;
function bodyImageQuality(input, pose) {
  qualityCanvas ||= makeCanvas(96, 96);
  const ctx = qualityCanvas.getContext('2d', {willReadFrequently: true});
  const [left, right] = bodyPoints.shoulders.map((index) => pose[index]);
  const [firstHip, secondHip] = bodyPoints.hips.map((index) => pose[index]);
  const width = Math.abs(left.x - right.x);
  const center = (left.x + right.x) / 2;
  const top = pose[bodyPoints.nose].y - ((left.y + right.y) / 2 - pose[bodyPoints.nose].y) * .48;
  const bottom = (firstHip.y + secondHip.y) / 2;
  ctx.drawImage(input, (center - width * .48) * input.width, top * input.height,
    width * .96 * input.width, (bottom - top) * input.height, 0, 0, 96, 96);
  const pixels = ctx.getImageData(0, 0, 96, 96).data;
  const luminance = new Float32Array(96 * 96);
  let sum = 0;
  let highlights = 0;
  let shadows = 0;
  for (let index = 0; index < luminance.length; index++) {
    const offset = index * 4;
    const light = pixels[offset] * .2126 + pixels[offset + 1] * .7152 + pixels[offset + 2] * .0722;
    luminance[index] = light;
    sum += light;
    if (light > 249) highlights++;
    if (light < 18) shadows++;
  }
  if (sum / luminance.length < 48 || shadows > luminance.length * .63) return 'Improve the lighting in front of you.';
  if (highlights > luminance.length * .57) return 'Move away from harsh light or glare.';
  let edges = 0;
  for (let row = 1; row < 95; row++) {
    for (let column = 1; column < 95; column++) {
      const i = row * 96 + column;
      const edge = 4 * luminance[i] - luminance[i - 1] - luminance[i + 1] - luminance[i - 96] - luminance[i + 96];
      edges += edge * edge;
    }
  }
  return edges / (94 * 94) < 13 ? 'The image looks blurry. Hold still and check the lens.' : '';
}

function advanceBodyCountdown(timer, pose, aspect, time) {
  if (!pose) return {anchor: null, stableSince: null, deadline: null};
  const unstable = !timer.anchor || stablePoints.some((index) => {
    const prior = timer.anchor[index];
    const current = pose[index];
    return Math.hypot((prior.x - current.x) * aspect, prior.y - current.y) > .028;
  });
  if (unstable) return {anchor: pose, stableSince: time, deadline: null};
  if (!timer.deadline && time - timer.stableSince >= 1000) return {...timer, deadline: time + 3000};
  return timer;
}
