'use strict';

const fullSuitSize = {width: 1024, height: 2636, trouserTop: 1160};
const frontOpening = 'M427 389 C427 510 447 598 442 681 Q439 758 432 855 Q425 1028 421 1199 L402 1469 H622 L603 1199 Q599 1028 592 855 Q585 758 582 681 C577 598 597 510 597 389 Q512 465 427 389Z';
const openJacketEdge = 'M427 389 C426 501 424 585 419 681 Q416 758 412 855 Q409 1028 407 1199 L385 1469';
const openJacketOpening = `${openJacketEdge} H639 L617 1199 Q615 1028 612 855 Q608 758 605 681 C600 585 598 501 597 389 Q512 465 427 389Z`;
const insideOpening = 'M426 388 C409 491 367 605 357 735 Q335 1051 347 1385 L245 1536 H779 L677 1385 Q689 1051 667 735 C657 605 615 491 598 388 Q512 460 426 388Z';
const vestOutline = 'M0 0H1024V1199H770Q684 1255 512 1315Q343 1255 251 1199H0Z';
const trouserOverlap = 'M310 1158H714L786 1470L1024 1582V2636H0V1582L238 1470Z';
const fullLookLayers = {};

function fullLookAssets(angle, withWaistcoat, jacketHidden = false) {
  if (jacketHidden && withWaistcoat) return angle === 'back' ? ['waistcoatBack', 'trousersBack'] : ['waistcoat', 'trousers'];
  if (angle === 'back') return ['back', 'trousersBack'];
  return withWaistcoat ? [angle, 'trousers', 'waistcoat'] : [angle, 'trousers'];
}

function fullLookLayer(key) {
  fullLookLayers[key] ||= makeCanvas(1, 1);
  return fullLookLayers[key];
}

function drawLookOpening(ctx, angle) {
  if (angle !== 'front') return;
  for (const mirror of [false, true]) {
    ctx.save();
    if (mirror) {
      ctx.translate(1024, 0);
      ctx.scale(-1, 1);
    }
    ink(ctx, openJacketEdge, '#1117217a', 8);
    ctx.translate(-3, 0);
    ink(ctx, openJacketEdge, '#fbf8ed44', 1.7);
    ctx.restore();
  }
}

function paintFullSuit(canvas, design, angle, {thumbnail = false, face = false, jacketHidden = false, skinTone = 0} = {}) {
  const withWaistcoat = design.outfit === 2;
  if (!fullLookAssets(angle, withWaistcoat, jacketHidden).every((view) => studioPhotos.has(view))) return false;
  const version = face && angle !== 'back' ? faceState.version : 0;
  const key = JSON.stringify(['full-look', design, clothAppearance(design), angle, thumbnail, version, jacketHidden, skinTone, studioPhotos.has('inside')]);
  if (renderedCanvases.get(canvas) === key) return true;
  const jacket = fullLookLayer('jacket');
  const trousers = fullLookLayer('trousers');
  const waistcoat = fullLookLayer('waistcoat');
  const trousersView = angle === 'back' ? 'trousersBack' : 'trousers';
  const vestView = angle === 'back' ? 'waistcoatBack' : 'waistcoat';
  if (!jacketHidden) paintGarmentPhoto(jacket, design, angle, false, {open: withWaistcoat && angle === 'front' ? 'wide' : false, fullBody: true, skinTone});
  paintGarmentPhoto(trousers, design, trousersView, false, {skinTone});
  if (jacketHidden || (withWaistcoat && angle !== 'back')) {
    paintGarmentPhoto(waistcoat, design, vestView, false, {garmentOnly: !jacketHidden, fullBody: jacketHidden, skinTone});
  }

  const {width, height, trouserTop} = fullSuitSize;
  canvas.width = thumbnail ? 128 : 768;
  canvas.height = Math.round(canvas.width * height / width);
  const output = canvas.getContext('2d');
  output.scale(canvas.width / width, canvas.height / height);
  output.save();
  output.clip(new Path2D(trouserOverlap));
  const waistCrop = (jacketHidden ? 70 : 35) * trousers.height / 1536;
  output.drawImage(trousers, 0, waistCrop, trousers.width, trousers.height - waistCrop, -50, trouserTop, 1124, height - trouserTop);
  output.restore();

  if (jacketHidden) {
    output.drawImage(waistcoat, 0, 0, 1024, 1536);
  } else {
    const top = fullLookLayer('top');
    top.width = jacket.width;
    top.height = jacket.height;
    const torso = top.getContext('2d');
    torso.drawImage(jacket, 0, 0);
    torso.scale(top.width / 1024, top.height / 1536);
    torso.globalCompositeOperation = 'destination-out';
    if (withWaistcoat && angle !== 'back') {
      const opening = angle === 'inside' ? insideOpening : openJacketOpening;
      fillShape(torso, opening, '#000');
      output.save();
      output.clip(new Path2D(opening));
      paintWaistcoatShirt(output);
      output.clip(new Path2D(vestOutline));
      output.drawImage(waistcoat, 0, 0, 1024, 1536);
      output.restore();
    }
    output.drawImage(top, 0, 0, 1024, 1536);
    if (withWaistcoat) drawLookOpening(output, angle);
  }
  if (version && faceState.image) paintPersonalFace(output);
  canvas.setAttribute('aria-label', `${fabrics[design.fabric].name} full-body ${outfits[design.outfit].name.toLowerCase()}, ${angle} view${jacketHidden ? ', jacket hidden' : ''}${version && faceState.image ? ', with your face' : ''}`);
  renderedCanvases.set(canvas, key);
  return true;
}
