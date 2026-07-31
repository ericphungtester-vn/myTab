const { test, describe } = require('node:test')
const assert = require('node:assert/strict')
const { loadToolScript } = require('./helpers/loadScript')

const { cl_parse, cl_rgbToHex, cl_rgbToHsl, cl_hslToRgb, cl_formats } = loadToolScript('js/color-tool.js')

const rgb = (o) => [o.r, o.g, o.b]

describe('cl_parse', () => {
  test('hex (3 and 6 digit), with or without #', () => {
    assert.deepEqual(rgb(cl_parse('#ff0000')), [255, 0, 0])
    assert.deepEqual(rgb(cl_parse('f00')), [255, 0, 0])
    assert.deepEqual(rgb(cl_parse('#0080ff')), [0, 128, 255])
  })
  test('rgb() and hsl()', () => {
    assert.deepEqual(rgb(cl_parse('rgb(0, 128, 255)')), [0, 128, 255])
    assert.deepEqual(rgb(cl_parse('hsl(120, 100%, 50%)')), [0, 255, 0])
  })
  test('rejects nonsense and out-of-range rgb', () => {
    assert.equal(cl_parse('nope'), null)
    assert.equal(cl_parse('rgb(300,0,0)'), null)
  })
})

describe('rgb <-> hex <-> hsl', () => {
  test('rgbToHex', () => {
    assert.equal(cl_rgbToHex(255, 0, 0), '#FF0000')
    assert.equal(cl_rgbToHex(0, 128, 255), '#0080FF')
  })
  test('rgbToHsl', () => {
    const h = cl_rgbToHsl(255, 0, 0)
    assert.deepEqual([h.h, h.s, h.l], [0, 100, 50])
    const g = cl_rgbToHsl(0, 255, 0)
    assert.deepEqual([g.h, g.s, g.l], [120, 100, 50])
  })
  test('hslToRgb round-trips primary colors', () => {
    assert.deepEqual(rgb(cl_hslToRgb(0, 100, 50)), [255, 0, 0])
    assert.deepEqual(rgb(cl_hslToRgb(240, 100, 50)), [0, 0, 255])
  })
})

describe('cl_formats', () => {
  test('produces all three string forms', () => {
    const f = cl_formats({ r: 0, g: 128, b: 255 })
    assert.equal(f.hex, '#0080FF')
    assert.equal(f.rgb, 'rgb(0, 128, 255)')
    assert.equal(f.hsl, 'hsl(210, 100%, 50%)')
  })
})
