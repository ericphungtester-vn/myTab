const { test, describe } = require('node:test')
const assert = require('node:assert/strict')
const { loadToolScript } = require('./helpers/loadScript')

const lib = loadToolScript('js/resize-tool.js')
const {
  rs_parseTargetBytes, rs_formatBytes, rs_dimsFromWidth, rs_dimsFromHeight,
  rs_validateDimensions, rs_dataUrlBytes, rs_searchQuality, rs_exportMime,
  rs_extForMime, rs_isLossy
} = lib

describe('rs_parseTargetBytes', () => {
  test('KB and MB use base 1000', () => {
    assert.equal(rs_parseTargetBytes('200', 'KB'), 200000)
    assert.equal(rs_parseTargetBytes('1.5', 'MB'), 1500000)
  })
  test('rejects non-positive / non-numeric', () => {
    assert.equal(rs_parseTargetBytes('0', 'KB'), null)
    assert.equal(rs_parseTargetBytes('-5', 'KB'), null)
    assert.equal(rs_parseTargetBytes('abc', 'KB'), null)
    assert.equal(rs_parseTargetBytes('', 'MB'), null)
  })
})

describe('rs_formatBytes', () => {
  test('B / KB / MB thresholds', () => {
    assert.equal(rs_formatBytes(512), '512 B')
    assert.equal(rs_formatBytes(2000), '2.0 KB')
    assert.equal(rs_formatBytes(45000), '45 KB')
    assert.equal(rs_formatBytes(2500000), '2.50 MB')
  })
})

describe('aspect-ratio dimension math', () => {
  test('dimsFromWidth preserves ratio, integers ≥ 1', () => {
    assert.deepEqual({ ...rs_dimsFromWidth(4000, 3000, 800) }, { w: 800, h: 600 })
    assert.deepEqual({ ...rs_dimsFromWidth(1920, 1080, 1280) }, { w: 1280, h: 720 })
    // never rounds to 0
    const tiny = rs_dimsFromWidth(4000, 30, 10)
    assert.ok(tiny.h >= 1)
  })
  test('dimsFromHeight preserves ratio', () => {
    assert.deepEqual({ ...rs_dimsFromHeight(4000, 3000, 600) }, { w: 800, h: 600 })
  })
})

describe('rs_validateDimensions', () => {
  test('accepts sane sizes, rejects <1, non-finite, and oversize', () => {
    assert.equal(rs_validateDimensions(800, 600).ok, true)
    assert.equal(rs_validateDimensions(0, 600).ok, false)
    assert.equal(rs_validateDimensions(800, 0).ok, false)
    assert.equal(rs_validateDimensions(NaN, 600).ok, false)
    assert.equal(rs_validateDimensions(50000, 600).ok, false)
  })
})

describe('rs_dataUrlBytes', () => {
  test('computes payload size of a base64 data URL', () => {
    // "AAAA" decodes to 3 bytes; with padding it drops accordingly
    assert.equal(rs_dataUrlBytes('data:image/png;base64,AAAA'), 3)
    assert.equal(rs_dataUrlBytes('data:image/jpeg;base64,AAA='), 2)
    assert.equal(rs_dataUrlBytes('data:image/jpeg;base64,AA=='), 1)
    assert.equal(rs_dataUrlBytes('not-a-data-url'), 0)
  })
})

describe('rs_searchQuality', () => {
  // A monotonic-in-quality encoder: size grows with quality.
  const encoder = k => q => Math.round(q * k)

  test('returns max quality immediately when it already fits', () => {
    const r = rs_searchQuality(encoder(1000), 5000)
    assert.equal(r.quality, 1.0)
    assert.equal(r.over, false)
  })

  test('finds a quality whose size is ≤ target, and it is genuinely under', () => {
    const enc = encoder(10000) // size = q*10000, target 5000 -> quality ~0.5
    const r = rs_searchQuality(enc, 5000)
    assert.ok(r.size <= 5000, `size ${r.size} should be ≤ 5000`)
    assert.equal(r.over, false)
    // should be reasonably close to the boundary, not tiny
    assert.ok(r.quality > 0.3 && r.quality <= 0.5)
  })

  test('flags `over` when even the lowest quality exceeds the target', () => {
    const enc = encoder(1000000) // even q=0.05 -> 50000 bytes
    const r = rs_searchQuality(enc, 1000)
    assert.equal(r.over, true)
    assert.equal(r.quality, 0.05)
  })
})

describe('format / mime helpers', () => {
  test('rs_exportMime maps explicit formats and preserves encodable originals', () => {
    assert.equal(rs_exportMime('jpeg', 'image/png'), 'image/jpeg')
    assert.equal(rs_exportMime('png', 'image/jpeg'), 'image/png')
    assert.equal(rs_exportMime('webp', 'image/png'), 'image/webp')
    assert.equal(rs_exportMime('original', 'image/webp'), 'image/webp')
    // non-encodable originals fall back to PNG
    assert.equal(rs_exportMime('original', 'image/gif'), 'image/png')
    assert.equal(rs_exportMime('original', 'image/bmp'), 'image/png')
  })
  test('rs_extForMime and rs_isLossy', () => {
    assert.equal(rs_extForMime('image/jpeg'), 'jpg')
    assert.equal(rs_extForMime('image/webp'), 'webp')
    assert.equal(rs_extForMime('image/png'), 'png')
    assert.equal(rs_extForMime('image/tiff'), 'png')
    assert.equal(rs_isLossy('image/jpeg'), true)
    assert.equal(rs_isLossy('image/webp'), true)
    assert.equal(rs_isLossy('image/png'), false)
  })
})
