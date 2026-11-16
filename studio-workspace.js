'use strict';

// Only named configurations are persisted here: never a face, photo or passport.
(() => {
  const notebookKey = 'form-atelier-looks-v1';
  const text = orderEscape;
  let looks = [];
  try {
    const stored = JSON.parse(localStorage.getItem(notebookKey));
    if (Array.isArray(stored)) looks = stored.filter(entry => entry && typeof entry.name === 'string' && entry.design && typeof entry.design === 'object')
      .slice(0, 3).map(entry => ({name: entry.name.trim().slice(0, 40) || 'Untitled look', design: safeDesign(entry.design)}));
  } catch { /* A damaged notebook must not prevent designing. */ }

  const label = (config, key) => styleGroups[key][1][key === 'shirtTie' && config.shirtCollar === 2 ? 2 : config[key]];
  const updateCount = () => { get('saved-look-count').textContent = looks.length; };
  function store(next) {
    try { localStorage.setItem(notebookKey, JSON.stringify(next)); }
    catch {
      get('saved-look-status').textContent = 'This browser could not save your looks. Free some site storage or allow local storage, then try again.';
      return false;
    }
    looks = next;
    updateCount();
    return true;
  }

  function compareValue(config, key) {
    if (key === 'outfit') return outfits[config.outfit].name;
    if (key === 'fabric') return fabrics[config.fabric].name;
    if (key === 'material') return fabrics[config.fabric].material;
    if (key === 'price') return money(configurationPrice(config));
    if (stylePiece(key) !== 'shirt' && !outfits[config.outfit].pieces.includes(stylePiece(key))) return 'Not included';
    if (stylePiece(key) !== 'shirt') return orderConstruction(config, stylePiece(key))[styleGroups[key][0]];
    return label(config, key);
  }

  function renderNotebook() {
    const entries = [{name: 'Current design', design}, ...looks];
    get('saved-look-cards').innerHTML = entries.map((entry, index) => `
      <article class="saved-look-card${index ? '' : ' current-look'}">
        <div class="notebook-cloth"><canvas width="400" height="180" data-notebook-fabric="${entry.design.fabric}" aria-label="${text(fabrics[entry.design.fabric].name)} fabric swatch" role="img"></canvas><span>${index ? 'SAVED ' + String(index).padStart(2, '0') : 'DESIGNING NOW'}</span></div>
        <div class="saved-look-copy"><h3>${text(entry.name)}</h3><p>${text(fabrics[entry.design.fabric].name)}</p><div class="saved-look-price"><span>${text(outfits[entry.design.outfit].name)}</span><strong>${money(configurationPrice(entry.design))}</strong></div>
        ${index ? `<div class="saved-look-actions"><button type="button" data-use-look="${index - 1}">Use this look <span aria-hidden="true">↗</span></button><button type="button" data-remove-look="${index - 1}" aria-label="Remove ${text(entry.name)}">Remove</button></div>` : '<p class="current-look-note">Your live configuration</p>'}</div>
      </article>`).join('');
    get('saved-look-cards').querySelectorAll('canvas').forEach((canvas, index) => paintCloth(canvas, entries[index].design.fabric, 1.1));
    const rows = [['Pieces', 'outfit'], ['Fabric', 'fabric'], ['Material', 'material'], ['Silhouette', 'silhouette'], ['Lapels', 'lapel'], ['Button stance', 'closure'], ['Construction', 'canvasType'], ['Lining coverage', 'liningCoverage'], ['Trouser cut', 'trouserFit'], ['Waistcoat neckline', 'vestNeck'], ['Shirt color · preview', 'shirtColor'], ['Tie · preview', 'shirtTie'], ['Configuration total', 'price']];
    get('look-comparison').innerHTML = looks.length ? `<table><caption>Compare the details <span>Different choices are highlighted</span></caption><thead><tr><th scope="col">Detail</th>${entries.map(entry => `<th scope="col">${text(entry.name)}</th>`).join('')}</tr></thead><tbody>${rows.map(([name, key]) => {
      const values = entries.map(entry => compareValue(entry.design, key));
      return `<tr${new Set(values).size > 1 ? ' class="look-difference"' : ''}><th scope="row">${name}</th>${values.map(value => `<td>${text(value)}</td>`).join('')}</tr>`;
    }).join('')}</tbody></table>` : '<p class="notebook-empty">Save your first look to compare cloth, cut and price here.</p>';
  }

  get('open-saved-looks').addEventListener('click', () => {
    get('look-name').value = fabrics[design.fabric].name.slice(0, 40);
    get('saved-look-status').textContent = '';
    renderNotebook();
    get('saved-looks-dialog').showModal();
  });
  get('save-look-form').addEventListener('submit', event => {
    event.preventDefault();
    const name = get('look-name').value.trim();
    if (!name) { get('saved-look-status').textContent = 'Give this look a name first.'; return; }
    if (looks.length === 3) { get('saved-look-status').textContent = 'Your notebook has three looks. Remove one to make room for another.'; return; }
    if (store([...looks, {name: name.slice(0, 40), design: safeDesign(design)}])) {
      renderNotebook();
      get('saved-look-status').textContent = `${name} saved on this browser.`;
    }
  });
  get('saved-look-cards').addEventListener('click', event => {
    const use = event.target.closest('[data-use-look]'), remove = event.target.closest('[data-remove-look]');
    if (use) {
      const entry = looks[Number(use.dataset.useLook)];
      if (!entry) return;
      design = safeDesign(entry.design);
      piece = 'jacket'; angle = 'front'; lookDetail = ''; split = false;
      jacketHidden = false; waistcoatHidden = false; zoomed = false; zoomFocus = 53;
      resetFabricSearch(); syncPieceControls(); renderDesign(); save();
      get('saved-looks-dialog').close();
      get('status').textContent = `${entry.name} applied. Your measurements and bag items are unchanged.`;
    } else if (remove) {
      const index = Number(remove.dataset.removeLook), entry = looks[index];
      if (!entry || !store(looks.filter((_, position) => position !== index))) return;
      renderNotebook();
      get('saved-look-status').textContent = `${entry.name} removed.`;
      get('look-name').focus();
    }
  });

  const specRows = entries => `<dl class="design-specs">${entries.map(([name, value]) => `<div><dt>${text(name)}</dt><dd>${text(value)}</dd></div>`).join('')}</dl>`;
  get('open-design-details').addEventListener('click', () => {
    const fabric = fabrics[design.fabric], outfit = outfits[design.outfit];
    get('design-details-content').innerHTML = `
      <div class="design-overview"><div><span class="eyebrow">${text(outfit.name)}</span><h3>${text(fabric.name)}</h3><p>${text(fabric.material)} · ${text(fabric.code)}</p></div><canvas id="design-cloth" width="240" height="180" role="img" aria-label="Selected fabric swatch"></canvas></div>
      <section class="design-pricing" aria-label="Price breakdown">${specRows([['Base ' + outfit.name.toLowerCase(), money(outfit.price)], ['Cloth upgrade', fabric.surcharge ? '+' + money(fabric.surcharge) : 'Included'], ['Construction choices', 'Included'], ['Configuration total', money(configurationPrice(design))]])}<p>Demo configuration price in USD. No payment is collected.</p></section>
      ${outfit.pieces.map(garment => `<section class="design-section"><div class="design-section-title"><h3>${text(pieces[garment])}</h3><button type="button" data-edit-design="${garment}">Edit <span aria-hidden="true">↗</span></button></div>${specRows(Object.entries(orderConstruction(design, garment)))}</section>`).join('')}
      <section class="design-section"><div class="design-section-title"><h3>Preview styling</h3>${showsStudioModel() ? '<button type="button" data-edit-design="shirt">Edit <span aria-hidden="true">↗</span></button>' : ''}</div><p class="workspace-intro">Shirt and tie styling is for the studio preview; it is not included in your suit order.</p>${specRows(['shirtColor', 'shirtCollar', 'shirtCuff', 'shirtTie'].map(key => [styleGroups[key][0], label(design, key)]))}</section>
      <p class="design-next-step"><span>Up next</span> Add your design to the bag, then complete its Size Passport.</p>`;
    paintCloth(get('design-cloth'), design.fabric, 1.1);
    get('design-details-dialog').showModal();
  });
  get('design-details-content').addEventListener('click', event => {
    const button = event.target.closest('[data-edit-design]');
    if (!button) return;
    get('design-details-dialog').close();
    get('piece-tabs').querySelector(`[data-piece="${button.dataset.editDesign}"]`).click();
    get('tailoring-title').scrollIntoView({block: 'center', behavior: 'smooth'});
    get('style-jump').focus({preventScroll: true});
  });

  document.querySelector('.season-shortcuts').addEventListener('click', event => {
    const button = event.target.closest('[data-season]');
    if (!button) return;
    get('fabric-season').value = button.dataset.season;
    filterFabrics();
  });
  document.addEventListener('cloth-sample-ready', ({detail: index}) => {
    if (get('saved-looks-dialog').open) {
      for (const canvas of get('saved-look-cards').querySelectorAll(`[data-notebook-fabric="${index}"]`)) paintCloth(canvas, index, 1.1);
    }
    if (get('design-details-dialog').open && index === design.fabric) paintCloth(get('design-cloth'), index, 1.1);
  });
  updateCount();
})();
