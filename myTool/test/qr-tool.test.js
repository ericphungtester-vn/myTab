const { test } = require('node:test')
const assert = require('node:assert')
const { loadToolScript } = require('./helpers/loadScript')

const qt = loadToolScript('js/qr-tool.js')

test('qr_version derives the QR version from the module count', () => {
  assert.equal(qt.qr_version(21), 1)   // smallest
  assert.equal(qt.qr_version(25), 2)
  assert.equal(qt.qr_version(177), 40) // largest
})

test('qr_svg builds an SVG from the module matrix', () => {
  const svg = qt.qr_svg(1, () => true, { cellSize: 10, margin: 0 })
  assert.match(svg, /width="10" height="10"/)
  assert.match(svg, /<rect width="10" height="10" fill="#ffffff"\/>/) // quiet-zone / background
  assert.match(svg, /<path d="M0 0h10v10h-10z" fill="#000000"\/>/)    // the single dark module
})

test('qr_svg leaves an empty path when no module is dark, and honors the default quiet zone', () => {
  const empty = qt.qr_svg(1, () => false, { cellSize: 10, margin: 0 })
  assert.match(empty, /<path d="" fill="#000000"\/>/)
  // default margin is 4 modules on each side: (1 + 4*2) * 8 = 72
  const withMargin = qt.qr_svg(1, () => true, { cellSize: 8 })
  assert.match(withMargin, /width="72" height="72"/)
})
