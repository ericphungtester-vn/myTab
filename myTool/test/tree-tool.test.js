const { test } = require('node:test')
const assert = require('node:assert')
const { loadToolScript } = require('./helpers/loadScript')

const tr = loadToolScript('js/tree-tool.js')

const INPUT = 'project\n  src\n    index.js\n    utils\n      helper.js\n  README.md'

test('tree_render builds a Unicode tree with correct connectors and pipes', () => {
  const expected = [
    'project',
    '├── src',
    '│   ├── index.js',
    '│   └── utils',
    '│       └── helper.js',
    '└── README.md'
  ].join('\n')
  assert.equal(tr.tree_render(tr.tree_parse(INPUT), 'unicode'), expected)
})

test('tree_render supports an ASCII style', () => {
  const out = tr.tree_render(tr.tree_parse(INPUT), 'ascii')
  assert.match(out, /\|-- src/)
  assert.match(out, /`-- README\.md/)
  assert.ok(!out.includes('├'))
})

test('tree_parse handles tabs and 4-space indentation the same as 2-space', () => {
  const tabs = 'a\n\tb\n\t\tc'
  const spaces = 'a\n    b\n        c'
  assert.equal(tr.tree_render(tr.tree_parse(tabs), 'unicode'), tr.tree_render(tr.tree_parse(spaces), 'unicode'))
})

test('blank lines are ignored and multiple roots are allowed', () => {
  const out = tr.tree_render(tr.tree_parse('a\n\n  b\nc'), 'unicode')
  assert.equal(out, ['a', '└── b', 'c'].join('\n'))
})
