const { test } = require('node:test')
const assert = require('node:assert')
const { loadToolScript } = require('./helpers/loadScript')

const uc = loadToolScript('js/unicode-tool.js')

test('uc_cpHex formats U+XXXX with at least 4 digits', () => {
  assert.equal(uc.uc_cpHex(0x48), 'U+0048')
  assert.equal(uc.uc_cpHex(0x1F44D), 'U+1F44D')
})

test('uc_utf8Hex encodes code points to UTF-8 bytes', () => {
  assert.equal(uc.uc_utf8Hex(0x41), '41')             // A
  assert.equal(uc.uc_utf8Hex(0xE9), 'C3 A9')          // é (precomposed)
  assert.equal(uc.uc_utf8Hex(0x20AC), 'E2 82 AC')     // €
  assert.equal(uc.uc_utf8Hex(0x1F44D), 'F0 9F 91 8D') // 👍
})

test('uc_classify names notable characters and flags hidden ones', () => {
  assert.deepEqual(uc.uc_classify('​'), { label: 'ZERO WIDTH SPACE', hidden: true })
  assert.deepEqual(uc.uc_classify(' '), { label: 'NO-BREAK SPACE', hidden: true })
  assert.equal(uc.uc_classify(' ').label, 'SPACE')
  assert.equal(uc.uc_classify(' ').hidden, false) // a plain space isn't "hidden"
  assert.equal(uc.uc_classify('‮').label, 'RIGHT-TO-LEFT OVERRIDE') // bidi attack char
  assert.equal(uc.uc_classify('‮').hidden, true)
})

test('uc_classify categorizes letters, digits, emoji, and combining marks', () => {
  assert.equal(uc.uc_classify('A').label, 'Letter')
  assert.equal(uc.uc_classify('7').label, 'Number')
  assert.equal(uc.uc_classify('👍').label, 'Emoji')
  assert.equal(uc.uc_classify('\u{1F3FD}').label, 'Emoji skin-tone modifier')
  assert.equal(uc.uc_classify('́').label, 'Combining mark') // combining acute accent
  assert.equal(uc.uc_classify('A').hidden, false)
})
