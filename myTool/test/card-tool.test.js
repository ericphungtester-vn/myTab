const { test, describe } = require('node:test')
const assert = require('node:assert/strict')
const { loadToolScript } = require('./helpers/loadScript')

const lib = loadToolScript('js/card-tool.js')
const {
  CARD_NETWORKS, card_luhnChecksum, card_luhnCheckDigit, card_luhnValid,
  card_generateNumber, card_detectNetwork, card_format, card_generateCvv,
  card_formatExpiry, card_generate
} = lib

// Public, well-known test card numbers (all Luhn-valid) — used to verify Luhn + network detection
// against the real world, not just against this code.
const KNOWN = {
  visa: ['4111111111111111', '4242424242424242'],
  mastercard: ['5555555555554444', '5105105105105100', '2223003122003222'],
  amex: ['378282246310005', '371449635398431'],
  discover: ['6011111111111117', '6011000990139424'],
  jcb: ['3530111333300000', '3566002020360505'],
  diners: ['30569309025904', '36227206271667', '38520000023237'],
  unionpay: ['6200000000000005']
}

describe('Luhn checksum', () => {
  test('every known test card passes Luhn', () => {
    for (const nums of Object.values(KNOWN)) {
      for (const n of nums) assert.equal(card_luhnValid(n), true, `${n} should pass Luhn`)
    }
  })
  test('a single altered digit fails Luhn', () => {
    assert.equal(card_luhnValid('4111111111111112'), false)
    assert.equal(card_luhnValid('4242424242424243'), false)
  })
  test('check digit completes a body to a valid number', () => {
    // 424242424242424 + check -> 4242424242424242
    assert.equal(card_luhnCheckDigit('424242424242424'), '2')
    assert.equal(card_luhnChecksum('4242424242424242'), 0)
  })
})

describe('card_detectNetwork on known test numbers', () => {
  test('each known number detects as its own network', () => {
    for (const [key, nums] of Object.entries(KNOWN)) {
      for (const n of nums) assert.equal(card_detectNetwork(n), key, `${n} should be ${key}`)
    }
  })
  test('unrecognized prefix -> unknown', () => {
    assert.equal(card_detectNetwork('9999999999999999'), 'unknown')
  })
})

describe('card_generateNumber: every network, many samples', () => {
  test('valid Luhn, correct length, and detects back to the intended network', () => {
    for (const net of CARD_NETWORKS) {
      for (let i = 0; i < 200; i++) {
        const num = card_generateNumber(net.key)
        assert.equal(num.length, net.length, `${net.key} wrong length`)
        assert.match(num, /^\d+$/)
        assert.equal(card_luhnValid(num), true, `${net.key} produced non-Luhn: ${num}`)
        assert.equal(card_detectNetwork(num), net.key, `${net.key} misdetected: ${num}`)
      }
    }
  })
  test('unknown network throws', () => {
    assert.throws(() => card_generateNumber('sepa'), /Unknown network/)
  })
})

describe('card_format', () => {
  test('groups digits per network', () => {
    assert.equal(card_format('4242424242424242', 'visa'), '4242 4242 4242 4242')
    assert.equal(card_format('378282246310005', 'amex'), '3782 822463 10005')
    assert.equal(card_format('30569309025904', 'diners'), '3056 930902 5904')
  })
})

describe('card_generateCvv', () => {
  test('3 digits normally, 4 for Amex', () => {
    for (let i = 0; i < 50; i++) {
      assert.match(card_generateCvv('visa'), /^\d{3}$/)
      assert.match(card_generateCvv('amex'), /^\d{4}$/)
    }
  })
})

describe('card_formatExpiry', () => {
  test('zero-pads month and uses 2-digit year', () => {
    assert.equal(card_formatExpiry(3, 2027), '03/27')
    assert.equal(card_formatExpiry(12, 2030), '12/30')
  })
})

describe('card_generate (full record)', () => {
  test('produces consistent, valid fields; expiry is in the future', () => {
    const nowYear = new Date().getFullYear()
    for (let i = 0; i < 100; i++) {
      const c = card_generate('random')
      assert.ok(CARD_NETWORKS.some(n => n.key === c.key))
      assert.equal(card_luhnValid(c.numberRaw), true)
      assert.equal(card_detectNetwork(c.numberRaw), c.key)
      assert.match(c.cvv, c.key === 'amex' ? /^\d{4}$/ : /^\d{3}$/)
      assert.match(c.expiry, /^\d{2}\/\d{2}$/)
      const yy = 2000 + parseInt(c.expiry.slice(3), 10)
      assert.ok(yy >= nowYear, `expiry year ${yy} should be >= ${nowYear}`)
      assert.match(c.name, /^[A-Z]+ [A-Z]+$/)
    }
  })
  test('an explicit network key is honored', () => {
    for (let i = 0; i < 30; i++) {
      assert.equal(card_generate('amex').key, 'amex')
    }
  })
})
