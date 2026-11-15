# Form Atelier

A static HTML, CSS and JavaScript suit studio. Choose fabrics and construction,
preview jacket, two-piece and three-piece looks, save configurations in a bag,
complete a Size Passport, and download a demo order as JSON.

## Run locally

Serve this directory with a static HTTP server. For example, with Python 3:

```powershell
python -m http.server 8080 --bind 127.0.0.1
```

Open <http://127.0.0.1:8080>. There is no production dependency installation or
build step. Use localhost for camera access; deployed camera access requires
HTTPS and browser permission.

## Browser checks

The regression suite uses Node.js 20+ and Playwright with Microsoft Edge installed.
Install Playwright locally (the application itself does not use it):

```powershell
npm install --no-save --package-lock=false playwright@1.62.1
node --test tests/studio.test.cjs
```

The suite serves its own ephemeral localhost port, opens an isolated headless
browser, and blocks all external requests. It checks unfinished passport
persistence, autofill and unit conversion, invalid measurements, bag editing,
garment controls, fabric filters, mobile width, demo checkout and order download.
It never uses a live payment or rendering service. To use installed Chrome, set
`$env:BROWSER_CHANNEL='chrome'` before running. Optional screenshots can be saved
to an existing directory with `$env:STUDIO_SCREENSHOT_DIR='C:\path\to\screenshots'`.

## Data and integration boundaries

- Designs, bag contents, measurements, body-feature selections, measurement unit
  and model preferences are saved in this browser's local storage under
  `form-atelier-v1`. Clearing site data removes them. Storage-disabled browsers
  can still use the current tab, without persistence.
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
- `body-*.js`, `face-camera.js`, `studio-render.js`: optional personal try-on flows.

Automated browser checks cover local desktop and a 390px mobile viewport.
Physical camera capture, real phones, external model availability and an AI
rendering backend require separate integration checks.
