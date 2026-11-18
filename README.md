# Form Atelier

A static HTML, CSS and JavaScript suit studio. Choose fabrics and construction,
preview jacket, two-piece and three-piece looks, save configurations in a bag,
complete a Size Passport, and download a demo order as JSON.

Use **Save & compare** to keep up to three named looks in this browser, restore
one, or compare its cloth, effective construction choices and total with the
current design. Saved looks contain configurations only, without photos or
measurements. **Design details** reviews the actual garment specifications and
base/cloth price breakdown before adding to the bag, with links back to editing.
The fabric panel has synchronized year-round, summer and winter shortcuts.
See [the platform review](PLATFORM_REVIEW.md) for the reference comparison,
delivered changes and remaining production gaps.

The **Shirt** tab styles the studio model's shirt: five colors, classic/spread/band
collars, standard/minimal cuff reveal and navy/burgundy/no tie. Use **Show jacket**
to compare the shirt with the suit. Choosing cuff reveal shows the jacket
automatically; band collars always display without a tie. These choices persist
with each bag item and appear in review/download as preview accessories. They do
not add a shirt to the suit price or require additional tailoring measurements.
Shirt styling is available on the studio model, including the rear view; it does
not alter a personal try-on photo or the mannequin.

The cloth renderer separates catalogue swatches from on-garment material detail,
uses a shared linear-light exposure response for jacket and studio trousers, and
passes the source photograph's shadows/highlights through lapels and pockets.
This remains a composited photographic preview with fixed poses, not a simulated
3D cloth model. Matching new photographic garment assets would still be needed
for a higher ceiling on natural drape and pose fidelity.

## Run locally

Serve this directory with a static HTTP server. For example, with Python 3:

```powershell
python -m http.server 8080 --bind 127.0.0.1
```

Open <http://127.0.0.1:8080>. There is no production dependency installation or
build step. Use localhost for camera access; deployed camera access requires
HTTPS and browser permission.

## Current SuitCraft checks

Run the current workflow, try-on and browser fitting checks with Node.js 20+:

```powershell
node --test studio-workflow.test.cjs try-on.test.cjs tests/studio-fitting.test.cjs tests/camera.test.cjs
```

The browser fitting tests require Playwright and installed Edge. They serve an
isolated local page, block external requests, and check nine outfit/angle
combinations, seat coverage, trouser underlays, a closed three-piece jacket,
slim/tailored/relaxed waist widths, neck preservation and 360–1440px screens.
They also ensure the face picker sits below the model instead of covering shoes.
Use `BROWSER_EXECUTABLE_PATH` for a specific browser executable, or
`BROWSER_CHANNEL` for a Playwright browser channel.

Camera tests use the browser's native synthetic camera, not your physical webcam.
They cover capture/apply/remove, retake, stop/restart, device errors, disconnects,
backgrounding, late permissions, photo uploads and mobile dialog sizing. Body
capture UI tests use fixture landmarks; the pose/quality algorithms are checked
separately. Set `STUDIO_SCREENSHOT_DIR` to save camera test screenshots.
Both camera dialogs offer Stop camera, including while permission is pending.
Face capture also releases the camera when the tab goes into the background.

An optional online smoke check, `node tests/pose-model-smoke.cjs`, loads the actual
MediaPipe model and validates the built-in studio photograph with framing margins.
It downloads the public model/runtime; it does not send the photograph anywhere.
Physical webcam permissions, image quality and positioning still need a live
device check and are not established by the synthetic-camera tests.

`tests/studio.test.cjs` and `tests/visual-suit.cjs` target the earlier Form Atelier
interface, including shirt controls removed by the later SuitCraft update.
Use the current command above for this interface. Automated checks do not replace
visual inspection of the garment photographs or establish physical fit accuracy.

## Data and integration boundaries

- Designs, bag contents, measurements, body-feature selections, measurement unit
  and model preferences are saved in this browser's local storage under
  `form-atelier-v1`. Clearing site data removes them. Storage-disabled browsers
  can still use the current tab, without persistence.
- Named looks use `form-atelier-looks-v1` in the same browser's local storage.
  They are separate from the active design and bag, and do not sync across
  devices. Failed notebook writes report an error instead of claiming success.
- Measurements are stored in centimetres; switching the display to inches does
  not repeatedly round the source values. Label sizes are optional; measurements
  and all three body-feature selections are required for review.
- Demo checkout does not send shipping details or collect payment. Its order
  receipt exists in memory until the page is reloaded; download the JSON to keep it.
- Face and body photos stay in the current tab for the instant preview. Body
  pose detection and background removal may need third-party model downloads.
- AI studio rendering probes `api/try-on`. This static repository does not
  provide that backend. The rendering control remains hidden when the endpoint
  is unavailable. No API key belongs in these frontend files.

## Main files

- `index.html`, `studio.css`, `studio.js`: interface, controls, navigation and state.
- `catalog.js`: fabrics, construction options and defaults.
- `size-passport.js`: measurement validation, conversion and order specifications.
- `studio-model.js`, `full-suit.js`, `fabric-renderer.js`: preview composition.
- `studio-shirt.js`: studio shirt colors, collars and tie rendering.
- `body-*.js`, `face-camera.js`, `studio-render.js`: optional personal try-on flows.

Automated browser checks cover local desktop and a 390px mobile viewport.
Physical camera capture, real phones, external model availability and an AI
rendering backend require separate integration checks.
