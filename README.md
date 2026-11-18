# SuitCraft

A local custom-suit product prototype built with static HTML, CSS and JavaScript.
Choose cloth and construction, compare jacket/two-piece/three-piece views, save
the active design on this browser, edit bag items, complete Size Passport and
export a demo order.

## Product flows

- **Fabric:** searchable catalogue, combined material/color/pattern/season/price
  filters, local photographed cloth samples and digital swatches.
- **Design:** quick lapel/button/pocket choices, advanced construction controls,
  front/inside/back views, studio faces and a separate 3D jacket preview.
- **Save Design:** saves the current configuration locally. It is not a cloud
  account or a multi-look notebook, and storage failures are reported.
- **Bag and Size Passport:** per-item measurements and optional size labels;
  centimetres remain the source values when displaying inches. Browser-autofilled
  values are collected on unit changes, navigation and leaving the page.
- **Demo order:** review specifications, enter an address and download JSON.
  The receipt survives refresh in this tab through session storage. No payment,
  email, fulfilment or shipping request is sent.

The photographic renderer composites fixed garment/body photographs and drawn
construction details. It is not a physical cloth simulation or a guarantee of
real tailoring fit. The optional 3D view is a jacket configurator, not a body scan.

## Run

Serve this directory on localhost, for example:

```powershell
python -m http.server 8080 --bind 127.0.0.1
```

Open http://127.0.0.1:8080. Camera access needs localhost or HTTPS plus browser
permission. There is no production dependency installation or frontend build.

## Test

Node.js, Playwright and an installed Edge browser are needed for browser tests.
Use `BROWSER_EXECUTABLE_PATH` for a specific executable or `BROWSER_CHANNEL` for
another installed Playwright browser channel.

```powershell
node --test studio-workflow.test.cjs try-on.test.cjs tests/studio-fitting.test.cjs tests/camera.test.cjs tests/product-browser.test.cjs
```

The browser suites serve isolated localhost pages and block external requests.
They cover measured garment coverage/alpha gaps, cut changes, viewport fitting,
measurement autofill and conversion precision, bag editing, saved design errors,
mobile demo checkout/export, and camera lifecycle/race conditions. Native
synthetic video tests do not establish physical webcam or real-phone behavior.
Body camera UI tests use fixture landmarks; pose and quality logic is separate.

For visual inspection of the current interface:

```powershell
$env:STUDIO_SCREENSHOT_DIR='C:\path\to\screenshots'
node tests/visual-suit.cjs
```

This captures 28 rendering cases as transparent native PNGs and neutral-background
PNGs, plus desktop/mobile screens and a JSON manifest. Cases include all three
outfits and angles, notch/peak/shawl lapels with single/double closures, three
cuts, all four trouser fits on two-/three-piece suits, and waistcoat front/back. Set `STUDIO_QA_FABRIC` to an exact catalogue name
(default: `Blue Rough Linen`) to repeat with another material. Inspect the images:
automated assertions alone cannot establish visual realism.

`tests/studio.test.cjs` is a legacy suite for the earlier Form Atelier interface,
including controls removed by the SuitCraft update. It is not the current UI suite.

## Camera and privacy boundaries

Face and full-body cameras offer Stop/Restart, handle disconnects and release
tracks when their dialog closes or the page is left. Face capture also pauses in
a background tab. Late permission grants are discarded after cancellation.
Photos remain in memory in the current tab and are not stored with designs.

`node tests/pose-model-smoke.cjs` is an optional online check: it downloads the
public MediaPipe runtime/model and validates the built-in studio photograph with
framing margins. Inference runs in the browser; the photograph is not uploaded.
Physical webcam permission, positioning and quality still need a live device check.

The optional studio-render control probes `api/try-on`; this static repository
has no rendering backend. Sending a photo to an external renderer requires its
separate consent flow. Keep API keys out of frontend files.

Designs, bag contents, measurements, units and preferences use browser local
storage under `form-atelier-v1`. Clearing site data removes them. Demo shipping
information exists only in the tab's session receipt/export. None of this is an
account-synced production order database.
