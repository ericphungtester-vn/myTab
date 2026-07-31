const { test, describe } = require('node:test')
const assert = require('node:assert/strict')
const { loadToolScript } = require('./helpers/loadScript')

const lib = loadToolScript('js/uuid-tool.js')
const {
  UUID_TYPES, uu_uuidV4, uu_uuidV7, uu_ulid, uu_encodeUlidTime, uu_decodeUlidTime,
  uu_nanoid, uu_objectId, ULID_ALPHABET, NANOID_ALPHABET
} = lib

const seq = n => Array.from({ length: n }, (_, i) => (i * 37 + 11) & 0xff)

describe('UUID v4', () => {
  test('has version 4 and the 10xx variant, correct shape', () => {
    const u = uu_uuidV4(seq(16))
    assert.match(u, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
  })
})

describe('UUID v7', () => {
  const ms = 1700000000000
  test('embeds the timestamp and carries version 7 + variant', () => {
    const u = uu_uuidV7(ms, seq(10))
    assert.match(u, /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
    const first48 = parseInt(u.replace(/-/g, '').slice(0, 12), 16)
    assert.equal(first48, ms)
  })
})

describe('ULID', () => {
  const ms = 1700000000000
  test('is 26 Crockford chars and the time half round-trips', () => {
    const u = uu_ulid(ms, seq(16))
    assert.equal(u.length, 26)
    assert.ok([...u].every(c => ULID_ALPHABET.includes(c)))
    assert.equal(uu_decodeUlidTime(u), ms)
    assert.equal(uu_encodeUlidTime(ms).length, 10)
  })
})

describe('NanoID', () => {
  test('is 21 chars from the 64-symbol url-safe alphabet', () => {
    assert.equal(NANOID_ALPHABET.length, 64)
    const id = uu_nanoid(seq(21))
    assert.equal(id.length, 21)
    assert.ok([...id].every(c => NANOID_ALPHABET.includes(c)))
  })
})

describe('Mongo ObjectId', () => {
  test('is 24 hex chars with the seconds timestamp in the first 4 bytes', () => {
    const secs = 1700000000
    const oid = uu_objectId(secs, seq(5), 0x0000ff)
    assert.match(oid, /^[0-9a-f]{24}$/)
    assert.equal(parseInt(oid.slice(0, 8), 16), secs)
    assert.equal(oid.slice(18), '0000ff')
  })
})

describe('registry', () => {
  test('exposes the five id types with unique keys', () => {
    assert.equal(UUID_TYPES.length, 5)
    const keys = UUID_TYPES.map(t => t.key).join(',')
    assert.equal(keys, 'v4,v7,ulid,nanoid,objectid')
  })
})
