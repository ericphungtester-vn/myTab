const { test } = require('node:test')
const assert = require('node:assert')
const { loadToolScript } = require('./helpers/loadScript')

const bc = loadToolScript('js/barcode-tool.js')

test('bc_gtinCheck computes the standard GTIN check digit', () => {
  assert.equal(bc.bc_gtinCheck('590123412345'), '7') // EAN-13 payload
  assert.equal(bc.bc_gtinCheck('9638507'), '4')      // EAN-8 payload
  assert.equal(bc.bc_gtinCheck('03600029145'), '2')  // UPC-A payload
})

test('the bundled EAN/UPC samples carry a valid check digit', () => {
  // Keeps the sample data honest — a wrong sample would fail to scan / render.
  for (const value of ['EAN13', 'EAN8', 'UPC']) {
    const sample = bc.bc_sampleFor(value)
    const body = sample.slice(0, -1)
    const check = sample.slice(-1)
    assert.equal(bc.bc_gtinCheck(body), check, `${value} sample ${sample} check digit`)
  }
})

test('bc_sampleFor returns the sample for a format, or empty for an unknown one', () => {
  assert.equal(bc.bc_sampleFor('CODE128'), 'ABC-1234')
  assert.equal(bc.bc_sampleFor('EAN13'), '5901234123457')
  assert.equal(bc.bc_sampleFor('nope'), '')
})

test('BC_FORMATS lists Code 128 first and every entry is complete', () => {
  assert.equal(bc.BC_FORMATS[0].value, 'CODE128')
  assert.ok(bc.BC_FORMATS.length >= 8)
  for (const f of bc.BC_FORMATS) {
    assert.ok(f.value && f.label && f.sample && f.hint, `format ${f.value} has all fields`)
  }
})
