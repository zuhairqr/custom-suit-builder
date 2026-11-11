'use strict';

const passportFields = {
  jacket: [
    ['chest', 'Chest circumference', 'Around the fullest part of the chest.'],
    ['waist', 'Waist circumference', 'Around the natural waist.'],
    ['shoulder', 'Shoulder width', 'Across the back, from shoulder point to shoulder point.'],
    ['length', 'Jacket back length', 'From the base of the neck to the desired hem.'],
    ['leftSleeve', 'Left sleeve length', 'From the shoulder point to the wrist.'],
    ['rightSleeve', 'Right sleeve length', 'From the shoulder point to the wrist.'],
  ],
  trousers: [
    ['waist', 'Waistband circumference', 'Around the level where the trousers will sit.'],
    ['seat', 'Seat circumference', 'Around the fullest part of the hips and seat.'],
    ['thigh', 'Thigh circumference', 'Around the widest part of one thigh.'],
    ['inseam', 'Inseam', 'From the crotch to the desired hem along the inner leg.'],
    ['outseam', 'Outseam', 'From the top of the waistband to the hem along the outside.'],
    ['rise', 'Front rise', 'From the crotch seam to the top of the front waistband.'],
    ['hem', 'Leg opening circumference', 'Around one trouser hem at the desired width.'],
  ],
  waistcoat: [
    ['chest', 'Chest circumference', 'Around the fullest part of the chest.'],
    ['waist', 'Waist circumference', 'Around the natural waist.'],
    ['frontLength', 'Waistcoat front length', 'From the shoulder beside the neck to the desired front point.'],
    ['backLength', 'Waistcoat back length', 'From the base of the neck to the desired back hem.'],
  ],
};

const sizeExamples = {jacket: 'e.g. EU 50', trousers: 'e.g. W32 / L32', waistcoat: 'e.g. UK 40'};
const passportUnits = {cm: 1, in: 2.54};
const minMeasurementCm = 1;
const maxMeasurementCm = 500;

function cleanSizeLabel(value) {
  return typeof value === 'string' ? value.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 24) : '';
}

function validMeasurement(value) {
  return Number.isFinite(value) && value >= minMeasurementCm && value <= maxMeasurementCm;
}

function safePassport(data, outfit) {
  return Object.fromEntries(outfits[outfit].pieces.map((piece) => {
    const prior = data?.[piece];
    const measurements = Object.fromEntries(passportFields[piece]
      .filter(([key]) => validMeasurement(prior?.measurements?.[key]))
      .map(([key]) => [key, prior.measurements[key]]));
    return [piece, {size: cleanSizeLabel(prior?.size), measurements}];
  }));
}

function passportComplete(item) {
  return outfits[item.outfit].pieces.every((piece) =>
    passportFields[piece].every(([key]) => validMeasurement(item.passport[piece].measurements[key])));
}

function measurementInUnit(cm, unit) {
  return Number((cm / passportUnits[unit]).toFixed(2));
}

function orderEscape(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character]);
}

function mountSizePassport(container, items, unit) {
  container.innerHTML = items.map((item, index) => `
    <section class="surface passport-item" aria-labelledby="passport-item-${index}">
      <h2 id="passport-item-${index}">${items.length > 1 ? `Item ${index + 1} · ` : ''}${outfits[item.outfit].name}</h2>
      <p>${fabrics[item.fabric].name} · ${fabrics[item.fabric].code}</p>
      <div class="passport-pieces">${outfits[item.outfit].pieces.map((piece) => `
        <fieldset class="passport-piece" data-passport-item="${index}" data-passport-piece="${piece}">
          <legend>${pieces[piece]}</legend>
          <label class="passport-size">Label size (optional)<input type="text" maxlength="24" autocomplete="off" data-size-label placeholder="${sizeExamples[piece]}"></label>
          <div class="passport-fields">${passportFields[piece].map(([key, label, hint]) => {
            const hintId = `passport-${index}-${piece}-${key}-hint`;
            return `<label>${label} <span class="measurement-unit">(${unit})</span>
              <input type="number" inputmode="decimal" min="${measurementInUnit(minMeasurementCm, unit)}" max="${measurementInUnit(maxMeasurementCm, unit)}" step="any" required data-measurement="${key}" aria-describedby="${hintId}">
              <small id="${hintId}">${hint}</small>
            </label>`;
          }).join('')}</div>
        </fieldset>`).join('')}</div>
    </section>`).join('');

  for (const fieldset of container.querySelectorAll('[data-passport-piece]')) {
    const {passportItem, passportPiece} = fieldset.dataset;
    const entry = items[Number(passportItem)].passport[passportPiece];
    fieldset.querySelector('[data-size-label]').value = entry.size;
    for (const input of fieldset.querySelectorAll('[data-measurement]')) {
      const cm = entry.measurements[input.dataset.measurement];
      if (validMeasurement(cm)) input.value = measurementInUnit(cm, unit);
    }
  }
}

function storePassportInput(items, input, unit) {
  const fieldset = input.closest('[data-passport-piece]');
  if (!fieldset) return;
  const {passportItem, passportPiece} = fieldset.dataset;
  const entry = items[Number(passportItem)].passport[passportPiece];
  const key = input.dataset.measurement;
  if (!key) {
    entry.size = cleanSizeLabel(input.value);
    return;
  }
  const cm = input.valueAsNumber * passportUnits[unit];
  if (Number.isFinite(cm) && input.validity.valid) entry.measurements[key] = Math.max(minMeasurementCm, Math.min(maxMeasurementCm, cm));
  else delete entry.measurements[key];
}

function orderFabric(index) {
  const {name, code, material} = fabrics[index];
  return {name, code, material};
}

function orderConstruction(item, piece) {
  const details = Object.fromEntries(Object.entries(styleGroups)
    .filter(([key]) => stylePiece(key) === piece)
    .map(([key, [label, options]]) => [label, options[item[key]]]));

  if (piece === 'jacket') {
    if (!item.ticket) details[styleGroups.ticket[0]] = styleGroups.ticket[1][lowerPockets[item.pocket].ticket ? 1 : 2];
    if (!item.cuffFinish) details[styleGroups.cuffFinish[0]] = buttonFinishes[item.button];
    if (item.breast === 2) details[styleGroups.square[0]] = 'None';
    if (item.liningCoverage === 2) details[styleGroups.lining[0]] += ' (unlined jacket)';
    if (item.monogram && item.monogramText) details['Monogram text'] = item.monogramText;
  }
  if (piece === 'trousers') {
    if (!item.trouserClosure) details[styleGroups.trouserClosure[0]] = styleGroups.trouserClosure[1][item.trouserWaist === 2 ? 4 : 1];
    if (!item.trouserButton) details[styleGroups.trouserButton[0]] = buttonFinishes[item.button];
  }
  if (piece === 'waistcoat') {
    details[styleGroups.vestNeck[0]] = styleGroups.vestNeck[1][waistcoatNeck(item)];
    if (!item.vestClosure) {
      const count = vestButtonRows[item.vestCut].length;
      details[styleGroups.vestClosure[0]] = item.vestCut === 3 ? 'Double six-button' : styleGroups.vestClosure[1][count - 3];
    }
    if (!item.vestButton) details[styleGroups.vestButton[0]] = buttonFinishes[item.button];
    if (!item.vestLining) details[styleGroups.vestLining[0]] = styleGroups.lining[1][item.lining];
  }
  return details;
}

function orderItem(item, unit) {
  const fabric = orderFabric(item.fabric);
  return {
    outfit: outfits[item.outfit].name,
    fabric: fabric.name,
    fabricCode: fabric.code,
    fabricMaterial: fabric.material,
    price: configurationPrice(item),
    pieces: outfits[item.outfit].pieces.map((piece) => {
      const entry = item.passport[piece];
      return {
        garment: pieces[piece],
        fabric: piece === 'waistcoat' ? orderFabric(vestContrast[item.vestCloth] ?? item.fabric) : fabric,
        size: entry.size || null,
        measurementUnit: unit,
        measurements: Object.fromEntries(passportFields[piece].map(([key, label]) =>
          [label, measurementInUnit(entry.measurements[key], unit)])),
        construction: orderConstruction(item, piece),
      };
    }),
  };
}

function orderSpecification(items, total, bodyFit) {
  const rows = (entries) => `<dl class="spec-list">${entries.map(([label, value]) =>
    `<div><dt>${orderEscape(label)}</dt><dd>${orderEscape(value)}</dd></div>`).join('')}</dl>`;
  return items.map((item, index) => `
    <article class="order-item">
      <div class="receipt-row"><h3>${items.length > 1 ? `Item ${index + 1} · ` : ''}${item.outfit}</h3><strong>${money(item.price)}</strong></div>
      <div class="order-fabric"><span>Fabric</span><strong>${item.fabric}</strong><small>${item.fabricCode} · ${item.fabricMaterial}</small></div>
      ${item.pieces.map((piece) => `
        <details class="order-piece" open>
          <summary><strong>${piece.garment}</strong><span>${orderEscape(piece.size || 'Made to measure')}</span></summary>
          ${piece.fabric.code !== item.fabricCode ? `<p class="piece-fabric">Fabric · <strong>${piece.fabric.name}</strong> · ${piece.fabric.code} · ${piece.fabric.material}</p>` : ''}
          <h4>Measurements</h4>
          ${rows(Object.entries(piece.measurements).map(([label, value]) => [label, `${value} ${piece.measurementUnit}`]))}
          <h4>Construction</h4>
          ${rows(Object.entries(piece.construction))}
        </details>`).join('')}
    </article>`).join('') + `
    <details class="order-piece order-fit"><summary><strong>Body features</strong></summary>${rows(Object.entries(fitGroups).map(([key, [label]]) => [label, bodyFit[key] || '—']))}</details>
    <div class="receipt-row order-total"><strong>Order total</strong><strong>${money(total)}</strong></div>`;
}
