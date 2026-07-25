# myTool unit tests

Fast, dependency-free tests for myTool's core logic (`js/file-tool.js`, `js/text-tool.js`) using
Node's built-in test runner — no npm install needed.

## Running

```bash
cd myTool
node --test test/*.test.js
```

(`node --test` with no path defaults to recursively scanning the whole `test/` directory,
including `test/helpers/`, which aren't test files themselves — the explicit glob avoids that.)

## What's covered

- **file-tool.test.js** — the big one. For every one of the 22 generated file types: the
  exact-byte-size guarantee (never overflows the requested size, hits it exactly once above the
  format's own minimum), plus format-specific structural checks (real magic bytes/signatures, ZIP
  entry names for the Office/EPUB formats, a real `zlib.inflateSync` round-trip for PNG's
  compressed pixel data, and a from-scratch reference LZW-GIF decoder used as a permanent
  regression guard for a real bug caught during development — see the comment above that describe
  block for what went wrong and why the test is shaped the way it is).
- **text-tool.test.js** — the Text tool's generation logic: word banks are non-empty for every
  language, each Unit (Characters/Words/Sentences/Paragraphs) hits its exact target, and the
  random-string generator's "one character per checked class guaranteed" + validation rules.
- **id-tool.test.js** — the ID tool's generators for all 18 countries: every real checksum
  algorithm (Luhn, Verhoeff, ISO 7064 Mod 11-2, and each country's own weighted-sum formula) is
  checked against a real published test vector *and*, across many random samples, by independently
  recomputing the checksum rather than trusting the generator's own math — plus the structure-only
  formats (Vietnam, USA, UK), every country's passport number format, and the ICAO 9303 MRZ TD3
  builder's composite check digit.

## What's NOT covered here

These are pure-logic tests only — they load the tool scripts' logic into a Node `vm` sandbox
(see `test/helpers/loadScript.js`), stripping out the DOM-dependent wiring at the bottom of each
file. They don't verify the popup's actual UI (dropdown positioning, layout, click handling,
Chrome Sync persistence). That would need a real browser — see the top-level `tests/` folder for
how myTab does this with Playwright; myTool doesn't have an equivalent yet.
