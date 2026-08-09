const { test } = require('node:test')
const assert = require('node:assert')
const { loadToolScript } = require('./helpers/loadScript')

const ic = loadToolScript('js/icons-tool.js')

test('ic_svg wraps inner geometry with the chosen size, stroke and colour', () => {
  const svg = ic.ic_svg('<path d="M1 1"/>', { size: 32, stroke: 1.5, color: '#ff0000' })
  assert.match(svg, /^<svg /)
  assert.match(svg, /width="32" height="32"/)
  assert.match(svg, /viewBox="0 0 24 24"/) // geometry stays 24-grid; only the box scales
  assert.match(svg, /stroke="#ff0000"/)
  assert.match(svg, /stroke-width="1.5"/)
  assert.ok(svg.includes('<path d="M1 1"/>'))
})

test('ic_svg falls back to sensible defaults', () => {
  const svg = ic.ic_svg('<path/>')
  assert.match(svg, /width="24"/)
  assert.match(svg, /stroke-width="2"/)
  assert.match(svg, /stroke="currentColor"/)
})

test('ic_search matches name and tags, requires all words, and honours the limit', () => {
  const names = ['house', 'home-wifi', 'arrow-up', 'circle']
  const tags = { house: 'home living building', 'home-wifi': 'router network', 'arrow-up': 'direction', circle: 'shape round' }
  assert.deepEqual(ic.ic_search(names, tags, 'home'), ['house', 'home-wifi']) // tag hit + name hit
  assert.deepEqual(ic.ic_search(names, tags, 'arrow up'), ['arrow-up']) // hyphen treated as space
  assert.deepEqual(ic.ic_search(names, tags, 'home living'), ['house']) // every word must match
  assert.equal(ic.ic_search(names, tags, '', 2).length, 2) // limit
  assert.deepEqual(ic.ic_search(names, tags, 'zzz'), [])
})

test('ic_filterSymbols keeps only groups with matches and filters their items', () => {
  const groups = [
    { name: 'Arrows', items: [['←', 'arrow left'], ['→', 'arrow right']] },
    { name: 'Math', items: [['÷', 'divide'], ['×', 'multiply times']] }
  ]
  const res = ic.ic_filterSymbols(groups, 'left')
  assert.equal(res.length, 1)
  assert.equal(res[0].name, 'Arrows')
  assert.deepEqual(res[0].items, [['←', 'arrow left']])
  assert.equal(ic.ic_filterSymbols(groups, '').length, 2) // empty query = everything
  assert.equal(ic.ic_filterSymbols(groups, 'times').length, 1) // keyword match
})

test('ic_iconsInCategory filters names by Lucide category', () => {
  const cats = { house: ['buildings', 'home'], tent: ['buildings', 'travel'], star: ['shapes'] }
  const names = ['house', 'tent', 'star']
  assert.deepEqual(ic.ic_iconsInCategory(cats, names, 'buildings'), ['house', 'tent'])
  assert.deepEqual(ic.ic_iconsInCategory(cats, names, 'travel'), ['tent'])
  assert.deepEqual(ic.ic_iconsInCategory(cats, names, 'all'), names) // 'all' passes everything
  assert.deepEqual(ic.ic_iconsInCategory(cats, names, 'zzz'), [])
})

test('ic_categoryList returns sorted categories with counts', () => {
  const cats = { house: ['buildings', 'home'], tent: ['buildings', 'travel'], star: ['shapes'] }
  const list = ic.ic_categoryList(cats, Object.keys(cats))
  assert.deepEqual(list, [
    { name: 'buildings', count: 2 },
    { name: 'home', count: 1 },
    { name: 'shapes', count: 1 },
    { name: 'travel', count: 1 }
  ])
})

test('the bundled symbol set has non-empty groups and valid [char, keywords] pairs', () => {
  assert.ok(ic.IC_SYMBOLS.length >= 5)
  for (const g of ic.IC_SYMBOLS) {
    assert.ok(g.name && g.items.length)
    for (const it of g.items) {
      assert.equal(typeof it[0], 'string')
      assert.ok(it[0].length >= 1)
      assert.equal(typeof it[1], 'string')
    }
  }
})
