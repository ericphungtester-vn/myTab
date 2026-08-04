# Privacy Policy for myTool

**Last updated:** August 2026

myTool is a Chrome extension that provides a small collection of on-device developer and testing utilities (placeholder text, test files, synthetic test data, and value encoders/converters). This policy explains what data myTool accesses and how it is used.

## Summary

**myTool does not collect, transmit, sell, or share any of your data with anyone.** It has no backend server, no analytics, no tracking, and no account system. Every tool runs entirely inside the extension popup, on your own device. myTool makes **no network requests**, so nothing you type or generate ever leaves your computer.

## What myTool accesses, and why

### Storage (`storage` permission)

myTool uses Chrome's built-in `chrome.storage.sync` to remember your own interface settings between sessions — for example, the last tool tab you opened, per-tool option choices (such as a selected country, output format, or indent width), and the light/dark theme.

- This stores **only your UI preferences**. It never stores the content you type into a tool, any generated output, or any personal data.
- Because it uses Chrome Sync, these settings may sync across devices where you are signed into Chrome with the same Google account — the same way Chrome syncs its own settings. That data is subject to Google's Chrome Sync privacy practices, not myTool's.

## What myTool does NOT do

- It does **not** collect or transmit any personal or sensitive information.
- It does **not** make network requests or contact any server (the developer's or a third party's).
- It does **not** read your browsing history, tabs, cookies, or the content of any web page.
- It does **not** use analytics, advertising, or any tracking.
- It does **not** download or run remote code — all code is bundled in the extension package.

## Synthetic test data

Some tools generate fake data (names, addresses, IDs, payment-card numbers, bank/IBAN numbers, etc.) for testing forms and validation logic. This data is **randomly generated on your device** and does **not** correspond to any real person, account, card, or institution. It is never uploaded anywhere.

## Changes to this policy

If this policy changes, the "Last updated" date above will be revised.

## Contact

For any questions about this policy, please open an issue on the extension's repository.
