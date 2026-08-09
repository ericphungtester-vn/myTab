const { test } = require('node:test')
const assert = require('node:assert')
const { loadToolScript } = require('./helpers/loadScript')

const sc = loadToolScript('js/scan-tool.js')

test('sc_friendlyFormat maps ZXing format names to the generators\' labels', () => {
  assert.equal(sc.sc_friendlyFormat('QR_CODE'), 'QR Code')
  assert.equal(sc.sc_friendlyFormat('CODE_128'), 'Code 128')
  assert.equal(sc.sc_friendlyFormat('EAN_13'), 'EAN-13')
  assert.equal(sc.sc_friendlyFormat('UPC_A'), 'UPC-A')
  assert.equal(sc.sc_friendlyFormat('CODABAR'), 'Codabar')
  // unknown falls back to underscores-to-spaces, never throws
  assert.equal(sc.sc_friendlyFormat('SOME_NEW_ONE'), 'SOME NEW ONE')
  assert.equal(sc.sc_friendlyFormat(''), '')
})
