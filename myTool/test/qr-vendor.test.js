const { test } = require('node:test')
const assert = require('node:assert')
const qrcode = require('../js/vendor/qrcode.js')
qrcode.stringToBytes = qrcode.stringToBytesFuncs['UTF-8'] // match the tool's UTF-8 config

function encode(text, ec) {
  const qr = qrcode(0, ec)
  qr.addData(text)
  qr.make()
  return qr
}

// A valid QR always has three finder patterns: a 7x7 with a dark border, a light ring, and a dark
// 3x3 center. Checking them proves the matrix is a real QR, not garbage.
function finderOk(isDark, r0, c0) {
  for (let i = 0; i < 7; i++) {
    if (!isDark(r0, c0 + i) || !isDark(r0 + 6, c0 + i)) return false // top & bottom rows dark
    if (!isDark(r0 + i, c0) || !isDark(r0 + i, c0 + 6)) return false // left & right cols dark
  }
  for (let r = 2; r <= 4; r++) for (let c = 2; c <= 4; c++) if (!isDark(r0 + r, c0 + c)) return false // dark center
  // ring just inside the border must be light
  if (isDark(r0 + 1, c0 + 1) || isDark(r0 + 1, c0 + 5) || isDark(r0 + 5, c0 + 1)) return false
  return true
}

test('vendored encoder: known input yields the exact reference matrix', () => {
  // Locks the bundled library's output — if js/vendor/qrcode.js is ever altered/corrupted, this fails.
  const expected = ['111111101000101111111', '100000101000101000001', '101110100000001011101', '101110101010101011101', '101110100111001011101', '100000100011101000001', '111111101010101111111', '000000001111100000000', '101101110101101001011', '011000010111111101100', '000001111101010100011', '101011011001000101010', '100010110110110000101', '000000001011001100101', '111111101011111110000', '100000101110010101111', '101110100100101001000', '101110101110001001110', '101110101100100100100', '100000100111011110001', '111111101101010100000']
  const qr = encode('HELLO WORLD', 'M')
  const n = qr.getModuleCount()
  assert.equal(n, 21) // version 1
  const rows = []
  for (let r = 0; r < n; r++) {
    let s = ''
    for (let c = 0; c < n; c++) s += qr.isDark(r, c) ? '1' : '0'
    rows.push(s)
  }
  assert.deepEqual(rows, expected)
})

test('vendored encoder: finder patterns are valid at all three corners, every EC level', () => {
  for (const ec of ['L', 'M', 'Q', 'H']) {
    const qr = encode('https://example.com/test?x=1', ec)
    const n = qr.getModuleCount()
    const d = (r, c) => qr.isDark(r, c)
    assert.ok(finderOk(d, 0, 0), `top-left finder (${ec})`)
    assert.ok(finderOk(d, 0, n - 7), `top-right finder (${ec})`)
    assert.ok(finderOk(d, n - 7, 0), `bottom-left finder (${ec})`)
  }
})

test('vendored encoder: UTF-8 content encodes without error and stays a valid QR', () => {
  const qr = encode('Xin chào — 你好 😀', 'M') // Vietnamese + CJK + emoji
  const n = qr.getModuleCount()
  assert.ok(n >= 21)
  assert.ok(finderOk((r, c) => qr.isDark(r, c), 0, 0))
})

test('vendored encoder: higher error correction never shrinks the code', () => {
  const text = 'The quick brown fox jumps over the lazy dog 0123456789'
  const low = encode(text, 'L').getModuleCount()
  const high = encode(text, 'H').getModuleCount()
  assert.ok(high >= low, `H (${high}) should be >= L (${low})`)
})
