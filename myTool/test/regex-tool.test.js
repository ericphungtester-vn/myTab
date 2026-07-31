const { test, describe } = require('node:test')
const assert = require('node:assert/strict')
const { loadToolScript } = require('./helpers/loadScript')

const { rx_run, rx_highlight } = loadToolScript('js/regex-tool.js')

describe('rx_run', () => {
  test('finds all matches with their index', () => {
    const r = rx_run('\\d+', '', 'a1b22c333')
    assert.equal(r.matches.length, 3)
    assert.equal(r.matches[0].match, '1')
    assert.equal(r.matches[0].index, 1)
    assert.equal(r.matches[1].match, '22')
    assert.equal(r.matches[2].match, '333')
  })
  test('captures groups (undefined -> null)', () => {
    const r = rx_run('(\\w)(\\d)', '', 'a1 b2')
    assert.equal(r.matches.length, 2)
    assert.equal(r.matches[0].groups[0], 'a')
    assert.equal(r.matches[0].groups[1], '1')
  })
  test('case-insensitive flag', () => {
    assert.equal(rx_run('abc', 'i', 'xxABCxx').matches.length, 1)
  })
  test('invalid pattern returns an error, not a throw', () => {
    assert.ok(rx_run('(', '', 'x').error)
  })
  test('zero-width pattern terminates instead of looping forever', () => {
    const r = rx_run('a*', '', 'bbb')
    assert.ok(Array.isArray(r.matches))
    assert.ok(r.matches.length < 100)
  })
})

describe('rx_highlight', () => {
  test('escapes text and wraps matches in <mark>', () => {
    const matches = [{ match: '<b>', index: 1, groups: [] }]
    assert.equal(rx_highlight('a<b>c', matches), 'a<mark class="rx-hit">&lt;b&gt;</mark>c')
  })
  test('no matches -> just the escaped text', () => {
    assert.equal(rx_highlight('a & b < c', []), 'a &amp; b &lt; c')
  })
})
