const { test } = require('node:test')
const assert = require('node:assert')
const { loadToolScript } = require('./helpers/loadScript')

const nf = loadToolScript('js/number-tool.js')

test('nf_parse accepts plain numbers and grouping, rejects junk', () => {
  assert.deepEqual(nf.nf_parse('1234567.89'), { ok: true, n: 1234567.89 })
  assert.deepEqual(nf.nf_parse('1,234,567.89'), { ok: true, n: 1234567.89 }) // commas as grouping
  assert.deepEqual(nf.nf_parse('-42'), { ok: true, n: -42 })
  assert.equal(nf.nf_parse('  ').empty, true)
  assert.equal(nf.nf_parse('abc').ok, false)
  assert.equal(nf.nf_parse('1.2.3').ok, false)
})

test('nf_number uses each locale\'s separators', () => {
  assert.equal(nf.nf_number(1234567.89, 'en-US'), '1,234,567.89')
  assert.equal(nf.nf_number(1234567.89, 'de-DE'), '1.234.567,89') // dot grouping, comma decimal
})

test('nf_currency reflects the currency\'s own decimal rules', () => {
  assert.equal(nf.nf_currency(1234.5, 'en-US', 'USD'), '$1,234.50')
  // VND has no minor unit -> no decimals regardless of the amount
  assert.equal(nf.nf_currency(1234.5, 'vi-VN', 'VND').includes(','), false)
  assert.match(nf.nf_currency(1234.5, 'vi-VN', 'VND'), /₫/)
})

test('reference data is well-formed', () => {
  assert.ok(nf.NF_LOCALES.length >= 8)
  for (const l of nf.NF_LOCALES) assert.ok(/^[a-z]{2}-[A-Z]{2}$/.test(l.id) && l.name)
  for (const c of nf.NF_CURRENCIES) assert.ok(/^[A-Z]{3}$/.test(c))
})
