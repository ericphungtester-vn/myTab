const { test, describe } = require('node:test')
const assert = require('node:assert/strict')
const { loadToolScript } = require('./helpers/loadScript')

const lib = loadToolScript('js/encode-tool.js')
const {
  eh_base64Encode, eh_base64Decode, eh_hexEncode, eh_hexDecode, eh_convert
} = lib

describe('Base64', () => {
  test('known vector and round-trip', () => {
    assert.equal(eh_base64Encode('Hello, World!'), 'SGVsbG8sIFdvcmxkIQ==')
    assert.equal(eh_base64Decode('SGVsbG8sIFdvcmxkIQ=='), 'Hello, World!')
  })
  test('handles unicode via UTF-8', () => {
    const s = 'héllo — 世界 🌍'
    assert.equal(eh_base64Decode(eh_base64Encode(s)), s)
  })
  test('padding variants decode correctly', () => {
    assert.equal(eh_base64Encode('any carnal pleasure.'), 'YW55IGNhcm5hbCBwbGVhc3VyZS4=')
    assert.equal(eh_base64Decode('YW55IGNhcm5hbCBwbGVhc3VyZQ=='), 'any carnal pleasure')
    assert.equal(eh_base64Decode('YW55IGNhcm5hbCBwbGVhc3Vy'), 'any carnal pleasur')
  })
})

describe('Hex', () => {
  test('known vector and round-trip', () => {
    assert.equal(eh_hexEncode('AB'), '4142')
    assert.equal(eh_hexDecode('4142'), 'AB')
    assert.equal(eh_hexDecode('48 65 6c 6c 6f'), 'Hello') // ignores spaces
  })
  test('unicode round-trip', () => {
    const s = 'café ☕'
    assert.equal(eh_hexDecode(eh_hexEncode(s)), s)
  })
})

describe('eh_convert routing', () => {
  test('url encode/decode', () => {
    assert.equal(eh_convert('urlenc', 'a b&c=d').output, 'a%20b%26c%3Dd')
    assert.equal(eh_convert('urldec', 'a%20b%26c').output, 'a b&c')
  })
  test('base64 + hex via router', () => {
    assert.equal(eh_convert('b64enc', 'hi').output, 'aGk=')
    assert.equal(eh_convert('hexenc', 'hi').output, '6869')
  })
  test('odd-length hex decode returns an error, not a throw', () => {
    const r = eh_convert('hexdec', 'abc') // 3 hex digits -> odd length
    assert.ok(r.error)
    assert.equal(r.output, undefined)
  })
  test('unknown op errors', () => {
    assert.ok(eh_convert('nope', 'x').error)
  })
})
