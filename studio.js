'use strict';

const get = (id) => document.getElementById(id);
const storageKey = 'form-atelier-v1';
const receiptKey = 'form-atelier-demo-order-v1';
const money = (value) => new Intl.NumberFormat('en-US', {style: 'currency', currency: 'USD', maximumFractionDigits: 0}).format(value);
const configurationPrice = (configuration) => outfits[configuration.outfit].price + fabrics[configuration.fabric].surcharge;

function readSaved() {
  try {
    return JSON.parse(localStorage.getItem(storageKey)) || {};
  } catch {
    return {};
  }
}

function cleanMonogram(value) {
  return typeof value === 'string' ? value.normalize().replace(/[^\p{L}\p{N} .-]/gu, '').slice(0, 12) : '';
}

function safeDesign(data) {
  const config = {...defaults};
  for (const key of ['fabric', 'outfit', ...Object.keys(styleGroups)]) {
    const limit = {fabric: fabrics.length, outfit: outfits.length}[key] || styleGroups[key][1].length;
    const value = data?.[key];
    if (Number.isInteger(value) && value >= 0 && value < limit) config[key] = value;
  }
  config.monogramText = cleanMonogram(data?.monogramText);
  if (config.lining === 3) {
    config.lining = 0;
    config.liningCoverage = 2;
  }
  return config;
}

const saved = readSaved();
let design = safeDesign(saved.design);
let bag = Array.isArray(saved.bag) ? saved.bag.map((entry) => {
  const item = safeDesign(entry);
  return {...item, passport: safePassport(entry?.passport, item.outfit)};
}) : [];
let fitUnit = saved.fitUnit === 'in' ? 'in' : 'cm';
let fit = {};
for (const [key, [, options]] of Object.entries(fitGroups)) {
  if (options.includes(saved.fit?.[key])) fit[key] = saved.fit[key];
}
let angle = 'front';
let piece = 'jacket';
let jacketHidden = false;
let waistcoatHidden = false;
let three3DRenderer = null;
let threePreviewAngle = null;
let modelPreference = saved.modelPreference === 'mannequin' ? 'mannequin' : 'studio';
let studioFaceId = studioFaces.some(({id}) => id === saved.studioFaceId) ? saved.studioFaceId : 'original';
let skinTone = Number.isInteger(saved.skinTone) && mannequinTones[saved.skinTone] ? saved.skinTone : 0;
let split = true;
let zoomed = false;
let zoomFocus = 53;
let lookDetail = '';
let previewDetailTrigger = null;
let receipt = readSessionReceipt();
let fabricPage = 0;
const fabricsPerPage = 12;
const failedPhotos = new Set();
const loadingPhotos = new Set();
const paintedDetailThumbnails = new WeakMap();
const previewDetailSets = {
  jacket: ['lapel', 'closure', 'pocket'],
  trousers: ['trouserPleats', 'trouserClosure', 'trouserPocket'],
  waistcoat: ['vestNeck', 'vestClosure', 'vestPocket'],
};
const photoSources = {
  front: frontMannequin, inside: insideMannequin, back: backMannequin, trousers: trousersMannequin, waistcoat: waistcoatMannequin,
  trousersBack: trousersBackMannequin, waistcoatBack: waistcoatBackMannequin,
};
const detailViews = {lining: 'inside', liningCoverage: 'inside', inner: 'inside', monogram: 'inside', monogramThread: 'inside', canvasType: 'inside', collarFelt: 'back', vent: 'back'};
const collectionCodes = new Set(collectionLooks.map(({fabric}) => fabric));

function save() {
  try {
    localStorage.setItem(storageKey, JSON.stringify({design, bag, fit, fitUnit, skinTone, modelPreference, studioFaceId}));
    return true;
  } catch {
    // The current tab can still hold the configuration when storage is disabled.
    return false;
  }
}

const fabricFacets = [...get('fabric-facets').querySelectorAll('select')];
const fabricOrder = fabrics.map((fabric, index) => ({fabric, index, traits: fabricTraits(fabric)}));
fabricOrder.sort((a, b) => Number(Boolean(b.fabric.scan)) - Number(Boolean(a.fabric.scan)));

function fabricTraits(fabric) {
  const {name, material, family, weave} = fabric;
  const colorGroups = {
    blue: /navy|blue|cornflower|midnight|teal|petrol/i, grey: /grey|gray|graphite|charcoal|pewter|silver/i,
    black: /ink|onyx|black/i, green: /pine|forest|sage|olive|moss|eucalyptus/i,
    brown: /cocoa|espresso|tobacco|chestnut|copper|camel/i, beige: /sand|taupe|oyster|stone|oat|ivory|beige/i,
    red: /burgundy|oxblood|rose|red/i, purple: /plum|aubergine|heather|purple/i,
  };
  const color = fabric.colorGroup || Object.keys(colorGroups).find((key) => colorGroups[key].test(name)) || 'grey';
  const pattern = /stripe/.test(weave) ? 'stripe' : /plaid|window|prince|gunclub|houndstooth/.test(weave) ? 'check'
    : weave === 'herringbone' ? weave : /plain|twill|linen/.test(weave) ? 'solid' : 'texture';
  const season = fabric.season || (family === 'summer' ? 'warm' : /flannel|tweed|velvet|corduroy/i.test(material) ? 'cool' : 'all-season');
  return {color, pattern, season};
}

function mountSwatches() {
  const [source, material, color, pattern, season, upgrade] = fabricFacets.map(({value}) => value);
  const activeCount = fabricFacets.filter(({value}) => value !== 'all').length;
  get('fabric-filter-count').textContent = activeCount ? `(${activeCount})` : '';
  const terms = get('fabric-search').value.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const matching = fabricOrder.filter(({fabric, traits}) => {
    const photographed = Boolean(fabric.scan || photoClothSources[fabric.code]);
    const inSource = source === 'all' || (source === 'scan' && photographed) || (source === 'digital' && !photographed) ||
      (source === 'collection' && collectionCodes.has(fabric.code));
    const priceBand = fabric.surcharge === 0 ? 'included' : fabric.surcharge <= 25 ? 'mid' : 'premium';
    const label = `${fabric.name} ${fabric.material} ${fabric.code} ${fabric.weave} ${traits.color} ${traits.pattern} ${traits.season}`.toLowerCase();
    return inSource && (material === 'all' || fabric.material.toLowerCase().includes(material)) &&
      (color === 'all' || color === traits.color) && (pattern === 'all' || pattern === traits.pattern) &&
      (season === 'all' || season === traits.season) && (upgrade === 'all' || upgrade === priceBand) &&
      terms.every((term) => label.includes(term));
  });
  const pages = Math.ceil(matching.length / fabricsPerPage);
  fabricPage = Math.max(0, Math.min(fabricPage, pages - 1));
  const page = matching.slice(fabricPage * fabricsPerPage, (fabricPage + 1) * fabricsPerPage);
  get('fabric-count').textContent = `${matching.length.toLocaleString('en-US')} / ${fabrics.length.toLocaleString('en-US')}`;
  get('fabric-page').textContent = pages ? `${fabricPage + 1} / ${pages}` : 'No matches';
  get('previous-fabrics').disabled = fabricPage === 0;
  get('next-fabrics').disabled = fabricPage + 1 >= pages;
  get('swatches').innerHTML = page.map(({fabric, index}) => `
    <button class="swatch" type="button" data-fabric="${index}" aria-label="${fabric.name}" title="${fabric.name} · ${fabric.code}" aria-pressed="${index === design.fabric}">
      <canvas width="220" height="128" aria-hidden="true"></canvas>
      <span>${fabric.name}</span><small>${fabric.surcharge ? `+${money(fabric.surcharge)}` : 'Included'}</small>
    </button>`).join('') || '<p class="fabric-empty">No fabrics match these filters.</p>';
  get('swatches').scrollTop = 0;
  for (const swatch of get('swatches').querySelectorAll('[data-fabric]')) {
    paintCloth(swatch.firstElementChild, Number(swatch.dataset.fabric), 1.1);
  }
}

function resetFabricSearch() {
  for (const facet of fabricFacets) facet.value = 'all';
  get('fabric-search').value = '';
  fabricPage = Math.floor(fabricOrder.findIndex(({index}) => index === design.fabric) / fabricsPerPage);
  mountSwatches();
}

function mountStyles() {
  const groups = Object.entries(styleGroups);
  get('outfit').innerHTML = outfits.map(({name}, index) => `<option value="${index}">${name}</option>`).join('');
  get('style-groups').innerHTML = groups.map(([key, [label, options]]) => `
    <details class="style-group" id="group-${key}" data-detail="${key}" name="construction"${key === 'lapel' ? ' open' : ''}>
      <summary>${label}<small id="choice-${key}"></small></summary>
      ${constructionGuides[key] ? `<p class="style-guide">${constructionGuides[key]}</p>` : ''}
      ${key === 'monogram' ? '<label class="monogram-field" for="monogram-text">Monogram text<input id="monogram-text" type="text" maxlength="12" autocomplete="off" placeholder="e.g. J. A."></label>' : ''}
      <div class="style-options">${options.map((option, index) => key === 'lining' && index === 3 ? '' : `
        <button class="style-option" type="button" data-style="${key}" data-choice="${index}" aria-pressed="false">${optionIcon(key, index)}<span>${option}</span></button>`).join('')}</div>
    </details>`).join('');
}

function syncPieceControls() {
  const outfit = outfits[design.outfit];
  if (!outfit.pieces.includes(piece)) piece = 'jacket';
  get('outfit').value = design.outfit;
  for (const button of get('piece-tabs').querySelectorAll('[data-piece]')) {
    button.hidden = !outfit.pieces.includes(button.dataset.piece);
    button.setAttribute('aria-pressed', button.dataset.piece === piece);
  }
  get('tailoring-title').textContent = {jacket: 'Jacket details', trousers: 'Trouser details', waistcoat: 'Waistcoat details'}[piece];
  get('open-necklines').hidden = piece !== 'jacket';
  const active = Object.entries(styleGroups).filter(([key]) => stylePiece(key) === piece);
  const groupIds = new Set(active.map(([key]) => 'group-' + key));
  for (const group of get('style-groups').querySelectorAll('.style-group')) group.hidden = !groupIds.has(group.id);
  if (!get('style-groups').querySelector('details[open]:not([hidden])')) get('group-' + active[0][0]).open = true;
  get('style-jump').innerHTML = '<option value="">Jump to a detail</option>' + active.map(([key, [label]]) => `<option value="${key}">${label}</option>`).join('');
  get('style-groups').scrollTop = 0;
  get('tailoring-title').closest('.tailoring').scrollTop = 0;
  get('preview-angles').hidden = design.outfit !== 2 && piece !== 'jacket';
  get('compare').hidden = design.outfit > 0 || piece !== 'jacket';
  const quickOptions = get('studio-quick-options');
  if (quickOptions) quickOptions.hidden = piece !== 'jacket';
}

function mountStudioQuickOptions() {
  const container = get('studio-quick-options');
  if (!container) return;
  const groups = [
    ['lapel', 'Jacket style', [[2, 'Peak'], [0, 'Notch'], [4, 'Shawl']]],
    ['closure', 'Button stance', [[4, 'Double'], [1, 'Single'], [5, 'Three']]],
    ['pocket', 'Pocket style', [[0, 'Flap'], [1, 'Welt'], [2, 'Patch']]],
  ];
  container.innerHTML = groups.map(([key, title, choices]) => `
    <section class="studio-quick-group">
      <h3>${title}</h3>
      <div class="studio-quick-choices">${choices.map(([index, label]) => `
        <button class="studio-quick-option" type="button" data-style="${key}" data-choice="${index}" aria-pressed="false">
          <canvas width="144" height="86" data-option-preview aria-hidden="true" hidden></canvas>${optionIcon(key, index)}<span>${label}</span>
        </button>`).join('')}</div>
    </section>`).join('');
}

function description(config) {
  const labels = [fabrics[config.fabric].name, styleGroups.lapel[1][config.lapel], styleGroups.closure[1][config.closure]];
  if (config.outfit > 0) labels.push(styleGroups.trouserFit[1][config.trouserFit]);
  if (config.outfit === 2) {
    labels.push(config.vestNeck ? styleGroups.vestNeck[1][config.vestNeck] : styleGroups.vestCut[1][config.vestCut]);
    if (config.vestClosure) labels.push(styleGroups.vestClosure[1][config.vestClosure]);
  }
  return labels.join(' · ');
}

function activePhoto() {
  return design.outfit === 2 || piece === 'jacket' ? angle : piece;
}

function showsFullLook() {
  return design.outfit === 2 || (design.outfit === 1 && piece === 'jacket');
}

function showsBodyPhoto() {
  return Boolean(tryOnSession.capture && angle === 'front');
}

function showsStudioModel() {
  return modelPreference === 'studio' && !showsBodyPhoto() && !faceState.image;
}

function studioModelView() {
  if (piece === 'waistcoat') return waistcoatHidden ? 'shirt' : 'waistcoat';
  if (design.outfit !== 2 || !jacketHidden) return 'jacket';
  return waistcoatHidden ? 'shirt' : 'waistcoat';
}

function previewAssets() {
  if (showsBodyPhoto()) return design.outfit ? fullLookAssets('front', design.outfit === 2) : ['front'];
  if (showsStudioModel()) {
    return studioGarmentAssets(angle, studioModelView(), design.outfit);
  }
  const view = activePhoto();
  return showsFullLook() ? fullLookAssets(view, design.outfit === 2, design.outfit === 2 && jacketHidden) : [view];
}

function ensurePhoto(view) {
  if (loadingPhotos.has(view) || failedPhotos.has(view)) return;
  loadingPhotos.add(view);
  loadGarmentPhoto(view, photoSources[view]).then(() => {
    if (previewAssets().includes(view) || constructionDetails[lookDetail]?.[0] === view ||
        (view === 'inside' && (piece === 'waistcoat' || design.outfit === 2))) renderPreview();
    else paintPreviewThumbnails();
    if (['front', 'trousers', 'waistcoat'].includes(view)) paintBagPreviews();
  }, () => {
    failedPhotos.add(view);
    if (previewAssets().includes(view)) renderPreview();
  });
}

function shows3DPreview() {
  return Boolean(three3DRenderer && get('three-container').style.display === 'block');
}

function syncPreviewAngles() {
  for (const button of document.querySelectorAll('[data-view]')) {
    button.setAttribute('aria-pressed', button.dataset.view === angle);
  }
}

function paintPreviewThumbnails() {
  for (const canvas of document.querySelectorAll('[data-option-preview]')) {
    const {style, choice} = canvas.parentElement.dataset;
    const optionDesign = {...design, [style]: Number(choice)};
    const configuration = JSON.stringify([optionDesign, clothAppearance(optionDesign)]);
    if (paintedDetailThumbnails.get(canvas) === configuration) continue;
    canvas.hidden = !paintConstructionFocus(canvas, style, optionDesign, false);
    if (canvas.hidden) ensurePhoto(constructionDetails[style][0]);
    else paintedDetailThumbnails.set(canvas, configuration);
  }
  for (const canvas of document.querySelectorAll('[data-angle-thumbnail]')) {
    if (get('preview-angles').hidden) break;
    const view = canvas.dataset.angleThumbnail;
    canvas.hidden = !paintGarmentPhoto(canvas, design, view, false, {thumbnail: true, skinTone});
    if (canvas.hidden) ensurePhoto(view);
  }

  const callouts = get('preview-callouts');
  if (!callouts) return;
  const detailPiece = piece === 'jacket' && jacketHidden && !waistcoatHidden ? 'waistcoat' : piece;
  callouts.hidden = detailPiece === 'jacket' && jacketHidden;
  if (callouts.hidden) return;
  const buttons = callouts.querySelectorAll('[data-view-detail]');
  if (!buttons.length) return;
  const details = previewDetailSets[detailPiece];
  callouts.setAttribute('aria-label', `${pieces[detailPiece]} close-ups`);
  const configuration = JSON.stringify([design, clothAppearance(design)]);
  for (const [index, button] of [...buttons].entries()) {
    const detail = details[index];
    button.dataset.viewDetail = detail;
    const canvas = button.querySelector('[data-detail-thumbnail]');
    const label = button.querySelector('[data-detail-label]');
    if (label) label.textContent = styleGroups[detail][1][design[detail]];
    button.setAttribute('aria-pressed', String(lookDetail === detail));
    const previewKey = `${detail}:${configuration}`;
    if (!canvas || paintedDetailThumbnails.get(canvas) === previewKey) continue;
    canvas.hidden = !paintConstructionFocus(canvas, detail, design, false);
    if (canvas.hidden) ensurePhoto(constructionDetails[detail][0]);
    else paintedDetailThumbnails.set(canvas, previewKey);
  }
}

function renderPreview() {
  const model = get('fabric-model');
  if (shows3DPreview() && (angle === 'inside' || lookDetail || piece !== 'jacket')) {
    set3DPreviewVisible(false);
    showStudioAction(angle === 'inside' ? 'Inside view uses the 2D preview.' : 'Construction details use the 2D preview.');
  }
  if (shows3DPreview()) {
    get('preview-mode').innerHTML = `<i></i> 3D JACKET / ${angle.toUpperCase()}`;
    get('photo-notice').hidden = true;
    get('look-detail').hidden = true;
    get('studio-faces').hidden = true;
    const stage = get('model');
    stage.classList.toggle('zoomed', false);
    stage.classList.toggle('garment-focus', false);
    stage.closest('.model-stage').classList.toggle('detail-active', false);
    if (threePreviewAngle !== angle) {
      three3DRenderer.setCameraPreset(angle);
      threePreviewAngle = angle;
    }
    syncPreviewAngles();
    paintPreviewThumbnails();
    return;
  }
  const personal = showsBodyPhoto();
  const studio = showsStudioModel();
  const garmentView = studioModelView();
  const view = personal ? 'front' : studio ? angle : activePhoto();
  const full = personal || studio || showsFullLook();
  const garmentFocus = !personal && full && piece !== 'trousers' && angle !== 'inside';
  const hideJacket = design.outfit === 2 && jacketHidden;
  if (studio) {
    loadStudioModel('front', () => {
      const front = studioModelCaptures.get('front');
      if (front) loadStudioFaces(get('studio-faces'), front.photo, renderPreview);
      renderPreview();
    });
    if (angle === 'back') loadStudioModel('back', renderPreview);
  }
  const photographic = personal ? paintBodyTryOn(model, design, {jacketHidden: hideJacket})
    : studio ? paintStudioModel(model, design, angle, garmentView, studioFaceId)
      : full ? paintFullSuit(model, design, view, {face: true, jacketHidden: hideJacket, skinTone})
      : paintGarmentPhoto(model, design, view, split, {face: true, skinTone});
  model.hidden = !photographic;
  const notice = get('photo-notice');
  notice.hidden = photographic;
  if (!photographic) {
    const required = previewAssets();
    const portraitFailed = studioFaceId !== 'original' &&
      (studioModelFailures.has('front') || (angle === 'back' ? studioRearPortraitsFailed : studioPortraitsFailed));
    const studioFailed = studio && (studioModelFailures.has(studioModelDirection(angle)) || portraitFailed);
    notice.textContent = studioFailed || required.some((item) => failedPhotos.has(item))
      ? 'This preview could not load. Refresh the page to try again.' : 'Loading preview…';
    for (const item of required) ensurePhoto(item);
  }
  const studioLabel = angle === 'front' ? garmentView : angle;
  const mode = personal ? 'INSTANT FIT / FRONT' : studio ? 'STUDIO MODEL / ' + studioLabel.toUpperCase() : full ? 'FULL LOOK / ' + view.toUpperCase()
    : piece === 'jacket' ? angle.toUpperCase() + ' VIEW' : pieces[piece].toUpperCase();
  get('preview-mode').innerHTML = `<i></i> ${mode}`;
  const stage = model.closest('.model-stage');
  stage.setAttribute('data-preview-angle', angle);
  stage.setAttribute('data-preview-piece', piece);
  get('model').classList.toggle('zoomed', garmentFocus ? !zoomed : zoomed);
  get('model').classList.toggle('garment-focus', garmentFocus);
  get('model').classList.toggle('full-look', full);
  get('model').classList.toggle('personal-look', personal);
  get('model').classList.toggle('studio-look', studio);
  const visual = model.closest('.visual');
  visual.classList.toggle('full-look-visual', full);
  visual.classList.toggle('personal-visual', personal);
  get('model').style.setProperty('--zoom-focus', `${zoomFocus}%`);
  const detailSpec = constructionDetails[lookDetail];
  const detailSource = detailSpec?.[0];
  const sameView = full && !personal && !studio && !detailSpec?.[5] && (detailSource === view || (hideJacket && detailSource === 'waistcoat' && view === 'front'));
  const detailCanvas = get('look-detail-image');
  const detailCapture = studio && angle === 'front' ? studioModelCaptures.get('front') : tryOnSession.capture;
  const detailVisible = Boolean(photographic && detailSource && (
    (detailCapture && (personal || (studio && angle === 'front')) && !detailSpec[5] && paintBodyFocus(detailCanvas, model, lookDetail, detailSource, detailCapture)) ||
    paintConstructionFocus(detailCanvas, lookDetail, design, split && !full, sameView ? model : null)));
  if (detailSource && !detailVisible) ensurePhoto(detailSource);
  get('look-detail').hidden = !detailVisible;
  const facePicker = get('studio-faces');
  facePicker.hidden = !(studio && photographic && studioPortraits && !detailVisible);
  for (const button of facePicker.children) button.setAttribute('aria-pressed', String(button.dataset.studioFace === studioFaceId));
  stage.classList.toggle('detail-active', detailVisible);
  if (detailVisible) {
    const [label, options] = styleGroups[lookDetail];
    get('look-detail-mode').textContent = cutawayNames[lookDetail] || 'Construction close-up';
    get('look-detail-label').textContent = label;
    get('look-detail-choice').textContent = options[design[lookDetail]];
    get('close-look-detail').textContent = 'Back to preview';
  }
  get('toggle-jacket').hidden = design.outfit !== 2;
  get('toggle-jacket').textContent = hideJacket ? 'Show jacket' : 'Hide jacket';
  get('toggle-waistcoat').hidden = !(studio && hideJacket);
  get('toggle-waistcoat').textContent = waistcoatHidden ? 'Show waistcoat' : 'Hide waistcoat';
  get('preview-model-control').hidden = personal || Boolean(faceState.image);
  get('skin-tone-control').hidden = personal || studio;
  get('open-body').textContent = tryOnSession.capture ? 'Manage try-on photo' : 'Full-body try-on';
  get('open-fit-export').hidden = !(personal && photographic);
  get('open-studio-render').hidden = !(studioGeneration.available && personal && photographic);
  get('open-face').hidden = Boolean(tryOnSession.capture) || !['front', 'inside', 'waistcoat'].includes(view);
  get('open-face').textContent = faceState.image ? 'Adjust your face' : 'Add your face';
  get('compare').disabled = full || view !== 'front';
  get('compare').setAttribute('aria-pressed', !full && split && view === 'front');
  get('zoom').setAttribute('aria-pressed', zoomed);
  const framing = garmentFocus ? (zoomed ? 'Jacket focus' : 'Full body') : (zoomed ? 'Reset preview zoom' : 'Zoom preview');
  get('zoom').textContent = garmentFocus ? framing : zoomed ? '-' : '+';
  get('zoom').setAttribute('aria-label', framing);
  syncPreviewAngles();
  paintPreviewThumbnails();
}

function focusConstruction(key, trigger = null) {
  if (key === 'silhouette') {
    // A cut changes the whole dressed silhouette; a mannequin close-up hides
    // the very fit the customer is trying to compare.
    lookDetail = '';
    previewDetailTrigger = null;
    jacketHidden = false;
    zoomed = false;
    return;
  }
  lookDetail = key;
  previewDetailTrigger = trigger;
  zoomed = false;
  const view = constructionDetails[key]?.[0];
  if (stylePiece(key) === 'jacket') jacketHidden = false;
  if (stylePiece(key) === 'waistcoat') waistcoatHidden = false;
  if (detailViews[key]) angle = detailViews[key];
  else if (['front', 'trousers', 'waistcoat'].includes(view)) angle = 'front';
}

function renderDesign() {
  const fabric = fabrics[design.fabric];
  const kind = photoCloth(design.fabric) ? 'PHOTO TEXTURE' : 'DIGITAL SWATCH';
  get('fabric-detail').innerHTML = `<span class="eyebrow">${fabric.code} / ${kind}</span><strong>${fabric.name}</strong><small>${fabric.material}</small>`;
  for (const button of document.querySelectorAll('[data-fabric]')) {
    button.setAttribute('aria-pressed', Number(button.dataset.fabric) === design.fabric);
  }
  for (const [key, [, options]] of Object.entries(styleGroups)) {
    get('choice-' + key).textContent = options[design[key]];
  }
  if (get('monogram-text').value !== design.monogramText) get('monogram-text').value = design.monogramText;
  if (design.breast === 2) get('choice-square').textContent = 'Requires a breast pocket';
  for (const button of document.querySelectorAll('[data-style]')) {
    button.setAttribute('aria-pressed', design[button.dataset.style] === Number(button.dataset.choice));
    button.disabled = button.dataset.style === 'square' && design.breast === 2;
  }
  renderPreview();
  get('design-summary').textContent = `${outfits[design.outfit].name} · ${description(design)}`;
  get('price').textContent = money(configurationPrice(design));
  if (typeof update3DRenderer === 'function') update3DRenderer(); // Sync 3D with design changes
}

function mountFit() {
  get('body-options').innerHTML = Object.entries(fitGroups).map(([key, [label, options]]) => `
    <fieldset><legend>${label}</legend><div class="fit-options">${options.map((option, index) => `
      <label>${fitIcon(key, index)}<input type="radio" name="${key}" value="${option}" required${fit[key] === option ? ' checked' : ''}>${option}</label>`).join('')}</div></fieldset>`).join('');
}

function renderBag() {
  get('bag-count').textContent = bag.length;
  get('to-fit').hidden = !bag.length;
  get('cart-lines').innerHTML = bag.length ? bag.map((item, index) => `
    <article class="cart-line">
      <canvas data-bag-photo="${index}" role="img" aria-label="${fabrics[item.fabric].name} jacket"></canvas>
      <div><h2>${outfits[item.outfit].name}</h2><p>${description(item)}</p><p class="passport-status">${passportComplete(item) ? 'Size Passport complete' : 'Measurements needed'}</p><button class="quiet" type="button" data-edit="${index}">Edit configuration</button></div>
      <div><strong>${money(configurationPrice(item))}</strong><button class="quiet" type="button" data-remove="${index}">Remove</button></div>
    </article>`).join('') : '<p class="surface">Your bag is empty. Add a configuration from the studio to get started.</p>';
  paintBagPreviews();
}

function paintBagPreviews() {
  for (const canvas of document.querySelectorAll('[data-bag-photo]')) {
    const item = bag[Number(canvas.dataset.bagPhoto)];
    if (item.outfit > 0) {
      if (!paintFullSuit(canvas, item, 'front', {thumbnail: true})) {
        for (const view of fullLookAssets('front', item.outfit === 2)) ensurePhoto(view);
      }
    } else {
      paintGarmentPhoto(canvas, item, 'front', false, {thumbnail: true});
    }
  }
}

let editIndex = null;
const pageIds = ['studio', 'cart', 'fit', 'checkout', 'complete'];

function navigate(page) {
  const hash = '#' + page;
  if (location.hash !== hash) location.hash = hash;
}

function sizePassportReady() {
  return bag.length > 0 && bag.every(passportComplete) && Object.keys(fit).length === Object.keys(fitGroups).length;
}

function orderTotal() {
  return bag.reduce((total, item) => total + configurationPrice(item), 0);
}

function route() {
  if (!get('fit').hidden) {
    storePassportForm(get('passport-items'), bag, fitUnit);
    save();
  }
  let page = location.hash.slice(1);
  if (!pageIds.includes(page)) page = 'studio';
  if (['fit', 'checkout'].includes(page) && !bag.length) page = 'cart';
  if (page === 'checkout' && !sizePassportReady()) page = 'fit';
  if (page === 'complete' && !receipt) page = 'studio';
  if (page !== location.hash.slice(1)) history.replaceState(null, '', '#' + page);
  if (page !== 'studio') {
    editIndex = null;
    get('add').firstChild.textContent = 'Add to bag ';
  }
  renderBag();
  if (page === 'fit') {
    get('passport-unit').value = fitUnit;
    mountSizePassport(get('passport-items'), bag, fitUnit);
  }
  if (page === 'checkout') {
    get('review').innerHTML = '<h2>Order specifications</h2>' + orderSpecification(bag.map((item) => orderItem(item, fitUnit)), orderTotal(), fit);
  }
  if (page === 'complete') renderReceipt();
  for (const id of pageIds) get(id).hidden = id !== page;
  for (const link of document.querySelectorAll('.top nav a, .bag')) {
    if (link.hash === '#' + page) link.setAttribute('aria-current', 'step');
    else link.removeAttribute('aria-current');
  }
  window.scrollTo(0, 0);
}

function filterFabrics() {
  fabricPage = 0;
  mountSwatches();
}

get('fabric-facets').addEventListener('change', filterFabrics);
get('clear-fabric-filters').addEventListener('click', () => {
  for (const facet of fabricFacets) facet.value = 'all';
  get('fabric-search').value = '';
  filterFabrics();
});
get('fabric-search').addEventListener('input', filterFabrics);
get('previous-fabrics').addEventListener('click', () => { fabricPage -= 1; mountSwatches(); });
get('next-fabrics').addEventListener('click', () => { fabricPage += 1; mountSwatches(); });

get('outfit').addEventListener('change', (event) => {
  design.outfit = Number(event.target.value);
  jacketHidden = false;
  waistcoatHidden = false;
  lookDetail = '';
  angle = 'front';
  zoomed = false;
  zoomFocus = 53;
  syncPieceControls();
  renderDesign();
  save();
});

function selectPiece(nextPiece) {
  piece = nextPiece;
  lookDetail = '';
  if (design.outfit === 2 && piece !== 'jacket') angle = 'front';
  zoomed = false;
  zoomFocus = 53;
  syncPieceControls();
  renderPreview();
}

get('piece-tabs').addEventListener('click', (event) => {
  const button = event.target.closest('[data-piece]');
  if (button) selectPiece(button.dataset.piece);
});

function showStudioAction(message) {
  const notice = get('studio-action-message') || get('status');
  notice.textContent = message;
}

document.querySelector('.studio-rail')?.addEventListener('click', (event) => {
  const button = event.target.closest('[data-studio-panel]');
  if (!button) return;
  const panel = button.dataset.studioPanel;
  for (const item of button.closest('.studio-rail').querySelectorAll('[data-studio-panel]')) {
    item.setAttribute('aria-pressed', String(item === button));
  }

  showStudioAction('');
  if (panel === 'fabric') {
    get('fabric-search').focus();
  } else if (panel === 'trousers' && !outfits[design.outfit].pieces.includes('trousers')) {
    showStudioAction('Select a two-piece or three-piece suit to customize trousers.');
    get('outfit').focus();
  } else if (panel === 'jacket' || panel === 'trousers') {
    selectPiece(panel);
    const quickOption = get('studio-quick-options')?.querySelector('button');
    if (panel === 'jacket' && quickOption) quickOption.focus();
    else focusAdvancedStudioOptions();
  } else if (panel === 'details') {
    focusAdvancedStudioOptions();
  } else if (panel === 'size') {
    showStudioAction('Add the design to your bag to enter its Size Passport measurements.');
    get('add').focus();
  }
});

function focusAdvancedStudioOptions() {
  const advanced = get('advanced-jacket-options');
  if (advanced) advanced.open = true;
  get('style-jump').focus();
}

get('save-design')?.addEventListener('click', () => {
  showStudioAction(save()
    ? 'Design saved on this device.'
    : 'This browser could not save your design.');
});

get('apply-studio-look')?.addEventListener('click', () => {
  if (showsBodyPhoto() || faceState.image) {
    showStudioAction('Remove the try-on photo or custom face to use the studio model.');
    return;
  }
  set3DPreviewVisible(false);
  design = {...design, fabric: defaults.fabric, lapel: 2, lapelFinish: 0, closure: 4, pocket: 0};
  modelPreference = 'studio';
  studioFaceId = 'original';
  get('preview-model').value = modelPreference;
  piece = 'jacket';
  angle = 'front';
  jacketHidden = false;
  waistcoatHidden = false;
  split = false;
  zoomed = false;
  lookDetail = '';
  previewDetailTrigger = null;
  resetFabricSearch();
  syncPieceControls();
  renderDesign();
  save();
  showStudioAction('Navy studio look applied.');
});

get('swatches').addEventListener('click', (event) => {
  const option = event.target.closest('[data-fabric]');
  if (!option) return;
  design.fabric = Number(option.dataset.fabric);
  split = false;
  renderDesign();
  save();
});

function selectStyle(option) {
  const {style, choice} = option.dataset;
  design[style] = Number(choice);
  if (style === 'vestCut') {
    design.vestNeck = 0;
    design.vestClosure = 0;
  }
  focusConstruction(style);
  get('status').textContent = `${styleGroups[style][0]}, ${styleGroups[style][1][choice]}`;
  renderDesign();
  save();
}

get('style-groups').addEventListener('click', (event) => {
  const summary = event.target.closest('summary');
  if (summary) {
    const group = summary.parentElement;
    requestAnimationFrame(() => {
      if (group.open && !group.hidden) {
        focusConstruction(group.dataset.detail);
        renderPreview();
      } else if (lookDetail === group.dataset.detail) {
        lookDetail = '';
        renderPreview();
      }
    });
    return;
  }
  const option = event.target.closest('[data-style]');
  if (option) selectStyle(option);
});

get('studio-quick-options')?.addEventListener('click', (event) => {
  const option = event.target.closest('[data-style]');
  if (option) selectStyle(option);
});

get('style-groups').addEventListener('input', (event) => {
  if (event.target.id !== 'monogram-text') return;
  design.monogramText = cleanMonogram(event.target.value);
  if (design.monogramText && !design.monogram) design.monogram = 1;
  lookDetail = 'monogram';
  angle = 'inside';
  zoomed = false;
  renderDesign();
  save();
});

get('style-jump').addEventListener('change', (event) => {
  const key = event.target.value;
  if (!key) return;
  const group = get('group-' + key);
  const list = get('style-groups');
  const panel = getComputedStyle(list).overflowY === 'auto' ? list : list.closest('.tailoring');
  group.open = true;
  const pickerHeight = panel === list ? 0 : event.target.offsetHeight + 7;
  panel.scrollTop += group.getBoundingClientRect().top - panel.getBoundingClientRect().top - pickerHeight;
  group.querySelector('summary').focus({preventScroll: true});
  focusConstruction(key);
  renderPreview();
  event.target.value = '';
});

document.querySelector('.angles').addEventListener('click', (event) => {
  const button = event.target.closest('[data-view]');
  if (!button) return;
  angle = button.dataset.view;
  if (angle === 'inside' && !showsStudioModel()) jacketHidden = false;
  lookDetail = '';
  zoomed = false;
  zoomFocus = 53;

  renderPreview();
});

get('preview-callouts')?.addEventListener('click', (event) => {
  const button = event.target.closest('[data-view-detail]');
  if (!button) return;
  focusConstruction(button.dataset.viewDetail, button);
  renderPreview();
});

get('toggle-jacket').addEventListener('click', () => {
  jacketHidden = !jacketHidden;
  waistcoatHidden = false;
  piece = jacketHidden ? 'waistcoat' : 'jacket';
  syncPieceControls();
  if (angle === 'inside' && !showsStudioModel()) angle = 'front';
  lookDetail = '';
  renderPreview();
});

get('toggle-waistcoat').addEventListener('click', () => {
  waistcoatHidden = !waistcoatHidden;
  lookDetail = '';
  renderPreview();
});

get('preview-model').value = modelPreference;
get('preview-model').addEventListener('change', (event) => {
  modelPreference = event.target.value;
  lookDetail = '';
  zoomed = false;
  renderPreview();
  save();
});

get('studio-faces').addEventListener('click', (event) => {
  const button = event.target.closest('[data-studio-face]');
  if (!button || studioFaceId === button.dataset.studioFace) return;
  studioFaceId = button.dataset.studioFace;
  renderPreview();
  save();
});

get('skin-tone').value = skinTone;
get('skin-tone').addEventListener('change', (event) => {
  skinTone = Number(event.target.value);
  renderPreview();
  save();
});

get('compare').addEventListener('click', () => {
  split = !split;
  renderPreview();
});

get('zoom').addEventListener('click', () => {
  if (shows3DPreview()) {
    three3DRenderer.toggleZoom();
    return;
  }
  lookDetail = '';
  zoomed = !zoomed;
  renderPreview();
});

get('close-look-detail').addEventListener('click', () => {
  const detail = lookDetail;
  const trigger = previewDetailTrigger?.dataset.viewDetail === detail
    ? previewDetailTrigger : get('group-' + detail)?.querySelector('summary');
  previewDetailTrigger = null;
  lookDetail = '';
  renderPreview();
  trigger?.focus({preventScroll: true});
});

get('reset').addEventListener('click', () => {
  design = {...defaults};
  jacketHidden = false;
  waistcoatHidden = false;
  lookDetail = '';
  piece = 'jacket';
  angle = 'front';
  split = true;
  zoomed = false;
  zoomFocus = 53;
  resetFabricSearch();
  syncPieceControls();
  renderDesign();
  save();
});

get('add').addEventListener('click', () => {
  const item = {...design, passport: safePassport(bag[editIndex]?.passport, design.outfit)};
  if (editIndex === null) bag.push(item);
  else bag[editIndex] = item;
  save();
  get('status').textContent = 'Configuration saved to your bag.';
  navigate('cart');
});

get('cart-lines').addEventListener('click', (event) => {
  if (event.target.hasAttribute('data-remove')) {
    bag.splice(Number(event.target.dataset.remove), 1);
    save();
    renderBag();
    get('status').textContent = 'Configuration removed from your bag.';
  }
  if (event.target.hasAttribute('data-edit')) {
    editIndex = Number(event.target.dataset.edit);
    design = safeDesign(bag[editIndex]);
    set3DPreviewVisible(false);
    jacketHidden = false;
    waistcoatHidden = false;
    zoomed = false;
    previewDetailTrigger = null;
    lookDetail = '';
    piece = 'jacket';
    angle = 'front';
    split = false;
    zoomFocus = 53;
    resetFabricSearch();
    syncPieceControls();
    renderDesign();
    get('add').firstChild.textContent = 'Save configuration ';
    navigate('studio');
  }
});

get('passport-items').addEventListener('input', (event) => {
  storePassportInput(bag, event.target, fitUnit);
  save();
});

window.addEventListener('pagehide', () => {
  if (!get('fit').hidden) {
    storePassportForm(get('passport-items'), bag, fitUnit);
    save();
  }
});

get('passport-unit').addEventListener('change', (event) => {
  const invalid = [...get('passport-items').querySelectorAll('[data-measurement]')].find((input) =>
    input.validity.badInput || (input.value !== '' && !input.validity.valid));
  if (invalid) {
    event.target.value = fitUnit;
    invalid.reportValidity();
    return;
  }
  storePassportForm(get('passport-items'), bag, fitUnit);
  fitUnit = event.target.value;
  mountSizePassport(get('passport-items'), bag, fitUnit);
  save();
});

get('body-options').addEventListener('change', ({target}) => {
  if (target.checked && fitGroups[target.name]?.[1].includes(target.value)) {
    fit[target.name] = target.value;
    save();
  }
});

get('fit-form').addEventListener('submit', (event) => {
  event.preventDefault();
  fit = Object.fromEntries(new FormData(event.currentTarget));
  storePassportForm(get('passport-items'), bag, fitUnit);
  save();
  if (sizePassportReady()) navigate('checkout');
});

get('checkout-form').addEventListener('submit', (event) => {
  event.preventDefault();
  if (!sizePassportReady()) {
    navigate('fit');
    return;
  }
  receipt = {
    reference: 'FA-' + Date.now().toString(36).toUpperCase(),
    currency: 'USD',
    total: orderTotal(),
    items: bag.map((item) => orderItem(item, fitUnit)),
    fit: {...fit},
    shipping: orderShipping(new FormData(event.currentTarget)),
  };
  try {
    sessionStorage.setItem(receiptKey, JSON.stringify(receipt));
  } catch {
    // The download remains available in the current page if storage is disabled.
  }
  event.currentTarget.reset();
  bag = [];
  save();
  navigate('complete');
});

function readSessionReceipt() {
  try {
    const order = JSON.parse(sessionStorage.getItem(receiptKey));
    const record = (value) => value && typeof value === 'object' && !Array.isArray(value);
    if (!record(order) || typeof order.reference !== 'string' || !/^FA-[A-Z0-9]+$/.test(order.reference) ||
        order.currency !== 'USD' || !Number.isFinite(order.total) || !record(order.fit) ||
        !Array.isArray(order.items) || !order.items.length || !order.items.every((item) =>
          record(item) && Number.isFinite(item.price) && Array.isArray(item.pieces) && item.pieces.every((part) =>
            record(part) && record(part.fabric) && record(part.measurements) && record(part.construction)))) return undefined;
    return order;
  } catch {
    return undefined;
  }
}

function renderReceipt() {
  const confirmation = get('confirmation');
  confirmation.innerHTML = `<div class="confirmation-header"><div><h2>${orderEscape(receipt.reference)}</h2><p>Demo order prepared.</p></div>
    <button type="button" class="secondary" id="download">Download order (.json) ↓</button></div>
    ${orderSpecification(receipt.items, receipt.total, receipt.fit)}`;
  get('download').addEventListener('click', () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(receipt, null, 2)], {type: 'application/json'}));
    const link = document.createElement('a');
    link.href = url;
    link.download = receipt.reference + '.json';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
}

const collectionDialog = get('source-dialog');
const collectionGrid = get('collection-looks');
function openCollections() {
  if (!collectionGrid.hasChildNodes()) {
    collectionGrid.innerHTML = collectionLooks.map(({brand, title, notes, url, image, media, guide}, index) => `
      <article class="collection-look">
        <figure><img src="${image}" alt="${title}" loading="lazy" referrerpolicy="no-referrer"><figcaption>${media}</figcaption></figure>
        <div class="collection-copy">
          <p class="eyebrow">${brand}</p>
          <h3>${title}</h3>
          <p>${notes}</p>
          <div class="collection-actions">
            <button type="button" data-collection="${index}" aria-label="Apply ${title}">Apply look</button>
            <a href="${url}" target="_blank" rel="noopener noreferrer">Brand reference ↗</a>
            ${guide ? `<a href="${guide[1]}" target="_blank" rel="noopener noreferrer">${guide[0]} ↗</a>` : ''}
          </div>
        </div>
      </article>`).join('');
  }
  collectionDialog.showModal();
}

get('references').addEventListener('click', openCollections);
get('open-collections').addEventListener('click', openCollections);
collectionGrid.addEventListener('click', (event) => {
  const button = event.target.closest('[data-collection]');
  if (!button) return;
  const look = collectionLooks[Number(button.dataset.collection)];
  design = safeDesign({...look.cut, fabric: fabrics.findIndex(({code}) => code === look.fabric)});
  piece = 'jacket';
  angle = 'front';
  split = false;
  lookDetail = '';
  zoomed = false;
  zoomFocus = 53;
  for (const facet of fabricFacets) facet.value = 'all';
  get('fabric-search').value = '';
  get('fabric-filter').value = 'collection';
  filterFabrics();
  syncPieceControls();
  renderDesign();
  save();
  collectionDialog.close();
  get('status').textContent = `${look.title} studio look applied.`;
});
function paintFabricInspector() {
  const fabric = fabrics[design.fabric];
  const traits = fabricTraits(fabric);
  get('fabric-dialog-title').textContent = fabric.name;
  get('fabric-dialog-material').textContent = fabric.material;
  get('fabric-dialog-source').textContent = photoCloth(design.fabric) ? 'Photographed cloth' : fabric.scan ? 'Loading cloth photograph' : 'Digital swatch';
  const season = {warm: 'Warm weather', cool: 'Cool weather', 'all-season': 'Year-round'}[traits.season];
  const details = [['Studio code', fabric.code], ['Color', traits.color], ['Pattern', traits.pattern],
    ['Season suggestion', season], ['Cloth upgrade', fabric.surcharge ? `+${money(fabric.surcharge)}` : 'Included']];
  get('fabric-dialog-specs').innerHTML = details.map(([label, value]) => `<div><dt>${label}</dt><dd>${value}</dd></div>`).join('');
  const credit = get('fabric-dialog-credit');
  credit.hidden = !fabric.scan;
  if (fabric.scan) credit.href = `https://polyhaven.com/a/${fabric.scan}`;
  paintClothMacro(get('fabric-macro'), design.fabric);
}

get('inspect-fabric').addEventListener('click', () => {
  paintFabricInspector();
  get('fabric-dialog').showModal();
});

document.addEventListener('cloth-sample-ready', ({detail: index}) => {
  const swatch = get('swatches').querySelector(`[data-fabric="${index}"] canvas`);
  if (swatch) paintCloth(swatch, index, 1.1);
  if (index === design.fabric) {
    renderDesign();
    if (get('fabric-dialog').open) paintFabricInspector();
  }
  if (bag.some(({fabric}) => fabric === index)) paintBagPreviews();
});
window.addEventListener('hashchange', route);
installFaceCamera(renderPreview);
installNecklineCatalog(([lapel, facing, closure, stitching]) => {
  design.lapel = lapel;
  if (facing != null) design.lapelFinish = facing;
  if (closure != null) design.closure = closure;
  if (stitching != null) design.stitching = stitching;
  focusConstruction('lapel');
  renderDesign();
  save();
});
installBodyCapture((applied) => {
  clearBodyTryOn();
  if (applied) {
    angle = 'front';
    piece = 'jacket';
    lookDetail = '';
    zoomed = false;
    syncPieceControls();
  }
  renderPreview();
});
installStudioRender();
installInstantFitExport();
resetFabricSearch();
mountStyles();
mountStudioQuickOptions();
syncPieceControls();
mountFit();
renderDesign();
function init3DRenderer() {
  if (three3DRenderer) return true;
  if (typeof ThreeSuitRenderer === 'undefined' || !window.THREE) return false;
  try {
    three3DRenderer = new ThreeSuitRenderer('three-container', sync3DZoom);
    update3DRenderer();
    return true;
  } catch (error) {
    three3DRenderer?.dispose();
    three3DRenderer = null;
    get('three-container').replaceChildren();
    console.warn('3D renderer failed:', error);
    return false;
  }
}

// Sync 3D renderer with current design
function update3DRenderer() {
  if (typeof three3DRenderer === 'undefined' || !three3DRenderer) return;

  // Update lapel style
  if (three3DRenderer.updateLapelStyle) {
    three3DRenderer.updateLapelStyle(design.lapel);
  }

  // Update fabric texture (includes color)
  if (three3DRenderer.updateFabricTexture) {
    three3DRenderer.updateFabricTexture(design.fabric);
  } else if (three3DRenderer.updateFabricColor) {
    // Fallback to color-only if texture update not available
    const fabric = fabrics[design.fabric];
    if (fabric?.color) {
      three3DRenderer.updateFabricColor(fabric.color);
    }
  }
}

function sync3DZoom(zoomed) {
  if (!shows3DPreview()) return;
  const button = get('zoom');
  button.setAttribute('aria-pressed', zoomed);
  button.textContent = zoomed ? '−' : '+';
  button.setAttribute('aria-label', zoomed ? 'Reset 3D camera zoom' : 'Zoom 3D camera');
}

function set3DPreviewVisible(active) {
  get('three-container').style.display = active ? 'block' : 'none';
  get('fabric-model').style.display = active ? 'none' : '';
  get('model').closest('.visual').classList.toggle('preview-3d', active);
  const toggle = get('toggle-3d');
  toggle.textContent = active ? '2D Preview' : '3D Jacket';
  toggle.setAttribute('aria-pressed', String(active));
  if (!active) {
    threePreviewAngle = null;
    three3DRenderer?.cancelCameraTransition();
  }
}

get('toggle-3d')?.addEventListener('click', () => {
  showStudioAction('');
  if (shows3DPreview()) {
    set3DPreviewVisible(false);
  } else {
    get('three-container').style.display = 'block';
    if (!init3DRenderer()) {
      set3DPreviewVisible(false);
      get('status').textContent = '3D preview is unavailable. The 2D preview is ready.';
      return;
    }
    if (angle === 'inside') angle = 'front';
    lookDetail = '';
    zoomed = false;
    if (piece !== 'jacket') {
      piece = 'jacket';
      syncPieceControls();
    }
    set3DPreviewVisible(true);
    three3DRenderer.onWindowResize();
  }
  renderPreview();
});

route();
