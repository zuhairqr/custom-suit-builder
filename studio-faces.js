'use strict';

// Crop coordinates on the original 1261 × 1247 portrait sheet.
const studioFaces = [
  {id: 'silver', name: 'Silver hair', crop: [132, 39, 386, 552], tone: [.97, 1.01, 1.05]},
  {id: 'curls', name: 'Short curls', crop: [754, 49, 373, 539], tone: [.65, .62, .61]},
  {id: 'blond', name: 'Blond hair', crop: [129, 638, 383, 563], tone: [1.01, 1.05, 1.09]},
  {id: 'swept', name: 'Swept hair', crop: [756, 627, 389, 573], tone: [1.00, 1.04, 1.07]},
  {id: 'original', name: 'Original model'},
];
let studioPortraits;

function drawStudioPortrait(ctx, face, x, y, width, height) {
  const scaleX = studioPortraits.naturalWidth / 1261;
  const scaleY = studioPortraits.naturalHeight / 1247;
  const [left, top, cropWidth, cropHeight] = face.crop;
  ctx.drawImage(studioPortraits, left * scaleX, top * scaleY, cropWidth * scaleX, cropHeight * scaleY,
    x, y, width, height);
}

function loadStudioFaces(picker, onLoad) {
  const image = new Image();
  image.onload = () => {
    studioPortraits = image;
    for (const face of studioFaces) {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.studioFace = face.id;
      button.setAttribute('aria-label', face.name);
      button.title = face.name;
      const thumbnail = makeCanvas(96, 106);
      thumbnail.setAttribute('aria-hidden', 'true');
      const ctx = thumbnail.getContext('2d');
      if (face.crop) {
        drawStudioPortrait(ctx, face, 10, 5, 76, 103);
      } else {
        const {photo} = studioModelCapture;
        ctx.drawImage(photo, photo.width * 326 / 887, 0, photo.width * 221 / 887, photo.height * 248 / 1774,
          3, 0, 90, 106);
      }
      button.append(thumbnail);
      picker.append(button);
    }
    onLoad();
  };
  image.src = studioFaceSheet;
}

function toneStudioSkin(ctx, width, height, bounds, tone) {
  const [left, top, right, bottom] = bounds;
  const x = Math.floor(left * width / 887);
  const y = Math.floor(top * height / 1774);
  const w = Math.ceil((right - left) * width / 887);
  const h = Math.ceil((bottom - top) * height / 1774);
  const skin = ctx.getImageData(x, y, w, h);
  const {data} = skin;
  for (let i = 0; i < data.length; i += 4) {
    if (!data[i + 3]) continue;
    const warm = clamp((data[i] - data[i + 1] - 9) / 22, 0, 1) *
      clamp((data[i + 1] - data[i + 2] - 2) / 12, 0, 1);
    for (let channel = 0; channel < 3; channel++) data[i + channel] *= 1 + (tone[channel] - 1) * warm;
  }
  ctx.putImageData(skin, x, y);
}

function paintStudioFace(ctx, width, height, faceId) {
  const face = studioFaces.find(({id}) => id === faceId);
  if (!studioPortraits || !face?.crop) return;
  for (const bounds of [[352, 214, 517, 306], [180, 898, 282, 1102], [594, 898, 704, 1102]]) {
    toneStudioSkin(ctx, width, height, bounds, face.tone);
  }

  const scaleY = height / 1774;
  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  const fade = ctx.createLinearGradient(0, 218 * scaleY, 0, 252 * scaleY);
  fade.addColorStop(0, '#000');
  fade.addColorStop(1, '#0000');
  ctx.fillStyle = fade;
  ctx.fillRect(0, 0, width, 252 * scaleY);
  ctx.restore();

  const layer = tryOnLayer('studio-portrait');
  layer.width = width;
  layer.height = Math.ceil(277 * scaleY);
  const portrait = layer.getContext('2d');
  drawStudioPortrait(portrait, face, width * 337 / 887, 9 * scaleY, width * 196 / 887, 263 * scaleY);
  portrait.globalCompositeOperation = 'destination-in';
  const edge = portrait.createLinearGradient(0, 235 * scaleY, 0, 270 * scaleY);
  edge.addColorStop(0, '#000');
  edge.addColorStop(1, '#0000');
  portrait.fillStyle = edge;
  portrait.fillRect(0, 0, width, layer.height);
  ctx.drawImage(layer, 0, 0);
}
