'use strict';

// Positions on the original 887 × 1774 studio photograph. The image is resized
// for delivery, so the fitting mesh uses normalized coordinates.
const studioModelPose = {
  11: [267, 364], 12: [613, 364], 13: [222, 638], 14: [657, 638],
  15: [223, 912], 16: [654, 912], 23: [322, 832], 24: [555, 832],
  25: [337, 1250], 26: [540, 1250], 27: [334, 1602], 28: [537, 1602],
};
let studioModelCapture;
let studioModelRequested = false;
let studioModelUnavailable = false;

function loadStudioModel(onLoad) {
  if (studioModelRequested) return;
  studioModelRequested = true;
  const image = new Image();
  image.onload = () => {
    const photo = makeCanvas(image.naturalWidth, image.naturalHeight);
    photo.getContext('2d').drawImage(image, 0, 0);
    const pose = Object.fromEntries(Object.entries(studioModelPose).map(([index, [x, y]]) =>
      [index, {x: x / 887, y: y / 1774}]));
    studioModelCapture = {photo, pose, bounds: {head: 0, foot: 1, left: .17, right: .81}, faceBottom: 267 / 1774};
    onLoad();
  };
  image.onerror = () => {
    studioModelUnavailable = true;
    onLoad();
  };
  image.src = studioModelImage;
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

function studioModelClothes(display) {
  if (studioModelCapture.clothes) return studioModelCapture.clothes;
  const {width, height, photoFrame} = display;
  const base = makeCanvas(width, height);
  const trousers = makeCanvas(width, height);
  const shirt = base.getContext('2d');
  const pants = trousers.getContext('2d');
  shirt.drawImage(photoFrame, 0, 0);
  const photo = shirt.getImageData(0, 0, width, height);
  const cloth = pants.createImageData(width, height);
  for (let y = Math.floor(height * .413); y < height * .928; y++) {
    const sourceY = y * 1774 / height;
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const sourceX = x * 887 / width;
      const tieHalf = Math.min(36, (788 - sourceY) * 1.12);
      // Keep blue-toned shadows on the white cuffs out of the trouser mask.
      if (sourceX < 250 || sourceX > 625 || Math.abs(sourceX - 443) < tieHalf ||
          photo.data[i] > 118 || photo.data[i + 2] - photo.data[i] < 6) continue;
      for (let c = 0; c < 4; c++) cloth.data[i + c] = photo.data[i + c];
      photo.data[i + 3] = 0;
    }
  }
  shirt.putImageData(photo, 0, 0);
  pants.putImageData(cloth, 0, 0);
  const trouserOnly = makeCanvas(width, height);
  studioModelCapture.clothes = {base, trousers, cloth, trouserOnly, fitKey: ''};
  return studioModelCapture.clothes;
}

function paintStudioModelTrousers(output, display, design) {
  const {base, trousers, cloth, trouserOnly} = studioModelClothes(display);
  if (!design.outfit) {
    output.drawImage(display.photoFrame, 0, 0);
    return;
  }
  const state = studioModelCapture.clothes;
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
    paintTrousers(ctx, {...design, trouserPocket: design.trouserPocket === 1 ? 1 : 2});
    ctx.restore();
    ctx.globalCompositeOperation = 'destination-in';
    ctx.drawImage(trousers, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    state.fitKey = key;
  }
  output.drawImage(base, 0, 0);
  drawTrouserFit(output, trouserOnly, design.trouserFit);
}

function paintStudioModel(canvas, design, garmentView) {
  if (!studioModelCapture) return false;
  const needsJacket = garmentView === 'jacket';
  const needsVest = design.outfit === 2 && garmentView !== 'shirt';
  const key = JSON.stringify(['studio-model', design, clothAppearance(design), garmentView]);
  if (renderedCanvases.get(canvas) === key) return true;
  let garment;
  if (needsJacket) {
    garment = composeTryOnJacket(design, needsVest, needsVest);
  } else if (needsVest) {
    garment = tryOnLayer('studio-vest');
    if (!paintGarmentPhoto(garment, design, 'waistcoat', false, {garmentOnly: true})) return false;
  }
  if ((needsJacket || needsVest) && !garment) return false;
  const display = prepareTryOnDisplay(studioModelCapture);
  const {width, height} = display;
  const body = studioModelBody(display);
  canvas.width = width;
  canvas.height = height;
  const output = canvas.getContext('2d');
  paintStudioModelTrousers(output, display, design);
  if (needsJacket) {
    // Keep the real collar and tie in the opening. The jacket supplies the
    // shoulders and sleeves, so the shirt cannot show through the armholes.
    output.save();
    output.scale(width / 887, height / 1774);
    const sleeveMask = new Path2D('M0 268H887V909H0Z M370 268H506Q530 310 532 345L521 909H356L351 345Q354 304 370 268Z');
    output.clip(sleeveMask, 'evenodd');
    output.clearRect(0, 268, 887, 641);
    output.restore();
  }
  if (garment) {
    const layer = tryOnLayer('studio-outerwear');
    layer.width = width;
    layer.height = height;
    const ctx = layer.getContext('2d');
    putJacket(ctx, garment, display, body, design, !needsJacket);
    ctx.clearRect(0, 0, width, display.safeTop);
    output.drawImage(layer, 0, 0);
  }
  const fabric = fabrics[design.fabric].name;
  const view = {jacket: outfits[design.outfit].name.toLowerCase(), waistcoat: 'waistcoat and trousers', shirt: 'shirt and trousers'}[garmentView];
  canvas.setAttribute('aria-label', `${fabric} ${view} on the studio model, front view`);
  renderedCanvases.set(canvas, key);
  return true;
}
