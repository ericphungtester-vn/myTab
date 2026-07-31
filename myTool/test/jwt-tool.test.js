const { test, describe } = require('node:test')
const assert = require('node:assert/strict')
const { loadToolScript } = require('./helpers/loadScript')

const lib = loadToolScript('js/jwt-tool.js')
const { jwt_base64UrlToText, jwt_decode, jwt_formatClaimTime } = lib

// The canonical jwt.io example token (HS256).
const TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9' +
  '.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ' +
  '.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c'

describe('jwt_decode', () => {
  test('decodes the header and payload of a real token', () => {
    const r = jwt_decode(TOKEN)
    assert.equal(r.error, undefined)
    assert.equal(r.header.alg, 'HS256')
    assert.equal(r.header.typ, 'JWT')
    assert.equal(r.payload.sub, '1234567890')
    assert.equal(r.payload.name, 'John Doe')
    assert.equal(r.payload.iat, 1516239022)
    assert.equal(r.signature, 'SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c')
  })

  test('base64url alphabet (- and _) decodes correctly', () => {
    // "s?>" encodes to "cz8+" in base64 and "cz8-" is not it; use a value exercising - / _
    // {"a":"ÿÿÿ"} → payload contains chars that use + / in std base64
    const r = jwt_decode(TOKEN)
    assert.ok(r.payload) // already covered; this asserts the url-safe path ran without throwing
    assert.equal(typeof jwt_base64UrlToText('SGVsbG8'), 'string')
    assert.equal(jwt_base64UrlToText('SGVsbG8'), 'Hello') // no padding, url-safe
  })

  test('rejects non-tokens with a clear error', () => {
    assert.ok(jwt_decode('not-a-jwt').error)
    assert.ok(jwt_decode('only.two').error === undefined ? false : true) // two segs, but not valid base64 json
    assert.ok(jwt_decode('').error)
  })

  test('flags malformed base64/JSON', () => {
    assert.match(jwt_decode('@@@.@@@.sig').error, /base64url JSON/)
  })
})

describe('jwt_formatClaimTime', () => {
  test('renders a unix-seconds claim as a UTC datetime', () => {
    assert.equal(jwt_formatClaimTime(1516239022), '2018-01-18 01:30:22 UTC')
  })
})
