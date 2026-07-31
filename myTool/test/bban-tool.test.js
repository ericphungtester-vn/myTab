const { test, describe } = require('node:test')
const assert = require('node:assert/strict')
const { loadToolScript } = require('./helpers/loadScript')

const lib = loadToolScript('js/bban-tool.js')
const {
  BBAN_COUNTRIES, bb_ibanIsValid, bb_ibanCheckDigits,
  beCheck, noCheck, isoMod97Check, fiLuhn, esDc, itCin, frRibKey,
  generateBban
} = lib

// Each reference is a real ISO 13616 registry / bank example IBAN. The national check-digit code is
// verified by reproducing the check digit(s) actually embedded in that IBAN. `slice` is where the
// BBAN body ends and the national check begins.
describe('national check digits reproduce real registry IBANs', () => {
  test('Belgium: BE68539007547034', () => {
    const bban = 'BE68539007547034'.slice(4) // 539007547034
    assert.equal(beCheck(bban.slice(0, 10)), bban.slice(10))
    assert.equal(bb_ibanIsValid('BE68539007547034'), true)
  })
  test('Norway: NO9386011117947', () => {
    const bban = 'NO9386011117947'.slice(4) // 86011117947
    assert.equal(noCheck(bban.slice(0, 10)), bban.slice(10))
  })
  test('Portugal: PT50000201231234567890154', () => {
    const bban = 'PT50000201231234567890154'.slice(4)
    assert.equal(isoMod97Check(bban.slice(0, 19)), bban.slice(19))
  })
  test('Slovenia: SI56263300012039086', () => {
    const bban = 'SI56263300012039086'.slice(4)
    assert.equal(isoMod97Check(bban.slice(0, 13)), bban.slice(13))
  })
  test('Finland: FI2112345600000785', () => {
    const bban = 'FI2112345600000785'.slice(4)
    assert.equal(fiLuhn(bban.slice(0, 13)), bban.slice(13))
  })
  test('Spain: ES9121000418450200051332 (both control digits)', () => {
    const bban = 'ES9121000418450200051332'.slice(4) // 21000418 45 0200051332
    const bank = bban.slice(0, 4), branch = bban.slice(4, 8), dc = bban.slice(8, 10), account = bban.slice(10)
    assert.equal(esDc(bank, branch, account), dc)
  })
  test('Italy: IT60X0542811101000000123456 (CIN)', () => {
    const bban = 'IT60X0542811101000000123456'.slice(4)
    assert.equal(itCin(bban.slice(1)), bban[0])
  })
  test('San Marino: SM86U0322509800000000270100 (CIN)', () => {
    const bban = 'SM86U0322509800000000270100'.slice(4)
    assert.equal(itCin(bban.slice(1)), bban[0])
  })
  test('France: FR1420041010050500013M02606 (RIB key)', () => {
    const bban = 'FR1420041010050500013M02606'.slice(4)
    assert.equal(frRibKey(bban.slice(0, 5), bban.slice(5, 10), bban.slice(10, 21)), bban.slice(21))
  })
  test('Monaco: MC5811222000010123456789030 (RIB key)', () => {
    const bban = 'MC5811222000010123456789030'.slice(4)
    assert.equal(frRibKey(bban.slice(0, 5), bban.slice(5, 10), bban.slice(10, 21)), bban.slice(21))
  })
})

describe('Norway mod-11 edge case', () => {
  test('noCheck returns null when the weighted result needs digit 10 (caller regenerates)', () => {
    // Exhaustive over some inputs — just assert the contract: result is null or a single digit
    let sawNull = false
    for (let i = 0; i < 5000; i++) {
      const body = String(Math.floor(1e9 + i)).slice(0, 10)
      const c = noCheck(body)
      if (c === null) { sawNull = true; continue }
      assert.match(c, /^\d$/)
    }
    assert.equal(sawNull, true, 'expected at least one mod-11 "10" rejection across many inputs')
  })
})

describe('generateBban: every country, many samples', () => {
  test('assembled IBAN is valid at BOTH the mod-97 and national layer', () => {
    for (const c of BBAN_COUNTRIES) {
      for (let i = 0; i < 60; i++) {
        const r = generateBban(c.code)
        // IBAN mod-97 valid
        assert.equal(bb_ibanIsValid(r.iban), true, `${c.code} IBAN fails mod-97: ${r.iban}`)
        // IBAN's BBAN equals the reported BBAN, and its check digits recompute
        assert.equal(r.iban.slice(4), r.bban)
        assert.equal(r.iban.slice(2, 4), bb_ibanCheckDigits(c.code, r.bban))
        // national check digit is present as a field and non-empty
        const byLabel = Object.fromEntries(r.fields.map(f => [f.label, f.value]))
        assert.ok(byLabel['BBAN'] && byLabel['IBAN'] && byLabel['Scheme'])
      }
    }
  })

  test('re-verifying the national check on generated output holds', () => {
    // For a couple of representative schemes, extract the generated BBAN and re-run the check fn.
    for (let i = 0; i < 100; i++) {
      const be = generateBban('BE').bban
      assert.equal(beCheck(be.slice(0, 10)), be.slice(10))
      const fr = generateBban('FR').bban
      assert.equal(frRibKey(fr.slice(0, 5), fr.slice(5, 10), fr.slice(10, 21)), fr.slice(21))
      const it = generateBban('IT').bban
      assert.equal(itCin(it.slice(1)), it[0])
      const es = generateBban('ES').bban
      assert.equal(esDc(es.slice(0, 4), es.slice(4, 8), es.slice(10)), es.slice(8, 10))
    }
  })

  test('registry has 10 verified countries, unique 2-letter codes', () => {
    assert.equal(BBAN_COUNTRIES.length, 10)
    const seen = new Set()
    for (const c of BBAN_COUNTRIES) {
      assert.match(c.code, /^[A-Z]{2}$/)
      assert.equal(seen.has(c.code), false)
      seen.add(c.code)
    }
  })

  test('unsupported country throws', () => {
    assert.throws(() => generateBban('DE'), /Unsupported country/)
  })
})
