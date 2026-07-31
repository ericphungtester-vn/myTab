const { test, describe } = require('node:test')
const assert = require('node:assert/strict')
const { loadToolScript } = require('./helpers/loadScript')

const { bn_convert, bn_parse } = loadToolScript('js/base-tool.js')

describe('bn_convert', () => {
  test('decimal 255 to every base', () => {
    const o = bn_convert('255', 10).outputs
    assert.equal(o.dec, '255')
    assert.equal(o.hex, 'FF')
    assert.equal(o.bin, '11111111')
    assert.equal(o.oct, '377')
  })
  test('reads hex/bin/oct (with or without prefix)', () => {
    assert.equal(bn_convert('ff', 16).outputs.dec, '255')
    assert.equal(bn_convert('0xFF', 16).outputs.dec, '255')
    assert.equal(bn_convert('0b1010', 2).outputs.dec, '10')
    assert.equal(bn_convert('0o777', 8).outputs.dec, '511')
  })
  test('negatives keep their sign in every base', () => {
    const o = bn_convert('-10', 10).outputs
    assert.equal(o.hex, '-A')
    assert.equal(o.bin, '-1010')
  })
  test('stays exact beyond Number.MAX_SAFE_INTEGER (BigInt)', () => {
    assert.equal(bn_convert('9007199254740993', 10).outputs.dec, '9007199254740993')
  })
  test('invalid digit for the base returns an error', () => {
    assert.ok(bn_convert('xyz', 16).error)
    assert.ok(bn_convert('2', 2).error) // 2 is not a binary digit
  })
})

describe('bn_parse', () => {
  test('returns a BigInt', () => {
    assert.equal(typeof bn_parse('10', 10), 'bigint')
    assert.equal(bn_parse('10', 16).toString(), '16')
  })
})
