'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const read = name => fs.readFileSync(path.join(__dirname, name), 'utf8');
const studio = read('studio.js');
const beforeStartup = studio.indexOf('installStudioRender();');
const rendererStart = studio.indexOf('function init3DRenderer()');
const finalRoute = studio.lastIndexOf('\nroute();');

function storage(initial = {}) {
  const items = new Map(Object.entries(initial));
  return {
    getItem: key => items.get(key) ?? null,
    setItem: (key, value) => items.set(key, value),
  };
}

function makeStudio({localStorage = storage(), sessionStorage = storage(), renderer, three, render = false} = {}) {
  const elements = new Map();
  const listeners = new Map();
  const removedChildren = [];
  let blob;
  const location = {hash: '#studio'};
  const element = id => {
    if (!elements.has(id)) {
      elements.set(id, {
        id,
        value: '',
        firstChild: {textContent: ''},
        style: {display: '', setProperty() {}},
        classList: {toggle() {}},
        children: [],
        textContent: '',
        hidden: false,
        innerHTML: '',
        addEventListener: (name, handler) => listeners.set(id + ':' + name, handler),
        querySelectorAll: () => [],
        closest: element,
        setAttribute(name, value) { this[name] = String(value); },
        removeAttribute() {},
        replaceChildren() { removedChildren.push(id); },
        click() {},
        focus() {},
      });
    }
    return elements.get(id);
  };
  const selectors = Array.from({length: 6}, () => ({value: 'all'}));
  element('fabric-facets').querySelectorAll = () => selectors;
  element('three-container').style.display = 'none';
  const context = vm.createContext({
    window: {addEventListener() {}, scrollTo() {}, THREE: three},
    document: {
      getElementById: element,
      querySelector: element,
      querySelectorAll: () => [],
      addEventListener() {},
      createElement: element,
    },
    location,
    history: {replaceState(_state, _title, hash) { location.hash = hash; }},
    localStorage,
    sessionStorage,
    FormData: class { constructor(form) { return new Map(Object.entries(form.values ?? {})); } },
    Blob,
    URL: {createObjectURL(value) { blob = value; return 'blob:receipt'; }, revokeObjectURL() {}},
    console: {log() {}, warn() {}},
    setTimeout() {},
    requestAnimationFrame: callback => callback(),
    ThreeSuitRenderer: renderer,
    paintCloth() {},
    installFaceCamera() {},
    installNecklineCatalog() {},
    installBodyCapture() {},
    photoClothSources: {},
    mannequinTones: [{}],
    studioFaces: [{id: 'original'}, {id: 'swept'}],
    tryOnSession: {},
    faceState: {},
    constructionDetails: {lapel: ['front'], pocket: ['front']},
    cutawayNames: {},
    studioPortraits: null,
    studioGeneration: {available: false},
    photoCloth: () => false,
    clothAppearance: () => 'test-cloth',
    paintFullSuit: () => true,
    paintConstructionFocus: () => true,
    frontMannequin: '', insideMannequin: '', backMannequin: '', trousersMannequin: '',
    waistcoatMannequin: '', trousersBackMannequin: '', waistcoatBackMannequin: '',
  });
  const run = code => vm.runInContext(code, context);
  run(read('neckline-catalog.js'));
  run(read('catalog.js'));
  run(read('garment-details.js'));
  run(read('suit-pieces.js'));
  run(read('size-passport.js'));
  run(read('studio-model.js'));
  run('loadStudioModel = () => {}; paintStudioModel = () => true;');
  assert.ok(beforeStartup > 0 && rendererStart > beforeStartup && finalRoute > rendererStart);
  run(studio.slice(0, beforeStartup) + studio.slice(rendererStart, finalRoute));
  if (!render) run('renderPreview = () => {}; renderDesign = () => {};');
  run('syncPieceControls = () => {}; paintBagPreviews = () => {};');
  function emit(id, name, target = element(id)) {
    const handler = listeners.get(id + ':' + name);
    assert.equal(typeof handler, 'function', id + ' should handle ' + name);
    handler({target, currentTarget: target, preventDefault() {}});
  }
  return {element, run, emit, location, selectors, localStorage, sessionStorage, removedChildren, download: () => blob};
}

test('the explicit navy studio action changes the preview and retains saved bag lines', () => {
  const studio = makeStudio();
  studio.run("design.fabric = 12; design.closure = 5; modelPreference = 'mannequin'; bag = [{...design}];");
  const bagBefore = studio.run('JSON.stringify(bag)');
  studio.emit('apply-studio-look', 'click');
  assert.equal(studio.run('design.fabric'), studio.run('defaults.fabric'));
  assert.equal(studio.run('design.closure'), 4);
  assert.equal(studio.run('design.lapel'), 2);
  assert.equal(studio.run('design.pocket'), 0);
  assert.equal(studio.run('modelPreference'), 'studio');
  assert.equal(studio.run('piece'), 'jacket');
  assert.equal(studio.run('angle'), 'front');
  assert.equal(studio.run('JSON.stringify(bag)'), bagBefore);
  assert.equal(JSON.parse(studio.localStorage.getItem('form-atelier-v1')).modelPreference, 'studio');
});

test('quick construction choices and Save Design use the current configuration', () => {
  const studio = makeStudio();
  studio.run('mountStudioQuickOptions()');
  assert.match(studio.element('studio-quick-options').innerHTML, /data-style="pocket" data-choice="2"/);
  studio.emit('studio-quick-options', 'click', {
    closest: () => ({dataset: {style: 'pocket', choice: '2'}}),
  });
  assert.equal(studio.run('design.pocket'), 2);

  studio.emit('save-design', 'click');
  const saved = JSON.parse(studio.localStorage.getItem('form-atelier-v1'));
  assert.equal(saved.design.pocket, 2);
  assert.equal(saved.bag.length, 0);
  assert.equal(studio.element('studio-action-message').textContent, 'Design saved on this device.');
});

test('a saved full-look mannequin opens in garment focus and can show the full body', () => {
  const localStorage = storage({'form-atelier-v1': JSON.stringify({
    design: {outfit: 2, fabric: 3}, modelPreference: 'mannequin',
  })});
  const app = makeStudio({localStorage, render: true});
  const modelClasses = new Set();
  app.element('model').classList.toggle = (name, active) => (
    active ? modelClasses.add(name) : modelClasses.delete(name)
  );

  app.run('renderPreview()');
  assert.ok(modelClasses.has('garment-focus'));
  assert.ok(modelClasses.has('zoomed'));
  assert.equal(app.element('zoom').textContent, 'Full body');

  app.emit('zoom', 'click');
  assert.ok(!modelClasses.has('zoomed'));
  assert.equal(app.element('zoom').textContent, 'Jacket focus');
  assert.equal(app.run('design.outfit'), 2);
  assert.equal(app.run('design.fabric'), 3);
  assert.equal(app.run('modelPreference'), 'mannequin');
});

test('callouts switch to the selected piece without keeping the old jacket details', () => {
  const app = makeStudio({render: true});
  const cards = ['lapel', 'closure', 'pocket'].map((detail) => {
    const card = app.element('card-' + detail);
    card.dataset = {viewDetail: detail};
    card.querySelector = selector => app.element(detail + selector);
    return card;
  });
  app.element('preview-callouts').querySelectorAll = () => cards;

  app.run("design.outfit = 2; selectPiece('waistcoat')");
  assert.equal(app.element('preview-callouts').hidden, false);
  assert.deepEqual(cards.map(card => card.dataset.viewDetail), ['vestNeck', 'vestClosure', 'vestPocket']);
  assert.equal(app.element('lapel[data-detail-label]').textContent, app.run('styleGroups.vestNeck[1][design.vestNeck]'));

  app.run("selectPiece('jacket')");
  assert.deepEqual(cards.map(card => card.dataset.viewDetail), ['lapel', 'closure', 'pocket']);
});

test('preview thumbnail children select the real angle and a detail closes back to its card', () => {
  const studio = makeStudio();
  studio.emit('.angles', 'click', {closest: () => ({dataset: {view: 'back'}})});
  assert.equal(studio.run('angle'), 'back');

  let restoredFocus = false;
  const card = {dataset: {viewDetail: 'lapel'}, focus() { restoredFocus = true; }};
  studio.emit('preview-callouts', 'click', {closest: () => card});
  assert.equal(studio.run('lookDetail'), 'lapel');
  assert.equal(studio.run('angle'), 'front');
  studio.emit('close-look-detail', 'click');
  assert.equal(studio.run('lookDetail'), '');
  assert.equal(restoredFocus, true);
});

test('Size and unavailable Trousers rail actions do not alter the order', () => {
  const studio = makeStudio();
  const rail = studio.element('.studio-rail');
  let focused;
  studio.element('add').focus = () => { focused = 'add'; };
  studio.element('outfit').focus = () => { focused = 'outfit'; };
  function select(panel) {
    const button = {dataset: {studioPanel: panel}, setAttribute() {}, closest: () => rail};
    rail.querySelectorAll = () => [button];
    studio.emit('.studio-rail', 'click', {closest: () => button});
  }
  select('trousers');
  assert.equal(focused, 'outfit');
  assert.equal(studio.run('design.outfit'), 0);
  select('size');
  assert.equal(focused, 'add');
  assert.equal(studio.run('bag.length'), 0);
  assert.match(studio.element('studio-action-message').textContent, /Size Passport/);
});

function completePassport(studio, outfit = 2) {
  studio.run('design.outfit = ' + outfit + '; bag = [{...design, passport: safePassport({}, design.outfit)}];'
    + ' for (const [piece, entry] of Object.entries(bag[0].passport)) {'
    + ' for (const [key] of passportFields[piece]) entry.measurements[key] = 76.2; }'
    + ' fit = Object.fromEntries(Object.entries(fitGroups).map(([key, [, options]]) => [key, options[0]]));');
}

test('fabric search matches the actual weave of Mohair Serge', () => {
  const app = makeStudio();
  app.element('fabric-search').value = 'twill mohair';
  app.emit('fabric-search', 'input');
  assert.match(app.element('swatches').innerHTML, /Mohair Serge/);
});

test('fabric filters combine photographed, gold, and premium and clear back to the catalog', () => {
  const app = makeStudio();
  app.selectors[0].value = 'scan';
  app.selectors[2].value = 'gold';
  app.selectors[5].value = 'premium';
  app.emit('fabric-facets', 'change');
  assert.match(app.element('swatches').innerHTML, /Gold Crepe Satin/);
  assert.match(app.element('fabric-count').textContent, /^1 \/ /);
  assert.equal(app.element('next-fabrics').disabled, true);
  app.emit('clear-fabric-filters', 'click');
  assert.equal(app.selectors.every(facet => facet.value === 'all'), true);
  assert.equal(app.element('next-fabrics').disabled, false);
});

test('fabric paging advances and a search resets the page and empty state', () => {
  const app = makeStudio();
  app.run('mountSwatches()');
  app.emit('next-fabrics', 'click');
  assert.match(app.element('fabric-page').textContent, /^2 \/ /);
  app.element('fabric-search').value = 'FA-P06';
  app.emit('fabric-search', 'input');
  assert.match(app.element('swatches').innerHTML, /Green Stretch Poplin/);
  assert.equal(app.element('previous-fabrics').disabled, true);
  app.element('fabric-search').value = 'no-fabric-with-this-name';
  app.emit('fabric-search', 'input');
  assert.equal(app.element('fabric-page').textContent, 'No matches');
  assert.equal(app.element('next-fabrics').disabled, true);
});

test('closing the active construction accordion clears its preview', () => {
  const app = makeStudio();
  app.run("lookDetail = 'lapel'");
  app.emit('style-groups', 'click', {closest: () => ({parentElement: {open: false, dataset: {detail: 'lapel'}}})});
  assert.equal(app.run('lookDetail'), '');
});

test('a body feature selection survives a refresh before form submission', () => {
  const app = makeStudio();
  app.emit('body-options', 'change', {name: 'shoulders', value: 'Sloped', checked: true});
  const reloaded = makeStudio({localStorage: app.localStorage});
  assert.equal(reloaded.run('fit.shoulders'), 'Sloped');
});

test('editing a bag line keeps other lines and compatible measurements', () => {
  const app = makeStudio();
  completePassport(app);
  app.run('bag.push({...design, passport: safePassport({}, design.outfit)}); editIndex = 0; design.outfit = 1;');
  app.emit('add', 'click');
  assert.equal(app.run('bag.length'), 2);
  assert.equal(app.run('bag[0].outfit'), 1);
  assert.equal(app.run('bag[1].outfit'), 2);
  assert.equal(app.run('bag[0].passport.jacket.measurements.chest'), 76.2);
  assert.equal(app.run('bag[0].passport.waistcoat'), undefined);
  assert.equal(app.location.hash, '#cart');
});

test('checkout redirects an empty bag and incomplete passports', () => {
  const app = makeStudio();
  app.location.hash = '#checkout';
  app.run('route()');
  assert.equal(app.location.hash, '#cart');
  completePassport(app);
  app.run('delete bag[0].passport.jacket.measurements.chest');
  app.location.hash = '#checkout';
  app.run('route()');
  assert.equal(app.location.hash, '#fit');
  completePassport(app);
  app.run('fit = {}');
  app.location.hash = '#checkout';
  app.run('route()');
  assert.equal(app.location.hash, '#fit');
});

test('checkout reports separate pieces and converts measurements without mutating the passport', () => {
  const app = makeStudio();
  completePassport(app);
  const order = JSON.parse(app.run("JSON.stringify(orderItem(bag[0], 'in'))"));
  assert.deepEqual(order.pieces.map(piece => piece.garment), ['Jacket', 'Trousers', 'Waistcoat (inner)']);
  assert.equal(order.pieces[0].measurements['Chest circumference'], 30);
  assert.equal(order.pieces[1].measurements.Inseam, 30);
  assert.equal(order.pieces[2].measurements['Waistcoat back length'], 30);
  assert.equal(app.run('bag[0].passport.jacket.measurements.chest'), 76.2);
});

test('the demo order download survives refresh after the bag is cleared', async () => {
  const app = makeStudio();
  completePassport(app, 1);
  const form = {reset() {}, values: {first: 'QA', last: 'Customer', email: 'qa@example.invalid', address: '1 Test Road', city: 'Test City', postal: '12345', country: 'Test Country'}};
  app.emit('checkout-form', 'submit', form);
  assert.equal(app.location.hash, '#complete');
  assert.equal(app.run('bag.length'), 0);
  const reloaded = makeStudio({localStorage: app.localStorage, sessionStorage: app.sessionStorage});
  reloaded.location.hash = '#complete';
  reloaded.run('route()');
  assert.equal(reloaded.location.hash, '#complete');
  reloaded.emit('download', 'click');
  const downloaded = JSON.parse(await reloaded.download().text());
  assert.equal(downloaded.items.length, 1);
  assert.equal(downloaded.items[0].pieces.length, 2);
  assert.match(downloaded.reference, /^FA-/);
});

test('demo checkout includes the entered shipping address in the export', async () => {
  const app = makeStudio();
  completePassport(app, 0);
  app.emit('checkout-form', 'submit', {reset() {}, values: {
    first: ' QA ', last: 'Customer', email: 'qa@example.invalid', address: '1 Test Road',
    address2: '', city: 'Test City', state: '', postal: '12345', country: 'Test Country',
  }});
  app.run('route()');
  app.emit('download', 'click');
  const order = JSON.parse(await app.download().text());
  assert.equal(order.shipping.first, 'QA');
  assert.equal(order.shipping.address, '1 Test Road');
  assert.equal(order.shipping.email, 'qa@example.invalid');
  assert.equal(JSON.parse(app.localStorage.getItem('form-atelier-v1')).shipping, undefined);
});

test('a malformed session receipt returns to the studio without rendering an invalid order', () => {
  const sessionStorage = storage({'form-atelier-demo-order-v1': '{"reference":"FA-QA","items":[null]}'});
  const app = makeStudio({sessionStorage});
  app.location.hash = '#complete';
  app.run('route()');
  assert.equal(app.location.hash, '#studio');
  assert.equal(app.element('confirmation').innerHTML, '');
});

test('studio angle and selected face survive jacket and waistcoat changes', () => {
  const app = makeStudio();
  app.run("design.outfit = 2; studioFaceId = 'swept';");
  app.emit('.angles', 'click', {closest: () => ({dataset: {view: 'back'}})});
  app.emit('toggle-jacket', 'click');
  assert.equal(app.run('studioModelView()'), 'waistcoat');
  assert.equal(app.run("previewAssets().join(',')"), 'waistcoatBack');
  app.emit('toggle-waistcoat', 'click');
  assert.equal(app.run('studioModelView()'), 'shirt');
  assert.equal(app.run('previewAssets().length'), 0);
  app.emit('.angles', 'click', {closest: () => ({dataset: {view: 'inside'}})});
  assert.equal(app.run('studioModelView()'), 'shirt');
  assert.equal(app.run('studioFaceId'), 'swept');
});

test('a missing 3D library keeps the 2D preview visible and explains the failure', () => {
  const app = makeStudio();
  app.emit('toggle-3d', 'click');
  assert.equal(app.element('three-container').style.display, 'none');
  assert.notEqual(app.element('fabric-model').style.display, 'none');
  assert.match(app.element('status').textContent, /3D preview is unavailable/);
});

test('a WebGL initialization failure restores the 2D preview', () => {
  class BrokenRenderer { constructor() { throw Error('WebGL unavailable'); } }
  const app = makeStudio({three: {}, renderer: BrokenRenderer});
  app.emit('toggle-3d', 'click');
  assert.equal(app.element('three-container').style.display, 'none');
  assert.notEqual(app.element('fabric-model').style.display, 'none');
  assert.match(app.element('status').textContent, /3D preview is unavailable/);
});

test('successful 3D toggle initializes once and returns to the 2D preview', () => {
  const cameraViews = [];
  let initialized = 0;
  class Renderer {
    constructor() { initialized += 1; }
    onWindowResize() {}
    cancelCameraTransition() {}
    setCameraPreset(angle) { cameraViews.push(angle); }
  }
  const app = makeStudio({three: {}, renderer: Renderer, render: true});
  app.emit('toggle-3d', 'click');
  assert.equal(app.element('fabric-model').style.display, 'none');
  app.emit('.angles', 'click', {closest: () => ({dataset: {view: 'back'}})});
  app.emit('toggle-3d', 'click');
  assert.notEqual(app.element('fabric-model').style.display, 'none');
  app.emit('toggle-3d', 'click');
  assert.equal(initialized, 1);
  assert.deepEqual(cameraViews, ['front', 'back', 'back']);
});

test('3D zoom, Back and Inside preserve the design, price and saved bag', () => {
  const calls = [];
  class Renderer {
    constructor(_container, syncZoom) { this.syncZoom = syncZoom; }
    onWindowResize() {}
    cancelCameraTransition() {}
    setCameraPreset(view) { calls.push(view); this.syncZoom(false); }
    updateFabricTexture(index) { this.fabric = index; }
    toggleZoom() { calls.push('zoom'); this.syncZoom(true); }
  }
  const app = makeStudio({three: {}, renderer: Renderer, render: true});
  app.run('design.outfit = 2; design.fabric = 3; design.lapel = 2; design.pocket = 4; renderDesign();');
  app.emit('add', 'click');
  app.location.hash = '#studio';
  app.run('route()');
  const saved = app.localStorage.getItem('form-atelier-v1');
  const price = app.element('price').textContent;
  const bag = app.element('cart-lines').innerHTML;

  app.emit('toggle-3d', 'click');
  assert.equal(app.run('three3DRenderer.fabric'), 3);
  app.emit('zoom', 'click');
  assert.equal(app.element('zoom')['aria-label'], 'Reset 3D camera zoom');
  assert.equal(app.run('zoomed'), false);
  app.emit('.angles', 'click', {closest: () => ({dataset: {view: 'back'}})});
  assert.match(app.element('preview-mode').innerHTML, /3D JACKET \/ BACK/);
  app.emit('.angles', 'click', {closest: () => ({dataset: {view: 'inside'}})});
  assert.deepEqual(calls, ['front', 'zoom', 'back']);
  assert.match(app.element('preview-mode').innerHTML, /STUDIO MODEL \/ INSIDE/);
  assert.equal(app.element('toggle-3d')['aria-pressed'], 'false');
  assert.equal(app.element('fabric-model').style.display, '');
  assert.equal(app.localStorage.getItem('form-atelier-v1'), saved);
  assert.equal(app.run('JSON.stringify({design, bag})'), JSON.stringify({
    design: JSON.parse(saved).design,
    bag: JSON.parse(saved).bag,
  }));
  assert.equal(app.element('price').textContent, price);
  assert.equal(app.element('cart-lines').innerHTML, bag);
});

test('3D fabric changes stay live and unsupported construction opens the 2D detail', () => {
  class Renderer {
    onWindowResize() {}
    cancelCameraTransition() {}
    setCameraPreset() {}
    updateFabricTexture(index) { this.fabric = index; }
  }
  const app = makeStudio({three: {}, renderer: Renderer, render: true});
  app.emit('toggle-3d', 'click');
  app.emit('swatches', 'click', {closest: () => ({dataset: {fabric: '3'}})});
  assert.equal(app.run('three3DRenderer.fabric'), 3);
  assert.equal(app.element('three-container').style.display, 'block');
  app.emit('style-groups', 'click', {
    closest: selector => selector === '[data-style]' ? {dataset: {style: 'pocket', choice: '2'}} : null,
  });
  assert.equal(app.run('design.pocket'), 2);
  assert.equal(app.element('three-container').style.display, 'none');
  assert.equal(app.element('look-detail').hidden, false);
  assert.match(app.element('studio-action-message').textContent, /Construction details use the 2D preview/);
});

test('camera zoom moves the WebGL camera and rapid preset changes settle on Back', () => {
  let now = 0;
  let frameId = 0;
  const frames = new Map();
  const {ThreeSuitRenderer} = vm.runInNewContext(read('three-suit-renderer.js') + '\n({ThreeSuitRenderer})', {
    Date: {now: () => now},
    requestAnimationFrame(callback) { frames.set(++frameId, callback); return frameId; },
    cancelAnimationFrame(id) { frames.delete(id); },
  });
  const renderer = Object.create(ThreeSuitRenderer.prototype);
  const zoom = [];
  renderer.camera = {position: {z: 5}, lookAt() {}};
  renderer.modelGroup = {rotation: {x: 0, y: 0}};
  renderer.renderer = {domElement: {addEventListener() {}}};
  renderer.onZoomChange = value => zoom.push(value);
  renderer.setupControls();
  renderer.toggleZoom();
  assert.equal(renderer.camera.position.z, 3.5);
  renderer.toggleZoom();
  assert.equal(renderer.camera.position.z, 5);
  assert.deepEqual(zoom, [true, false]);

  function advance(ms) {
    now += ms;
    const callbacks = [...frames.values()];
    frames.clear();
    callbacks.forEach(callback => callback());
  }

  renderer.setCameraPreset('back');
  advance(100);
  renderer.setCameraPreset('front');
  renderer.setCameraPreset('back');
  renderer.toggleZoom();
  assert.equal(frames.size, 1);
  advance(400);
  assert.equal(renderer.modelGroup.rotation.y, Math.PI);
  assert.equal(renderer.modelGroup.rotation.x, 0);
  assert.ok(Math.abs(renderer.camera.position.z - 3.85) < 0.001);
  assert.equal(frames.size, 0);
});

test('3D resize uses the actual short preview dimensions and skips hidden containers', () => {
  const {ThreeSuitRenderer} = vm.runInNewContext(read('three-suit-renderer.js') + '\n({ThreeSuitRenderer})');
  const renderer = Object.create(ThreeSuitRenderer.prototype);
  const sizes = [];
  renderer.container = {clientWidth: 320, clientHeight: 285};
  renderer.camera = {updateProjectionMatrix() {}};
  renderer.renderer = {setSize: (width, height) => sizes.push([width, height])};
  renderer.onWindowResize();
  assert.deepEqual(sizes, [[320, 285]]);
  assert.equal(renderer.camera.aspect, 320 / 285);
  renderer.container = {clientWidth: 0, clientHeight: 0};
  renderer.onWindowResize();
  assert.equal(sizes.length, 1);
});
