# Privacy Policy for myTab

**Last updated:** July 2026

myTab is a Chrome extension that replaces the New Tab page with a customizable bookmark dashboard and FlashPaint, a built-in screenshot annotation tool. This policy explains what data myTab accesses and how it's used.

## Summary

myTab does not collect, transmit, or sell any of your data to anyone. Everything myTab reads or stores stays on your device (and, for settings, in your own Google account's Chrome Sync) — nothing is ever sent to the developer or any third-party server. myTab has no backend, no analytics, and no account system of its own.

## What myTab accesses, and why

### Chrome Bookmarks (`bookmarks` permission)
myTab reads your existing Chrome bookmarks to display them on the New Tab page in a customizable column layout.

- **Reordering, column assignment, and folder grouping are display-only.** Dragging a bookmark to a different column, reordering it, or "nesting" it under a different folder only changes how it looks inside myTab — it never moves or reorganizes your actual Chrome bookmarks.
- **Renaming, deleting, or creating a bookmark/folder** through myTab's own right-click menu *does* make that real change to your Chrome bookmarks, the same as doing it through Chrome's native bookmark manager — because you explicitly asked for that action.
- None of this bookmark data ever leaves your device.

### Clipboard (`clipboardRead` permission, plus the standard Clipboard API)
- **Read:** used in FlashPaint so you can paste (Ctrl+V) a screenshot or image directly onto the canvas, and in Bookmarks so "Paste" can insert a clipboard image.
- **Write:** used when you choose "Copy URL" or "Copy Title" on a bookmark, to put that text on your clipboard.
- Clipboard content is only read/written at the moment you trigger one of these actions — myTab does not monitor your clipboard in the background.

### Tab Groups (`tabGroups` permission)
Used only when you choose "Open all in new tabs" for a bookmark folder — myTab creates and names a tab group for the tabs it opens, so they stay organized. No data about your other tabs or tab groups is read otherwise.

### Local file access (File System Access API, FlashPaint's "Save location" setting)
If you choose a folder in FlashPaint's Settings, exported images/projects are written directly to that folder on your computer instead of using the browser's normal download prompt. This uses a standard browser API with your explicit, one-time permission grant (via your operating system's native folder picker) — myTab never accesses any other files or folders on your device.

### Storage (`storage`, `unlimitedStorage` permissions)
myTab saves your settings and content using Chrome's built-in storage:

- **Settings that sync across your devices** (`chrome.storage.sync`) — things like column layout, font, colors, zoom, and Quick Bar pins. These sync automatically if you're signed into Chrome with the same Google account on multiple computers, the same way Chrome syncs its own settings. This data is subject to Google's own Chrome Sync privacy practices, not myTab's.
- **Larger content, kept only on this device** (`chrome.storage.local`) — FlashPaint's autosave and custom "Your Bookmarks" folders.

In all cases, this storage is Chrome's own on-device (and Google-account-synced) storage — myTab has no server of its own and cannot access this data from anywhere else.

## What myTab does NOT do

- No analytics, tracking, or telemetry of any kind.
- No advertising.
- No data is ever sent to myTab's developer or any third party.
- No user accounts, logins, or sign-ups beyond your existing Chrome/Google sign-in (only relevant for Chrome's own Sync feature, not myTab specifically).

## Changes to this policy

If myTab's data practices change, this document will be updated accordingly.

## Contact

Questions about this policy can be directed to: **vominhphung.vip@gmail.com**
