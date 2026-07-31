const { test, describe } = require('node:test')
const assert = require('node:assert/strict')
const { loadToolScript } = require('./helpers/loadScript')

const { ts_detectEpoch, ts_parse, ts_isoFromMs, ts_relative } = loadToolScript('js/timestamp-tool.js')

describe('ts_detectEpoch', () => {
  test('10-digit is seconds, 13-digit is millis, non-numeric is null', () => {
    assert.equal(ts_detectEpoch('1700000000'), 1700000000000)
    assert.equal(ts_detectEpoch('1700000000000'), 1700000000000)
    assert.equal(ts_detectEpoch('2023-01-01'), null)
    assert.equal(ts_detectEpoch(' 0 '), 0)
  })
})

describe('ts_parse', () => {
  test('parses epochs and ISO dates, rejects gibberish', () => {
    assert.equal(ts_parse('1700000000').ms, 1700000000000)
    assert.equal(ts_parse('1970-01-01T00:00:00Z').ms, 0)
    assert.ok(ts_parse('hello world').error)
    assert.equal(ts_parse('').error, 'empty')
  })
})

describe('ts_isoFromMs', () => {
  test('epoch 0 is the unix epoch', () => {
    assert.equal(ts_isoFromMs(0), '1970-01-01T00:00:00.000Z')
    assert.equal(ts_isoFromMs(1700000000000), '2023-11-14T22:13:20.000Z')
  })
})

describe('ts_relative', () => {
  test('past, future, and now', () => {
    assert.equal(ts_relative(0, 3600000), '1 hour ago')
    assert.equal(ts_relative(7200000, 0), 'in 2 hours')
    assert.equal(ts_relative(1000, 1000), 'just now')
    assert.equal(ts_relative(0, 2 * 86400000), '2 days ago')
  })
})
