const { test } = require('node:test')
const assert = require('node:assert')
const { loadToolScript } = require('./helpers/loadScript')

const up = loadToolScript('js/url-tool.js')

test('up_decode percent-decodes and treats + as space, tolerating bad escapes', () => {
  assert.equal(up.up_decode('hello%20world'), 'hello world')
  assert.equal(up.up_decode('a+b'), 'a b')
  assert.equal(up.up_decode('%E2%9C%93'), '✓')
  assert.equal(up.up_decode('%zz'), '%zz') // malformed -> left as-is, no throw
})

test('up_parseQuery splits and decodes name/value pairs', () => {
  assert.deepEqual(up.up_parseQuery(''), [])
  const r = up.up_parseQuery('?a=1&b=hello%20world&flag')
  assert.equal(r.length, 3)
  assert.equal(r[0].name, 'a'); assert.equal(r[0].value, '1')
  assert.equal(r[1].name, 'b'); assert.equal(r[1].value, 'hello world')
  assert.equal(r[2].name, 'flag'); assert.equal(r[2].value, '') // key with no '='
})

test('up_parseQuery handles encoded keys and empty segments', () => {
  const r = up.up_parseQuery('user%20name=Jo%20Bloggs&&x=1')
  assert.equal(r.length, 2) // the empty segment between && is dropped
  assert.equal(r[0].name, 'user name')
  assert.equal(r[0].value, 'Jo Bloggs')
  assert.equal(r[1].name, 'x')
})
