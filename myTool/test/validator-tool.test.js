const { test } = require('node:test')
const assert = require('node:assert')
const { loadToolScript } = require('./helpers/loadScript')

const va = loadToolScript('js/validator-tool.js')

test('va_luhnValid / va_validateCard', () => {
  assert.equal(va.va_luhnValid('4111111111111111'), true)
  assert.equal(va.va_luhnValid('4111111111111112'), false)
  const visa = va.va_validateCard('4111 1111 1111 1111')
  assert.equal(visa.ok, true); assert.match(visa.detail, /Visa/)
  assert.equal(va.va_validateCard('4111111111111112').ok, false)          // bad Luhn
  assert.equal(va.va_validateCard('411111').ok, false)                    // too short
  assert.equal(va.va_validateCard('378282246310005').detail.includes('American Express'), true) // valid Amex
})

test('va_validateGtin', () => {
  assert.equal(va.va_validateGtin('5901234123457').ok, true)   // EAN-13
  assert.equal(va.va_validateGtin('96385074').ok, true)         // EAN-8
  assert.equal(va.va_validateGtin('036000291452').ok, true)     // UPC-A
  assert.equal(va.va_validateGtin('5901234123458').ok, false)   // wrong check digit
  assert.match(va.va_validateGtin('5901234123457').detail, /EAN-13/)
})

test('va_validateAba', () => {
  assert.equal(va.va_validateAba('021000021').ok, true)   // JPMorgan Chase
  assert.equal(va.va_validateAba('021000022').ok, false)  // bad checksum
  assert.equal(va.va_validateAba('12345').ok, false)      // wrong length
})

test('va_validateIban', () => {
  assert.equal(va.va_validateIban('DE89 3704 0044 0532 0130 00').ok, true)  // valid, spaced
  assert.equal(va.va_validateIban('GB82WEST12345698765432').ok, true)
  assert.equal(va.va_validateIban('DE89370400440532013001').ok, false)      // bad mod-97
  assert.equal(va.va_validateIban('DE8937040044053201300').ok, false)       // wrong length for DE
  assert.equal(va.va_validateIban('hello').ok, false)                       // not IBAN format
  assert.match(va.va_validateIban('DE89370400440532013000').detail, /DE/)
})

test('va_ibanMod97 of a valid IBAN is 1', () => {
  assert.equal(va.va_ibanMod97('DE89370400440532013000'), 1)
})
