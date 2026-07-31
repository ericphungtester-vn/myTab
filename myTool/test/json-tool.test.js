const { test, describe } = require('node:test')
const assert = require('node:assert/strict')
const { loadToolScript } = require('./helpers/loadScript')

const { jf_format, jf_minify, jf_validate } = loadToolScript('js/json-tool.js')

describe('jf_format', () => {
  test('pretty-prints with the given indent, preserving key order', () => {
    assert.equal(jf_format('{"b":1,"a":[2,3]}', 2).output, '{\n  "b": 1,\n  "a": [\n    2,\n    3\n  ]\n}')
  })
  test('tab indent', () => {
    assert.equal(jf_format('{"a":1}', '\t').output, '{\n\t"a": 1\n}')
  })
  test('invalid JSON returns an error message, not a throw', () => {
    const r = jf_format('{bad}', 2)
    assert.ok(r.error)
    assert.equal(r.output, undefined)
  })
})

describe('jf_minify', () => {
  test('strips all insignificant whitespace', () => {
    assert.equal(jf_minify('{ "a": 1,\n  "b": [ 2, 3 ] }').output, '{"a":1,"b":[2,3]}')
  })
})

describe('jf_validate', () => {
  test('reports valid / invalid with a reason', () => {
    assert.equal(jf_validate('[]').valid, true)
    assert.equal(jf_validate('{"a":1}').valid, true)
    const bad = jf_validate('{"a":}')
    assert.equal(bad.valid, false)
    assert.ok(bad.error)
  })
})
