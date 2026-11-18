'use strict';

const vestContrast = [null, 1, 15, 11];
const vestButtonRows = [
  [746, 833, 920, 1007, 1094], [730, 809, 888, 967, 1046, 1125],
  [860, 950, 1040, 1130], [792, 904, 1016],
  [765, 853, 941, 1029, 1117], [790, 875, 960, 1045, 1130], [938, 1024, 1110],
];
const trouserPleatPaths = [
  '', 'M414 93Q417 155 447 253', 'M403 91Q396 165 380 249M361 88Q349 154 334 227',
  'M403 91Q396 165 380 249', 'M414 93Q417 155 447 253M365 91Q372 151 393 224',
];

function trouserButtonFinish(design) {
  return design.trouserButton ? design.trouserButton - 1 : design.button;
}

function paintWaistband(ctx, design) {
  const {trouserClosure, trouserWaist, trouserHeight, fabric} = design;
  const lower = [88, 75, 93, 111][trouserHeight];
  if (trouserHeight) {
    fabricSurface(ctx, `M289 40Q512 58 735 40L743 ${lower - 3}Q512 ${lower + 18} 281 ${lower - 3}Z`, fabric, {x: 284, y: 40, w: 456, h: lower - 30});
  }
  const style = trouserClosure || (trouserWaist === 2 ? 4 : 1);
  const offset = (lower - 88) * .55;
  ctx.save();
  ctx.translate(0, offset);
  const extension = {
    3: 'M452 50H559L594 65 560 82H452Z',
    4: 'M449 52H582Q589 64 581 82L449 85Z',
    5: 'M466 54H552L579 66 551 78H466Z',
    6: 'M636 53Q677 49 720 49L721 76Q677 74 636 79Z',
  }[style];
  if (extension) fabricSurface(ctx, extension, fabric, {x: 450, y: 51, w: 130, h: 33});
  if (style === 2 || style === 4) ink(ctx, 'M506 85V106', '#10141b82', 3);
  if ([1, 3, 5, 6].includes(style)) paintButton(ctx, {1: 510, 3: 563, 5: 550, 6: 708}[style], 65, 9, trouserButtonFinish(design), fabric);
  ctx.restore();
}

function paintTrousers(ctx, design, rear = false) {
  const {fabric, trouserPleats, trouserWaist, trouserPocket, trouserHem, trouserTrim} = design;
  ctx.save();
  if (!rear) paintWaistband(ctx, design);
  for (const right of [false, true]) {
    ctx.save();
    if (right) {
      ctx.translate(1024, 0);
      ctx.scale(-1, 1);
    }
    if (!rear && trouserPleats) {
      const pleat = trouserPleatPaths[trouserPleats];
      const start = [0, -12, 4, 20][design.trouserHeight];
      ctx.save();
      ctx.translate(0, start);
      ink(ctx, pleat, '#07111ab0', 5);
      ctx.save();
      ctx.translate(5, 0);
      ink(ctx, pleat, '#ffffff59', 2.7);
      ctx.restore();
      ctx.restore();
    }
    if (!rear && trouserPocket !== 2) {
      const seam = trouserPocket === 0 ? 'M313 89 Q302 172 260 250' : 'M274 115 Q257 177 253 253';
      ink(ctx, seam, '#111522d9', 6.5);
      ctx.save();
      ctx.translate(3, -1);
      ink(ctx, seam, '#ffffff56', 2.4);
      ctx.restore();
    }
    if (!rear && trouserWaist === 0) {
      fabricSurface(ctx, 'M349 41 L362 42 L363 101 L349 100Z', fabric, {x: 347, y: 41, w: 16, h: 60});
    }
    if (!rear && trouserWaist === 1) {
      fabricSurface(ctx, 'M301 57 Q335 55 377 62 L380 76 Q335 73 297 76Z', fabric, {x: 299, y: 55, w: 82, h: 21});
      ink(ctx, 'M340 55H361V77H340Z', '#b4a795', 3.4);
    }
    if (trouserTrim) {
      const trim = trouserTrim === 1 ? '#161622' : '#20354c';
      ink(ctx, 'M278 91 Q234 210 247 430 Q263 612 255 811 Q250 1015 250 1379', trim, 9);
      ink(ctx, 'M281 92 Q237 211 250 430 Q266 613 258 811 Q253 1016 253 1379', '#ffffff38', 1.8);
    }
    if (trouserHem) {
      const cuffY = [1380, 1347, 1328, 1354, 1337][trouserHem];
      const cuff = `M245 ${cuffY} Q325 ${cuffY + 11} 422 ${cuffY - 1} L420 1379 Q339 1402 245 1380Z`;
      fabricSurface(ctx, cuff, fabric, {x: 245, y: cuffY, w: 177, h: 58});
      ink(ctx, `M248 ${cuffY + 1} Q325 ${cuffY + 11} 419 ${cuffY}`, '#ffffff52', 2.6);
    }
    ctx.restore();
  }
  ctx.restore();
}

function drawTrouserFit(ctx, source, fit) {
  if (fit === 0) {
    ctx.drawImage(source, 0, 0);
    return;
  }
  const {width, height} = source;
  const change = [0, -.31, .34, -.16][fit];
  const half = width / 2;
  const legCenter = width / 3;
  for (let y = 0; y < height; y += 2) {
    const row = Math.min(2, height - y);
    const position = y / height;
    const taper = Math.max(0, Math.min(1, (position - .25) / .63, (.92 - position) / .025));
    const stretch = change * taper;
    const destWidth = half * (1 + stretch);
    const offset = -legCenter * stretch;
    ctx.drawImage(source, 0, y, half, row, offset, y, destWidth, row);
    ctx.drawImage(source, half, y, half, row, width - offset - destWidth, y, destWidth, row);
  }
}

function waistcoatNeck(design) {
  return design.vestNeck || [1, 1, 2, 1, 4, 5, 3][design.vestCut];
}

function waistcoatLining(design) {
  return activeLinings[design.vestLining - 1]?.[1] || liningColors[design.lining] || liningColors[0];
}

function paintWaistcoatShirt(ctx) {
  const shirt = ctx.createLinearGradient(431, 435, 595, 835);
  shirt.addColorStop(0, '#f0f2f3');
  shirt.addColorStop(.55, '#faf9f5');
  shirt.addColorStop(1, '#c4c9cb');
  fillShape(ctx, 'M420 410 Q512 457 604 410 L642 937 H382Z', shirt);
  ink(ctx, 'M512 492V932', '#6c767c45', 3);
  fillShape(ctx, 'M427 420 Q469 450 512 456 L477 509ZM597 420 Q555 450 512 456 L547 509Z', '#f9f9f6');
  ink(ctx, 'M427 420L477 509L512 456L547 509L597 420', '#59646a66', 2);
}

function paintWaistcoat(ctx, design, garmentOnly) {
  const {vestCut, vestPocket, vestCloth, vestButton, button} = design;
  const fabric = vestContrast[vestCloth] ?? design.fabric;
  const finish = vestButton === 0 ? button : vestButton - 1;
  const neckStyle = waistcoatNeck(design);
  const double = design.vestClosure ? design.vestClosure >= 4 : vestCut === 3;
  const scoop = neckStyle === 2 || neckStyle === 3;
  const seamStart = scoop ? (neckStyle === 2 ? 798 : 880) : 693;
  if (scoop) {
    const edge = neckStyle === 2
      ? 'M445 458 Q426 551 442 658 Q458 793 511 798 Q566 791 583 655 Q597 550 578 458'
      : 'M430 464 Q411 605 432 738 Q450 868 512 879 Q575 866 593 739 Q613 605 594 464';
    const neck = edge + ' Q512 485 512 493Z';
    ctx.save();
    ctx.clip(new Path2D(neck));
    if (garmentOnly) {
      ctx.clearRect(0, 0, 1024, 1536);
    } else {
      paintWaistcoatShirt(ctx);
    }
    ctx.restore();
    ink(ctx, edge, '#131b22a3', 2.4);
  }
  if (neckStyle === 4 || neckStyle === 5) {
    const collar = neckStyle === 4
      ? 'M425 325 Q408 382 374 424 L398 452 L364 472 Q407 593 511 696 Q457 530 425 325Z'
      : 'M425 325 Q374 374 370 453 Q371 573 511 696 Q458 530 425 325Z';
    for (const right of [false, true]) {
      ctx.save();
      if (right) {
        ctx.translate(1024, 0);
        ctx.scale(-1, 1);
      }
      fabricSurface(ctx, collar, fabric, {x: 367, y: 325, w: 143, h: 370});
      ctx.restore();
    }
  }
  const seam = double
    ? `M513 ${seamStart} Q464 790 453 876 L448 1268`
    : `M512 ${seamStart} Q507 945 511 1310`;
  ink(ctx, seam, '#111820c8', 4.5);
  ctx.save();
  ctx.translate(3, -2);
  ink(ctx, seam, '#ffffff3f', 1.7);
  ctx.restore();

  const legacy = vestButtonRows[vestCut];
  const count = [legacy.length, 4, 5, 6, 3, 4][design.vestClosure];
  const first = Math.max(seamStart + 52, legacy[0]);
  const spacing = Math.min(94, (1163 - first) / (count - 1));
  const rows = !design.vestClosure && !design.vestNeck ? legacy : Array.from({length: count}, (_, i) => first + i * spacing);
  for (const y of rows) {
    if (double) {
      paintButton(ctx, 449, y, 13, finish, fabric);
      paintButton(ctx, 575, y, 13, finish, fabric);
    } else {
      ink(ctx, `M519 ${y}h22`, '#131820a0', 3.5);
      paintButton(ctx, 512, y, 12, finish, fabric);
    }
  }
  if (vestPocket === 3) return;
  for (const right of [false, true]) {
    ctx.save();
    if (right) {
      ctx.translate(1024, 0);
      ctx.scale(-1, 1);
    }
    ctx.translate(318, 1058);
    if (vestPocket === 2) fabricSurface(ctx, 'M0 0H105L102 32Q60 37 3 33Z', fabric, {x: 0, y: 0, w: 106, h: 36});
    else welt(ctx, 105, 2);
    if (vestPocket === 1) {
      ctx.translate(7, -246);
      welt(ctx, 83, 2);
    }
    ctx.restore();
  }
}

function paintWaistcoatBack(ctx, design) {
  if (!design.vestBackAdjuster) return;
  const fabric = vestContrast[design.vestCloth] ?? design.fabric;
  const finish = design.vestBack === 2 ? waistcoatLining(design) : design.vestBack === 1 ? fabrics[fabric].color : null;
  if (design.vestBackAdjuster === 1) {
    fabricSurface(ctx, 'M312 938Q512 975 712 938L705 971Q512 1007 319 969Z', fabric, {x: 312, y: 938, w: 400, h: 40}, finish);
    ink(ctx, 'M490 962h47v32h-47Z M506 963v31', '#cebda2', 5);
  } else {
    fabricSurface(ctx, 'M301 945L388 953L388 982L301 976ZM723 945L636 953L636 982L723 976Z', fabric, {x: 301, y: 945, w: 423, h: 36}, finish);
    const button = design.vestButton ? design.vestButton - 1 : design.button;
    paintButton(ctx, 369, 966, 10, button, fabric);
    paintButton(ctx, 655, 966, 10, button, fabric);
  }
}
