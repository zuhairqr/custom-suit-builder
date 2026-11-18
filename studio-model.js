'use strict';

// Positions on the original 887 × 1774 studio photograph. The image is resized
// for delivery, so the fitting mesh uses normalized coordinates.
const studioModelPose = {
  11: [267, 364], 12: [613, 364], 13: [222, 638], 14: [657, 638],
  15: [223, 912], 16: [654, 912], 23: [322, 832], 24: [555, 832],
  25: [337, 1250], 26: [540, 1250], 27: [334, 1602], 28: [537, 1602],
};
const studioModelCaptures = new Map();
const studioModelRequests = new Set();
const studioModelFailures = new Set();

function studioModelDirection(angle) {
  return angle === 'back' ? 'back' : 'front';
}

function loadStudioModel(direction, onLoad) {
  if (studioModelRequests.has(direction)) return;
  studioModelRequests.add(direction);
  const rear = direction === 'back';
  const image = new Image();
  image.onload = () => {
    const photo = makeCanvas(image.naturalWidth, image.naturalHeight);
    const photoContext = photo.getContext('2d');
    photoContext.drawImage(image, 0, 0);
    // The supplied cutout contains near-transparent chroma spill around hands,
    // cuffs and hair, and alpha 252–254 across otherwise solid fabric. Repeated
    // compositing amplified that fringe and punched tiny holes through cloth.
    const matte = photoContext.getImageData(0, 0, photo.width, photo.height);
    for (let i = 0; i < matte.data.length; i += 4) {
      const alpha = matte.data[i + 3];
      if (alpha < 12) matte.data.fill(0, i, i + 4);
      else if (alpha > 240) matte.data[i + 3] = 255;
    }
    photoContext.putImageData(matte, 0, 0);
    const pose = Object.fromEntries(Object.entries(studioModelPose).map(([index, [x, y]]) =>
      [index, {x: x / 887, y: y / 1774}]));
    studioModelCaptures.set(direction, {
      photo, pose, rear, bounds: {head: 0, foot: 1, left: .17, right: .81},
      faceBottom: (rear ? 245 : 267) / 1774,
    });
    onLoad();
  };
  image.onerror = () => {
    studioModelFailures.add(direction);
    onLoad();
  };
  image.src = rear ? studioRearModelImage : studioModelImage;
}

function studioModelBody(display) {
  const {point} = display;
  const body = Object.fromEntries(['shoulders', 'elbows', 'wrists', 'hips', 'knees', 'ankles'].map((part) =>
    [part, bodyPoints[part].map(point)]));
  body.shoulderCenter = pointBetween(...body.shoulders, .5);
  body.hipCenter = pointBetween(...body.hips, .5);
  body.span = body.shoulders[1][0] - body.shoulders[0][0];
  body.torsoLength = body.hipCenter[1] - body.shoulderCenter[1];
  return body;
}

function studioModelClothes(display, capture) {
  if (capture.clothes) return capture.clothes;
  const {width, height, photoFrame} = display;
  const base = makeCanvas(width, height);
  const trousers = makeCanvas(width, height);
  const shirt = base.getContext('2d');
  const pants = trousers.getContext('2d');
  shirt.drawImage(photoFrame, 0, 0);
  const photo = shirt.getImageData(0, 0, width, height);
  const cloth = pants.createImageData(width, height);
  const trouserEnd = capture.rear ? .938 : .928;
  for (let y = Math.floor(height * .413); y < height * trouserEnd; y++) {
    const sourceY = y * 1774 / height;
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const sourceX = x * 887 / width;
      const tieHalf = capture.rear ? 0 : Math.min(36, (788 - sourceY) * 1.12);
      // Keep blue-toned shadows on the white cuffs out of the trouser mask.
      if (sourceX < 250 || sourceX > 625 || Math.abs(sourceX - 443) < tieHalf ||
          photo.data[i] > 118 || (photo.data[i + 2] - photo.data[i] < 6 && !(Math.max(photo.data[i], photo.data[i + 1], photo.data[i + 2]) < 65 && photo.data[i + 2] >= photo.data[i] - 4))) continue;
      for (let c = 0; c < 4; c++) cloth.data[i + c] = photo.data[i + c];
      photo.data[i + 3] = 0;
    }
  }
  shirt.putImageData(photo, 0, 0);
  pants.putImageData(cloth, 0, 0);
  const trouserOnly = makeCanvas(width, height);
  capture.clothes = {base, trousers, cloth, trouserOnly, fitKey: ''};
  return capture.clothes;
}

function paintStudioModelTrousers(output, display, design, capture) {
  if (!design.outfit) {
    output.drawImage(display.photoFrame, 0, 0);
    return;
  }
  const state = studioModelClothes(display, capture);
  const {base, trousers, cloth, trouserOnly} = state;
  const key = JSON.stringify([garmentSettings.trousers.map((name) => design[name]), photoCloth(design.fabric)]);
  if (state.fitKey !== key) {
    const ctx = trouserOnly.getContext('2d');
    const frame = ctx.createImageData(cloth.width, cloth.height);
    const {pixels, average} = clothTile(design.fabric);
    const patterned = /window|plaid|check|prince|gunclub|stripe|houndstooth/.test(fabrics[design.fabric].weave);
    const texture = patterned ? .88 : .72;
    for (let i = 0; i < cloth.data.length; i += 4) {
      const alpha = cloth.data[i + 3];
      if (!alpha) continue;
      const pixel = i / 4;
      const x = pixel % cloth.width;
      const y = Math.floor(pixel / cloth.width);
      const sample = ((y % tileSize) * tileSize + x % tileSize) * 4;
      const light = clamp(Math.pow((cloth.data[i] + 2 * cloth.data[i + 1] + cloth.data[i + 2]) / 161, .68), .37, 1.33);
      for (let c = 0; c < 3; c++) {
        frame.data[i + c] = (average[c] + (pixels[sample + c] - average[c]) * texture) * light;
      }
      frame.data[i + 3] = alpha;
    }
    ctx.putImageData(frame, 0, 0);
    ctx.save();
    ctx.scale(cloth.width / 887, cloth.height / 1774);
    ctx.translate(104, 711);
    ctx.scale(.66, .67);
    // Preserve photographed seams for the standard cut. Add the selected
    // construction over them only when the customer changes it.
    paintTrousers(ctx, {...design, trouserPocket: design.trouserPocket === 1 ? 1 : 2}, capture.rear);
    ctx.restore();
    ctx.globalCompositeOperation = 'destination-in';
    ctx.drawImage(trousers, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    state.fitKey = key;
  }
  output.drawImage(base, 0, 0);
  drawStudioTrouserFit(output, trouserOnly, display, design);
  return trouserOnly;
}

function drawStudioTrouserFit(output, trousers, display, design) {
  if (!design.outfit) {
    drawTrouserFit(output, trousers, design.trouserFit);
    return;
  }
  const ankleCenters = bodyPoints.ankles.map((index) => display.point(index)[0]);
  drawTrouserFit(output, trousers, design.trouserFit, .65, ankleCenters);
}

function shapeClosedStudioJacket(jacket, closure) {
  const layer = tryOnLayer('studio-closed-jacket');
  layer.width = jacket.width;
  layer.height = jacket.height;
  const output = layer.getContext('2d');
  output.scale(layer.width / 1024, layer.height / 1536);
  const hemCurve = doubleStances.has(closure)
    ? 'C819 1401 801 1422 772 1435 Q702 1458 437 1457 Q425 1456 423 1450 Q304 1456 254 1435 C222 1427 209 1402 208 1355'
    : 'C817 1406 796 1433 760 1441 Q672 1458 578 1444 Q529 1435 512 1394 Q494 1435 445 1444 Q351 1458 264 1441 C229 1433 208 1406 208 1355';
  output.save();
  output.clip(new Path2D(`M0 0H1024V1355H816 ${hemCurve} H0Z`));
  output.drawImage(jacket, 0, 0, 1024, 1536);
  output.restore();
  output.globalCompositeOperation = 'source-atop';
  output.translate(0, -2.5);
  ink(output, `M816 1355 ${hemCurve}`, '#0b142773', 5);
  return layer;
}

function studioGarmentAssets(angle, garmentView, outfit) {
  if (garmentView === 'shirt') return [];
  const vest = angle === 'back' ? 'waistcoatBack' : 'waistcoat';
  if (garmentView === 'waistcoat') return [vest];
  return angle !== 'back' && outfit === 2 ? [angle, vest] : [angle];
}

function closedStudioJacket(design) {
  const jacket = tryOnLayer('studio-jacket-source');
  if (!paintGarmentPhoto(jacket, design, 'front', false, {garmentOnly: true, shapeJacket: false})) return null;
  const closed = shapeClosedStudioJacket(jacket, design.closure);
  if (design.outfit !== 2) return closed;
  const vest = tryOnLayer('studio-vest-source');
  if (!paintGarmentPhoto(vest, design, 'waistcoat', false, {garmentOnly: true})) return null;
  const complete = tryOnLayer('studio-closed-three-piece');
  complete.width = closed.width;
  complete.height = closed.height;
  const output = complete.getContext('2d');
  output.save();
  output.scale(complete.width / 1024, complete.height / 1536);
  // A waistcoat sits behind the jacket, visible only in the lapel opening.
  // Cutting the whole front open mixes both garments' button rows and hems.
  output.beginPath(); output.rect(380, 320, 264, 505); output.clip();
  output.drawImage(vest, 0, 0, 1024, 1536);
  output.restore();
  output.drawImage(closed, 0, 0);
  return complete;
}

function maskStudioShirtShoulders(output, display, capture) {
  if (capture.rear) return;
  if (!capture.neckShirtMask) {
    const {width, height, photoFrame} = display;
    const source = photoFrame.getContext('2d').getImageData(0, 0, width, height).data;
    const collar = makeCanvas(width, height), ctx = collar.getContext('2d');
    ctx.scale(width / 887, height / 1774);
    // Preserve the real shirt collar around the neck and knot. The original
    // shirt's shoulder fabric outside it must not dictate the jacket neckline.
    ctx.fill(new Path2D('M378 245Q443 294 508 245L514 282L491 346L443 312L395 346L372 282Z'));
    const allowed = ctx.getImageData(0, 0, width, height).data;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, width, height);
    ctx.scale(width / 887, height / 1774);
    ctx.fill(new Path2D('M370 0H516V240Q506 276 443 302Q384 277 370 240Z'));
    const skin = ctx.getImageData(0, 0, width, height).data;
    const mask = new Uint8Array(width * height);
    for (let y = Math.floor(height * 240 / 1774); y < height * 335 / 1774; y++) {
      for (let x = Math.floor(width * 325 / 887); x < width * 560 / 887; x++) {
        const sx = x * 887 / width;
        // Never remove central neck/chin pixels, including neutral beard
        // highlights that could otherwise be mistaken for white fabric.
        if (sx >= 392 && sx <= 495) continue;
        const px = y * width + x, i = px * 4;
        // Remove the whole photographed shirt edge, including its grey
        // antialiasing fringe, while protecting the anatomical neck silhouette.
        const warmSkin = source[i] > source[i + 2] + 30 && source[i] > source[i + 1] + 10;
        if (source[i + 3] && !warmSkin) mask[px] = (255 - allowed[i + 3]) * (1 - skin[i + 3] / 255);
      }
    }
    capture.neckShirtMask = mask;
  }
  const frame = output.getImageData(0, 0, display.width, display.height);
  const mask = capture.neckShirtMask;
  for (let px = 0; px < mask.length; px++) {
    if (mask[px]) frame.data[px * 4 + 3] *= 1 - mask[px] / 255;
  }
  output.putImageData(frame, 0, 0);
}

function paintStudioGarment(design, angle, garmentView) {
  const [primary, secondary] = studioGarmentAssets(angle, garmentView, design.outfit);
  if (!primary) return null;
  if (angle === 'front' && garmentView === 'jacket') {
    return closedStudioJacket(design);
  }
  const garment = tryOnLayer('studio-angle-garment');
  if (!paintGarmentPhoto(garment, design, primary, false, {garmentOnly: true, shapeJacket: garmentView !== 'jacket'})) return null;
  if (!secondary) return garment;

  const vest = tryOnLayer('studio-inside-waistcoat');
  if (!paintGarmentPhoto(vest, design, secondary, false, {garmentOnly: true})) return null;
  const layered = tryOnLayer('studio-inside-jacket');
  layered.width = garment.width;
  layered.height = garment.height;
  const output = layered.getContext('2d');
  output.scale(layered.width / 1024, layered.height / 1536);
  output.save();
  output.clip(new Path2D(insideOpening));
  output.clip(new Path2D(vestOutline));
  output.drawImage(vest, 0, 0, 1024, 1536);
  output.restore();
  output.drawImage(garment, 0, 0, 1024, 1536);
  return layered;
}

function paintStudioHands(output, display, capture) {
  if (!capture.hands) {
    const {width, height} = display;
    const source = display.photoFrame.getContext('2d').getImageData(0, 0, width, height);
    const hands = makeCanvas(width, height), ctx = hands.getContext('2d');
    const pixels = ctx.createImageData(width, height);
    const body = studioModelBody(display);
    for (const wrist of body.wrists) {
      for (let y = Math.max(0, Math.floor(wrist[1])); y < Math.min(height, wrist[1] + body.torsoLength * .48); y++) {
        for (let x = Math.max(0, Math.floor(wrist[0] - body.span * .2)); x < Math.min(width, wrist[0] + body.span * .2); x++) {
          const i = (y * width + x) * 4;
          const r = source.data[i], g = source.data[i + 1], b = source.data[i + 2];
          if (source.data[i + 3] && r > g + 5 && r > b + 12) pixels.data.set(source.data.subarray(i, i + 4), i);
        }
      }
    }
    ctx.putImageData(pixels, 0, 0);
    capture.hands = hands;
  }
  output.drawImage(capture.hands, 0, 0);
}

function paintStudioModel(canvas, design, angle, garmentView, faceId) {
  const capture = studioModelCaptures.get(studioModelDirection(angle));
  const face = studioFaces.find(({id}) => id === faceId);
  const portraits = capture?.rear ? studioRearPortraits : studioPortraits;
  if (!capture || (face?.crop && !portraits)) return false;
  const needsJacket = garmentView === 'jacket';
  const key = JSON.stringify(['studio-model', design, clothAppearance(design), angle, garmentView, faceId]);
  if (renderedCanvases.get(canvas) === key) return true;
  const garment = paintStudioGarment(design, angle, garmentView);
  if (garmentView !== 'shirt' && !garment) return false;
  const display = prepareTryOnDisplay(capture);
  const {width, height} = display;
  const body = studioModelBody(display);
  canvas.width = width;
  canvas.height = height;
  const output = canvas.getContext('2d');
  const trousers = paintStudioModelTrousers(output, display, design, capture);
  if (face?.crop) paintStudioFace(output, width, height, face, capture.rear);
  if (needsJacket) {
    // Keep the real collar and tie in the opening. The jacket supplies the
    // shoulders and sleeves, so the shirt cannot show through the armholes.
    output.save();
    output.scale(width / 887, height / 1774);
    const collarOpening = capture.rear
      ? 'M371 278H516L539 318H348Z'
      : 'M370 268H506Q530 310 532 345L521 909H356L351 345Q354 304 370 268Z';
    const sleeveMask = new Path2D(`M0 ${capture.rear ? 278 : 268}H887V909H0Z ${collarOpening}`);
    output.clip(sleeveMask, 'evenodd');
    output.clearRect(0, 268, 887, 641);
    output.restore();
    maskStudioShirtShoulders(output, display, capture);
  }
  if (needsJacket) {
    // The front quarters and rear vents can also reveal the trousers. Clearing
    // the shirt sleeves above removed this underlay, leaving transparent slits.
    output.save();
    output.globalCompositeOperation = 'destination-over';
    if (trousers) drawStudioTrouserFit(output, trousers, display, design);
    else {
      // Jacket-only looks keep the photographed trousers below the hip, without
      // restoring the shirt sleeves that the outerwear replaces.
      output.beginPath();
      output.rect(body.hipCenter[0] - body.span * .48, body.hipCenter[1], body.span * .96, height - body.hipCenter[1]);
      output.clip();
      output.drawImage(display.photoFrame, 0, 0);
    }
    output.restore();
  }
  if (garment) {
    const layer = tryOnLayer('studio-outerwear');
    layer.width = width;
    layer.height = height;
    const ctx = layer.getContext('2d');
    putJacket(ctx, garment, display, body, design, !needsJacket, false, needsJacket, angle);
    ctx.clearRect(0, 0, width, display.safeTop);
    output.drawImage(layer, 0, 0);
  }
  if (needsJacket) paintStudioHands(output, display, capture);
  const fabric = fabrics[design.fabric].name;
  const view = {jacket: outfits[design.outfit].name.toLowerCase(), waistcoat: 'waistcoat and trousers', shirt: 'shirt and trousers'}[garmentView];
  canvas.setAttribute('aria-label', `${fabric} ${view} on the studio model, ${angle} view${face?.crop ? `, ${face.name}` : ''}`);
  renderedCanvases.set(canvas, key);
  return true;
}
