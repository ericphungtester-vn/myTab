# myTool unit tests

Fast, dependency-free tests for myTool's core logic (`js/file-tool.js`, `js/text-tool.js`,
`js/profile-tool.js`, `js/iban-tool.js`, `js/noniban-tool.js`, `js/bban-tool.js`,
`js/resize-tool.js`, `js/compare-tool.js`, `js/card-tool.js`, `js/uuid-tool.js`,
`js/encode-tool.js`, `js/jwt-tool.js`, `js/timestamp-tool.js`, `js/json-tool.js`, `js/base-tool.js`,
`js/color-tool.js`, `js/regex-tool.js`) using Node's built-in test runner — no npm install needed.

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
- **profile-tool.test.js** — the Profile tool's generators for all 21 countries (formerly the "ID"
  tool). Every real checksum algorithm (Luhn, Verhoeff, ISO 7064 Mod 11-2, and each country's own
  weighted-sum formula) is checked against a real published test vector *and*, across many random
  samples, by independently recomputing the checksum rather than trusting the generator's own math —
  plus the structure-only formats (Vietnam, USA, UK, Indonesia, Malaysia), every country's passport
  number format, the ICAO 9303 MRZ TD3 builder's composite check digit, and the Company section's
  Tax Code / Business Registration Number checksums.
- **iban-tool.test.js** — the IBAN tool's 35 SEPA+ countries: the ISO 7064 MOD-97-10 checksum is
  verified against known real reference IBANs (and a flipped-digit fails), every country's BBAN
  length/structure matches ISO 13616, all generated IBANs pass the checksum, the bank/account
  segments are consistent with the IBAN, and the SWIFT/BIC format is correct.
- **noniban-tool.test.js** — the Non-IBAN tool's 18 documented countries: each produces its domestic
  identifiers + account number + a format-correct SWIFT/BIC. The three verifiable check digits — USA
  ABA routing (weighted MOD-10), Mexico CLABE (MOD-10), Argentina CBU (two check digits) — are
  verified against known reference values (real published routing numbers, reference CLABE/CBU).
- **bban-tool.test.js** — the BBAN tool's 10 countries whose national check-digit algorithm was
  verified by reproducing the check digit embedded in a real ISO 13616 registry IBAN (Belgium,
  Finland, France, Italy, Monaco, Norway, Portugal, San Marino, Slovenia, Spain). Generated BBANs
  re-verify their own national check, and the assembled IBAN is valid at both the mod-97 and
  national layer.
- **resize-tool.test.js** — the Resize tool's pure math (the canvas encoding itself is DOM-only):
  KB/MB target parsing, aspect-ratio dimension math, dimension validation, base64 data-URL byte
  sizing, the quality binary-search that hits a target file size (driven by a monotonic mock
  encoder), and the format→MIME/extension mapping.
- **compare-tool.test.js** — the Compare tool's diff engine: the LCS core, line-level diff (equal /
  insert / delete / paired "mod" rows with independent line numbers), the normalization options
  (ignore case / whitespace / trim), word-level diff within a changed line, the add/remove/change +
  similarity stats, and HTML rendering (content is escaped, changed words are tagged, and the
  standalone report is a full self-contained document).
- **card-tool.test.js** — the Card tool's synthetic payment-card generator: the Luhn checksum and
  network detection are verified against well-known public test card numbers (Visa/Mastercard/Amex/
  Discover/JCB/Diners/UnionPay), every network generates numbers that are Luhn-valid, correct-length,
  and detect back to the intended network, plus CVV length, digit grouping, expiry formatting, and
  that a full record's expiry is always in the future.
- **uuid-tool.test.js** — the ID generators: UUID v4/v7 version+variant bits and (for v7) the
  embedded timestamp, ULID length + Crockford alphabet + time round-trip, NanoID length/alphabet,
  and Mongo ObjectId hex length + embedded seconds. Builders take injected random bytes so they're
  deterministic.
- **encode-tool.test.js** — Base64/Hex/URL encode+decode: known vectors, UTF-8 unicode round-trips,
  padding variants, the operation router, and that bad input returns an error instead of throwing.
- **jwt-tool.test.js** — decodes the canonical jwt.io example token (header + payload + raw
  signature), handles the base64url alphabet, formats `exp`/`iat` as UTC, and rejects malformed
  tokens with a clear error.
- **timestamp-tool.test.js** — epoch detection (seconds vs millis), parsing of epochs and ISO
  dates, ISO formatting from ms, and the relative "x ago / in x / just now" phrasing.
- **json-tool.test.js** — format (indent + key-order preserved), tab indent, minify, and validate,
  with parser errors surfaced instead of thrown.
- **base-tool.test.js** — dec/hex/bin/oct conversion both directions, `0x`/`0b`/`0o` prefixes,
  negatives, exactness beyond `Number.MAX_SAFE_INTEGER` (BigInt), and invalid-digit errors.
- **color-tool.test.js** — parsing hex (3/6-digit), rgb(), and hsl(); the rgb↔hex↔hsl conversion
  math on primary colors; and the combined format strings.
- **regex-tool.test.js** — all-matches enumeration with capture groups, flags, invalid-pattern
  errors, zero-width termination, and the escape-then-<mark> highlighter.

## What's NOT covered here

These are pure-logic tests only — they load the tool scripts' logic into a Node `vm` sandbox
(see `test/helpers/loadScript.js`), stripping out the DOM-dependent wiring at the bottom of each
file. They don't verify the popup's actual UI.

The **DOM-dependent behavior is covered separately by Playwright end-to-end tests in
[`../e2e/`](../e2e/)** — those drive the real `popup.html` (served over http, using main.js's
localStorage fallback for `chrome.storage`) through Chromium and cover the Compare diff render +
HTML-report download, the Resize load/aspect-lock/resize/download flow (including the real
canvas + `createImageBitmap` path), copy-to-clipboard, and the Reset + last-selection persistence
added across the tools. Run them with `cd e2e && npm install && npm test`. Between the two suites
(pure logic here + UI there), the remaining untested surface is mostly pure styling/layout.
