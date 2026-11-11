'use strict';

const clothTiles = new Map();
const clothSamples = new Map();
const tileSize = 144;

function clothAverage(pixels) {
  const sum = [0, 0, 0];
  for (let index = 0; index < pixels.length; index += 4) {
    for (let channel = 0; channel < 3; channel++) sum[channel] += pixels[index + channel];
  }
  return sum.map((value) => value / (pixels.length / 4));
}

function rgb(hex) {
  return [1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16));
}

function requestClothSample(index) {
  const {scan, code} = fabrics[index];
  const source = scan ? scannedClothSources[scan] : photoClothSources[code];
  if (!source || clothSamples.has(index)) return;
  clothSamples.set(index, null);
  const photo = new Image();
  photo.onload = () => {
    const tile = makeCanvas(tileSize, tileSize);
    const ctx = tile.getContext('2d');
    ctx.drawImage(photo, 0, 0, tileSize, tileSize);
    const pixels = ctx.getImageData(0, 0, tileSize, tileSize).data;
    clothSamples.set(index, {tile, pixels, average: clothAverage(pixels), image: photo});
    clothTiles.delete(index);
    document.dispatchEvent(new CustomEvent('cloth-sample-ready', {detail: index}));
  };
  photo.src = source;
}

function paintClothMacro(canvas, index) {
  const sample = clothSamples.get(index);
  if (!fabrics[index].scan || !sample) {
    paintCloth(canvas, index, 3);
    return;
  }
  const {image} = sample;
  const {width, height} = canvas;
  const cropHeight = image.naturalWidth * height / width;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(image, 0, (image.naturalHeight - cropHeight) / 2,
    image.naturalWidth, cropHeight, 0, 0, width, height);
}

function photoCloth(index) {
  return Boolean(clothSamples.get(index));
}

function clothAppearance(design) {
  return [photoCloth(design.fabric), photoCloth(vestContrast[design.vestCloth] ?? design.fabric)];
}

function clothTile(index) {
  const sample = clothSamples.get(index);
  if (sample) return sample;
  requestClothSample(index);
  const cached = clothTiles.get(index);
  if (cached) {
    clothTiles.delete(index);
    clothTiles.set(index, cached);
    return cached;
  }

  const {color, thread, weave, material, scale = 1} = fabrics[index];
  const density = scale <= .82 ? 2 : scale >= 1.25 ? .5 : 1;
  const slub = /linen/i.test(material);
  const brushed = /flannel|velvet|tweed/i.test(material);
  const base = rgb(color);
  const yarn = rgb(thread);
  const tile = document.createElement('canvas');
  tile.width = tile.height = tileSize;
  const ctx = tile.getContext('2d');

  // Enhanced fabric generation with better realism
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, tileSize, tileSize);

  const texture = ctx.createImageData(tileSize, tileSize);

  for (let y = 0; y < tileSize; y++) {
    for (let x = 0; x < tileSize; x++) {
      const offset = (y * tileSize + x) * 4;
      const seed = ((Math.imul(x + 3, 1597334677) ^ Math.imul(y + 7, 3812015801)) >>> 0);
      const grain = ((seed ^ (seed >>> 13)) % 101 + 101) % 101 / 100 - 0.5;
      const warp = ((x + (y % 4 < 2 ? 1 : 0)) % 4) < 2 ? 1 : -1;
      const fill = ((y + (x % 4 < 2 ? 1 : 0)) % 4) < 2 ? 1 : -1;
      const fibre = grain * (brushed ? 31 : 22) + warp * 5 + fill * 3;
      const u = Math.floor(x * density);
      const v = Math.floor(y * density);
      let tint = 0;

      switch (weave) {
        case 'window': {
          const check = Math.min((u + 5) % 72, (v + 5) % 72);
          tint = check < 2 ? 0.60 : check < 4 ? 0.19 : 0;
          break;
        }
        case 'herringbone': {
          const stripe = u % 12;
          const diagonal = (v + Math.min(stripe, 12 - stripe)) % 6;
          tint = diagonal < 2 ? 0.25 : diagonal === 2 ? 0.10 : -0.12;
          break;
        }
        case 'plaid': {
          const warpCheck = u % 72;
          const fillCheck = v % 72;
          tint = (warpCheck < 13 ? .24 : warpCheck < 17 ? .52 : 0) + (fillCheck < 13 ? .23 : fillCheck < 17 ? .45 : 0);
          tint += ((x + y) % 8 < 4 ? .10 : -.13);
          break;
        }
        case 'prince':
          tint = (u % 36 < 7 ? .22 : 0) + (v % 36 < 7 ? .22 : 0) + (Math.min(u % 72, v % 72) < 2 ? .42 : 0);
          break;
        case 'gunclub':
          tint = (u % 24 < 5 ? .40 : 0) + (v % 24 < 5 ? .25 : 0) + ((u + v) % 8 < 3 ? .10 : -.07);
          break;
        case 'houndstooth': {
          const a = u % 12;
          const b = v % 12;
          tint = (a < 6 && b < 6) || ((a + b) % 6 < 3 && (a < 6 || b < 6)) ? .62 : -.09;
          break;
        }
        case 'shark':
          tint = (u + 2 * v) % 6 < 2 ? 0.25 : -0.10;
          break;
        case 'bird': {
          const eyeX = (u + (v % 12 < 6 ? 0 : 3)) % 6 - 2.5;
          const eyeY = v % 6 - 2.5;
          tint = eyeX * eyeX + eyeY * eyeY < 4 ? 0.36 : -0.07;
          break;
        }
        case 'stripe':
          tint = u % 36 < 2 ? (v % 6 < 5 ? 0.63 : 0.25) : 0;
          break;
        case 'pinstripe':
          tint = u % 24 < 1 ? .61 : -.035;
          break;
        case 'basket':
          tint = (u % 6 < 3) === (v % 6 < 3) ? 0.17 : -0.11;
          tint += u % 24 === 0 || v % 18 === 0 ? 0.16 : 0;
          break;
        case 'barathea':
          tint = (u + v * 2) % 9 < 3 ? .18 : -.105;
          break;
        case 'silk-basket':
          tint = (u % 8 < 4) === (v % 8 < 4) ? .24 : -.08;
          tint += Math.sin((u - v) * Math.PI / 12) * .08;
          break;
        case 'seersucker':
          tint = u % 24 < 8 ? 0.65 : 0.03;
          tint += Math.sin(u * Math.PI / 4) * 0.08;
          break;
        case 'cord':
          tint = Math.cos(u * Math.PI / 4) * 0.24;
          break;
        case 'twill':
          tint = (u + v) % 6 < 2 ? .20 : -.06;
          break;
        case 'linen':
          tint = u % 24 < 2 || v % 18 < 2 ? .31 : (u % 4 === v % 4 ? .14 : -.055);
          break;
        case 'velvet':
          tint = Math.sin(v * Math.PI / 12) * .12 + grain * .2;
          break;
        default:
          tint = Math.sin((x + y) * Math.PI / 12) * 0.035;
      }
      if (slub && weave !== 'linen' && (x % 24 === 0 || (y % 18 === 1 && x % 36 > 23))) tint += .16;

      for (let channel = 0; channel < 3; channel++) {
        texture.data[offset + channel] = base[channel] + (yarn[channel] - base[channel]) * tint + fibre;
      }
      texture.data[offset + 3] = 255;
    }
  }

  ctx.putImageData(texture, 0, 0);
  const result = {tile, pixels: texture.data, average: clothAverage(texture.data)};
  clothTiles.set(index, result);
  if (clothTiles.size > 42) clothTiles.delete(clothTiles.keys().next().value);
  return result;
}

function paintCloth(canvas, index, magnification) {
  const ctx = canvas.getContext('2d');
  const {tile} = clothTile(index);
  const pattern = ctx.createPattern(tile, 'repeat');
  ctx.save();
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.scale(magnification, magnification);
  ctx.fillStyle = pattern;
  ctx.fillRect(0, 0, canvas.width / magnification, canvas.height / magnification);
  ctx.restore();
}

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const studioPhotos = new Map();
const renderedCanvases = new WeakMap();
const garmentSettings = Object.fromEntries(Object.keys(pieces).map((piece) => [
  piece, ['fabric', ...Object.keys(styleGroups).filter((key) => stylePiece(key) === piece || key === 'button')],
]));
garmentSettings.jacket.push('monogramText');
garmentSettings.waistcoat.push('lining');

function makeCanvas(width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function loadGarmentPhoto(angle, source) {
  const photo = new Image();
  return new Promise((resolve, reject) => {
    photo.onerror = () => reject(new Error(`Could not load ${angle} photograph`));
    photo.onload = () => {
      try {
        const width = photo.naturalWidth;
        const height = photo.naturalHeight;
        const sourceCanvas = makeCanvas(width, height);
        const ctx = sourceCanvas.getContext('2d', {willReadFrequently: true});
        ctx.drawImage(photo, 0, 0);
        const base = ctx.getImageData(0, 0, width, height).data;
        const pixels = width * height;
        const mask = new Int8Array(pixels);
        const shade = new Float32Array(pixels);
        const tileOffsets = new Uint16Array(pixels);

        for (let i = 0; i < base.length; i += 4) {
          const r = base[i];
          const g = base[i + 1];
          const b = base[i + 2];
          if (base[i + 3] < 6) continue;
          const liningMask = angle === 'inside' ? clamp((r - b - 8) / 16, 0, 1) * clamp((r - g - 9) / 16, 0, 1) : 0;
          const woolMask = clamp((b - g - 3) / 13, 0, 1) * clamp((b - r - 5) / 13, 0, 1);
          if (!liningMask && !woolMask) continue;

          const px = i / 4;
          const x = px % width;
          const y = Math.floor(px / width);
          const chestTaper = 1 + 0.04 * Math.sin(y * 0.011);
          const tx = (Math.floor((x - width / 2) * chestTaper * 0.82) + tileSize * 10) % tileSize;
          const ty = Math.floor(y * 0.82 + Math.abs(x - width / 2) * 0.028) % tileSize;
          const light = liningMask ? (r * .72 + g * .23 + b * .05) / 78 : (r * .24 + g * .62 + b * .14) / 49;
          mask[px] = Math.round(liningMask ? -127 * liningMask : 127 * woolMask);
          shade[px] = clamp(Math.pow(light, .76), .19, 1.78);
          tileOffsets[px] = ty * tileSize + tx;
        }

        studioPhotos.set(angle, {image: photo, width, height, base, mask, shade, tileOffsets, materialCanvas: sourceCanvas, composition: makeCanvas(width, height)});
        resolve();
      } catch (error) {
        reject(error);
      }
    };
    photo.src = source;
  });
}

const mannequinTones = [null, '#efc6a8', '#c89373', '#a57455', '#774d39', '#53352c'];

function mannequinSkinPixel(x, y, angle) {
  if (angle.startsWith('trousers')) return y > 1370;
  const head = x > 362 && x < 666 && (y < 322 || (y < 420 && x > 421 && x < 603));
  const hands = y > 1190 && (x < 209 || x > 815);
  return head || hands;
}

function paintMaterials(photo, design, angle, split, skinTone = 0) {
  const fabricIndex = angle.startsWith('waistcoat') ? vestContrast[design.vestCloth] ?? design.fabric : design.fabric;
  const satinColor = angle === 'waistcoatBack' ? [null, fabrics[fabricIndex].color, waistcoatLining(design)][design.vestBack] : null;
  const sample = photoCloth(fabricIndex);
  const key = `${fabricIndex}/${sample}/${split}/${skinTone}/${angle === 'inside' ? [design.lining, design.liningCoverage] : satinColor}`;
  if (photo.materialKey === key) return;
  const {width, height, base, mask, shade, tileOffsets, materialCanvas} = photo;
  const ctx = materialCanvas.getContext('2d');
  const frame = ctx.createImageData(width, height);
  frame.data.set(base);
  const selected = clothTile(fabricIndex);
  const comparison = split ? clothTile(1) : selected;
  const patterned = /^(window|plaid|prince|gunclub|houndstooth|stripe|pinstripe|seersucker)$/;
  const selectedTexture = patterned.test(fabrics[fabricIndex].weave) ? .77 : sample ? .78 : .57;
  const selectedMatte = /flannel|tweed|linen/i.test(fabrics[fabricIndex].material);
  const comparisonMatte = split ? false : selectedMatte;
  const lining = liningColors[design.lining] ? rgb(liningColors[design.lining]) : null;
  const satin = satinColor ? rgb(satinColor) : null;
  const liningLimit = [height, height * 918 / 1536, 0][design.liningCoverage] * width;
  const tone = mannequinTones[skinTone] && rgb(mannequinTones[skinTone]);

  for (let px = 0; px < mask.length; px++) {
    const i = px * 4;
    if (!mask[px]) {
      if (tone && base[i + 3] > 5 && mannequinSkinPixel((px % width) * 1024 / width, Math.floor(px / width) * 1536 / height, angle)) {
        const [r, g, b] = [base[i], base[i + 1], base[i + 2]];
        if (Math.max(r, g, b) - Math.min(r, g, b) < 32) {
          const light = clamp(Math.pow((r + 2 * g + b) / 860, .82), .24, 1.18);
          for (let channel = 0; channel < 3; channel++) frame.data[i + channel] = tone[channel] * light;
        }
      }
      continue;
    }
    const opacity = Math.abs(mask[px]) / 127;
    const solid = satin || (mask[px] < 0 && px < liningLimit && lining);
    const left = px % width < width / 2;
    const cloth = left ? comparison : selected;
    const texture = left && split ? .57 : selectedTexture;
    const index = tileOffsets[px] * 4;
    const light = shade[px];
    const matte = !solid && (left ? comparisonMatte : selectedMatte);
    const fromPhoto = sample && !solid && !(left && split);
    const fold = fromPhoto ? clamp(light, .27, 1.62) : light;
    const drape = matte && fold > 1 ? 1 + (fold - 1) * .68 : fold;
    for (let channel = 0; channel < 3; channel++) {
      const color = solid ? solid[channel]
        : cloth.average[channel] + (cloth.pixels[index + channel] - cloth.average[channel]) * texture;
      const shaded = color * drape;
      frame.data[i + channel] = base[i + channel] * (1 - opacity) + shaded * opacity;
    }
  }
  ctx.putImageData(frame, 0, 0);
  photo.materialKey = key;
}

function jacketSilhouetteStretch(row, fit, shoulder) {
  const position = clamp((row - .27) / .59, 0, 1);
  const shoulderBand = clamp((row - .21) / .26, 0, 1);
  return [0, .105, -.105][fit] * Math.sin(position * Math.PI) ** 2 +
    [0, .015, -.044, .040, .048, .088][shoulder] * Math.sin(shoulderBand * Math.PI) ** 2;
}

function applySilhouette(ctx, source, fit, shoulder = 0) {
  const {width, height} = source;
  if (fit === 0 && shoulder === 0) {
    ctx.drawImage(source, 0, 0);
    return;
  }
  // Taper only the jacket area. The head and hands retain the source proportions.
  for (let y = 0; y < height; y += 2) {
    const row = Math.min(2, height - y);
    const stretch = width * jacketSilhouetteStretch(y / height, fit, shoulder);
    ctx.drawImage(source, 0, y, width, row, -stretch / 2, y, width + stretch, row);
  }
}

function removePortraitTrousers(layer, photo, hem) {
  if (!photo.porcelainMask) {
    const {width, height, mask, base} = photo;
    const canvas = makeCanvas(width, height);
    const ctx = canvas.getContext('2d');
    const frame = ctx.createImageData(width, height);
    const left = Math.floor(width * 214 / 1024);
    const right = width - left;
    for (let y = Math.floor(height * hem / 1536); y < height; y++) {
      for (let x = left; x < right; x++) {
        const pixel = y * width + x;
        const i = pixel * 4;
        if (mask[pixel] < 25 && mask[pixel] >= 0 && Math.min(base[i], base[i + 1], base[i + 2]) > 65) {
          frame.data[i + 3] = Math.round(255 * (1 - mask[pixel] / 25));
        }
      }
    }
    ctx.putImageData(frame, 0, 0);
    photo.porcelainMask = canvas;
  }
  layer.save();
  layer.globalCompositeOperation = 'destination-out';
  layer.drawImage(photo.porcelainMask, 0, 0);
  layer.restore();
}

function isolatePhotoCloth(ctx, photo) {
  if (!photo.clothAlpha) {
    const alpha = makeCanvas(photo.width, photo.height);
    const target = alpha.getContext('2d');
    const frame = target.createImageData(photo.width, photo.height);
    for (let px = 0; px < photo.mask.length; px++) {
      const i = px * 4;
      const fabric = Math.abs(photo.mask[px]);
      frame.data[i + 3] = photo.base[i + 3] * clamp(fabric / 45, 0, 1);
    }
    target.putImageData(frame, 0, 0);
    photo.clothAlpha = alpha;
  }
  ctx.save();
  ctx.globalCompositeOperation = 'destination-in';
  ctx.drawImage(photo.clothAlpha, 0, 0, 1024, 1536);
  ctx.restore();
}

function paintGarmentPhoto(canvas, design, angle, split, {thumbnail = false, open = false, face = false, fullBody = false, garmentOnly = false, skinTone = 0} = {}) {
  const photo = studioPhotos.get(angle);
  if (!photo) return false;
  split = split && angle === 'front';
  const garment = angle.startsWith('trousers') ? 'trousers' : angle.startsWith('waistcoat') ? 'waistcoat' : 'jacket';
  const faceVersion = face && ['front', 'inside', 'waistcoat'].includes(angle) ? faceState.version : 0;
  const key = JSON.stringify([garmentSettings[garment].map((key) => design[key]), clothAppearance(design), angle, split, open, faceVersion, thumbnail, fullBody, garmentOnly, skinTone]);
  if (renderedCanvases.get(canvas) === key) return true;

  const fabric = fabrics[garment === 'waistcoat' ? vestContrast[design.vestCloth] ?? design.fabric : design.fabric].name;
  const material = split ? `${fabrics[1].name} and ${fabric}` : fabric;
  const view = angle.endsWith('Back') ? 'back' : garment === 'jacket' ? angle : 'front';
  canvas.setAttribute('aria-label', `${material} ${garment}, ${view} view${faceVersion && faceState.image ? ', with your face' : ''}`);
  const {width, height, materialCanvas, composition} = photo;
  paintMaterials(photo, design, angle, split, skinTone);

  const layer = composition.getContext('2d');
  layer.setTransform(1, 0, 0, 1, 0, 0);
  layer.clearRect(0, 0, width, height);
  layer.drawImage(materialCanvas, 0, 0);
  if (fullBody && garment !== 'trousers') removePortraitTrousers(layer, photo, garment === 'waistcoat' ? 1228 : 1318);
  layer.scale(width / 1024, height / 1536);
  if (garment === 'jacket') {
    if (angle === 'front') paintFrontDetails(layer, design, split, open);
    if (angle === 'back') paintBackDetails(layer, design);
    if (angle === 'inside') paintInsideDetails(layer, design);
    paintShoulderDetails(layer, design);
    paintCuffs(layer, design, angle, split);
  } else if (garment === 'trousers') {
    paintTrousers(layer, design, angle === 'trousersBack');
  } else if (angle === 'waistcoatBack') {
    paintWaistcoatBack(layer, design);
  } else {
    paintWaistcoat(layer, design, garmentOnly);
  }
  if (garmentOnly) isolatePhotoCloth(layer, photo);

  canvas.width = thumbnail ? 144 : width;
  canvas.height = Math.round(canvas.width * height / width);
  const output = canvas.getContext('2d');
  output.scale(canvas.width / width, canvas.height / height);
  if (garment === 'trousers') drawTrouserFit(output, composition, design.trouserFit);
  else if (garment === 'jacket') applySilhouette(output, composition, design.silhouette, design.shoulder);
  else output.drawImage(composition, 0, 0);
  if (faceVersion && faceState.image) {
    output.scale(width / 1024, height / 1536);
    paintPersonalFace(output);
  }
  renderedCanvases.set(canvas, key);
  return true;
}
