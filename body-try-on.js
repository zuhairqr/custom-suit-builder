'use strict';

const tryOnLayers = new Map();
const pointBetween = (a, b, ratio) => [a[0] + (b[0] - a[0]) * ratio, a[1] + (b[1] - a[1]) * ratio];
const centeredRow = ([x, y], half) => [[x - half, y], [x + half, y]];

function tryOnLayer(name) {
  if (!tryOnLayers.has(name)) tryOnLayers.set(name, makeCanvas(1, 1));
  return tryOnLayers.get(name);
}

function inversePanel(a, b, c, d) {
  const ex = b[0] - a[0], ey = b[1] - a[1], fx = c[0] - a[0], fy = c[1] - a[1];
  const gx = d[0] - c[0] - ex, gy = d[1] - c[1] - ey;
  const determinant = ex * fy - ey * fx;
  return (x, y, result) => {
    if (Math.abs(determinant) < 1e-4) return false;
    const px = x - a[0], py = y - a[1];
    let u = (px * fy - py * fx) / determinant;
    let v = (ex * py - ey * px) / determinant;
    for (let iteration = 0; iteration < 4; iteration++) {
      const dx = ex * u + fx * v + gx * u * v - px;
      const dy = ey * u + fy * v + gy * u * v - py;
      if (Math.abs(dx) + Math.abs(dy) < .015) break;
      const ux = ex + gx * v, uy = ey + gy * v, vx = fx + gx * u, vy = fy + gy * u;
      const jacobian = ux * vy - uy * vx;
      if (Math.abs(jacobian) < 1e-4) return false;
      u -= (dx * vy - dy * vx) / jacobian;
      v -= (ux * dy - uy * dx) / jacobian;
    }
    if (!(u >= 0 && u <= 1 && v >= -.001 && v <= 1.001)) return false;
    result[0] = u;
    result[1] = clamp(v, 0, 1);
    return true;
  };
}

function warpPanels(ctx, image, original, fitted) {
  // A continuous quadrilateral per panel keeps grain and seams intact across the former triangle diagonal.
  const [[minX, minY], [maxX, maxY]] = panelBounds(fitted.flat(), ctx.canvas.width, ctx.canvas.height);
  const width = maxX - minX, height = maxY - minY;
  if (width < 1 || height < 1) return;
  const source = image.getContext('2d').getImageData(0, 0, image.width, image.height).data;
  const stage = tryOnLayer('panel');
  stage.width = width;
  stage.height = height;
  const target = stage.getContext('2d');
  const frame = target.createImageData(width, height);
  const pixel = frame.data;
  const uv = [0, 0];
  const mesh = smoothPanelRows(fitted, original);
  for (let row = 1; row < mesh.length; row++) {
    const [a, b] = mesh[row - 1].source, [c, d] = mesh[row].source;
    const corners = [...mesh[row - 1].target, ...mesh[row].target];
    const map = inversePanel(...corners);
    const [[left, top], [right, bottom]] = panelBounds(corners, ctx.canvas.width, ctx.canvas.height);
    for (let y = top; y < bottom; y++) {
      for (let x = left; x < right; x++) {
        if (!map(x + .5, y + .5, uv)) continue;
        const [u, v] = uv;
        const sourceX = ((a[0] + (b[0] - a[0]) * u) * (1 - v) + (c[0] + (d[0] - c[0]) * u) * v) * image.width / 1024 - .5;
        const sourceY = (a[1] + (c[1] - a[1]) * v) * image.height / 1536 - .5;
        samplePanel(source, image.width, sourceX, sourceY, pixel, ((y - minY) * width + x - minX) * 4);
      }
    }
  }
  target.putImageData(frame, 0, 0);
  ctx.drawImage(stage, minX, minY);
}

function smoothPanelRows(fitted, original) {
  const mesh = [{target: fitted[0], source: original[0]}];
  for (let row = 1; row < fitted.length; row++) {
    for (let step = 1; step <= 5; step++) {
      const t = step / 5;
      const target = [0, 1].map((side) => {
        const a = fitted[row - 1][side], b = fitted[row][side];
        const prev = fitted[Math.max(0, row - 2)][side], next = fitted[Math.min(fitted.length - 1, row + 1)][side];
        const x = a[0] + t * (.5 * (b[0] - prev[0]) +
          t * (prev[0] - 2.5 * a[0] + 2 * b[0] - .5 * next[0] +
          t * (.5 * (next[0] - prev[0]) + 1.5 * (a[0] - b[0]))));
        return [clamp(x, Math.min(a[0], b[0]), Math.max(a[0], b[0])), a[1] + (b[1] - a[1]) * t];
      });
      const source = [0, 1].map((side) => pointBetween(original[row - 1][side], original[row][side], t));
      mesh.push({target, source});
    }
  }
  return mesh;
}

function panelBounds(points, width, height) {
  const xs = points.map(([x]) => x), ys = points.map(([, y]) => y);
  return [[Math.max(0, Math.floor(Math.min(...xs))), Math.max(0, Math.floor(Math.min(...ys)))],
    [Math.min(width, Math.ceil(Math.max(...xs))), Math.min(height, Math.ceil(Math.max(...ys)))]];
}

function samplePanel(source, width, x, y, target, offset) {
  const col = Math.floor(x), row = Math.floor(y);
  const dx = x - col, dy = y - row;
  const nw = (row * width + col) * 4, ne = nw + 4, sw = nw + width * 4, se = sw + 4;
  const a = source[nw + 3] * (1 - dx) * (1 - dy), b = source[ne + 3] * dx * (1 - dy);
  const c = source[sw + 3] * (1 - dx) * dy, d = source[se + 3] * dx * dy;
  const alpha = a + b + c + d;
  if (alpha < 1) return;
  for (let channel = 0; channel < 3; channel++) {
    target[offset + channel] = (source[nw + channel] * a + source[ne + channel] * b +
      source[sw + channel] * c + source[se + channel] * d) / alpha;
  }
  target[offset + 3] = alpha;
}

function garmentRows(rows, left) {
  return rows.map(([y, min, max]) => left ? [[min, y], [max, y]] : [[1024 - max, y], [1024 - min, y]]);
}

function prepareTryOnDisplay(capture) {
  if (capture.display) return capture.display;
  const {photo, bounds, pose} = capture;
  const scale = Math.min(1, 1500 / Math.max(photo.width, photo.height));
  const frameW = photo.width * scale;
  const frameH = photo.height * scale;
  const top = Math.max(0, bounds.head - .068) * frameH;
  const bottom = Math.min(1, bounds.foot + .058) * frameH;
  const height = Math.round(bottom - top);
  const width = Math.round(Math.min(frameW, Math.max(height * .60, (bounds.right - bounds.left + .23) * frameW)));
  const left = clamp((bounds.left + bounds.right) * .5 * frameW - width / 2, 0, frameW - width);
  const point = (index) => [pose[index].x * frameW - left, pose[index].y * frameH - top];
  const photoFrame = makeCanvas(width, height);
  const ctx = photoFrame.getContext('2d');
  ctx.drawImage(photo, -left, -top, frameW, frameH);
  const light = makeCanvas(width, height);
  const lightCtx = light.getContext('2d');
  lightCtx.filter = 'grayscale(1) blur(9px)';
  lightCtx.drawImage(photoFrame, 0, 0);
  lightCtx.filter = 'none';
  lightCtx.fillStyle = '#808080ad';
  lightCtx.fillRect(0, 0, width, height);
  const edgeScale = Math.min(1, 240 / height);
  const edges = copyBodyFrame(photoFrame, width, height, Math.round(height * edgeScale));
  const pixels = edges.getContext('2d', {willReadFrequently: true}).getImageData(0, 0, edges.width, edges.height).data;
  const colorAt = (x, y) => {
    const col = clamp(Math.round(x * edges.width / width), 0, edges.width - 1);
    const row = clamp(Math.round(y * edges.height / height), 0, edges.height - 1);
    return (row * edges.width + col) * 4;
  };
  const contrast = (a, b) => Math.hypot(pixels[a] - pixels[b], pixels[a + 1] - pixels[b + 1], pixels[a + 2] - pixels[b + 2]);
  function studioBackground(x, y) {
    const leftA = colorAt(width * .028, y);
    const leftB = colorAt(width * .08, y);
    const rightA = colorAt(width * .972, y);
    const rightB = colorAt(width * .92, y);
    if (contrast(leftA, leftB) > 16 || contrast(rightA, rightB) > 16 || contrast(leftA, rightA) > 43) return null;
    const blend = clamp(x / width, 0, 1);
    return [0, 1, 2].map((channel) => pixels[leftA + channel] * (1 - blend) + pixels[rightA + channel] * blend);
  }
  function silhouetteEdge(center, direction, size, low, high) {
    let half = size;
    let edge = 27;
    const offset = Math.max(2, 1.5 / edgeScale);
    const candidate = (radius) => colorAt(center[0] + direction[0] * radius, center[1] + direction[1] * radius);
    const background = (radius) => {
      const x = center[0] + direction[0] * radius, y = center[1] + direction[1] * radius;
      const tint = studioBackground(x, y);
      const pixel = candidate(radius);
      return tint && Math.hypot(...tint.map((value, channel) => pixels[pixel + channel] - value)) < 24;
    };
    // Prefer the outside edge of clothing on an even background. Strong seams inside
    // a shirt or trousers can otherwise be mistaken for the edge of the person.
    for (let radius = size * high; radius >= size * low; radius -= offset / 2) {
      if (background(radius + offset * 1.5) && background(radius + offset * .5) &&
          background(radius - offset * .6) === false && background(radius - offset * 1.3) === false) {
        return radius + offset * .45;
      }
    }
    for (let radius = size * low; radius <= size * high; radius += offset / 2) {
      const strength = contrast(candidate(radius - offset), candidate(radius + offset));
      if (strength > edge) {
        edge = strength;
        half = radius;
      }
    }
    return half;
  }
  capture.display = {width, height, photoFrame, light, point, silhouetteEdge, studioBackground,
    safeTop: capture.faceBottom * frameH - top};
  return capture.display;
}

function fittedRow(display, center, direction, size, low = .75, high = 1.35) {
  const dx = direction[0];
  const dy = direction[1];
  const length = Math.max(1, Math.hypot(dx, dy));
  const normal = [Math.abs(dy) / length, -Math.sign(dy || 1) * dx / length];
  return [-1, 1].map((side) => {
    const half = display.silhouetteEdge(center, [normal[0] * side, normal[1] * side], size, low, high);
    return [center[0] + normal[0] * half * side, center[1] + normal[1] * half * side];
  });
}

const openJacketScale = (row) => 1 - .14 * clamp((row - .29) / .54, 0, 1);

function jacketPanelRows(rows, design, spread) {
  return rows.map(([y, ...columns]) => {
    const row = y / 1536;
    const stretch = 1 + jacketSilhouetteStretch(row, design.silhouette, design.shoulder);
    const opening = spread ? openJacketScale(row) : 1;
    return [y, ...columns.map((x) => (512 + (x - 512) * stretch) * opening)];
  });
}

function putSleeve(ctx, jacket, display, side, elbow, wrist, span, armhole, sourceRows, studioFit) {
  const left = side === 0;
  const original = garmentRows(sourceRows, left);
  const capCenter = pointBetween(...armhole, .5);
  const elbowY = Math.max(elbow[1], capCenter[1] + (wrist[1] - capCenter[1]) * .22);
  const drape = pointBetween(capCenter, wrist, clamp((elbowY - capCenter[1]) / Math.max(1, wrist[1] - capCenter[1]), 0, 1));
  const sleeveElbow = [pointBetween(elbow, drape, studioFit ? .58 : .35)[0], elbowY];
  const arm = [wrist[0] - capCenter[0], wrist[1] - capCenter[1]];
  const forearm = [wrist[0] - elbow[0], wrist[1] - elbow[1]];
  const fitted = [armhole,
    fittedRow(display, sleeveElbow, arm, span * (studioFit ? .15 : .16), .95, studioFit ? 1.09 : 1.17),
    fittedRow(display, pointBetween(sleeveElbow, wrist, .52), forearm, span * .135, .95, studioFit ? 1.14 : 1.24),
    fittedRow(display, pointBetween(elbow, wrist, studioFit ? .985 : .96), forearm,
      span * .109, .95, studioFit ? 1.13 : 1.28)];
  const inside = left ? 1 : 0;
  const inward = left ? 1 : -1;
  fitted[2][inside][0] += inward * span * .018;
  fitted[3][inside][0] += inward * span * .014;
  warpPanels(ctx, jacket, original, fitted);
}

function putTrousers(ctx, trousers, display, body, design) {
  const {hips, knees, ankles, span, hipCenter, torsoLength} = body;
  const cut = [1, .88, 1.17, .94][design.trouserFit];
  const halfHip = Math.abs(hips[1][0] - hips[0][0]) / 2;
  const waistY = hipCenter[1] - torsoLength * .14;
  for (const side of [0, 1]) {
    const sign = side === 0 ? -1 : 1;
    const original = garmentRows([[36, 274, 512], [305, 234, 512], [645, 239, 474],
      [989, 234, 446], [1363, 234, 432]], sign < 0);
    const hip = hips[side], knee = knees[side], ankle = ankles[side];
    const upper = [knee[0] - hip[0], knee[1] - hip[1]];
    const lower = [ankle[0] - knee[0], ankle[1] - knee[1]];
    const outside = hipCenter[0] + sign * Math.max(span * .46, halfHip + span * .17);
    const inner = [hipCenter[0], waistY];
    const outer = [outside, waistY];
    const thigh = pointBetween(hip, knee, .23);
    const thighRow = fittedRow(display, thigh, upper, span * .275, .9, 1.49);
    thighRow[side === 0 ? 1 : 0] = [hipCenter[0], thigh[1]];
    const kneeRow = fittedRow(display, knee, upper, span * .22 * cut, .9, 1.51);
    const fitted = [sign < 0 ? [outer, inner] : [inner, outer],
      thighRow, kneeRow,
      fittedRow(display, pointBetween(knee, ankle, .53), lower, span * .194 * cut, .88, 1.47),
      fittedRow(display, pointBetween(knee, ankle, 1.09), lower, span * .205 * cut, .92, 1.4)];
    warpPanels(ctx, trousers, original, fitted);
  }
}

function putJacket(ctx, jacket, display, body, design, vestOnly = false, spread = design.outfit === 2, studioFit = false) {
  const {elbows, wrists, shoulderCenter, hipCenter, torsoLength, knees, span} = body;
  const profile = [1, 1.035, .955][design.silhouette];
  // The studio two-piece samples the unscaled photograph. Apply the cut to the
  // fitted rows so it changes the silhouette without moving the source seams.
  const sourceDesign = studioFit ? {silhouette: 0, shoulder: 0} : design;
  const shoulderWidth = (width, y) => span * width * (studioFit
    ? 1 + jacketSilhouetteStretch(y / 1536, 0, design.shoulder)
    : 1);
  const torso = [hipCenter[0] - shoulderCenter[0], hipCenter[1] - shoulderCenter[1]];
  const armhole = pointBetween(shoulderCenter, hipCenter, .32);
  const hem = pointBetween(hipCenter, pointBetween(...knees, .5), .23);
  const neck = [shoulderCenter[0], Math.max(display.safeTop + 1, shoulderCenter[1] - torsoLength * .16)];
  // End the sleeve mesh in the source photo's air gap, so it cannot pull
  // a second strip of the jacket body down beside the cuff.
  const sleeveRows = jacketPanelRows([[730, 110, 261], [851, 94, 255],
    [1070, 74, 231], [1324, 71, 204]], sourceDesign, spread);
  const [joinY, outside, inside] = sleeveRows[0];
  const widthAtArmhole = span * .72;
  const shoulderRow = centeredRow(armhole, widthAtArmhole);
  const torsoRow = centeredRow(armhole, widthAtArmhole * (512 - inside) / (512 - outside));

  // Keep the photographed shoulder and sleeve cap in a single mesh. The three
  // lower panels meet on the same source and fitted row, without a second cap.
  const upper = [[300, 123], [390, 190], [450, 328], [490, 352], [600, 380], [joinY, 512 - outside]]
    .map(([y, half]) => centeredRow([512, y], half));
  warpPanels(ctx, jacket, upper, [
    centeredRow(neck, span * .21),
    centeredRow(pointBetween(neck, shoulderCenter, .40), span * .34),
    centeredRow(pointBetween(neck, shoulderCenter, .88), shoulderWidth(.565, 450)),
    centeredRow(pointBetween(shoulderCenter, armhole, .18), shoulderWidth(.635, 490)),
    centeredRow(pointBetween(shoulderCenter, armhole, .56), shoulderWidth(.68, 600)),
    shoulderRow,
  ]);
  if (!vestOnly) {
    putSleeve(ctx, jacket, display, 0, elbows[0], wrists[0], span, [shoulderRow[0], torsoRow[0]], sleeveRows, studioFit);
    putSleeve(ctx, jacket, display, 1, elbows[1], wrists[1], span, [torsoRow[1], shoulderRow[1]], sleeveRows, studioFit);
  }

  const original = [[joinY, inside], ...jacketPanelRows([[850, 267], [1050, 248], [1458, 196], [1500, 192]], sourceDesign, spread)]
    .map(([y, left]) => [[left, y], [1024 - left, y]]);
  const waist = pointBetween(shoulderCenter, hipCenter, .72);
  const chest = pointBetween(shoulderCenter, hipCenter, .48);
  const fitRow = (center, half, low, high) => {
    const row = fittedRow(display, center, torso, span * half * (studioFit ? 1 : profile), low, high);
    return studioFit ? row.map((point) => pointBetween(center, point, profile)) : row;
  };
  const fitted = [
    torsoRow,
    fitRow(chest, .44, .92, 1.13),
    fitRow(waist, .43, .91, 1.15),
    centeredRow(hem, span * .51 * profile),
    centeredRow([hem[0], hem[1] + torsoLength * .04], span * .51 * profile),
  ];
  warpPanels(ctx, jacket, original, fitted);
}

const studioVestOpening = 'M427 389 C422 530 421 598 399 701 Q375 854 361 1024 L337 1485 H687 L663 1024 Q649 854 625 701 C603 598 602 530 597 389 Q512 465 427 389Z';

function composeTryOnJacket(design, withWaistcoat, spread = false, shapeJacket = true) {
  const jacket = tryOnLayer('jacket');
  if (!paintGarmentPhoto(jacket, design, 'front', false, {open: withWaistcoat, garmentOnly: true, shapeJacket})) return null;
  if (!withWaistcoat) return jacket;
  const vest = tryOnLayer('vest');
  if (!paintGarmentPhoto(vest, design, 'waistcoat', false, {garmentOnly: true})) return null;
  const top = tryOnLayer('jacket-cut');
  const complete = tryOnLayer('torso');
  top.width = complete.width = jacket.width;
  top.height = complete.height = jacket.height;
  const front = top.getContext('2d');
  front.drawImage(jacket, 0, 0);
  front.scale(top.width / 1024, top.height / 1536);
  front.globalCompositeOperation = 'destination-out';
  front.fill(new Path2D(frontOpening));
  const layers = complete.getContext('2d');
  layers.scale(complete.width / 1024, complete.height / 1536);
  layers.save();
  layers.clip(new Path2D(spread ? studioVestOpening : frontOpening));
  layers.clip(new Path2D(vestOutline));
  layers.drawImage(vest, 0, 0, 1024, 1536);
  layers.restore();
  if (spread) {
    const half = top.width / 2;
    layers.resetTransform();
    for (let row = 0; row < top.height; row++) {
      const width = half * openJacketScale(row / top.height);
      const shift = half - width;
      layers.drawImage(top, 0, row, half, 1, 0, row, width, 1);
      layers.drawImage(top, half, row, half, 1, half + shift, row, width, 1);
    }
  } else {
    layers.drawImage(top, 0, 0, 1024, 1536);
  }
  return complete;
}

function coverSourceCloth(output, lighting, display, body, hasTrousers, vestOnly) {
  const {width, height, studioBackground} = display;
  const {span, ankles, hipCenter, knees, shoulderCenter, torsoLength} = body;
  const reach = Math.round(clamp(span * .11, 5, 30));
  const top = Math.max(0, Math.ceil(vestOnly ? hipCenter[1] : display.safeTop));
  const bottom = Math.min(height, Math.ceil(hasTrousers
    ? Math.max(...ankles.map((point) => point[1]))
    : pointBetween(hipCenter, pointBetween(...knees, .5), .23)[1] + span * .08));
  if (bottom <= top) return;
  const original = output.getImageData(0, top, width, bottom - top);
  const overlay = lighting.getContext('2d').getImageData(0, top, width, bottom - top).data;
  const pixels = original.data;
  const stride = width * 4;
  const reachSquared = reach * reach;
  const offsets = [-4, 4, -stride, stride];

  for (let y = 0; y < original.height; y++) {
    const imageY = y + top;
    const atCollar = imageY < shoulderCenter[1] + torsoLength * .27;
    // Edge recovery uses the photo's own backdrop as a guard against painting the room.
    const left = studioBackground(0, imageY);
    const right = studioBackground(width, imageY);
    if (!left || !right) continue;
    for (let x = 0; x < width; x++) {
      const index = y * stride + x * 4;
      if (overlay[index + 3] >= 240) continue;
      const r = pixels[index], g = pixels[index + 1], b = pixels[index + 2];
      if (r - g > 7 && r - b > 14) continue; // Keep exposed skin and fingers.
      if (atCollar && Math.abs(x - shoulderCenter[0]) < span * .23) continue;
      const blend = x / width;
      const bgR = left[0] + (right[0] - left[0]) * blend;
      const bgG = left[1] + (right[1] - left[1]) * blend;
      const bgB = left[2] + (right[2] - left[2]) * blend;
      const separation = (r - bgR) ** 2 + (g - bgG) ** 2 + (b - bgB) ** 2;
      if (separation < 28 ** 2) continue;
      const directions = [x, width - 1 - x, y, original.height - 1 - y];
      let match = -1;
      let matchDirection = 0;
      let distance = 1;
      for (; distance <= reach && match < 0; distance++) {
        for (let side = 0; side < offsets.length; side++) {
          if (distance > directions[side]) continue;
          const candidate = index + distance * offsets[side];
          if (overlay[candidate + 3] < 247) continue;
          const dr = r - pixels[candidate], dg = g - pixels[candidate + 1], db = b - pixels[candidate + 2];
          if (dr * dr + dg * dg + db * db > 54 ** 2 || Math.abs(dr - dg) > 16 || Math.abs(db - dg) > 19) continue;
          match = candidate;
          matchDirection = side;
          break;
        }
      }
      if (match < 0) continue;
      // Reflect into the garment instead of stretching one edge pixel across the old cloth.
      const depth = Math.min(distance - 2, directions[matchDirection] - (distance - 1));
      const reflected = match + depth * offsets[matchDirection];
      const sample = overlay[reflected + 3] >= 247 ? reflected : match;
      const drape = clamp((r + 2 * g + b + 80) / (pixels[match] + 2 * pixels[match + 1] + pixels[match + 2] + 80), .87, 1.12);
      const opacity = clamp((Math.sqrt(separation) - 24) / 15, 0, 1) *
        clamp((reachSquared - (distance - 1) ** 2) / reachSquared * 4, 0, 1);
      for (let channel = 0; channel < 3; channel++) {
        const color = (overlay[sample + channel] * .7 + overlay[match + channel] * .3) * drape;
        pixels[index + channel] += (color - pixels[index + channel]) * opacity;
      }
    }
  }
  output.putImageData(original, 0, top);
}

function paintBodyTryOn(canvas, design, {jacketHidden = false} = {}) {
  const capture = tryOnSession.capture;
  if (!capture) return false;
  const key = JSON.stringify(['body-try-on', tryOnSession.revision, design, clothAppearance(design), jacketHidden, studioPhotos.has('inside')]);
  if (renderedCanvases.get(canvas) === key) return true;
  const vest = tryOnLayer('vest');
  const jacket = jacketHidden ? (paintGarmentPhoto(vest, design, 'waistcoat', false, {garmentOnly: true}) ? vest : null)
    : composeTryOnJacket(design, design.outfit === 2, true);
  const trousers = tryOnLayer('trousers');
  if (!jacket || (design.outfit > 0 && !paintGarmentPhoto(trousers, design, 'trousers', false, {garmentOnly: true}))) return false;

  const display = prepareTryOnDisplay(capture);
  const {width, height, photoFrame, light, point, safeTop} = display;
  const sortSide = point(11)[0] < point(12)[0] ? [0, 1] : [1, 0];
  const body = Object.fromEntries(['shoulders', 'elbows', 'wrists', 'hips', 'knees', 'ankles'].map((part) =>
    [part, sortSide.map((side) => point(bodyPoints[part][side]))]));
  body.shoulderCenter = pointBetween(...body.shoulders, .5);
  body.hipCenter = pointBetween(...body.hips, .5);
  body.span = Math.abs(body.shoulders[1][0] - body.shoulders[0][0]);
  body.torsoLength = body.hipCenter[1] - body.shoulderCenter[1];

  const fabric = tryOnLayer('warped');
  fabric.width = width;
  fabric.height = height;
  const cloth = fabric.getContext('2d');
  cloth.imageSmoothingQuality = 'high';
  if (design.outfit > 0) putTrousers(cloth, trousers, display, body, design);
  putJacket(cloth, jacket, display, body, design, jacketHidden);
  cloth.clearRect(0, 0, width, Math.max(0, safeTop));
  const lighting = tryOnLayer('light');
  lighting.width = width;
  lighting.height = height;
  const relight = lighting.getContext('2d');
  relight.drawImage(fabric, 0, 0);
  relight.globalCompositeOperation = 'soft-light';
  relight.drawImage(light, 0, 0);
  relight.globalCompositeOperation = 'destination-in';
  relight.drawImage(fabric, 0, 0);

  canvas.width = width;
  canvas.height = height;
  const output = canvas.getContext('2d');
  output.drawImage(photoFrame, 0, 0);
  coverSourceCloth(output, lighting, display, body, design.outfit > 0, jacketHidden);
  output.drawImage(lighting, 0, 0);
  canvas.setAttribute('aria-label', `${fabrics[design.fabric].name} ${outfits[design.outfit].name.toLowerCase()} on your full-body photo, front view${jacketHidden ? ', jacket hidden' : ''}`);
  renderedCanvases.set(canvas, key);
  return true;
}

function clearBodyTryOn() {
  tryOnLayers.clear();
}

function paintBodyFocus(canvas, model, detail, source, capture) {
  if (!['front', 'trousers', 'waistcoat'].includes(source)) return false;
  const {point, width, height} = prepareTryOnDisplay(capture);
  const shoulders = [point(11), point(12)].sort((a, b) => a[0] - b[0]);
  const hips = [point(23), point(24)].sort((a, b) => a[0] - b[0]);
  const shoulder = pointBetween(...shoulders, .5);
  const hip = pointBetween(...hips, .5);
  const span = shoulders[1][0] - shoulders[0][0];
  const torso = hip[1] - shoulder[1];
  const regions = {
    lapel: [0, .29, 1.25, .72], lapelFinish: [0, .29, 1.25, .72],
    closure: [0, .72, 1.02, .78], button: [0, .72, 1.02, .77],
    breast: [.31, .40, .57, .47], square: [.31, .40, .57, .47],
    pocket: [-.32, .85, .56, .48], ticket: [-.32, .76, .55, .48],
    stitching: [-.31, .35, .56, .52], shoulder: [-.32, .13, .66, .5],
  };
  let region = regions[detail];
  if (!region && source === 'waistcoat') region = [0, .57, .72, .97];
  if (!region) return false;
  const [x, y, w, h] = region;
  const center = pointBetween(shoulder, hip, y);
  const cropW = Math.min(width, span * w);
  const cropH = Math.min(height, torso * h);
  const left = clamp(center[0] + x * span - cropW / 2, 0, width - cropW);
  const top = clamp(center[1] - cropH / 2, 0, height - cropH);
  const scale = Math.min(canvas.width / cropW, canvas.height / cropH);
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(model, left, top, cropW, cropH, (canvas.width - cropW * scale) / 2,
    (canvas.height - cropH * scale) / 2, cropW * scale, cropH * scale);
  return true;
}
