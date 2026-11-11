'use strict';

// Coordinates follow the 1024 × 1536 portrait used by the three studio photographs.
// LAPEL SYSTEM: Each lapel now supports independent left and right geometry for realistic tailoring.
// Format: [leftPath, rightPath] or string for symmetric (legacy compatibility)

const lapels = [
  // 0: Classic Notch Lapel (standard width, moderate point)
  'M424 321 Q399 362 358 407 L337 439 L372 463 L341 470 Q394 597 512 720 Q457 534 424 321Z',
  // 1: Wide Notch Lapel
  'M424 321 Q398 368 341 406 L311 446 L363 470 L314 482 Q385 613 512 720 Q457 534 424 321Z',
  // 2: Peak Lapel (sharp point, pronounced)
  'M424 321 Q394 372 344 419 L372 461 L302 442 Q370 602 512 720 Q460 534 424 321Z',
  // 3: Wide Peak Lapel
  'M424 321 Q390 372 332 420 L368 459 L264 426 Q355 612 512 720 Q460 534 424 321Z',
  // 4: Shawl Lapel (curved, rounded collar)
  'M424 321 Q363 378 363 457 Q367 588 512 720 Q461 537 424 321Z',
  // 5: Shawl Lapel (butterfly style)
  'M424 321 C374 351 319 395 333 468 C345 556 405 650 512 720 Q456 537 424 321Z',
  // 6: Narrow Notch (slim profile)
  'M424 321 L352 415 L380 450 L317 472 Q386 511 412 599 Q454 673 512 720 Q460 534 424 321Z',
  // 7: High-gorge Notch (tall gorge line)
  'M424 321 Q391 371 345 417 L373 459 Q347 463 288 443 Q318 532 400 626 Q452 683 512 720 Q461 533 424 321Z',
  // 8: Rounded Peak
  'M424 321 Q393 356 368 383 C364 534 407 635 493 714 L512 720 Q459 527 424 321Z',
  // 9: Straight Peak
  'M424 321 L374 375 Q361 489 399 647 L512 720 Q462 531 424 321Z',
  // 10: Soft Shawl
  'M424 321 Q355 378 348 451 C343 575 401 704 512 720 Q457 531 424 321Z',
  // 11: Mid-range Notch
  'M424 321 Q405 371 389 422 L413 459 L390 467 Q424 605 512 720 Q458 530 424 321Z',
  // 12: Tight Notch
  'M424 321 L367 391 L391 419 L352 427 Q408 609 512 720 Q458 530 424 321Z',
  // 13: Extra-wide Peak
  'M424 321 Q388 367 330 416 L357 453 L244 440 Q292 548 397 639 Q468 698 512 720 Q462 529 424 321Z',
  // 14: Dinner Shawl
  'M424 321 C352 356 296 398 309 481 C319 578 404 679 512 720 Q456 535 424 321Z',

  // 15: NEW - TRUE ASYMMETRICAL LAPEL (Left narrower, Right wider)
  // Left side: narrower notch for asymmetrical effect
  ['M424 321 Q410 365 375 410 L355 440 L385 460 L360 472 Q400 580 512 720 Q460 530 424 321Z',
   // Right side: wider, more pronounced
   'M424 321 Q385 370 330 420 L305 450 L360 475 L280 490 Q370 610 512 720 Q455 535 424 321Z'],

  // 16: ASYMMETRICAL PEAK (Left peak, Right notch)
  ['M424 321 Q400 360 370 400 L350 425 L385 455 L340 475 Q395 595 512 720 Q460 530 424 321Z',
   'M424 321 Q388 370 340 415 L310 445 L365 470 L295 480 Q365 610 512 720 Q455 535 424 321Z'],

  // 17: ASYMMETRICAL SHAWL (Left shawl, Right notch)
  ['M424 321 Q365 375 365 455 Q368 585 512 720 Q461 535 424 321Z',
   'M424 321 Q400 365 355 410 L330 440 L375 465 L310 475 Q385 605 512 720 Q460 530 424 321Z'],

  // 18: Satin-faced Peak (same as peak #2, material handled by lapelFinish)
  'M424 321 Q394 372 344 419 L372 461 L302 442 Q370 602 512 720 Q460 534 424 321Z',

  // 19: Satin-faced Shawl (same as shawl #4, material handled by lapelFinish)
  'M424 321 Q363 378 363 457 Q367 588 512 720 Q461 537 424 321Z',

  // 20: Grosgrain-faced Peak (variation of peak)
  'M424 321 Q396 370 346 417 L370 458 L305 444 Q372 600 512 720 Q461 533 424 321Z',

  // 21: Grosgrain-faced Shawl (variation of shawl)
  'M424 321 Q365 376 365 454 Q369 585 512 720 Q462 536 424 321Z',

  // 22: Velvet Shawl (deeper curve)
  'M424 321 C368 350 315 398 318 472 C322 565 395 665 512 720 Q458 535 424 321Z',

  // 23: Self-faced Shawl (classic clean shawl)
  'M424 321 Q361 380 361 460 Q365 590 512 720 Q460 538 424 321Z',

  ...extraLapelShapes.map(([, path]) => path),
];

const buttonStances = [
  [[512, 907]],
  [[512, 837], [512, 979]],
  [[512, 775], [512, 884], [512, 1000]],
  [[432, 844], [592, 844], [432, 994], [592, 994]],
  [[367, 748], [657, 748], [437, 902], [587, 902], [437, 1050], [587, 1050]],
  [[512, 755], [512, 863], [512, 971]],
  [[431, 902], [593, 902]],
  [[424, 755], [600, 755], [436, 889], [588, 889], [436, 1018], [588, 1018]],
  [[385, 836], [639, 836], [433, 996], [591, 996]],
  [[356, 808], [668, 808], [431, 974], [593, 974], [431, 1104], [593, 1104]],
  [[512, 755], [512, 851], [512, 947], [512, 1043]],
];

const doubleStances = new Set([3, 4, 6, 7, 8, 9]);
const functionalDoubleRows = {3: [844, 994], 4: [902, 1050], 6: [902], 7: [889, 1018], 8: [996], 9: [974, 1104]};
const buttonPalettes = [
  ['#947154', '#5e4433', '#35251e'], ['#edc798', '#a16a42', '#5d3527'],
  ['#fff4d8', '#d8cbad', '#96816c'], ['#ffe0a1', '#b88d4f', '#644727'],
  ['#71727a', '#292b33', '#111316'], ['#f5f8ff', '#a1a9b4', '#5c6674'],
  null, ['#8b8a99', '#1b1a24', '#0a0a10'],
  ['#e9d9dc', '#8d7889', '#493d56'], ['#ecab59', '#894328', '#361d22'],
  ['#fff1d2', '#cfb890', '#7c644a'], ['#b7bdc7', '#535f71', '#262b3a'],
  ['#ffeb9e', '#c4963c', '#72502a'], ['#d5a96f', '#92603d', '#5a382e'],
  ['#9d9dad', '#323241', '#10111b'], ['#d1a685', '#85533a', '#44281c'],
  ['#7191b7', '#2d4764', '#142536'], ['#b6ba8c', '#657151', '#2e3c29'],
  ...extraButtons.map(([, ...palette]) => palette),
];

const facingColors = [null, '#161720', '#1d324e', '#e8dcc2', '#181622'];
const liningColors = liningCollection.map(([, color]) => color);
const squareColors = ['#e8dfcf', null, '#7c2945', '#385275'];
const garmentAnchors = {
  front: {cuffs: [[98, 1292, 1], [926, 1292, -1]]},
  inside: {cuffs: [[79, 1290, 1], [945, 1290, -1]], pockets: [[245, 843, 96, -.08], [683, 843, 96, .08], [210, 1122, 119, -.03], [696, 1122, 119, .03]]},
  back: {cuffs: [[106, 1301, 1], [918, 1301, -1]], hem: 1453, vents: [283, 741]},
};

const lowerPockets = [
  {flap: 'M0 2 L129 1 L123 38 Q119 47 108 48 L5 47 Q0 45 0 39Z'},
  {welts: 1},
  {patch: 'M2 0 L130 2 L124 85 Q108 101 14 94 Q1 91 1 78Z'},
  {flap: 'M0 2 L129 1 L123 38 Q119 47 108 48 L5 47 Q0 45 0 39Z', ticket: true},
  {flap: 'M0 0 L129 18 L121 58 L2 43Z'},
  {welts: 2},
  {patch: 'M2 0 L130 2 L124 85 Q108 101 14 94 Q1 91 1 78Z', pleat: true},
  {flap: 'M0 2 L129 1 L122 33 Q96 41 66 51 Q39 41 4 37Z'},
  {patch: 'M2 0 L130 2 L124 85 Q108 101 14 94 Q1 91 1 78Z', flap: 'M0 2 L129 1 L123 38 Q119 47 108 48 L5 47 Q0 45 0 39Z'},
  {flap: 'M0 0H130L126 61Q122 72 105 72H9Q1 71 0 62Z'},
  {patch: 'M1 0H130L124 72Q122 103 66 103Q5 103 4 72Z'},
  {patch: 'M1 6Q65 35 129 6L122 74Q115 99 65 103Q12 98 5 73Z'},
];

function ink(ctx, path, color, width, dash = []) {
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.setLineDash(dash);
  ctx.stroke(typeof path === 'string' ? new Path2D(path) : path);
  ctx.restore();
}

function fillShape(ctx, path, fill) {
  ctx.fillStyle = fill;
  ctx.fill(new Path2D(path));
}

function fabricSurface(ctx, path, fabric, bounds, finish) {
  const {x, y, w, h, grain = 0} = bounds;
  const shape = new Path2D(path);
  const clothPhoto = !finish && photoCloth(fabric);
  ctx.save();
  ctx.shadowColor = clothPhoto ? '#090d1578' : '#090d15a6';
  ctx.shadowBlur = clothPhoto ? 4 : 6;
  ctx.shadowOffsetY = clothPhoto ? 2 : 3;
  if (finish) {
    ctx.fillStyle = finish;
  } else {
    const tile = clothTile(fabric).tile;
    const pattern = ctx.createPattern(tile, 'repeat');
    const aspectRatio = w / Math.max(1, h);
    const scaleAdjustment = aspectRatio < 0.6 ? 1.2 : 1.46;
    pattern.setTransform(new DOMMatrix().translate(x, y).rotate(grain).scale(scaleAdjustment));
    ctx.fillStyle = pattern;
  }
  ctx.fill(shape);
  ctx.restore();

  const sheen = ctx.createLinearGradient(x, y, x + w, y + h * 0.33);
  sheen.addColorStop(0, clothPhoto ? '#03070c35' : '#03070c60');
  sheen.addColorStop(0.34, finish ? '#ffffff40' : '#ffffff17');
  sheen.addColorStop(0.67, '#ffffff08');
  sheen.addColorStop(1, clothPhoto ? '#05090f54' : '#05090f85');
  ctx.fillStyle = sheen;
  ctx.fill(shape);
  ink(ctx, shape, clothPhoto ? '#0a0d125b' : '#0a0d126e', 1.8);
}

function paintButton(ctx, x, y, size, finish, fabric) {
  const palette = buttonPalettes[finish];
  const base = palette?.[1] || fabrics[fabric].color;
  ctx.save();
  ctx.shadowColor = '#05060abd';
  ctx.shadowBlur = 5;
  ctx.shadowOffsetY = 3;
  const rim = ctx.createLinearGradient(x - size, y - size, x + size, y + size);
  rim.addColorStop(0, palette?.[0] || '#91989e');
  rim.addColorStop(0.46, base);
  rim.addColorStop(1, palette?.[2] || '#171a1e');
  ctx.fillStyle = rim;
  ctx.beginPath();
  ctx.arc(x, y, size, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  const center = ctx.createRadialGradient(x - size * .3, y - size * .35, 1, x, y, size);
  center.addColorStop(0, palette?.[0] || fabrics[fabric].thread);
  center.addColorStop(.55, base);
  center.addColorStop(1, palette?.[2] || '#161a1e');
  ctx.fillStyle = center;
  ctx.beginPath();
  ctx.arc(x, y, size * .78, 0, Math.PI * 2);
  ctx.fill();
  if (finish === 6) {
    const cloth = ctx.createPattern(clothTile(fabric).tile, 'repeat');
    ctx.save();
    ctx.globalAlpha = .84;
    ctx.fillStyle = cloth;
    ctx.fill();
    ctx.restore();
    ink(ctx, `M${x - size * .42} ${y - size * .47}q${size * .42} -${size * .3} ${size * .78} 0`, '#ffffff59', size * .085);
    return;
  }
  if ([12, 13, 44].includes(finish)) {
    fillShape(ctx, `M${x} ${y - size * .55}l${size * .42} ${size * .3}v${size * .34}l-${size * .42} ${size * .34}l-${size * .42} -${size * .34}v-${size * .34}Z`, palette[0]);
    ink(ctx, `M${x - size * .21} ${y}h${size * .42}`, palette[2], size * .1);
    return;
  }
  if (finish === 15) {
    for (const offset of [-.31, 0, .31]) {
      ink(ctx, `M${x - size * .42} ${y + size * offset}q${size * .42} ${size * .28} ${size * .84} 0`, palette[0], size * .12);
    }
    return;
  }
  if ([7, 14].includes(finish)) return;
  ctx.fillStyle = '#151019bd';
  for (const dx of [-.19, .19]) {
    for (const dy of [-.19, .19]) {
      ctx.beginPath();
      ctx.arc(x + dx * size, y + dy * size, size * .105, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ink(ctx, `M${x - .19 * size} ${y - .19 * size}l${.38 * size} ${.38 * size}`, '#d3b5999e', size * .085);
}

function welt(ctx, width, count = 1) {
  ink(ctx, `M0 0H${width}`, '#0c121ac2', 7);
  ink(ctx, `M0 -3H${width}`, '#ffffff55', 2.4);
  if (count === 2) {
    ink(ctx, `M0 5H${width}`, '#0b1119b0', 2.5);
    ink(ctx, `M0 7H${width}`, '#ffffff50', 1.9);
  }
}

function paintAMF(ctx, path, stitching, x, y, span) {
  if (stitching === 1) return;
  ctx.save();
  ctx.clip(new Path2D(path));
  const inset = [1, 0, 2, 2, 6][stitching];
  ctx.translate(x, y);
  ctx.scale(1 - 2 * inset / span, 1 - 2 * inset / span);
  ctx.translate(-x, -y);
  ink(ctx, path, stitching === 2 ? '#f6e7c6bb' : '#f4ede375', 2, [3, 4]);
  ctx.restore();
}

function paintLowerPocket(ctx, choice, fabric, ticket, stitching) {
  const pocket = lowerPockets[choice];
  if (pocket.welts) welt(ctx, 129, pocket.welts);
  if (pocket.patch) {
    fabricSurface(ctx, pocket.patch, fabric, {x: 0, y: 0, w: 133, h: 96});
    paintAMF(ctx, pocket.patch, stitching, 65, 45, 95);
  }
  if (pocket.pleat) {
    ink(ctx, 'M49 12 L47 90 M79 13 L78 92', '#090d1380', 2.4);
    ink(ctx, 'M52 12 L50 90 M82 13 L81 92', '#ffffff54', 1.8);
  }
  if (pocket.flap) {
    fabricSurface(ctx, pocket.flap, fabric, {x: 0, y: 0, w: 130, h: 60});
    paintAMF(ctx, pocket.flap, stitching, 65, 26, 54);
  }
  if (ticket) {
    ctx.translate(15, -54);
    fabricSurface(ctx, 'M0 0 H71 L68 29 Q31 37 2 28Z', fabric, {x: 0, y: 0, w: 71, h: 34});
  }
}

function paintBreastPocket(ctx, choice, fabric, square, stitching) {
  if (choice === 2) return;
  ctx.save();
  ctx.clip(new Path2D('M609 535 L774 523 Q791 634 768 737 L615 760Z'));
  ctx.translate(652, 620);
  ctx.rotate(-.135);
  ctx.scale(.89, .9);
  if (squareColors[square]) {
    const silk = ctx.createLinearGradient(0, -34, 60, 2);
    silk.addColorStop(0, squareColors[square]);
    silk.addColorStop(.58, squareColors[square]);
    silk.addColorStop(1, '#263241');
    fillShape(ctx, 'M8 0 L14 -22 Q55 -24 98 -30 Q108 -28 108 -22 L104 4Z', silk);
    ink(ctx, 'M14 -22 Q55 -24 98 -30', '#ffffff81', 1.6);
  }
  if (choice === 6) {
    ink(ctx, 'M0 2Q45 13 114 -4', '#0c121ad0', 8);
    ink(ctx, 'M0 -2Q45 9 114 -8', '#ffffff66', 2.3);
  } else if (choice === 0 || choice === 3) {
    welt(ctx, 114, choice === 3 ? 2 : 1);
  } else {
    const patch = choice === 5 ? 66 : 80;
    const shape = choice === 7 ? 'M0 0H112L110 53Q104 89 57 89Q7 89 1 54Z'
      : `M0 0 H112 L109 ${patch - 14} Q90 ${patch + 9} 11 ${patch} Q1 ${patch - 3} 1 ${patch - 15}Z`;
    fabricSurface(ctx, shape, fabric, {x: 0, y: 0, w: 110, h: patch});
    paintAMF(ctx, shape, stitching, 56, 39, 78);
    if (choice === 4) {
      ink(ctx, 'M39 8 V72 M65 8 V75', '#10151d83', 2.3);
      ink(ctx, 'M42 8 V72 M68 8 V75', '#ffffff56', 1.7);
    }
    if (choice === 5) fabricSurface(ctx, 'M-3 -1 H114 L109 29 Q61 36 1 27Z', fabric, {x: 0, y: 0, w: 112, h: 34});
  }
  ctx.restore();
}

function paintFrontDetails(ctx, design, split, open = false) {
  const {lapel, lapelFinish, closure, breast, pocket, square, button, stitching, fabric} = design;
  const leftFabric = split ? 1 : fabric;
  const double = doubleStances.has(closure);
  const closureSeam = double ? 'M512 720 Q482 789 444 876 Q423 1040 425 1452' : 'M512 720 Q509 1045 512 1295 Q508 1380 474 1440';
  if (!open) {
    ink(ctx, closureSeam, '#0b101ab5', 4.5);
    ctx.save();
    ctx.translate(2.4, -1.8);
    ink(ctx, closureSeam, '#ffffff35', 1.9);
    ctx.restore();
  }

  paintBreastPocket(ctx, breast, fabric, square, stitching);
  const facing = facingColors[lapelFinish];
  const roll = closure === 2;

  for (const right of [false, true]) {
    ctx.save();
    if (right) {
      ctx.translate(1024, 0);
      ctx.scale(-1, 1);
    }
    const material = right ? fabric : leftFabric;
    const alternate = right ? extraLapelShapes[lapel - 15]?.[2] : null;
    let lapelPath = lapels[alternate ?? lapel];

    // Support asymmetrical lapels: [leftPath, rightPath] arrays for independent geometry
    if (Array.isArray(lapelPath)) {
      lapelPath = right ? lapelPath[1] : lapelPath[0];
    }

    ctx.save();
    if (open) ctx.transform(1, 0, -.14, 1, .14 * 321, 0);
    if (roll) {
      ctx.translate(0, 321);
      ctx.scale(1, 1.24);
      ctx.translate(0, -321);
    }
    fabricSurface(ctx, lapelPath, material, {x: 310, y: 320, w: 202, h: 405, grain: -14}, facing);

    // Add subtle depth to lapel edge for better definition
    const lapelDepth = ctx.createLinearGradient(420, 320, 380, 550);
    lapelDepth.addColorStop(0, '#ffffff08');
    lapelDepth.addColorStop(0.4, '#00000012');
    lapelDepth.addColorStop(1, '#00000008');
    ctx.fillStyle = lapelDepth;
    ctx.fill(new Path2D(lapelPath));

    const edge = {
      5: ['#e3d3ae', 5, []],
      6: ['#e1d9caab', 2.2, [6, 3]],
      7: ['#cfc2a8a3', 2.8, [1, 3]],
      8: ['#0a111bae', 4, [7, 3]],
    }[lapelFinish];
    if (edge) ink(ctx, lapelPath, ...edge);
    paintAMF(ctx, lapelPath, stitching, 411, 515, 154);
    if (right) {
      ink(ctx, 'M367 502l24 -9', '#07121ab5', 4.2);
      ink(ctx, 'M367 500l24 -9', '#ffffff4a', 1.3);
    }
    ctx.restore();
    // Keep the pocket and its shadow on the jacket body, clear of the sleeve and side gap.
    ctx.clip(new Path2D('M301 953 Q293 1033 269 1115 L253 1185 H462 V949Z'));
    ctx.translate(286, 1050);
    ctx.scale(.84, .92);
    const ticket = !right && (design.ticket === 1 || (design.ticket === 0 && lowerPockets[pocket].ticket));
    paintLowerPocket(ctx, pocket, material, ticket, stitching);
    ctx.restore();
  }

  const stance = roll ? buttonStances[closure].slice(1) : buttonStances[closure];
  for (const [x, y] of stance) {
    if (open) {
      // Keep the bottom row by the opening, clear of the side-pocket mouths.
      const left = !double || x < 512;
      const offset = double && y < 970 ? Math.max(123, Math.abs(x - 512)) : open === 'wide' ? 118 : 101;
      if (!double) ink(ctx, `M${512 + offset - 3} ${y}h23`, '#10141bc9', 4.5);
      paintButton(ctx, 512 + (left ? -offset : offset), y, 14, button, left ? leftFabric : fabric);
      continue;
    }
    const material = x < 512 ? leftFabric : fabric;
    if (!double || (x < 512 && functionalDoubleRows[closure].includes(y))) ink(ctx, `M${x + 12} ${y}h26`, '#10141bc9', 4.5);
    paintButton(ctx, x, y, double ? 16 : 17, button, material);
  }
}

function paintCuffs(ctx, design, angle, split) {
  const [count, step] = [[4, 17], [1, 18], [2, 24], [3, 23], [4, 22], [5, 16], [0, 0], [3, 17], [5, 23]][design.cuff];
  const finish = design.cuffFinish ? design.cuffFinish - 1 : design.button;
  const cuffs = garmentAnchors[angle].cuffs;
  for (const [side, [x, y, tilt]] of cuffs.entries()) {
    const material = split && side === 0 ? 1 : design.fabric;
    for (let index = 0; index < count; index++) {
      paintButton(ctx, x + tilt * index, y - step * index, 8.8, finish, material);
    }
  }
}

function paintBackDetails(ctx, design) {
  if (design.collarFelt) {
    const felt = 'M429 316Q509 298 594 316L606 353Q509 337 416 353Z';
    fabricSurface(ctx, felt, design.fabric, {x: 418, y: 306, w: 185, h: 44}, fabrics[design.fabric].color);
    ink(ctx, 'M421 347Q509 330 601 347', '#ffffff63', 2, [3, 4]);
  }
  const {hem, vents} = garmentAnchors.back;
  if (design.vent === 2) return;
  const positions = design.vent === 1 ? [512] : vents;
  for (const x of positions) {
    const direction = x > 512 ? -1 : 1;
    const end = x - 15 * direction;
    const top = hem - 169;
    const drape = ctx.createLinearGradient(x - 8, 0, x + 17 * direction, 0);
    drape.addColorStop(0, '#0e131800');
    drape.addColorStop(.5, '#0b0e19d9');
    drape.addColorStop(1, '#0e131800');
    fillShape(ctx, `M${x} ${top} Q${x + 7} ${top + 69} ${end - 9} ${hem - 8} L${end + 12} ${hem - 7} Q${x + 11} ${top + 60} ${x} ${top}Z`, drape);
    ink(ctx, `M${x} ${top} Q${x + 6} ${top + 66} ${end} ${hem - 8}`, '#11141bdd', 5);
    ink(ctx, `M${x + 4 * direction} ${top + 5} Q${x + 8} ${top + 65} ${end + 4 * direction} ${hem - 9}`, '#ffffff63', 1.9);
  }
}

function paintInsideDetails(ctx, design) {
  if (design.liningCoverage === 1) {
    ink(ctx, 'M210 929Q258 907 344 907M680 907Q766 907 814 929', '#fff9e07d', 2.4, [3, 4]);
  }
  if (design.monogram && design.monogramText) {
    ctx.save();
    ctx.translate(design.monogram === 1 ? 280 : 744, 768);
    ctx.rotate(design.monogram === 1 ? -.07 : .07);
    ctx.font = 'italic 20px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = ['#ffedca', '#e2b255', '#e0e7f1', '#b65275', '#4b6a96'][design.monogramThread];
    ctx.shadowColor = '#10151ba6';
    ctx.shadowBlur = 3;
    ctx.fillText(design.monogramText, 0, 0, 95);
    ctx.restore();
  }
  if (design.inner === 3) return;
  const positions = garmentAnchors.inside.pockets;
  for (let i = 0; i < (design.inner === 1 ? 4 : design.inner === 2 ? 1 : 2); i++) {
    const [x, y, w, rotation] = positions[i];
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rotation);
    welt(ctx, w, 2);
    if (i === 0) paintButton(ctx, w * .48, 16, 5.4, design.button, design.fabric);
    ctx.restore();
  }
}

function optionIcon(key, index) {
  const jacket = '<path d="M15 10 24 6h16l9 4 7 30-8 2-5-20 1 23H20l1-23-5 20-8-2z"/>';
  let body;
  switch (key) {
    case 'lapel': {
      let lapelPath = lapels[index];
      let leftPath, rightPath;
      if (Array.isArray(lapelPath)) {
        // Asymmetrical lapel: different left and right paths
        [leftPath, rightPath] = lapelPath;
      } else {
        // Symmetric lapel: mirror the path
        leftPath = lapelPath;
        rightPath = lapelPath;
      }
      body = `<g transform="scale(.057 .085) translate(48 -294)"><path d="${leftPath}"/><path d="${rightPath}" transform="translate(1024) scale(-1 1)"/></g>`;
      break;
    }
    case 'closure':
      body = jacket + buttonStances[index].map(([x, y]) => `<circle cx="${32 + (x - 512) * .047}" cy="${22 + (y - 740) * .049}" r="1.8" fill="currentColor" stroke="none"/>`).join('');
      break;
    case 'breast': {
      const mark = ['M34 20l10-2', 'M35 19l9-1v9q-4 2-9 1z', '', 'M34 20l10-2m-10 4 10-2', 'M35 19l9-1v9h-9zm4 1v6m2-6v6', 'M35 19l9-1v9q-5 3-9 1zm0 3 9-1', 'M34 20q5 2 10-2', 'M35 18h9v6q-4 7-9 0z'][index];
      body = jacket + (mark ? `<path class="icon-detail" d="${mark}"/>` : '');
      break;
    }
    case 'pocket': {
      const pocket = lowerPockets[index];
      const pocketMark = pocket.welts ? (pocket.welts === 1 ? 'M0 0H129' : 'M0 0H129M0 18H129') : [pocket.patch, pocket.flap, pocket.pleat && 'M49 12V90M79 12V90', pocket.ticket && 'M12 -44H86V-16H12Z'].filter(Boolean).join(' ');
      body = `${jacket}<path class="icon-detail" transform="translate(21 31) scale(.077)" d="${pocketMark}"/><path class="icon-detail" transform="translate(43 31) scale(-.077 .077)" d="${pocketMark}"/>`;
      break;
    }
    case 'button':
    case 'trouserButton':
    case 'vestButton':
    case 'cuffFinish': {
      const palette = buttonPalettes[key === 'button' ? index : index - 1] || ['#aaa098', '#6f675f', '#3f3a35'];
      body = `<circle cx="32" cy="24" r="15" fill="${palette[2]}"/><circle cx="32" cy="24" r="11" fill="${palette[1]}" stroke="${palette[0]}"/><path d="M29 21v6m6-6v6" stroke="${palette[0]}" stroke-width="3" stroke-dasharray="1 4"/>`;
      break;
    }
    case 'lining':
    case 'vestLining': {
      const color = key === 'lining' ? liningColors[index] : activeLinings[index - 1]?.[1];
      body = color ? `<path d="M9 12h46v27H9Z" fill="${color}" stroke="none"/><path d="M10 33 34 12m-13 27L53 12M37 39l18-16" stroke="#ffffff55"/>` : '';
      break;
    }
    default:
      return '';
  }
  return `<svg aria-hidden="true" viewBox="0 0 64 50" fill="none" stroke="currentColor" stroke-width="${key === 'lapel' ? 20 : 1.5}" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
}
