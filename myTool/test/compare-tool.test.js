const { test, describe } = require('node:test')
const assert = require('node:assert/strict')
const { loadToolScript } = require('./helpers/loadScript')

const lib = loadToolScript('js/compare-tool.js')
const {
  cp_escapeHtml, cp_normalizeLine, cp_lcs, cp_diffLines,
  cp_tokenize, cp_diffWords, cp_diffStats, cp_renderRows, cp_buildStandaloneHtml
} = lib

const types = rows => rows.map(r => r.type)
// Arrays returned from the vm sandbox have a different Array prototype than this realm's, which
// trips strict deepEqual's prototype check — round-trip through JSON to compare by structure only.
const sameShape = (actual, expected, msg) => assert.deepEqual(JSON.parse(JSON.stringify(actual)), expected, msg)

describe('cp_lcs', () => {
  test('finds the longest common subsequence as index pairs', () => {
    // A B C D  vs  A C E D  -> common A, C, D
    const pairs = cp_lcs(['A', 'B', 'C', 'D'], ['A', 'C', 'E', 'D'])
    sameShape(pairs, [[0, 0], [2, 1], [3, 3]])
  })
  test('no common elements -> no pairs', () => {
    sameShape(cp_lcs(['x'], ['y']), [])
  })
})

describe('cp_diffLines', () => {
  test('identical text is all equal', () => {
    sameShape(types(cp_diffLines('a\nb\nc', 'a\nb\nc')), ['equal', 'equal', 'equal'])
  })
  test('a pure insertion in the middle', () => {
    const rows = cp_diffLines('a\nc', 'a\nb\nc')
    sameShape(types(rows), ['equal', 'ins', 'equal'])
    assert.equal(rows[1].right, 'b')
    assert.equal(rows[1].left, undefined)
  })
  test('a pure deletion', () => {
    const rows = cp_diffLines('a\nb\nc', 'a\nc')
    sameShape(types(rows), ['equal', 'del', 'equal'])
    assert.equal(rows[1].left, 'b')
  })
  test('a changed line pairs into one mod row (left+right)', () => {
    const rows = cp_diffLines('hello world', 'hello there')
    sameShape(types(rows), ['mod'])
    assert.equal(rows[0].left, 'hello world')
    assert.equal(rows[0].right, 'hello there')
  })
  test('line numbers track original vs changed independently', () => {
    const rows = cp_diffLines('a\nb\nc', 'a\nx\nb\nc')
    // equal a(0/0), ins x(-/1), equal b(1/2), equal c(2/3)
    sameShape(rows.map(r => [r.type, r.aIndex ?? null, r.bIndex ?? null]), [
      ['equal', 0, 0], ['ins', null, 1], ['equal', 1, 2], ['equal', 2, 3]
    ])
  })
})

describe('normalization options', () => {
  test('ignoreCase makes differently-cased lines equal', () => {
    sameShape(types(cp_diffLines('Hello', 'hello', { ignoreCase: true })), ['equal'])
    sameShape(types(cp_diffLines('Hello', 'hello', {})), ['mod'])
  })
  test('ignoreWhitespace collapses runs and trims', () => {
    assert.equal(cp_normalizeLine('  a   b  ', { ignoreWhitespace: true }), 'a b')
    sameShape(types(cp_diffLines('a   b', 'a b', { ignoreWhitespace: true })), ['equal'])
  })
  test('trim ignores leading/trailing spaces only', () => {
    assert.equal(cp_normalizeLine('  a b  ', { trim: true }), 'a b')
  })
})

describe('cp_diffWords', () => {
  test('marks only the words that changed', () => {
    const { left, right } = cp_diffWords('the quick brown fox', 'the slow brown fox')
    const changedLeft = left.filter(t => t.changed).map(t => t.text)
    const changedRight = right.filter(t => t.changed).map(t => t.text)
    sameShape(changedLeft, ['quick'])
    sameShape(changedRight, ['slow'])
  })
  test('unchanged words carry changed:false', () => {
    const { left } = cp_diffWords('a b', 'a c')
    const a = left.find(t => t.text === 'a')
    assert.equal(a.changed, false)
  })
})

describe('cp_diffStats', () => {
  test('counts each row type and computes similarity', () => {
    const rows = cp_diffLines('a\nb\nc\nd', 'a\nB\nc\nd\ne')
    // equal a, mod b/B, equal c, equal d, ins e  -> equal 3, changed 1, added 1
    const s = cp_diffStats(rows)
    assert.equal(s.equal, 3)
    assert.equal(s.changed, 1)
    assert.equal(s.added, 1)
    assert.equal(s.removed, 0)
    assert.equal(s.similarity, Math.round(3 / rows.length * 100))
  })
})

describe('HTML rendering & escaping', () => {
  test('cp_escapeHtml neutralizes markup', () => {
    assert.equal(cp_escapeHtml('<b>&"'), '&lt;b&gt;&amp;&quot;')
  })
  test('rendered rows escape content and tag word-level changes', () => {
    const rows = cp_diffLines('a <x> b', 'a <y> b')
    const html = cp_renderRows(rows, {})
    assert.ok(!html.includes('<x>'), 'raw <x> must be escaped')
    assert.ok(html.includes('&lt;x&gt;'))
    assert.ok(html.includes('cp-w-del') && html.includes('cp-w-ins'), 'changed words highlighted')
  })
  test('standalone report is a full self-contained HTML document with the summary', () => {
    const rows = cp_diffLines('a\nb', 'a\nc')
    const doc = cp_buildStandaloneHtml(rows, cp_diffStats(rows), {})
    assert.ok(doc.startsWith('<!doctype html>'))
    assert.ok(doc.includes('<style>') && doc.includes('cp-diff'))
    assert.ok(/\d+ added · \d+ removed · \d+ changed · \d+% similar/.test(doc))
  })
})
