const { test, describe } = require('node:test')
const assert = require('node:assert/strict')
const { loadToolScript } = require('./helpers/loadScript')

const lib = loadToolScript('js/noniban-tool.js')
const {
  NONIBAN_COUNTRIES, NONIBAN_ACCOUNT_LEN,
  abaChecksum, abaRoutingIsValid, genAbaRouting,
  clabeCheckDigit, clabeIsValid, genClabe,
  cbuCheckDigit, cbuIsValid, genCbu, CBU_W1, CBU_W2,
  nb_generateSwift, generateNonIban
} = lib

describe('USA ABA routing checksum: real published routing numbers', () => {
  // Real Fed routing numbers (public) — proves the weighted MOD-10 matches the real world.
  const REAL = ['021000021', '121000248', '026009593', '011401533', '322271627']
  test('every real routing number validates', () => {
    for (const rn of REAL) assert.equal(abaRoutingIsValid(rn), true, `${rn} should validate`)
  })
  test('a flipped digit fails', () => {
    assert.equal(abaRoutingIsValid('021000022'), false)
    assert.equal(abaRoutingIsValid('12100024'), false)  // too short
    assert.equal(abaChecksum('021000021'), 0)
  })
  test('generated routing numbers always pass', () => {
    for (let i = 0; i < 500; i++) assert.equal(abaRoutingIsValid(genAbaRouting()), true)
  })
})

describe('Mexico CLABE checksum: known reference', () => {
  test('reference CLABE 032180000118359719 validates', () => {
    assert.equal(clabeIsValid('032180000118359719'), true)
    assert.equal(clabeCheckDigit('03218000011835971'), '9')
  })
  test('a flipped digit fails', () => {
    assert.equal(clabeIsValid('032180000118359718'), false)
    assert.equal(clabeIsValid('03218000011835971'), false) // 17 digits, too short
  })
  test('generated CLABEs always pass and are 18 digits', () => {
    for (let i = 0; i < 500; i++) {
      const c = genClabe()
      assert.match(c, /^\d{18}$/)
      assert.equal(clabeIsValid(c), true)
    }
  })
})

describe('Argentina CBU checksum: known reference', () => {
  test('reference CBU 2850590940090418135201 validates', () => {
    assert.equal(cbuIsValid('2850590940090418135201'), true)
    // both block check digits reproduce
    assert.equal(cbuCheckDigit('2850590', CBU_W1), 9)
    assert.equal(cbuCheckDigit('4009041813520', CBU_W2), 1)
  })
  test('a flipped digit in either block fails', () => {
    assert.equal(cbuIsValid('2850591940090418135201'), false) // block 1 body altered
    assert.equal(cbuIsValid('2850590940090418135200'), false) // block 2 check altered
    assert.equal(cbuIsValid('285059094009041813520'), false)  // 21 digits, too short
  })
  test('generated CBUs always pass and are 22 digits', () => {
    for (let i = 0; i < 500; i++) {
      const c = genCbu()
      assert.match(c, /^\d{22}$/)
      assert.equal(cbuIsValid(c), true)
    }
  })
})

describe('country registry integrity', () => {
  test('codes unique, 2 uppercase letters, and each has an account-length range', () => {
    const seen = new Set()
    for (const c of NONIBAN_COUNTRIES) {
      assert.match(c.code, /^[A-Z]{2}$/, `${c.code} malformed`)
      assert.equal(seen.has(c.code), false, `${c.code} duplicated`)
      seen.add(c.code)
      const range = NONIBAN_ACCOUNT_LEN[c.code]
      assert.ok(Array.isArray(range) && range[0] > 0 && range[0] <= range[1], `${c.code} bad account range`)
    }
  })
  test('exactly USA, Mexico, Argentina declare a verifiable checksum', () => {
    const withChecksum = NONIBAN_COUNTRIES.filter(c => c.checksum).map(c => c.code).sort().join(',')
    assert.equal(withChecksum, 'AR,MX,US')
  })
})

describe('generateNonIban: every country, many samples', () => {
  const bicRe = /^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$/

  test('always yields an Account Number and a correctly-formatted SWIFT/BIC', () => {
    for (const c of NONIBAN_COUNTRIES) {
      for (let i = 0; i < 40; i++) {
        const r = generateNonIban(c.code)
        assert.equal(r.countryCode, c.code)
        const byLabel = Object.fromEntries(r.fields.map(f => [f.label, f.value]))

        assert.ok(byLabel['Account Number'], `${c.code} missing Account Number`)
        assert.match(byLabel['Account Number'], /^\d+$/, `${c.code} non-numeric account`)

        const swift = byLabel['SWIFT / BIC']
        assert.match(swift, bicRe, `${c.code} bad SWIFT: ${swift}`)
        assert.equal(swift.slice(4, 6), c.code, `${c.code} SWIFT country mismatch: ${swift}`)
      }
    }
  })

  test('the declared checksum field actually validates', () => {
    for (let i = 0; i < 50; i++) {
      const byLabel = f => Object.fromEntries(generateNonIban(f).fields.map(x => [x.label, x.value]))
      assert.equal(abaRoutingIsValid(byLabel('US')['Routing Number (ABA)']), true)
      assert.equal(clabeIsValid(byLabel('MX')['CLABE']), true)
      assert.equal(cbuIsValid(byLabel('AR')['CBU']), true)
    }
  })

  test('account number length stays within the country range', () => {
    for (const c of NONIBAN_COUNTRIES) {
      const [min, max] = NONIBAN_ACCOUNT_LEN[c.code]
      for (let i = 0; i < 40; i++) {
        const acc = generateNonIban(c.code).fields.find(f => f.label === 'Account Number').value
        assert.ok(acc.length >= min && acc.length <= max, `${c.code} account len ${acc.length} out of [${min},${max}]`)
      }
    }
  })

  test('unsupported country throws', () => {
    assert.throws(() => generateNonIban('ZZ'), /Unsupported country/)
  })
})

describe('nb_generateSwift', () => {
  test('8 or 11 chars, country code in positions 5-6', () => {
    for (const c of NONIBAN_COUNTRIES) {
      for (let i = 0; i < 20; i++) {
        const bic = nb_generateSwift(c.code)
        assert.ok(bic.length === 8 || bic.length === 11)
        assert.equal(bic.slice(4, 6), c.code)
      }
    }
  })
})
