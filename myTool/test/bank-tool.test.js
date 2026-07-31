const { test, describe } = require('node:test')
const assert = require('node:assert/strict')
const { loadToolScript } = require('./helpers/loadScript')

const lib = loadToolScript('js/bank-tool.js')
const {
  IBAN_COUNTRIES, ibanMod97, ibanCheckDigits, ibanIsValid,
  generateBIC, generateBank
} = lib

// Real published IBAN examples from the ISO 13616 registry / national banks — used to prove the
// mod-97 implementation matches the world, not just itself. (These are example IBANs, not real
// accounts.)
const KNOWN_VALID = [
  'DE89370400440532013000',
  'GB82WEST12345698765432',
  'FR1420041010050500013M02606',
  'BE68539007547034',
  'NL91ABNA0417164300',
  'CH9300762011623852957',
  'ES9121000418450200051332',
  'IT60X0542811101000000123456',
  'NO9386011117947',
  'PL61109010140000071219812874'
]

describe('ibanMod97 / ibanIsValid: known reference vectors', () => {
  test('every published example IBAN validates', () => {
    for (const iban of KNOWN_VALID) {
      assert.equal(ibanIsValid(iban), true, `${iban} should be valid`)
    }
  })

  test('a valid IBAN with one digit flipped fails', () => {
    // DE89...3000 -> ...3001 breaks the mod-97 check
    assert.equal(ibanIsValid('DE89370400440532013001'), false)
    // swapping the check digits also fails
    assert.equal(ibanIsValid('DE98370400440532013000'), false)
  })

  test('validator tolerates spaces and lowercase, rejects malformed input', () => {
    assert.equal(ibanIsValid('de89 3704 0044 0532 0130 00'), true)
    assert.equal(ibanIsValid('89DE370400440532013000'), false) // country code not leading
    assert.equal(ibanIsValid(''), false)
    assert.equal(ibanIsValid('DE89'), false)
  })

  test('ibanCheckDigits reproduces the check digits of a known IBAN', () => {
    // Strip DE + "89" check, recompute from the BBAN, expect "89" back
    const bban = 'DE89370400440532013000'.slice(4)
    assert.equal(ibanCheckDigits('DE', bban), '89')
  })
})

describe('IBAN country registry integrity', () => {
  test('BBAN segment lengths always sum to ibanLength - 4', () => {
    for (const c of IBAN_COUNTRIES) {
      const sum = c.bban.reduce((n, [, len]) => n + len, 0)
      assert.equal(sum, c.ibanLength - 4, `${c.code} BBAN length mismatch`)
    }
  })

  test('country codes are unique, 2 uppercase letters', () => {
    const seen = new Set()
    for (const c of IBAN_COUNTRIES) {
      assert.match(c.code, /^[A-Z]{2}$/, `${c.code} malformed`)
      assert.equal(seen.has(c.code), false, `${c.code} duplicated`)
      seen.add(c.code)
    }
  })

  test('every BBAN segment uses a known role and charset', () => {
    for (const c of IBAN_COUNTRIES) {
      for (const [role, len, charset] of c.bban) {
        assert.ok(['bank', 'branch', 'account', 'x'].includes(role), `${c.code} bad role ${role}`)
        assert.ok(['n', 'a', 'c'].includes(charset), `${c.code} bad charset ${charset}`)
        assert.ok(len > 0, `${c.code} non-positive length`)
      }
    }
  })

  test('every country has at least one bank and one account segment', () => {
    for (const c of IBAN_COUNTRIES) {
      const roles = c.bban.map(p => p[0])
      assert.ok(roles.includes('bank'), `${c.code} has no bank segment`)
      assert.ok(roles.includes('account'), `${c.code} has no account segment`)
    }
  })
})

describe('generateBank: every country, many samples', () => {
  test('output is structurally correct and passes the IBAN checksum', () => {
    for (const c of IBAN_COUNTRIES) {
      for (let i = 0; i < 50; i++) {
        const b = generateBank(c.code)
        assert.equal(b.iban.length, c.ibanLength, `${c.code} wrong IBAN length`)
        assert.equal(b.iban.slice(0, 2), c.code, `${c.code} wrong country prefix`)
        assert.equal(ibanIsValid(b.iban), true, `${c.code} produced an IBAN failing mod-97: ${b.iban}`)
        assert.match(b.iban, /^[A-Z]{2}[0-9]{2}[A-Z0-9]+$/, `${c.code} IBAN has illegal chars: ${b.iban}`)
        assert.ok(b.bankCode.length > 0, `${c.code} empty bank code`)
        assert.ok(b.accountNumber.length > 0, `${c.code} empty account number`)
      }
    }
  })

  test('bank code and account number are the actual IBAN segments (consistency)', () => {
    for (const c of IBAN_COUNTRIES) {
      const b = generateBank(c.code)
      const bbanPart = b.iban.slice(4)
      assert.ok(bbanPart.includes(b.bankCode), `${c.code} bank code not inside IBAN`)
      assert.ok(bbanPart.includes(b.accountNumber), `${c.code} account number not inside IBAN`)
      if (b.branchCode) assert.ok(bbanPart.includes(b.branchCode), `${c.code} branch code not inside IBAN`)
    }
  })

  test('spaced IBAN has no spaces once stripped and equals the plain IBAN', () => {
    const b = generateBank('DE')
    assert.equal(b.ibanPretty.replace(/\s+/g, ''), b.iban)
  })

  test('unsupported country throws', () => {
    assert.throws(() => generateBank('ZZ'), /Unsupported country/)
  })
})

describe('generateBIC: ISO 9362 format', () => {
  test('always 8 or 11 chars with the country code in positions 5-6', () => {
    const bicRe = /^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$/
    for (const c of IBAN_COUNTRIES) {
      for (let i = 0; i < 30; i++) {
        const bic = generateBIC(c.code)
        assert.match(bic, bicRe, `${c.code} produced malformed BIC: ${bic}`)
        assert.ok(bic.length === 8 || bic.length === 11, `${c.code} BIC wrong length: ${bic}`)
        assert.equal(bic.slice(4, 6), c.code, `${c.code} BIC country code mismatch: ${bic}`)
      }
    }
  })
})
