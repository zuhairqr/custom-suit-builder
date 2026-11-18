'use strict';

const featuredFabrics = [
  ['Midnight Windowpane', 'Wool · Windowpane', 'wool', '#263e59', '#7492b6', 'window', 0],
  ['Graphite Herringbone', 'Wool · Herringbone', 'wool', '#3d3e40', '#bfc1bd', 'herringbone', 0],
  ['Oxford Glen Plaid', 'Wool · Glen plaid', 'wool', '#666b71', '#d0d3d5', 'plaid', 25],
  ['Blue Sharkskin', 'Wool · Sharkskin', 'wool', '#4d6680', '#c0d0df', 'shark', 30],
  ['Stone Birdseye', 'Wool · Birdseye', 'wool', '#79726b', '#e1d7c7', 'bird', 15],
  ['Ink Chalk Stripe', 'Wool · Chalk stripe', 'wool', '#222939', '#bcc7d7', 'stripe', 20],
  ['Charcoal Flannel', 'Wool · Flannel', 'wool', '#464c53', '#aeb5bc', 'plain', 25],
  ['Forest Hopsack', 'Wool · Basket weave', 'wool', '#344c46', '#9aab8b', 'basket', 25],
  ['Olive Irish Linen', 'Linen · Plain weave', 'summer', '#5d6549', '#b7b88e', 'basket', 15],
  ['Sand Herringbone', 'Wool, silk & linen blend', 'summer', '#b9a789', '#f6e6c6', 'herringbone', 45],
  ['Coastal Seersucker', 'Cotton blend · Seersucker', 'summer', '#8598aa', '#eff1ed', 'seersucker', 15],
  ['Oyster Linen', 'Linen · Slub weave', 'summer', '#c3bbab', '#f6eee1', 'basket', 20],
  ['Sage Slub', 'Linen & cotton blend', 'summer', '#7b8775', '#d1dbbc', 'plain', 20],
  ['Espresso Mohair', 'Wool & mohair blend', 'occasion', '#45332f', '#a17e6d', 'shark', 45],
  ['Oxblood Velvet', 'Cotton · Velvet', 'occasion', '#541e2e', '#bc6c80', 'plain', 50],
  ['Midnight Barathea', 'Wool · Barathea', 'occasion', '#25262e', '#777985', 'bird', 40],
  ['Tobacco Corduroy', 'Cotton · Fine cord', 'occasion', '#72543d', '#c3a47c', 'cord', 30],
  ['Heather Tweed', 'Wool · Tweed', 'occasion', '#686253', '#c0b495', 'herringbone', 35],
].map(([name, material, family, color, thread, weave, surcharge], index) => ({
  name, material, family, color, thread, weave, surcharge, code: `FA-E${String(index + 1).padStart(2, '0')}`,
}));

const clothColors = [
  ['Ink Black', '#24252a', '#777980'], ['Onyx', '#313036', '#9b979b'], ['Graphite', '#404246', '#a8a7a1'],
  ['Charcoal', '#50545c', '#acb2bb'], ['Pewter', '#6f7479', '#c5c8c9'], ['Silver Grey', '#989fa4', '#e4e7e7'],
  ['Dove Grey', '#b5b6b1', '#eee9de'], ['Deep Navy', '#25324d', '#687f9e'], ['Atlantic Blue', '#30465e', '#92adca'],
  ['Steel Blue', '#4e6681', '#a8bbce'], ['Cornflower', '#6f86a5', '#d0dcec'], ['Dusty Blue', '#8a9bad', '#dce2e8'],
  ['Teal', '#30545b', '#83aeb0'], ['Petrol', '#34434d', '#899da9'], ['Pine', '#344c40', '#8ea58b'],
  ['Moss', '#53604a', '#abb28f'], ['Olive', '#66634d', '#b5b08d'], ['Sage', '#848e79', '#c5cbb4'],
  ['Eucalyptus', '#8b9b93', '#d7ded0'], ['Espresso', '#483a33', '#a48674'], ['Cocoa', '#605047', '#b49b86'],
  ['Tobacco', '#795d47', '#caa887'], ['Chestnut', '#8c604f', '#d4a695'], ['Camel', '#a78864', '#e0c7a8'],
  ['Taupe', '#887b71', '#d9c7b4'], ['Stone', '#aaa092', '#e2d5c4'], ['Sand', '#c0ab8c', '#eee0ca'],
  ['Oat', '#c9c1ad', '#f3ebd8'], ['Ivory', '#d9d2bf', '#f7f0dd'], ['Burgundy', '#5e303e', '#b67889'],
  ['Oxblood', '#682d38', '#c38187'], ['Plum', '#564052', '#a689a8'], ['Aubergine', '#403547', '#8d7b9b'],
  ['Heather', '#787180', '#c4b8c8'], ['Dusty Rose', '#a0797d', '#e1bdc1'], ['Copper', '#986950', '#d9a481'],
];

// Digital swatch recipes. Colorways have local reference codes and no inventory claims.
const clothRecipes = [
  ['Worsted Twill', 'Worsted wool', 'wool', 'twill', 0],
  ['Four-Ply Twill', 'Four-ply wool', 'wool', 'twill', 40, 1.35],
  ['Soft Flannel', 'Brushed wool', 'wool', 'plain', 25],
  ['Compact Herringbone', 'Wool', 'wool', 'herringbone', 20, .8],
  ['Heritage Herringbone', 'Wool', 'wool', 'herringbone', 25, 1.65],
  ['Open Hopsack', 'Wool', 'wool', 'basket', 20, 1.3],
  ['Fine Birdseye', 'Worsted wool', 'wool', 'bird', 20],
  ['Micro Sharkskin', 'Worsted wool', 'wool', 'shark', 25],
  ['Chalk Stripe', 'Wool flannel', 'wool', 'stripe', 25],
  ['Fine Pinstripe', 'Worsted wool', 'wool', 'pinstripe', 20],
  ['Windowpane', 'Wool', 'wool', 'window', 25],
  ['Glen Check', 'Wool', 'wool', 'plaid', 25],
  ['Prince of Wales Check', 'Wool', 'wool', 'prince', 30],
  ['Mini Houndstooth', 'Wool', 'wool', 'houndstooth', 25, .75],
  ['Gun Club Check', 'Wool', 'wool', 'gunclub', 35],
  ['Barleycorn', 'Wool tweed', 'occasion', 'bird', 35, 1.65],
  ['Barathea', 'Wool', 'occasion', 'barathea', 40, .7],
  ['Fine Corduroy', 'Cotton', 'occasion', 'cord', 30],
  ['Wide Wale Corduroy', 'Cotton', 'occasion', 'cord', 30, 1.8],
  ['Cotton Velvet', 'Cotton', 'occasion', 'velvet', 50],
  ['Mohair Serge', 'Wool and mohair blend', 'occasion', 'twill', 45, .65],
  ['Silk Basketweave', 'Wool and silk blend', 'occasion', 'silk-basket', 50, 1.7],
  ['Irish Linen', 'Linen', 'summer', 'linen', 20],
  ['Linen Herringbone', 'Linen', 'summer', 'herringbone', 25, 1.25],
  ['Summer Slub', 'Linen and cotton blend', 'summer', 'linen', 25, 1.6],
  ['Summer Twill', 'Wool, silk and linen blend', 'summer', 'twill', 45, 1.1],
  ['Summer Windowpane', 'Wool and linen blend', 'summer', 'window', 35, .8],
  ['Striped Seersucker', 'Cotton blend', 'summer', 'seersucker', 25],
  ['Piqué Seersucker', 'Cotton blend', 'summer', 'seersucker', 25, .6],
  ['Tropical Open Weave', 'Tropical wool', 'summer', 'basket', 30, .75],
];

const collectionFabrics = [
  ['FA-C01', 'Deep Navy Herringbone', 'Wool · Fine herringbone', 'wool', '#273248', '#606b7f', 'herringbone', 35, .82],
  ['FA-C02', 'Sage Heritage Herringbone', 'Tweed-style herringbone', 'occasion', '#777b62', '#a0a28a', 'herringbone', 35, 1],
  ['FA-C03', 'Sage Summer Herringbone', 'Linen & cotton blend · Herringbone', 'summer', '#909583', '#bbbca6', 'herringbone', 25, .82],
  ['FA-C04', 'Midnight Four-Ply', 'Wool · Fine twill', 'wool', '#242b3b', '#58647a', 'twill', 40, .82],
].map(([code, name, material, family, color, thread, weave, surcharge, scale]) => ({
  code, name, material, family, color, thread, weave, surcharge, scale,
}));

// Keep these at the end so saved fabric selections keep their original IDs.
const scannedFabrics = [
  ['poly_wool_herringbone', 'Grey Wool Blend Herringbone', 'Wool–polyester blend', 'wool', '#777577', 'herringbone', 'grey', 'cool', 35],
  ['rough_linen', 'Blue Rough Linen', 'Linen', 'summer', '#91abcd', 'linen', 'blue', 'warm', 35],
  ['terlenka', 'Beige Terlenka', 'Polyester', 'occasion', '#c5af99', 'plain', 'beige', 'all-season', 15],
  ['gingham_check', 'Green Cotton Gingham', 'Cotton', 'summer', '#75886a', 'plaid', 'green', 'warm', 25],
  ['crepe_satin', 'Gold Crepe Satin', 'Satin', 'occasion', '#daac76', 'plain', 'gold', 'all-season', 40],
  ['stretch_poplin', 'Green Stretch Poplin', 'Cotton', 'summer', '#b7d463', 'plain', 'green', 'warm', 25],
].map(([scan, name, material, family, color, weave, colorGroup, season, surcharge], index) => ({
  scan, name, material, family, color, thread: color, weave, colorGroup, season, surcharge,
  code: `FA-P${String(index + 1).padStart(2, '0')}`,
}));

const fabrics = featuredFabrics.concat(clothRecipes.flatMap(([pattern, fibre, family, weave, surcharge, scale = 1], recipeIndex) =>
  clothColors.map(([shade, color, thread], colorIndex) => ({
    name: `${shade} ${pattern}`,
    material: `${fibre} · ${pattern}`,
    code: `FA-${String(recipeIndex + 1).padStart(2, '0')}-${String(colorIndex + 1).padStart(2, '0')}`,
    family, color, thread, weave, scale, surcharge,
  }))
), collectionFabrics, scannedFabrics);

const collectionLooks = [
  {
    brand: 'Suitsupply · Custom Made', title: 'Navy Herringbone Wool',
    notes: 'Fine herringbone with a two-button front and flap pockets in the studio look.',
    url: 'https://custommade.suitsupply.com/configurator',
    image: 'https://cdn.suitsupply.com/image/upload/c_fit,f_auto,h_450,q_auto:good,w_450/products/cm-sample/default/SW7195-3-1_23',
    media: 'Original cloth swatch', fabric: 'FA-C01',
    cut: {outfit: 1, lapel: 0, closure: 1, square: 1},
  },
  {
    brand: 'Proper Cloth', title: 'VBC Blue S110s Sharkskin',
    notes: 'Fine blue sharkskin, structured shoulders, half canvas, notch lapels and a two-button front.',
    url: 'https://propercloth.com/tailored-clothing/vbc-blue-sharkskin-allen-suit-101852.html',
    guide: ['Jacket construction', 'https://propercloth.com/reference/jacket-construction-and-the-options-we-offer/'],
    image: 'https://cdn2.propercloth.com/pic_tccp/74_a1dd71110a25c436f2c4faadd1c32073_size6.jpg',
    media: 'Original product photo', fabric: 'FA-E04',
    cut: {outfit: 1, lapel: 0, closure: 1, shoulder: 3, canvasType: 0, square: 1, cuff: 4, trouserFit: 1},
  },
  {
    brand: 'Suit Direct · Autumn Winter 2026', title: 'Baxter Sage Herringbone Tweed',
    notes: 'Antique Rogue’s sage herringbone three-piece with a slim cut and matching waistcoat.',
    url: 'https://www.suitdirect.co.uk/sage-antique-rogue-slim-fit-baxter-sage-herringbone-tweed-suit-p-14677',
    guide: ['AW26 style guide', 'https://www.suitdirect.co.uk/styleguide/features/mens-suit-trends-autumn-winter'],
    image: 'https://cdn.suitdirect.co.uk/upload/siteimages/xlarge/ar26115mj_630_a.jpg',
    media: 'Original product photo', fabric: 'FA-C02',
    cut: {outfit: 2, lapel: 0, closure: 1, silhouette: 2, trouserFit: 1, vestBack: 1, square: 1},
  },
  {
    brand: 'Crane Brothers · Autumn Winter 2026', title: 'Charcoal Wool Flannel Double-Breasted',
    notes: 'Wide peaks, six buttons, straight flaps, double pleats and side adjusters.',
    url: 'https://crane-brothers.com/products/wool-flannel-double-breasted-suit-charcoal',
    image: 'https://cdn.shopify.com/s/files/1/0504/6186/8185/files/Wool_Flannel_Double-Breasted_Suit_-_Charcoal.jpg?v=1772755174&width=540',
    media: 'Original product photo', fabric: 'FA-E07',
    cut: {outfit: 1, lapel: 3, closure: 4, silhouette: 1, trouserFit: 2, trouserPleats: 2, trouserWaist: 1, trouserHeight: 3, square: 1},
  },
  {
    brand: 'Hockerty · Tailored Suits', title: 'Sage Herringbone Linen-Cotton',
    notes: 'A lighter sage herringbone, cut as a single-breasted summer suit.',
    url: 'https://www.hockerty.com/en-us/men/suits/1190547-sage-green-herringbone-linen-cotton-suit',
    image: 'https://d1fufvy4xao6k9.cloudfront.net/feed/img/man_suit2/1190547/front.png',
    media: 'Brand catalog render', fabric: 'FA-C03',
    cut: {outfit: 1, lapel: 0, closure: 1, shoulder: 2, liningCoverage: 1, square: 1},
  },
  {
    brand: 'Suitsupply · Custom Made', title: 'Navy Wrinkle-Free 4-Ply Wool',
    notes: 'Dark navy four-ply wool. The studio look pairs it with a classic notch and straight-leg trousers.',
    url: 'https://custommade.suitsupply.com/configurator',
    image: 'https://cdn.suitsupply.com/image/upload/c_fit,f_auto,h_450,q_auto:good,w_450/products/cm-sample/default/S2258T-20-26R_23',
    media: 'Original cloth swatch', fabric: 'FA-C04',
    cut: {outfit: 1, lapel: 0, closure: 1, square: 1},
  },
];

const extraButtons = [
  ['Off-white bone', '#fff2d8', '#dcd1b9', '#a4977d'], ['Cream pearl', '#fff7df', '#e2c7a3', '#a88965'],
  ['White pearl', '#ffffff', '#e0e7ea', '#9da6b2'], ['Sand horn', '#eac69c', '#ac8363', '#6c4d37'],
  ['Honey horn', '#efc187', '#a46537', '#593a27'], ['Mahogany horn', '#bc805d', '#78422e', '#3d2320'],
  ['Dark brown matte', '#936a58', '#584033', '#2c211b'], ['Espresso horn', '#a07861', '#503326', '#251611'],
  ['Grey-brown horn', '#b4a297', '#78655b', '#41342e'], ['Pewter horn', '#b9b8b6', '#777779', '#383b42'],
  ['Slate horn', '#a3afb7', '#566371', '#26303a'], ['Charcoal horn', '#969195', '#535057', '#25252b'],
  ['Ivory corozo', '#f1ead2', '#cec1a6', '#928067'], ['Taupe corozo', '#c1ad98', '#938175', '#54473f'],
  ['Chestnut corozo', '#c49878', '#8b5847', '#51372b'], ['Espresso corozo', '#ab8771', '#61463a', '#3a2922'],
  ['Slate corozo', '#a2aebe', '#6e7e90', '#405267'], ['Forest corozo', '#91ab89', '#567154', '#293d31'],
  ['Burgundy corozo', '#b88091', '#814457', '#4a2935'], ['Plum corozo', '#b597ab', '#755266', '#492e41'],
  ['Cobalt enamel', '#8cadd9', '#416bb0', '#243558'], ['Ivory enamel', '#fff9e9', '#dfd2b8', '#9e8f78'],
  ['Copper metal', '#e8a787', '#b57258', '#703d2f'], ['Brushed nickel', '#d0d9dc', '#818d92', '#414c55'],
  ['Bright brass', '#fff0a8', '#cdab4c', '#866123'], ['Blackened brass', '#a29465', '#5d553b', '#332d25'],
  ['Silver crest', '#e1e8f5', '#9ca8ba', '#546379'], ['Smoke glass', '#b1adbf', '#605969', '#2b2630'],
  ['Pearl grey', '#eeecf2', '#b5b7c7', '#77798e'],
];
const buttonFinishes = ['Dark horn', 'Light horn', 'Mother of pearl', 'Antique brass', 'Black corozo', 'Silver metal', 'Fabric covered', 'Black enamel', 'Smoked pearl', 'Tortoiseshell', 'Natural bone', 'Gunmetal', 'Gold crest', 'Bronze crest', 'Satin covered', 'Braided leather', 'Navy corozo', 'Olive corozo', ...extraButtons.map(([name]) => name)];

const liningCollection = [
  ['Midnight', '#26374e'], ['Burgundy', '#721e3d'], ['Champagne', '#b79873'], ['Unlined', null],
  ['Forest', '#304f42'], ['Silver', '#aeb5c1'], ['White', '#ece8e1'], ['Stone', '#c8bfb1'],
  ['Light brown', '#b69a80'], ['Grey', '#777c86'], ['Light grey', '#babcc2'], ['Dark grey', '#434650'],
  ['Light blue', '#7eabc0'], ['Steel blue', '#53768e'], ['Royal blue', '#3656a3'], ['Deep navy', '#1d2c51'],
  ['Black', '#1c2028'], ['Dusty teal', '#4e888d'], ['Petrol', '#265261'], ['Sage', '#889a80'],
  ['Olive', '#666b45'], ['Emerald', '#2b6a56'], ['Ochre', '#a57d37'], ['Copper', '#a36143'],
  ['Cocoa', '#604436'], ['Rose', '#ac6d7d'], ['Pink', '#d49aa9'], ['Plum', '#653e62'],
  ['Lavender', '#9c89b2'], ['Wine', '#502839'], ['Coral', '#c36b59'],
];
const activeLinings = liningCollection.filter(([, color]) => color);

const styleGroups = {
  silhouette: ['Silhouette', ['Tailored', 'Relaxed', 'Slim']],
  lapel: ['Lapel style', [
    // Classic suit & tuxedo lapels (0-23)
    'Notch lapel (step lapel)',
    'Wide notch lapel',
    'Peak lapel (pointed lapel)',
    'Wide peak lapel',
    'Shawl lapel (roll collar)',
    'Shawl lapel (butterfly)',
    'Narrow notch lapel (slim notch)',
    'High-gorge notch lapel',
    'Rounded peak lapel',
    'Standard peak lapel',
    'Narrow shawl lapel',
    'Standard notch lapel',
    'Tight notch lapel',
    'Extra-wide peak lapel',
    'Wide shawl lapel (dinner shawl)',
    'Asymmetrical notch',
    'Asymmetrical peak',
    'Asymmetrical shawl',
    'Satin-faced peak lapel',
    'Satin-faced shawl lapel',
    'Grosgrain-faced peak lapel',
    'Grosgrain-faced shawl lapel',
    'Velvet shawl lapel',
    'Self-faced shawl lapel',
    // All remaining styles from extraLapelShapes (24+)
    ...extraLapelShapes.map(([name]) => name)
  ]],
  lapelFinish: ['Lapel facing', ['Self cloth', 'Black satin', 'Navy grosgrain', 'Ivory satin', 'Black velvet', 'Contrast piping', 'Topstitched edge', 'Raw edge', 'Detachable seam']],
  closure: ['Button stance', ['Single one', 'Single two', 'Three-two roll', 'Double four', 'Double six', 'Single three', 'Double two', 'Double 6–4', 'Double 4–1', 'Low double 6–2', 'Single four']],
  button: ['Button finish', buttonFinishes],
  breast: ['Chest pocket', ['Single besom', 'Patch', 'None', 'Double besom', 'Accordion patch', 'Patch flap', 'Boat shape', 'Rounded patch']],
  pocket: ['Side pockets', ['Straight flap', 'Single besom', 'Patch', 'Flap & ticket', 'Slanted flap', 'Double besom', 'Accordion patch', 'Peach flap', 'Patch flap', 'Large flap · 6.5 cm', 'Rounded patch', 'Tulip patch']],
  ticket: ['Ticket pocket', ['Match side style', 'Add ticket pocket', 'No ticket pocket']],
  cuff: ['Sleeve buttons', ['Four kissing', 'One button', 'Two spaced', 'Three spaced', 'Four spaced', 'Five kissing', 'No buttons', 'Three kissing', 'Five spaced']],
  cuffFinish: ['Sleeve button finish', ['Match jacket', ...buttonFinishes]],
  stitching: ['AMF pick stitching', ['Subtle', 'None', 'Contrast', 'AMF · 2 mm', 'AMF · 6 mm']],
  square: ['Pocket square', ['Ivory fold', 'None', 'Burgundy', 'Navy']],
  vent: ['Rear vents', ['Side vents', 'Center vent', 'Ventless']],
  collarFelt: ['Collar felt', ['Self fabric', 'Tonal felt']],
  shoulder: ['Shoulder construction', ['Natural', 'Natural pleated', 'Unconstructed', 'Lightly padded', 'Lightly padded pleated', 'Structured']],
  canvasType: ['Canvas construction', ['Half canvas', 'Full canvas', 'Unconstructed']],
  liningCoverage: ['Jacket lining coverage', ['Full lined', 'Half lined', 'Unlined']],
  lining: ['Jacket lining color', liningCollection.map(([name]) => name)],
  inner: ['Interior pockets', ['Two welts', 'Four pockets', 'Single pocket', 'None']],
  monogram: ['Monogram placement', ['None', 'Left inside', 'Right inside']],
  monogramThread: ['Monogram thread', ['Ivory', 'Gold', 'Silver', 'Burgundy', 'Navy']],
  trouserFit: ['Trouser fit', ['Straight leg', 'Slim tapered', 'Relaxed wide leg', 'Classic tapered']],
  trouserPleats: ['Front pleats', ['Flat front', 'Single forward pleat', 'Double reverse pleats', 'Single reverse pleat', 'Double forward pleats']],
  trouserWaist: ['Waistband details', ['Belt loops', 'Side adjusters', 'Extended tab', 'Clean waistband']],
  trouserClosure: ['Waist closure', ['Match waistband', 'Standard exposed button', 'Standard hidden button', 'Extended peak', 'Extended straight', 'Slim extended peak', 'Single side closure']],
  trouserHeight: ['Waistband height', ['Standard', '3 cm', '4 cm', '5 cm']],
  trouserPocket: ['Trouser pockets', ['Slanted pockets', 'Vertical seam pockets', 'No visible pockets']],
  trouserHem: ['Hem finishing', ['Plain hem', '1.5″ turn-up', '2″ turn-up', '3 cm turn-up', '4.5 cm turn-up']],
  trouserTrim: ['Trouser trim', ['Self cloth', 'Black tuxedo stripe', 'Navy grosgrain stripe']],
  trouserButton: ['Trouser buttons', ['Match jacket', ...buttonFinishes]],
  trouserSuspender: ['Suspender buttons', ['None', 'Inside waistband']],
  trouserLining: ['Leg lining', ['Unlined', 'Half lined', 'Full lined']],
  trouserReinforcement: ['Crotch reinforcement', ['None', 'Standard', 'Enlarged']],
  vestCut: ['Waistcoat style', ['Classic five-button V', 'Six-button V', 'Low scoop', 'Double-breasted', 'Notch-lapel waistcoat', 'Shawl-collar waistcoat', 'Horseshoe dinner vest']],
  vestNeck: ['Waistcoat neckline', ['Match style', 'Classic V', 'Low scoop', 'Horseshoe', 'Notch lapel', 'Shawl collar']],
  vestClosure: ['Waistcoat closure', ['Match style', 'Single four-button', 'Single five-button', 'Single six-button', 'Double six-button', 'Double eight-button']],
  vestPocket: ['Waistcoat pockets', ['Two welt pockets', 'Four welt pockets', 'Two flap pockets', 'No pockets']],
  vestCloth: ['Waistcoat cloth', ['Match suit', 'Graphite contrast', 'Midnight contrast', 'Oyster contrast']],
  vestButton: ['Waistcoat buttons', ['Match jacket', ...buttonFinishes]],
  vestBack: ['Waistcoat back', ['Matching cloth', 'Tonal satin', 'Lining fabric']],
  vestBackAdjuster: ['Waistcoat back adjuster', ['No adjuster', 'Buckle strap', 'Side tabs']],
  vestLining: ['Waistcoat lining', ['Match jacket', ...activeLinings.map(([name]) => name)]],
};

const outfits = [
  {name: 'Jacket only', price: 400, pieces: ['jacket']},
  {name: 'Two-piece suit', price: 565, pieces: ['jacket', 'trousers']},
  {name: 'Three-piece suit', price: 675, pieces: ['jacket', 'trousers', 'waistcoat']},
];

const pieces = {jacket: 'Jacket', trousers: 'Trousers', waistcoat: 'Waistcoat (inner)'};

function stylePiece(key) {
  if (key.startsWith('trouser')) return 'trousers';
  if (key.startsWith('vest')) return 'waistcoat';
  return 'jacket';
}

const defaults = {
  outfit: 0, fabric: 0, silhouette: 0, lapel: 2, lapelFinish: 0, closure: 4, button: 0,
  breast: 0, pocket: 0, cuff: 0, stitching: 0, square: 0, vent: 0, lining: 0, inner: 0,
  ticket: 0, cuffFinish: 0, collarFelt: 0, shoulder: 0, canvasType: 0, liningCoverage: 0,
  monogram: 0, monogramThread: 0, monogramText: '',
  trouserFit: 0, trouserPleats: 0, trouserWaist: 0, trouserPocket: 0, trouserHem: 0, trouserTrim: 0,
  trouserClosure: 0, trouserHeight: 0, trouserButton: 0, trouserSuspender: 0, trouserLining: 0, trouserReinforcement: 0,
  vestCut: 0, vestPocket: 0, vestCloth: 0, vestButton: 0, vestNeck: 0, vestClosure: 0, vestBack: 0, vestBackAdjuster: 0, vestLining: 0,
};

const fitGroups = {
  shoulders: ['Shoulder type', ['Full square', 'Square', 'Normal', 'Sloped']],
  chest: ['Chest build', ['Lean / flat', 'Normal', 'Muscular', 'Husky']],
  posture: ['Body posture', ['Erect / straight', 'Normal / relaxed', 'Stooping']],
};
