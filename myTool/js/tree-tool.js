// ---- Tree Tool: turn an indented list of files/folders into a pretty ASCII/Unicode directory tree
// (the ├── └── │ kind) for READMEs and docs. Pure string processing — offline, no library. Parser +
// renderer above the wiring marker are unit-tested.

// Parse indented text into a nested node list. Indentation depth (spaces, or tabs expanded to 4)
// decides nesting relative to the previous lines, so 2-space, 4-space, or tab indenting all work.
function tree_parse(text) {
  const root = { name: null, children: [] }
  const stack = [{ indent: -1, node: root }]
  const lines = String(text).split('\n')
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i]
    if (raw.trim() === '') continue
    const lead = (raw.match(/^[ \t]*/)[0] || '').replace(/\t/g, '    ').length
    while (stack.length > 1 && stack[stack.length - 1].indent >= lead) stack.pop()
    const node = { name: raw.trim(), children: [] }
    stack[stack.length - 1].node.children.push(node)
    stack.push({ indent: lead, node: node })
  }
  return root.children
}

var TREE_STYLES = {
  unicode: { tee: '├── ', last: '└── ', pipe: '│   ', gap: '    ' },
  ascii: { tee: '|-- ', last: '`-- ', pipe: '|   ', gap: '    ' }
}

// Render nodes to a tree string. Top-level nodes print plain (as roots); their descendants get the
// branch connectors, with a continuation pipe under every non-last branch.
function tree_render(nodes, styleKey) {
  const s = TREE_STYLES[styleKey] || TREE_STYLES.unicode
  const out = []
  function walk(children, prefix) {
    for (let i = 0; i < children.length; i++) {
      const n = children[i]
      const isLast = i === children.length - 1
      out.push(prefix + (isLast ? s.last : s.tee) + n.name)
      if (n.children.length) walk(n.children, prefix + (isLast ? s.gap : s.pipe))
    }
  }
  for (let i = 0; i < nodes.length; i++) {
    out.push(nodes[i].name)
    if (nodes[i].children.length) walk(nodes[i].children, '')
  }
  return out.join('\n')
}

// ---- Wiring ----
;(function initTreeTool() {
  const input = document.getElementById('tr-input')
  if (!input) return // Tree tab not present in this build

  const styleSeg = document.getElementById('tr-style')
  const outputEl = document.getElementById('tr-output')
  const copyBtn = document.getElementById('tr-copy')

  function styleKey() {
    const b = styleSeg.querySelector('.seg-btn.active')
    return b ? b.dataset.value : 'unicode'
  }
  function setStyle(k) { styleSeg.querySelectorAll('.seg-btn').forEach(b => b.classList.toggle('active', b.dataset.value === k)) }

  let current = ''
  function render() {
    current = input.value.trim() === '' ? '' : tree_render(tree_parse(input.value), styleKey())
    outputEl.textContent = current
    copyBtn.disabled = current === ''
  }

  input.addEventListener('input', () => { render(); saveSettings() })
  styleSeg.addEventListener('click', e => {
    const b = e.target.closest('.seg-btn')
    if (!b) return
    setStyle(b.dataset.value); render(); saveSettings()
  })

  copyBtn.addEventListener('click', () => {
    if (!current) return
    navigator.clipboard.writeText(current).then(() => {
      copyBtn.classList.add('copied')
      setTimeout(() => copyBtn.classList.remove('copied'), 1200)
    })
  })

  const SETTINGS_KEY = 'tree-tool-settings'
  const DEFAULTS = { text: 'project\n  src\n    index.js\n    utils\n      helper.js\n  README.md', style: 'unicode' }
  function saveSettings() { syncSet({ [SETTINGS_KEY]: { text: input.value, style: styleKey() } }) }
  function applySettings(s) { input.value = s.text; setStyle(s.style) }
  document.getElementById('tr-reset-btn').addEventListener('click', () => { applySettings(DEFAULTS); saveSettings(); render() })

  syncGet([SETTINGS_KEY]).then(d => { applySettings({ ...DEFAULTS, ...(d[SETTINGS_KEY] || {}) }); render() })
})()
