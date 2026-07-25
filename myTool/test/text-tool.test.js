const { test, describe } = require('node:test')
const assert = require('node:assert/strict')
const { loadToolScript } = require('./helpers/loadScript')

const lib = loadToolScript('js/text-tool.js')
const {
  LANG_CONFIG, generateParagraphs, buildWordsToLength,
  validateStringSettings, generateRandomString, FULL_CHAR_CLASSES
} = lib

describe('language word banks', () => {
  test('every configured language has a non-empty word pool', () => {
    for (const [code, cfg] of Object.entries(LANG_CONFIG)) {
      assert.ok(Array.isArray(cfg.pool) && cfg.pool.length > 0, `${code} has an empty pool`)
    }
  })
})

describe('buildWordsToLength', () => {
  test('always returns exactly the requested length, regardless of word size', () => {
    for (const target of [0, 1, 5, 37, 200]) {
      const text = buildWordsToLength(LANG_CONFIG.en.pool, target, true)
      assert.equal(text.length, target)
    }
  })
})

describe('generateParagraphs', () => {
  test('chars unit: exact character count', () => {
    const [text] = generateParagraphs({ lang: 'en', unit: 'chars', amount: 55 })
    assert.equal(text.length, 55)
  })

  test('words unit: exact word count for a spaced language', () => {
    const [text] = generateParagraphs({ lang: 'en', unit: 'words', amount: 12 })
    assert.equal(text.split(' ').length, 12)
  })

  test('sentences unit: produces exactly the requested number of sentences', () => {
    const [text] = generateParagraphs({ lang: 'en', unit: 'sentences', amount: 5 })
    const sentenceEnds = (text.match(/\./g) || []).length
    assert.equal(sentenceEnds, 5)
    assert.match(text, /^[A-Z]/) // first sentence is capitalized
  })

  test('paragraphs unit: exactly `amount` paragraphs, each exactly `paraLength` characters', () => {
    const paras = generateParagraphs({ lang: 'en', unit: 'paragraphs', amount: 4, paraLength: 40 })
    assert.equal(paras.length, 4)
    for (const p of paras) assert.equal(p.length, 40)
  })

  test('zh (unspaced script) still hits the exact character count for the chars unit', () => {
    const [text] = generateParagraphs({ lang: 'zh', unit: 'chars', amount: 30 })
    assert.equal(text.length, 30)
  })
})

describe('random string generator', () => {
  // A class only counts as "checked" if charEnabled[cls] is a populated array (real usage always
  // provides this, cloned from FULL_CHAR_CLASSES — see applySettings) — an empty/missing entry
  // means "not enabled", not "enabled with defaults", so tests must populate it explicitly too.
  const threeClassesEnabled = { upper: FULL_CHAR_CLASSES.upper, lower: FULL_CHAR_CLASSES.lower, digits: FULL_CHAR_CLASSES.digits }

  test('validateStringSettings rejects an amount smaller than the number of checked classes', () => {
    const err = validateStringSettings(2, ['upper', 'lower', 'digits'], threeClassesEnabled)
    assert.match(err, /at least 3/)
  })

  test('validateStringSettings accepts an amount >= the number of checked classes', () => {
    const err = validateStringSettings(3, ['upper', 'lower', 'digits'], threeClassesEnabled)
    assert.equal(err, null)
  })

  test('validateStringSettings rejects when nothing is checked', () => {
    const err = validateStringSettings(10, [], {})
    assert.ok(err)
  })

  test('every checked class contributes at least one character (run several times, it is random)', () => {
    const charEnabled = {
      upper: FULL_CHAR_CLASSES.upper, lower: FULL_CHAR_CLASSES.lower,
      digits: FULL_CHAR_CLASSES.digits, symbols: FULL_CHAR_CLASSES.symbols
    }
    for (let i = 0; i < 25; i++) {
      const str = generateRandomString(10, ['upper', 'lower', 'digits', 'symbols'], charEnabled)
      assert.equal(str.length, 10)
      assert.match(str, /[A-Z]/)
      assert.match(str, /[a-z]/)
      assert.match(str, /[0-9]/)
    }
  })

  test('respects a narrowed character subset within a class', () => {
    const charEnabled = { digits: ['1', '2'] }
    const str = generateRandomString(20, ['digits'], charEnabled)
    assert.ok([...str].every(ch => ch === '1' || ch === '2'), `unexpected characters in "${str}"`)
  })
})
