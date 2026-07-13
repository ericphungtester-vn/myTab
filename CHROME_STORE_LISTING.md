# Chrome Web Store listing — draft copy

Paste these into the corresponding fields in the Developer Dashboard. Review/edit before submitting — especially the contact email in PRIVACY_POLICY.md and the bracketed placeholders below.

## Single purpose description

(Chrome Web Store requires every extension to state one narrow purpose. myTab bundles a bookmark dashboard and a screenshot tool, which a reviewer could read as two purposes — this frames it as one: a personal New Tab replacement with two view modes.)

> myTab replaces the New Tab page with a single personal dashboard: a customizable view of your Chrome bookmarks, plus a built-in "FlashPaint" mode for quickly annotating and saving screenshots — both live under one New Tab replacement, not as separate unrelated tools.

## Permissions justification

Chrome Web Store asks for a justification per sensitive permission. Draft text for each:

**`bookmarks`**
> myTab's core feature is displaying and organizing the user's existing Chrome bookmarks on the New Tab page (custom columns, drag-and-drop layout, search). Renaming/deleting/creating bookmarks through myTab's own UI requires write access to reflect that change in Chrome; all display-only reordering (columns, custom nesting) never calls the move API and is purely a local rendering preference.

**`clipboardRead`**
> Used for two features: (1) FlashPaint, the extension's screenshot annotation tool, lets users paste (Ctrl+V) an image from the clipboard onto the canvas; (2) the Bookmarks tab's "Paste" and "Copy URL/Title" actions read/write plain text or image data to the clipboard only at the moment the user triggers them. The clipboard is never read in the background.

**`tabGroups`**
> Used only for the optional "Open all in new tabs" action on a bookmark folder, which creates and names a Chrome tab group so the newly opened tabs stay organized together.

**`storage`**
> Used to save the user's own settings (column layout, colors, font, pinned Quick Bar items) via chrome.storage.sync so they carry over across the user's devices, and larger content (FlashPaint autosave, custom bookmark folders) via chrome.storage.local. No data leaves the browser.

**`unlimitedStorage`**
> FlashPaint's autosave and saved project files (canvas images, shapes, text) can exceed the default chrome.storage.local quota, especially with larger screenshots — unlimitedStorage prevents autosave from silently failing.

**New Tab override (`chrome_url_overrides.newtab`)**
> The extension's entire purpose is to replace the default New Tab page with this dashboard — this is the core, expected behavior a user installs the extension for, not an incidental side effect.

## Store listing description (draft)

> **myTab** turns your New Tab page into a personal dashboard.
>
> 📁 **Bookmarks** — browse your existing Chrome bookmarks in a clean, multi-column layout you control: drag to reorder, assign columns, pin favorites to a Quick Bar, and organize with custom folders — all without ever touching your real Chrome bookmark structure unless you explicitly rename or delete something.
>
> 🎨 **FlashPaint** — paste a screenshot and annotate it right away: draw, add shapes and text, crop, and export — no separate app needed.
>
> Everything stays on your device (or syncs privately through your own Chrome account) — myTab has no server, no accounts, and no tracking.

## Category suggestion

**Productivity** (closest fit for a New Tab / bookmark-management extension).

## Before submitting, remember to

- [ ] Fill in your real contact email in `PRIVACY_POLICY.md`
- [ ] Host `PRIVACY_POLICY.md`'s content somewhere with a **genuinely public** URL and paste that URL into the listing's Privacy Policy field. **If the myTab repo itself is private, linking into it (even the raw file URL) 404s for Chrome's crawler** even though it opens fine for you while logged into GitHub — put the content in its own **public** GitHub Gist instead (gist.github.com → paste the actual Markdown content, not a shell command — double check what you pasted — → "Create public gist", not secret)
- [ ] Take at least one 1280×800 (or 640×400) screenshot of the actual UI
- [ ] Decide Public vs. Unlisted distribution — Unlisted is the better default for a personal tool
- [ ] Set and verify a **publisher contact email**: Dashboard's account-level **☰ menu → Settings** (separate from the item's own Settings/Privacy tabs) — submission is blocked until the verification email is confirmed
- [ ] Zip **the contents of** `extension/`, not the folder itself — `manifest.json` must end up at the zip's root: `cd extension && zip -r ../meTab.zip . -x '*.DS_Store'`
- [ ] On the item's Privacy tab: "Are you using remote code?" → **No**. Data usage → only check **Website content**; check all 3 "I certify" boxes
