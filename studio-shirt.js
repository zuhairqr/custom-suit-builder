'use strict';

const studioShirtColors = ['#f2f4f8', '#aecde5', '#f4e8d3', '#e9cacc', '#354660'];
const studioShirtRGB = studioShirtColors.map(color => color.slice(1).match(/../g).map(value => parseInt(value, 16)));
const studioShirtTie = (design) => design.shirtCollar === 2 ? 2 : design.shirtTie;

function shirtTint(red, green, blue, color) {
  if (!color) return [red, green, blue];
  const rgb = studioShirtRGB[color];
  const light = (red + green + blue) / (3 * 238);
  return rgb.map(channel => Math.min(255, channel * light));
}

function studioShirtOverlay(display, capture, design) {
  const key = JSON.stringify([design.shirtColor, design.shirtCollar, studioShirtTie(design)]);
  if (capture.shirt?.key === key) return capture.shirt.canvas;
  const canvas = makeCanvas(display.width, display.height);
  const ctx = canvas.getContext('2d');
  const source = display.photoFrame.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
  const overlay = ctx.createImageData(canvas.width, canvas.height);
  // Work in the fixed studio photograph's coordinates. Only neutral shirt
  // pixels are tinted: skin, hair, trousers and transparent background stay out.
  for (let y = 0; y < canvas.height; y++) {
    const sy = y * 1774 / canvas.height;
    if (sy < 240 || sy > 920) continue;
    for (let x = 0; x < canvas.width; x++) {
      const sx = x * 887 / canvas.width;
      if (sx < 155 || sx > 735 || (sy < 268 && (sx < 350 || sx > 535))) continue;
      const i = (y * canvas.width + x) * 4;
      const r = source.data[i], g = source.data[i + 1], b = source.data[i + 2], alpha = source.data[i + 3];
      if (!alpha || Math.min(r, g, b) < 95 || Math.max(r, g, b) - Math.min(r, g, b) > 42) continue;
      const rgb = shirtTint(r, g, b, design.shirtColor);
      for (let channel = 0; channel < 3; channel++) overlay.data[i + channel] = rgb[channel];
      overlay.data[i + 3] = alpha;
    }
  }
  ctx.putImageData(overlay, 0, 0);
  if (!capture.rear) {
    const tie = studioShirtTie(design);
    if (tie !== 0) {
      const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
      for (let y = Math.floor(canvas.height * 290 / 1774); y < canvas.height * 810 / 1774; y++) {
        let left = canvas.width, right = 0;
        for (let x = Math.floor(canvas.width * 395 / 887); x < canvas.width * 493 / 887; x++) {
          const i = (y * canvas.width + x) * 4;
          if (source.data[i + 2] > source.data[i] + 3 && Math.max(...source.data.slice(i, i + 3)) < 145) {
            left = Math.min(left, x); right = Math.max(right, x);
          }
        }
        if (right < left) continue;
        for (let x = left - 2; x <= right + 2; x++) {
          const i = (y * canvas.width + x) * 4;
          if (tie === 1) {
            // Trousers share the tie's navy pixels. Bound recoloring to the
            // taper and pointed tip so a burgundy rectangle cannot reach them.
            const sy = y * 1774 / canvas.height, sx = x * 887 / canvas.width;
            const half = sy < 764 ? 50 : 34 * (791 - sy) / 27;
            if (sy > 791 || Math.abs(sx - 443) > half || source.data[i + 2] <= source.data[i] + 3 || Math.max(...source.data.slice(i, i + 3)) >= 145) continue;
          }
          const a = (y * canvas.width + Math.round(canvas.width * 378 / 887)) * 4;
          const b = (y * canvas.width + Math.round(canvas.width * 510 / 887)) * 4;
          const blend = (x / canvas.width * 887 - 378) / (510 - 378);
          const rgb = [0, 1, 2].map(channel => source.data[a + channel] * (1 - blend) + source.data[b + channel] * blend);
          const white = Math.min(...rgb) > 95;
          const colored = tie === 2 ? (white ? shirtTint(...rgb, design.shirtColor) : rgb)
            : [112, 38, 58].map(channel => channel * (source.data[i] + source.data[i + 1] + source.data[i + 2]) / 165);
          frame.data.set([...colored, 255], i);
        }
      }
      ctx.putImageData(frame, 0, 0);
    }
    paintStudioShirtCollar(ctx, canvas, design);
    if (tie === 2) {
      ctx.save();
      ctx.scale(canvas.width / 887, canvas.height / 1774);
      ctx.strokeStyle = '#26394a25'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(438, 350); ctx.lineTo(438, 760); ctx.stroke();
      ctx.fillStyle = '#ffffffa0';
      for (const y of [365, 450, 535, 620, 705]) {
        ctx.beginPath(); ctx.arc(445, y, 3, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    }
  }
  capture.shirt = {key, canvas};
  return canvas;
}

function paintStudioShirtCollar(ctx, canvas, design) {
  if (!design.shirtCollar) return; // Preserve the photographed classic collar.
  ctx.save();
  ctx.scale(canvas.width / 887, canvas.height / 1774);
  const color = studioShirtColors[design.shirtColor];
  const fill = ctx.createLinearGradient(350, 265, 535, 345);
  fill.addColorStop(0, color);
  fill.addColorStop(.55, color);
  fill.addColorStop(1, `rgb(${shirtTint(190, 190, 190, design.shirtColor).join(' ')})`);
  // Flatten the old collar folds before drawing the new collar, while keeping
  // the neck opening above this edge and the photographed shirt below it.
  ctx.fillStyle = fill;
  ctx.fill(new Path2D('M365 268Q443 316 521 268L538 288L521 350H365L348 288Z'));
  ctx.lineWidth = 1.6;
  ctx.strokeStyle = '#26394a40';
  if (design.shirtCollar === 2) {
    const band = new Path2D('M375 274Q443 312 511 274L514 294Q443 329 372 294Z');
    ctx.fill(band); ctx.stroke(band);
    ctx.fillStyle = '#8a939d';
    ctx.beginPath(); ctx.arc(443, 309, 2.4, 0, Math.PI * 2); ctx.fill();
  } else {
    for (const shape of ['M365 268L435 299L389 342L348 288Z', 'M521 268L451 299L497 342L538 288Z']) {
      const collar = new Path2D(shape); ctx.fill(collar); ctx.stroke(collar);
    }
    // Retain the original knot on top of the newly drawn collar.
    if (studioShirtTie(design) !== 2) {
      const knot = new Path2D('M429 291L443 301L457 291L462 308L450 329H436L424 308Z');
      ctx.fillStyle = studioShirtTie(design) === 1 ? '#70263a' : '#263247';
      ctx.fill(new Path2D('M436 320H450L454 355H432Z'));
      ctx.fill(knot);
    }
  }
  ctx.restore();
}
