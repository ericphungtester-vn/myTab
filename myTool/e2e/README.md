# myTool end-to-end tests

Playwright tests that drive the **real popup UI** (`popup.html` + the tool scripts) through
Chromium — the part the Node unit tests in [`../test/`](../test/) deliberately can't reach.

## How it works

There's no Chrome-extension-ID plumbing. `server.js` serves the `myTool/` directory over
`http://localhost:5178`, and the specs open `/popup.html` directly. Because `chrome.storage.sync`
is absent in that context, `main.js`'s **localStorage fallback** takes over — which is exactly what
lets the persistence tests assert that a selection survives a reload. Clipboard read/write
permission is granted in `playwright.config.js` so the copy-button tests can read back the clipboard.

## Running

```bash
cd myTool/e2e
npm install
npx playwright install chromium   # first time only
npm test
```

## What's covered

- **compare.spec.js** — the side-by-side diff renders (changed word highlighted on each side),
  added/removed rows land on the correct side, empty input errors instead of crashing, the
  HTML report downloads, and Reset clears everything.
- **resize.spec.js** — loading an image auto-fills its dimensions and enables Generate, the aspect
  lock keeps the ratio, resizing downloads a file + shows a preview + reports the new size (real
  `createImageBitmap`/canvas path), a size target with a lossless format is rejected, and Reset
  unloads the image.
- **copy-persist.spec.js** — copy buttons put the field value on the clipboard (and the Card number
  copies raw, without spaces), the last-selected country survives a reload, and Reset restores the
  default.
