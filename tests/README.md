# myTab E2E test suite

Playwright regression tests for the FlashPaint feature of the myTab Chrome extension. Since myTab
is a `chrome_url_overrides.newtab` extension with no build step, these tests load it unpacked
into a real Chromium instance via `launchPersistentContext` — there is no dev server to start.

## Setup

```bash
cd tests
npm install
npx playwright install chromium   # only needed once, downloads the matching browser build
```

## Running

```bash
npm test              # headless is not supported for extensions — this runs headed
npm run test:headed   # same thing, explicit
npm run test:ui       # Playwright's interactive UI mode — best for debugging a failure
```

To run a single file: `npx playwright test specs/multiselect.spec.js`

## Layout

- `fixtures.js` — provides the `flashpaintPage` fixture (a page navigated to the extension's New
  Tab override with the FlashPaint tab already active). Every spec should use this instead of the
  default `page` fixture.
- `specs/toolbar-deselect.spec.js` — regression guard for the most common bug found during
  development: a toolbar control silently deselecting the active object via the global
  "click outside → deselect" listener. If you add a new toolbar button, add it to the
  `controlsThatMustNotDeselect` list here.
- `specs/paste-copy-undo.spec.js`, `specs/selection-crop.spec.js`, `specs/multiselect.spec.js`,
  `specs/dark-mode.spec.js`, `specs/autosave.spec.js` — feature-specific coverage.

## Notes for sandboxed / CI environments

Chrome's own sandbox can conflict with certain container/CI sandboxing (symptoms: `mach_port_rendezvous`
or crashpad permission errors on launch). If you hit that, the browser needs to run without the
outer sandbox restriction that's causing the conflict — this is unrelated to Playwright itself.

Extensions do not load reliably in headless Chromium, so `fixtures.js` always launches headed;
running in CI requires a virtual display (e.g. `xvfb-run npm test` on Linux).
