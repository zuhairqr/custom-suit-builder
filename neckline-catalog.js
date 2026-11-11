'use strict';

const necklineSections = [
  {title: "Classic suit & tuxedo lapels", styles: `Notch Lapel (Step Lapel)
Peak Lapel (Pointed Lapel)
Shawl Lapel (Roll Collar)
Narrow Notch Lapel (Slim Notch)
Standard Notch Lapel
Wide Notch Lapel
Narrow Peak Lapel (Slim Peak)
Standard Peak Lapel
Wide Peak Lapel
Belly Peak Lapel (Curved Peak)
Narrow Shawl Lapel
Wide Shawl Lapel
Satin-Faced Peak Lapel
Satin-Faced Shawl Lapel
Grosgrain-Faced Peak Lapel
Grosgrain-Faced Shawl Lapel
Velvet Shawl Lapel
Self-Faced Shawl Lapel`.split('\n')},
  {title: "Vintage, bespoke & specialty suit lapels", styles: `Fishmouth Lapel
Cloverleaf Lapel
T-Notch Lapel (L-Notch)
Semi-Peak Lapel
Parisienne Lapel
Drop-Gorge Lapel (Low Gorge)
High-Gorge Lapel
Double-Breasted Peak Lapel
Double-Breasted Shawl Lapel
Double-Breasted Notch Lapel
Conch Lapel
Swallowtail Lapel
Cross-Over Lapel
Asymmetrical Lapel
Layered / Double Lapel
Piped Lapel (Contrast Piping)
Pick-Stitched Lapel
Topstitched Lapel
Raw-Edge Lapel
Detached / Removable Lapel`.split('\n')},
  {title: "Overcoat, trench & outerwear lapels", styles: `Ulster Collar / Lapel
Storm Lapel (Convertible Lapel)
Napoleon Lapel (High-Buttoning)
Trench Coat Lapel (Gun-Flap Lapel)
Chesterfield Velvet-Trimmed Lapel
Polo Coat Peak Lapel
Pea Coat Wide Ulster Lapel
Reefer Lapel
Biker / Moto Asymmetric Snap Lapel
Shearling / Fur-Trimmed Lapel
Cape Lapel
Draped Waterfall Lapel
Oversized Blanket Lapel
Hooded Shawl Lapel
Funnel Lapel`.split('\n')},
  {title: "Standing & no-lapel alternatives", styles: `Mandarin Collar
Nehru Collar
Band Collar (Grandad Collar)
Mao Collar
Cadet Collar
Funnel Neck Collar
Turtleneck / Roll-Neck Jacket Front
Mock-Neck Jacket Front
Jewel / Collarless Round Front
V-Neck Collarless Front
Cardi-Coat Open Front (No Lapel)`.split('\n')},
  {title: "Shirt, blouse & dress collars", styles: `Camp Collar (Cuban Collar)
Revere Collar (Pajama Collar)
Convertible Collar
Flat Peter Pan Collar
Raised Peter Pan Collar
Puritan Collar
Pilgrim Collar
Sailor Collar (Middy Collar)
Bertha Collar
Chelsea Collar
Eton Collar
Wingtip Collar (Tuxedo Shirt)
Spread Collar
Point Collar (Straight Collar)
Button-Down Collar
Club Collar (Rounded)
Tab Collar
Pin Collar
Barrymore Collar (Long Point)
Spearpoint Collar
Cutaway Collar (Extreme Spread)
Swallow Collar
Ascot / Tie-Neck Collar
Ruffled / Jabot Collar
Lace-Trimmed Collar
Scalloped Collar
Pleated Collar
Origami / Sculpted Lapel`.split('\n')},
  {title: "Women's blazer, coat & couture lapels", styles: `Tuxedo Stripe Satin Lapel
Cropped Bolero Shawl Lapel
Tuxedo Dress Wrap Lapel
Belted Trench Shawl Lapel
Peplum Blazer Notch Lapel
Off-Shoulder Folded Lapel
Portrait Collar Lapel
Sweetheart Folded Lapel
Draped Cowl Lapel
Kimono-Band Lapel
Contrast-Color Blocked Lapel
Embellished / Beaded Lapel
Sequined Evening Lapel`.split('\n')},
];

// Appended geometry keeps the original saved lapel indices stable.
const extraLapelShapes = [
  ['Narrow peak', 'M424 321 Q405 370 382 420 L407 458 L361 441 Q421 614 512 720 Q460 534 424 321Z'],
  ['Belly peak', 'M424 321 Q391 373 342 418 L374 456 L287 435 C314 562 420 677 512 720 Q459 531 424 321Z'],
  ['Narrow shawl', 'M424 321 Q391 374 392 466 C398 572 438 657 512 720 Q463 534 424 321Z'],
  ['Fishmouth', 'M424 321 Q393 375 339 414 L375 440 Q356 457 328 453 Q376 612 512 720 Q461 535 424 321Z'],
  ['Cloverleaf', 'M424 321 Q390 365 351 398 Q329 423 366 441 Q316 438 326 469 C349 575 430 684 512 720 Q461 535 424 321Z'],
  ['T-notch', 'M424 321 Q396 373 350 411 L330 440 L375 440 L375 466 L332 466 Q385 617 512 720 Q462 531 424 321Z'],
  ['Semi-peak', 'M424 321 Q393 371 345 418 L374 455 L326 451 Q380 614 512 720 Q459 532 424 321Z'],
  ['Parisienne', 'M424 321 Q391 365 349 395 L374 419 L330 415 C371 566 440 666 512 720 Q456 531 424 321Z'],
  ['Drop gorge', 'M424 321 C398 376 390 440 356 482 L389 510 L351 515 Q408 651 512 720 Q456 533 424 321Z'],
  ['Conch', 'M424 321 C366 360 317 396 337 453 Q359 474 365 449 C352 555 430 669 512 720 Q460 532 424 321Z'],
  ['Swallowtail', 'M424 321 Q382 376 342 400 L366 451 L280 407 L325 497 Q382 642 512 720 Q458 532 424 321Z'],
  ['Cross-over', 'M424 321 C389 355 352 407 350 467 Q380 590 562 746 Q471 530 424 321Z'],
  ['Asymmetrical', 'M424 321 C368 359 320 412 335 478 Q371 627 512 720 Q460 535 424 321Z', 11],
  ['Layered', 'M424 321 Q384 363 338 402 L360 447 L304 425 Q367 612 512 720 Q461 534 424 321Z', 28],
  // Women's blazer & couture lapels (93-105)
  ['Tuxedo stripe satin', 'M424 321 Q393 371 350 420 L375 456 Q345 451 335 456 C372 565 440 670 512 720 Q459 532 424 321Z'],
  ['Cropped bolero shawl', 'M424 321 Q391 365 380 425 C386 490 425 570 512 720 Q463 535 424 321Z'],
  ['Tuxedo dress wrap', 'M424 321 C375 350 330 395 315 455 L345 485 L305 490 Q365 620 512 720 Q458 530 424 321Z'],
  ['Belted trench shawl', 'M424 321 Q385 368 375 445 L395 465 L365 470 C395 575 445 665 512 720 Q462 532 424 321Z'],
  ['Peplum blazer notch', 'M424 321 Q393 371 348 415 L328 445 L375 467 L330 472 Q385 615 512 720 Q460 532 424 321Z'],
  ['Off-shoulder folded', 'M424 321 C365 340 310 385 305 445 Q335 525 425 650 Q455 680 512 720 Q462 535 424 321Z'],
  ['Portrait collar', 'M424 321 Q382 355 365 405 L395 430 L360 435 C390 550 445 665 512 720 Q461 533 424 321Z'],
  ['Sweetheart folded', 'M424 321 C380 348 345 385 340 435 C345 505 395 605 512 720 Q460 535 424 321Z'],
  ['Draped cowl', 'M424 321 C375 355 340 405 335 465 Q355 545 425 655 Q465 695 512 720 Q461 534 424 321Z'],
  ['Kimono-band', 'M424 321 Q390 360 370 420 C375 490 420 600 512 720 Q462 535 424 321Z'],
  ['Contrast-color blocked', 'M424 321 Q388 368 345 418 L375 458 L320 450 Q380 615 512 720 Q459 532 424 321Z'],
  ['Embellished / beaded', 'M424 321 Q393 371 350 420 L375 456 L335 456 Q390 615 512 720 Q459 532 424 321Z'],
  ['Sequined evening', 'M424 321 Q391 365 360 410 L385 450 L340 448 C375 570 445 675 512 720 Q460 533 424 321Z'],

  // Vintage & specialty continued
  ['Double-breasted peak', 'M424 321 Q391 370 338 418 L368 458 L298 440 Q368 600 512 720 Q460 532 424 321Z'],
  ['Double-breasted shawl', 'M424 321 Q360 380 360 462 Q365 592 512 720 Q460 538 424 321Z'],
  ['Double-breasted notch', 'M424 321 Q397 365 353 410 L333 442 L370 465 L338 472 Q392 598 512 720 Q458 532 424 321Z'],
  ['Piped lapel', 'M424 321 Q398 363 356 408 L336 440 L372 464 L340 471 Q395 596 512 720 Q457 533 424 321Z'],
  ['Pick-stitched lapel', 'M424 321 Q399 361 359 406 L338 438 L373 462 L342 469 Q396 595 512 720 Q458 533 424 321Z'],
  ['Topstitched lapel', 'M424 321 Q400 360 360 405 L340 437 L374 461 L344 468 Q397 594 512 720 Q459 532 424 321Z'],
  ['Raw-edge lapel', 'M424 321 Q398 364 357 409 L337 441 L371 465 L341 472 Q394 597 512 720 Q457 534 424 321Z'],
  ['Detached lapel', 'M424 321 Q401 362 361 407 L342 439 L375 463 L346 470 Q398 596 512 720 Q460 533 424 321Z'],

  // Overcoat & outerwear lapels
  ['Ulster collar', 'M424 321 Q385 355 370 400 C375 490 425 610 512 720 Q462 535 424 321Z'],
  ['Storm lapel', 'M424 321 Q390 368 348 415 L328 448 L368 472 L325 480 Q380 615 512 720 Q460 532 424 321Z'],
  ['Napoleon lapel', 'M424 321 Q405 360 380 395 L360 420 L390 445 L365 455 Q415 590 512 720 Q462 530 424 321Z'],
  ['Trench coat lapel', 'M424 321 Q388 365 345 410 L320 445 L365 475 L310 485 Q375 620 512 720 Q458 533 424 321Z'],
  ['Chesterfield velvet', 'M424 321 C368 352 318 400 320 475 C324 568 398 668 512 720 Q457 536 424 321Z'],
  ['Polo coat peak', 'M424 321 Q393 373 342 420 L370 460 L300 443 Q368 603 512 720 Q459 533 424 321Z'],
  ['Pea coat ulster', 'M424 321 Q382 358 365 405 C370 495 420 615 512 720 Q461 536 424 321Z'],
  ['Reefer lapel', 'M424 321 Q395 370 350 415 L330 445 L370 470 L330 480 Q385 615 512 720 Q460 534 424 321Z'],
  ['Biker asymmetric', 'M424 321 C360 345 305 390 295 450 Q325 550 445 670 Q480 700 512 720 Q461 535 424 321Z'],
  ['Shearling fur-trimmed', 'M424 321 C370 354 322 402 325 478 C330 570 400 670 512 720 Q458 537 424 321Z'],
  ['Cape lapel', 'M424 321 Q375 360 360 425 C365 515 420 630 512 720 Q460 538 424 321Z'],
  ['Draped waterfall', 'M424 321 C368 358 325 410 320 485 Q340 580 440 680 Q475 705 512 720 Q460 536 424 321Z'],
  ['Oversized blanket', 'M424 321 Q370 365 340 425 C345 520 410 640 512 720 Q458 538 424 321Z'],
  ['Hooded shawl', 'M424 321 Q365 382 365 465 C370 585 425 680 512 720 Q461 538 424 321Z'],
  ['Funnel lapel', 'M424 321 Q395 358 375 410 C380 490 430 600 512 720 Q462 535 424 321Z'],

  // Standing & no-lapel alternatives
  ['Mandarin collar', 'M424 321 Q410 340 395 360 L395 380 L405 380 L405 360 Q420 340 424 321Z'],
  ['Nehru collar', 'M424 321 Q408 342 390 365 L390 390 L410 390 L410 365 Q422 342 424 321Z'],
  ['Band collar', 'M424 321 Q412 338 398 358 L398 375 L402 375 L402 358 Q418 338 424 321Z'],
  ['Mao collar', 'M424 321 Q409 343 388 368 L388 395 L412 395 L412 368 Q423 343 424 321Z'],
  ['Cadet collar', 'M424 321 Q411 339 396 362 L396 382 L408 382 L408 362 Q421 339 424 321Z'],
  ['Funnel neck', 'M424 321 Q405 345 385 375 L385 405 L415 405 L415 375 Q425 345 424 321Z'],
  ['Turtleneck front', 'M424 321 Q400 350 375 390 L375 430 L425 430 L425 390 Q430 350 424 321Z'],
  ['Mock-neck front', 'M424 321 Q407 344 390 370 L390 395 L413 395 L413 370 Q424 344 424 321Z'],
  ['Jewel collarless', 'M424 321 Q415 335 405 350 L405 360 L420 360 L420 350 Q428 335 424 321Z'],
  ['V-neck collarless', 'M424 321 L400 360 L400 380 L424 360 L448 380 L448 360 L424 321Z'],
  ['Cardi-coat open', 'M424 321 Q420 330 415 340 L415 350 L433 350 L433 340 Q428 330 424 321Z'],

  // Shirt, blouse & dress collars
  ['Camp collar', 'M424 321 Q400 355 380 395 L370 420 L405 435 L375 445 Q415 570 512 720 Q462 535 424 321Z'],
  ['Revere collar', 'M424 321 Q395 358 370 400 L360 425 L400 440 L370 450 Q420 580 512 720 Q461 536 424 321Z'],
  ['Convertible collar', 'M424 321 Q398 360 375 402 L365 428 L402 442 L375 452 Q418 575 512 720 Q462 534 424 321Z'],
  ['Flat peter pan', 'M424 321 Q405 350 390 380 C395 440 430 530 512 720 Q463 535 424 321Z'],
  ['Raised peter pan', 'M424 321 Q402 352 385 385 C390 445 432 535 512 720 Q462 536 424 321Z'],
  ['Puritan collar', 'M424 321 Q408 348 395 378 C400 435 435 525 512 720 Q464 534 424 321Z'],
  ['Pilgrim collar', 'M424 321 Q406 351 392 382 C398 438 436 528 512 720 Q463 535 424 321Z'],
  ['Sailor collar', 'M424 321 Q385 365 365 420 C372 510 425 630 512 720 Q460 538 424 321Z'],
  ['Bertha collar', 'M424 321 Q380 368 355 430 C365 525 420 640 512 720 Q458 540 424 321Z'],
  ['Chelsea collar', 'M424 321 Q404 354 388 388 C394 442 438 532 512 720 Q464 536 424 321Z'],
  ['Eton collar', 'M424 321 Q407 349 396 380 C402 438 436 530 512 720 Q463 535 424 321Z'],
  ['Wingtip collar', 'M424 321 Q410 346 400 375 L395 395 L415 405 L395 415 Q430 545 512 720 Q465 535 424 321Z'],
  ['Spread collar', 'M424 321 Q405 352 392 385 L385 405 L410 415 L388 425 Q425 550 512 720 Q464 536 424 321Z'],
  ['Point collar', 'M424 321 Q408 350 398 380 L395 400 L413 408 L398 418 Q428 542 512 720 Q466 534 424 321Z'],
  ['Button-down collar', 'M424 321 Q406 353 394 386 L390 406 L412 414 L395 424 Q426 548 512 720 Q465 535 424 321Z'],
  ['Club collar', 'M424 321 Q404 355 390 390 C396 445 435 535 512 720 Q463 537 424 321Z'],
  ['Tab collar', 'M424 321 Q409 351 400 382 L398 402 L414 410 L400 420 Q429 544 512 720 Q466 535 424 321Z'],
  ['Pin collar', 'M424 321 Q410 352 402 384 L400 404 L416 412 L403 422 Q430 546 512 720 Q467 536 424 321Z'],
  ['Barrymore collar', 'M424 321 Q403 356 386 395 L378 420 L408 432 L385 442 Q422 565 512 720 Q464 537 424 321Z'],
  ['Spearpoint collar', 'M424 321 Q407 354 396 388 L392 410 L414 420 L398 430 Q427 552 512 720 Q465 536 424 321Z'],
  ['Cutaway collar', 'M424 321 Q400 358 382 398 L372 425 L405 438 L380 448 Q418 575 512 720 Q462 538 424 321Z'],
  ['Swallow collar', 'M424 321 Q405 356 393 392 L388 415 L412 426 L395 436 Q425 558 512 720 Q464 537 424 321Z'],
  ['Ascot tie-neck', 'M424 321 Q398 362 378 405 L368 432 L402 445 L375 455 Q415 582 512 720 Q461 539 424 321Z'],
  ['Ruffled jabot', 'M424 321 Q395 365 372 412 C378 485 425 590 512 720 Q460 540 424 321Z'],
  ['Lace-trimmed', 'M424 321 Q402 360 385 398 C392 460 432 560 512 720 Q463 538 424 321Z'],
  ['Scalloped collar', 'M424 321 Q404 357 390 393 C397 448 436 548 512 720 Q464 538 424 321Z'],
  ['Pleated collar', 'M424 321 Q406 359 392 396 C399 452 437 552 512 720 Q465 539 424 321Z'],
  ['Origami sculpted', 'M424 321 Q390 370 360 425 C370 515 425 635 512 720 Q458 542 424 321Z'],
];

// Presets store [geometry, facing, jacket closure, pick stitching]. Later entries
// describe garment families whose pattern blocks are outside the suit studio.
const suitNecklinePresets = [
  [0], [2], [4], [11], [0], [1], [15], [2], [3], [16], [17], [14],
  [2, 1], [4, 1], [2, 2], [4, 2], [4, 4], [4, 0],
  [18], [19], [20], [21], [22], [23], [12], [2, 0, 4], [4, 0, 4], [0, 0, 4],
  [24], [25], [26, 0, 3], [27], [28], [0, 5], [0, 0, null, 4], [0, 6], [0, 7], [0, 8],
];

function installNecklineCatalog(onApply) {
  const dialog = get('neckline-dialog');
  const filter = get('neckline-category');
  const list = get('neckline-list');
  const count = get('neckline-count');
  let first = 0;
  filter.innerHTML = necklineSections.map(({title}, i) => `<option value="${i}">${title}</option>`).join('');
  function showCategory() {
    const category = Number(filter.value);
    const styles = necklineSections[category].styles;
    first = necklineSections.slice(0, category).reduce((total, section) => total + section.styles.length, 0);
    count.textContent = `${styles.length} styles in this category`;
    list.innerHTML = styles.map((name, i) => {
      const number = first + i;
      const preset = suitNecklinePresets[number];
      return `<li><span class="neckline-number">${String(number + 1).padStart(2, '0')}</span><strong>${name}</strong>${
        preset ? `<button type="button" class="secondary" data-neckline="${number}" aria-label="Apply ${name}">Apply</button>`
          : '<span class="neckline-reference">Reference</span>'}</li>`;
    }).join('');
  }
  get('open-necklines').addEventListener('click', () => {
    showCategory();
    dialog.showModal();
  });
  filter.addEventListener('change', showCategory);
  list.addEventListener('click', (event) => {
    const button = event.target.closest('[data-neckline]');
    if (!button) return;
    onApply(suitNecklinePresets[Number(button.dataset.neckline)]);
    dialog.close();
  });
}
