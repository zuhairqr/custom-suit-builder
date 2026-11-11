'use strict';

// Crops in the shared 1024 × 1536 portrait coordinates.
const constructionDetails = {
  silhouette: ['front', 69, 322, 886, 1160], lapel: ['front', 265, 320, 495, 500], lapelFinish: ['front', 280, 325, 465, 490],
  closure: ['front', 296, 687, 432, 484], button: ['front', 335, 723, 360, 420], breast: ['front', 577, 500, 240, 250],
  pocket: ['front', 245, 925, 233, 245], ticket: ['front', 253, 910, 230, 240], cuff: ['front', 49, 1108, 164, 241],
  cuffFinish: ['front', 49, 1108, 164, 241], stitching: ['front', 284, 400, 230, 263], square: ['front', 587, 509, 227, 241],
  vent: ['back', 204, 1130, 616, 342], collarFelt: ['back', 350, 244, 328, 204],
  shoulder: ['front', 126, 323, 325, 333], canvasType: ['inside', 112, 378, 385, 1000, 'canvas'],
  liningCoverage: ['inside', 93, 337, 838, 1044], lining: ['inside', 129, 615, 265, 627], inner: ['inside', 158, 681, 710, 587],
  monogram: ['inside', 198, 670, 192, 260], monogramThread: ['inside', 198, 670, 192, 260],
  trouserFit: ['trousers', 207, 20, 616, 1485], trouserPleats: ['trousers', 253, 67, 518, 336],
  trouserWaist: ['trousers', 245, 27, 535, 189], trouserClosure: ['trousers', 273, 20, 486, 147], trouserHeight: ['trousers', 259, 11, 512, 173],
  trouserPocket: ['trousers', 229, 61, 225, 264], trouserHem: ['trousers', 204, 1190, 252, 280],
  trouserTrim: ['trousers', 222, 219, 223, 716], trouserButton: ['trousers', 276, 19, 473, 184, 'trouserButton'],
  trouserSuspender: ['trousers', 240, 17, 545, 226, 'suspender'], trouserLining: ['trousers', 222, 52, 579, 1321, 'legLining'],
  trouserReinforcement: ['trousers', 269, 184, 489, 504, 'reinforcement'],
  vestCut: ['waistcoat', 230, 323, 567, 995], vestNeck: ['waistcoat', 349, 306, 328, 606],
  vestClosure: ['waistcoat', 354, 666, 322, 563], vestPocket: ['waistcoat', 281, 751, 465, 416],
  vestCloth: ['waistcoat', 278, 607, 460, 667], vestButton: ['waistcoat', 400, 675, 227, 546],
  vestBack: ['waistcoatBack', 228, 325, 567, 949], vestBackAdjuster: ['waistcoatBack', 258, 810, 508, 349],
  vestLining: ['waistcoatBack', 226, 326, 571, 951, 'vestLining'],
};

const constructionGuides = {
  ticket: 'A small pocket above the wearer’s right side pocket. Choose it independently of the side-pocket shape.',
  stitching: 'The AMF setting controls the stitch line’s distance from the edge of the lapel and pocket.',
  collarFelt: 'Choose self fabric or a tonal felt panel under the back collar.',
  shoulder: 'Choose padding and pleating independently of the jacket silhouette.',
  canvasType: 'A cutaway shows how far the support layer extends inside the jacket.',
  liningCoverage: 'Choose how much of the jacket interior is lined. Set its color separately.',
  monogram: 'Add up to 12 characters on the left or right inside panel.',
  monogramThread: 'Thread color applies to the monogram selected in Jacket details.',
  trouserWaist: 'Set belt loops or side adjusters independently of the front closure.',
  trouserClosure: 'Choose the shape of the tab and whether its fastening is exposed.',
  trouserHeight: 'Controls the depth of the waistband band.',
  trouserSuspender: 'The cutaway shows optional buttons on the inside of the waistband.',
  trouserLining: 'The cutaway shows lining to the knee or down the leg.',
  trouserReinforcement: 'The cutaway shows the optional reinforcement inside the crotch seam.',
  vestCut: 'Choose a base style, then adjust its neckline and closure separately.',
  vestNeck: 'Choose the front neckline independently of the button layout.',
  vestClosure: 'Set the button count and arrangement independently of the neckline.',
  vestBack: 'Choose the cloth or satin on the outside back.',
  vestBackAdjuster: 'Add a buckle strap or two side tabs.',
  vestLining: 'Select the inner lining color. The cutaway shows the covered panel.',
};

const cutawayNames = {
  canvasType: 'Canvas cutaway', trouserSuspender: 'Inside waistband', trouserLining: 'Leg lining cutaway',
  trouserReinforcement: 'Crotch seam cutaway', vestLining: 'Waistcoat lining cutaway', trouserButton: 'Trouser fastening detail',
};

function paintShoulderDetails(ctx, design) {
  const shape = design.shoulder;
  if (!shape) return;
  const seam = [
    '', 'M205 452Q252 408 386 360', 'M203 458Q264 402 391 358',
    'M194 444Q260 399 389 357', 'M191 439Q263 398 387 355', 'M177 427Q254 383 390 354',
  ][shape];
  for (const right of [false, true]) {
    ctx.save();
    if (right) {
      ctx.translate(1024, 0);
      ctx.scale(-1, 1);
    }
    ctx.clip(new Path2D('M420 317Q388 369 218 435Q193 450 185 484L219 525L425 395Z'));
    ink(ctx, seam, '#0e171e8f', shape === 5 ? 4 : 2.6);
    ctx.translate(0, 3);
    ink(ctx, seam, '#ffffff42', 1.8);
    if (shape === 1 || shape === 4) {
      for (let i = 0; i < 4; i++) {
        const x = 207 + 10 * i;
        const y = 453 - 6 * i;
        ink(ctx, `M${x} ${y}q16 15 7 38`, '#09121a99', 2.5);
      }
    }
    ctx.restore();
  }
}

function paintConstructionCutaway(ctx, kind, design) {
  const fabric = design.fabric;
  switch (kind) {
    case 'canvas': {
      const panel = design.canvasType === 1
        ? 'M391 445Q308 537 229 670L139 1239Q217 1345 326 1334L349 797Z'
        : 'M391 445Q308 537 229 670L190 910Q260 953 343 922L349 797Z';
      if (design.canvasType !== 2) {
        fabricSurface(ctx, panel, fabric, {x: 137, y: 445, w: 257, h: 890}, '#d0bfa0');
        ink(ctx, panel, '#6c614d', 2.7, [4, 5]);
      }
      break;
    }
    case 'suspender':
      fabricSurface(ctx, 'M287 40Q512 58 737 40L744 114Q512 133 280 114Z', fabric, {x: 281, y: 40, w: 463, h: 90}, '#a3a099');
      ink(ctx, 'M285 110Q512 127 740 110', '#fff8ddbc', 2.4, [3, 4]);
      if (design.trouserSuspender) {
        for (const x of [322, 380, 484, 540, 644, 702]) paintButton(ctx, x, 85, 10, trouserButtonFinish(design), fabric);
      }
      break;
    case 'legLining':
      if (design.trouserLining) {
        const end = design.trouserLining === 1 ? 775 : 1341;
        for (const right of [false, true]) {
          ctx.save();
          if (right) {
            ctx.translate(1024, 0);
            ctx.scale(-1, 1);
          }
          const panel = `M298 102Q255 260 273 491L269 ${end}Q332 ${end + 18} 414 ${end}Q445 533 504 364L497 104Z`;
          fabricSurface(ctx, panel, fabric, {x: 265, y: 102, w: 240, h: end - 102}, '#d7d7cf');
          ink(ctx, panel, '#76766fbf', 2.5, [4, 5]);
          ctx.restore();
        }
      }
      break;
    case 'reinforcement':
      if (design.trouserReinforcement) {
        const patch = design.trouserReinforcement === 1
          ? 'M415 272Q512 250 609 272L544 434Q512 473 480 434Z'
          : 'M382 239Q512 216 642 239L560 487Q512 540 464 487Z';
        fabricSurface(ctx, patch, fabric, {x: 382, y: 216, w: 260, h: 312}, '#bab4a5');
        ink(ctx, patch, '#504943c4', 3, [4, 5]);
      }
      break;
    case 'vestLining': {
      const panel = 'M430 351Q511 402 593 351L743 440Q711 546 716 637L735 1161Q512 1249 289 1161L307 637Q314 547 281 440Z';
      fabricSurface(ctx, panel, fabric, {x: 281, y: 351, w: 462, h: 890}, waistcoatLining(design));
      ink(ctx, panel, '#f3f0e17a', 2.8, [4, 4]);
      break;
    }
    case 'trouserButton':
      if ([2, 4].includes(design.trouserClosure)) paintButton(ctx, 512, 76, 10, trouserButtonFinish(design), fabric);
      break;
  }
}

let constructionSource;

function paintConstructionFocus(canvas, detail, design, split, fullPreview) {
  const spec = constructionDetails[detail];
  if (!spec) return false;
  const [view, x, y, width, height, cutaway] = spec;
  if (!fullPreview) {
    constructionSource ||= makeCanvas(1, 1);
    if (!paintGarmentPhoto(constructionSource, design, view, split)) return false;
  }
  const ctx = canvas.getContext('2d');
  const zoom = Math.min(canvas.width / width, canvas.height / height);
  const originX = (canvas.width - width * zoom) / 2;
  const originY = (canvas.height - height * zoom) / 2;
  const cropX = ['monogram', 'monogramThread'].includes(detail) && design.monogram === 2 ? 1024 - x - width : x;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.beginPath();
  ctx.rect(originX, originY, width * zoom, height * zoom);
  ctx.clip();
  ctx.translate(originX - cropX * zoom, originY - y * zoom);
  ctx.scale(zoom, zoom);
  if (fullPreview) ctx.drawImage(fullPreview, 0, 0, fullSuitSize.width, fullSuitSize.height);
  else ctx.drawImage(constructionSource, 0, 0, 1024, 1536);
  if (cutaway) paintConstructionCutaway(ctx, cutaway, design);
  ctx.restore();
  return true;
}
