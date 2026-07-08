# myTab — Onboarding Guide

Chrome Extension (Manifest V3) that replaces the New Tab page. Vanilla JS, no framework, no build step — scripts are loaded via plain `<script>` tags in `extension/newtab.html` and share one global scope (function-declaration hoisting is relied on throughout).

## Layout

```
extension/
  manifest.json          MV3 manifest, chrome_url_overrides.newtab
  newtab.html             single page for all tabs (Bookmarks / FlashPaint / About)
  style.css               one shared stylesheet, CSS custom properties for theming
  js/
    main.js               header, settings, dark-mode toggle, background/zoom controls
    bookmarks.js           bookmark manager tab (multi-column layout, drag/drop, virtual folders)
    flashpaint.js          FlashPaint tab — screenshot annotation tool (largest module, ~2200 lines)
    theme-init.js          tiny script that applies the saved theme before first paint
    about.js, inspector.js small/support tabs
tests/
  specs/*.spec.js          Playwright regression suite (FlashPaint only, for now)
  fixtures.js              loads the unpacked extension via launchPersistentContext
```

Storage: `chrome.storage.sync` for user settings/preferences (100KB quota, tied to Google account), `chrome.storage.local` for larger/ephemeral data (e.g. FlashPaint autosave) — see `syncGet/syncSet` and `localGet/localSet/localRemove` helpers in `flashpaint.js`.

## FlashPaint architecture (extension/js/flashpaint.js)

Screenshot/annotation tool. Every object on the canvas (image, shape, text) is a DOM element (`<div class="img-overlay">` variants), not a canvas-drawn pixel — this is what makes drag/resize/multi-select/layers possible without a full canvas re-render.

Key global state:
- `activeOverlay` — the single "focused" object (drives the style toolbar)
- `selectedOverlays` (a `Set`) — multi-select group, separate from `activeOverlay`
- `tool` — `'select' | 'draw' | 'shape' | 'text' | 'selection' | 'crop'`, drives canvas `pointerEvents`/cursor and dispatch branches in the shared `mousedown`/`mousemove`/`mouseup` listeners on `canvas`

### The "click outside → deselect" pattern (read this before adding a new toolbar control)

A single `document.addEventListener('click', ...)` deactivates `activeOverlay` when a click lands outside both the object and the toolbar. It uses `e.composedPath()` (a dispatch-time snapshot), **not** `e.target` + `.contains()` — a bubble-phase listener earlier in the chain (e.g. a Layers-panel row click) can mutate the DOM and detach `e.target` mid-dispatch, making `.contains()` unreliable. The exclusion check is:

```js
!path.includes(activeOverlay) && !path.includes(flashpaintToolbar) &&
!path.includes(layersPanel) && !path.includes(layersPanelDot)
```

Any new floating UI element (panel, popover, dot) that should NOT trigger deselect must be added to this list — an earlier version tried excluding individual buttons one at a time and kept missing new ones (7+ recurrences of the same bug class). Prefer containment checks against a container element over listing individual controls.

### Layers panel (dot / expanded / hidden)

Three states, sharing one dragged position so switching between dot and panel never jumps:
- Hidden — toolbar button off
- Dot (`#layers-panel-dot`) — small draggable circle, click (without dragging >3px) expands it
- Expanded (`#layers-panel`) — semi-transparent panel (`color-mix()` + `backdrop-filter`), draggable via its header, lists every overlay top-first

Position is clamped to `wrapper.clientWidth/clientHeight` in `setLayersPos()` — needed because the dot (38px) and panel (200px) share a position, so a dot parked near the right edge would otherwise put the wider panel partly off-screen on expand.

### Other conventions worth knowing

- 8-point resize handles (`nw/n/ne/w/e/sw/s/se`) are added via a shared `addResizeHandles(overlay, {textOnly})` helper — text overlays only get `w`/`e` (height is auto).
- Selection/Crop marquee dragging and object dragging use separate state (`marqueeAction` vs `imgAction`) but the same resize-math pattern.
- Dark mode: `[data-theme="dark"]` on `<html>`, applied synchronously by `theme-init.js` (an external file — inline `<script>` is blocked by the extension's CSP). Any feature that sets an inline style color (body background, custom text colors) must special-case the "default" value to clear the inline override instead of hardcoding a light-mode color, or it will silently break dark mode.
- Toasts: `showToast(message, type)` — use for any user-facing async result (export, save, clipboard errors).

## Testing

```
cd tests && npm test              # headed, launches real Chromium with the unpacked extension
npx playwright test --workers=1   # full suite — use 1 worker; this machine's default parallel
                                   # workers cause flaky timeouts from launching many Chromium
                                   # instances at once, not a product bug
```

Playwright quirks specific to this codebase:
- `page.mouse.click(x, y, { modifiers: ['Shift'] })` does not work — use `keyboard.down('Shift')` / `mouse.click()` / `keyboard.up('Shift')`.
- `page.keyboard.press('Control+v')` does not reliably fire a real `paste` event — call `pasteCopiedOverlay()` directly via `page.evaluate()`.
- Viewport must be wide (1600×900 in `fixtures.js`) or the toolbar overflows into a "»" menu, breaking id-based selectors.

## Git

Remote: `git@github.com:ericphungtester-vn/myTab.git`, branch `main`.
