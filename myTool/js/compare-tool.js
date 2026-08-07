// ---- Compare Tool: side-by-side diff of two texts. Lines are matched with a longest-common-
// subsequence diff (like git); within a changed line, the specific words that differ are
// highlighted. Runs entirely in the browser. The result can be downloaded as a standalone HTML
// report for a roomier full-window view than the popup allows.
//
// Everything above the wiring section (marked far below) is pure — no DOM — so it is unit-tested.

function cp_escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

// Normalize a line for *comparison only* (the original text is still what gets displayed).
function cp_normalizeLine(line, opts = {}) {
  let s = line
  if (opts.trim) s = s.trim()
  if (opts.ignoreWhitespace) s = s.replace(/\s+/g, ' ').trim()
  if (opts.ignoreCase) s = s.toLowerCase()
  return s
}

// Generic longest-common-subsequence over two arrays, compared with ===. Returns the matched index
// pairs [ai, bi] in order.
function cp_lcs(a, b) {
  const n = a.length, m = b.length
  const dp = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0))
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1])
    }
  }
  const pairs = []
  let i = 0, j = 0
  while (i < n && j < m) {
    if (a[i] === b[j]) { pairs.push([i, j]); i++; j++ }
    else if (dp[i + 1][j] >= dp[i][j + 1]) i++
    else j++
  }
  return pairs
}

// Line diff -> an ordered list of rows. Types: 'equal', 'del' (only in original), 'ins' (only in
// changed), 'mod' (a changed line paired left/right for word-level highlighting).
function cp_diffLines(aText, bText, opts = {}) {
  const aRaw = String(aText).split('\n')
  const bRaw = String(bText).split('\n')
  const aKey = aRaw.map(l => cp_normalizeLine(l, opts))
  const bKey = bRaw.map(l => cp_normalizeLine(l, opts))
  const pairs = cp_lcs(aKey, bKey)

  const rows = []
  const emitGap = (iFrom, iTo, jFrom, jTo) => {
    const dels = [], ins = []
    for (let x = iFrom; x < iTo; x++) dels.push(x)
    for (let y = jFrom; y < jTo; y++) ins.push(y)
    const paired = Math.min(dels.length, ins.length)
    for (let k = 0; k < paired; k++) {
      rows.push({ type: 'mod', aIndex: dels[k], bIndex: ins[k], left: aRaw[dels[k]], right: bRaw[ins[k]] })
    }
    for (let k = paired; k < dels.length; k++) rows.push({ type: 'del', aIndex: dels[k], left: aRaw[dels[k]] })
    for (let k = paired; k < ins.length; k++) rows.push({ type: 'ins', bIndex: ins[k], right: bRaw[ins[k]] })
  }

  let i = 0, j = 0
  for (const [pi, pj] of pairs) {
    emitGap(i, pi, j, pj)
    rows.push({ type: 'equal', aIndex: pi, bIndex: pj, left: aRaw[pi], right: bRaw[pj] })
    i = pi + 1; j = pj + 1
  }
  emitGap(i, aRaw.length, j, bRaw.length)
  return rows
}

// Split into words while keeping whitespace runs as their own tokens, so a line can be rebuilt.
function cp_tokenize(str) {
  return String(str).split(/(\s+)/).filter(t => t !== '')
}

function cp_normWord(tok, opts = {}) {
  if (/^\s+$/.test(tok)) return ' ' // any whitespace run is equal to any other for word matching
  return opts.ignoreCase ? tok.toLowerCase() : tok
}

// Word diff between two lines -> { left, right }, each a list of { text, changed } tokens.
function cp_diffWords(aLine, bLine, opts = {}) {
  const aTok = cp_tokenize(aLine), bTok = cp_tokenize(bLine)
  const aKey = aTok.map(t => cp_normWord(t, opts)), bKey = bTok.map(t => cp_normWord(t, opts))
  const pairs = cp_lcs(aKey, bKey)

  const left = [], right = []
  let i = 0, j = 0
  for (const [pi, pj] of pairs) {
    for (let x = i; x < pi; x++) left.push({ text: aTok[x], changed: true })
    for (let y = j; y < pj; y++) right.push({ text: bTok[y], changed: true })
    left.push({ text: aTok[pi], changed: false })
    right.push({ text: bTok[pj], changed: false })
    i = pi + 1; j = pj + 1
  }
  for (let x = i; x < aTok.length; x++) left.push({ text: aTok[x], changed: true })
  for (let y = j; y < bTok.length; y++) right.push({ text: bTok[y], changed: true })
  return { left, right }
}

function cp_diffStats(rows) {
  let equal = 0, added = 0, removed = 0, changed = 0
  for (const r of rows) {
    if (r.type === 'equal') equal++
    else if (r.type === 'ins') added++
    else if (r.type === 'del') removed++
    else if (r.type === 'mod') changed++
  }
  const total = rows.length || 1
  return { equal, added, removed, changed, similarity: Math.round(equal / total * 100) }
}

function cp_renderWordSide(tokens, kind) {
  return tokens.map(t => t.changed
    ? `<span class="cp-w cp-w-${kind}">${cp_escapeHtml(t.text)}</span>`
    : cp_escapeHtml(t.text)).join('')
}

// Build the two-column diff table HTML (pure string — used both in the popup and the download).
function cp_renderRows(rows, opts = {}) {
  const body = rows.map(r => {
    const aNum = r.aIndex != null ? r.aIndex + 1 : ''
    const bNum = r.bIndex != null ? r.bIndex + 1 : ''
    let leftHtml = r.left != null ? cp_escapeHtml(r.left) : ''
    let rightHtml = r.right != null ? cp_escapeHtml(r.right) : ''
    if (r.type === 'mod') {
      const wd = cp_diffWords(r.left, r.right, opts)
      leftHtml = cp_renderWordSide(wd.left, 'del')
      rightHtml = cp_renderWordSide(wd.right, 'ins')
    }
    return `<tr class="cp-${r.type}">`
      + `<td class="cp-ln">${aNum}</td><td class="cp-side">${leftHtml || '&nbsp;'}</td>`
      + `<td class="cp-ln">${bNum}</td><td class="cp-side">${rightHtml || '&nbsp;'}</td></tr>`
  }).join('')
  return `<table class="cp-diff"><tbody>${body}</tbody></table>`
}

const CP_REPORT_CSS = `
body { font-family: system-ui, -apple-system, Arial, sans-serif; margin: 24px; color: #1a1a1a; }
h1 { font-size: 18px; margin: 0 0 4px; }
.summary { color: #555; font-size: 13px; margin: 0 0 16px; }
.cp-diff { border-collapse: collapse; width: 100%; table-layout: fixed;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 12px; }
.cp-diff td { padding: 1px 8px; vertical-align: top; white-space: pre-wrap; word-break: break-word; border-top: 1px solid #eee; }
.cp-ln { width: 42px; text-align: right; color: #999; user-select: none; background: #fafafa; }
.cp-side { width: calc(50% - 42px); }
tr.cp-del td:nth-of-type(2) { background: #ffe3e3; }
tr.cp-ins td:nth-of-type(4) { background: #e3f7e3; }
tr.cp-mod td:nth-of-type(2) { background: #fff2e8; }
tr.cp-mod td:nth-of-type(4) { background: #eef9ee; }
.cp-w-del { background: #ffc9c9; border-radius: 2px; }
.cp-w-ins { background: #b2f2bb; border-radius: 2px; }
`

// Standalone HTML report for download (self-contained, opens in any browser).
function cp_buildStandaloneHtml(rows, stats, opts = {}) {
  const table = cp_renderRows(rows, opts)
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">`
    + `<meta name="viewport" content="width=device-width, initial-scale=1">`
    + `<title>Text comparison</title><style>${CP_REPORT_CSS}</style></head><body>`
    + `<h1>Text comparison</h1>`
    + `<p class="summary">${stats.added} added · ${stats.removed} removed · ${stats.changed} changed · ${stats.similarity}% similar</p>`
    + table + `</body></html>`
}

// ---- Wiring ----
;(function initCompareTool() {
  const aEl = document.getElementById('cp-a')
  if (!aEl) return // Compare tab not present in this build

  const bEl = document.getElementById('cp-b')
  const ignoreCaseEl = document.getElementById('cp-ignore-case')
  const ignoreWsEl = document.getElementById('cp-ignore-ws')
  const trimEl = document.getElementById('cp-trim')
  const compareBtn = document.getElementById('cp-compare')
  const downloadBtn = document.getElementById('cp-download')
  const errorEl = document.getElementById('cp-error')
  const statsEl = document.getElementById('cp-stats')
  const outputEl = document.getElementById('cp-output')

  const MAX_LINES = 2000
  let lastReport = null

  // Live line/char counters under each box — the real limit is lines, so surface it (there is no
  // character cap). The counter turns red once a side exceeds MAX_LINES, matching the compare error.
  const counters = [
    { el: aEl, lines: document.getElementById('cp-a-lines'), chars: document.getElementById('cp-a-chars'), box: document.getElementById('cp-a-lines').closest('.cp-counter') },
    { el: bEl, lines: document.getElementById('cp-b-lines'), chars: document.getElementById('cp-b-chars'), box: document.getElementById('cp-b-lines').closest('.cp-counter') }
  ]
  function updateCounter(c) {
    const v = c.el.value
    const lines = v === '' ? 0 : v.split('\n').length
    c.lines.textContent = lines
    c.chars.textContent = v.length
    c.box.classList.toggle('over', lines > MAX_LINES)
  }
  function updateCounters() { counters.forEach(updateCounter) }
  counters.forEach(c => c.el.addEventListener('input', () => updateCounter(c)))

  function currentOpts() {
    return { ignoreCase: ignoreCaseEl.checked, ignoreWhitespace: ignoreWsEl.checked, trim: trimEl.checked }
  }

  function compare() {
    errorEl.hidden = true
    const a = aEl.value, b = bEl.value
    if (a === '' && b === '') { showError('Paste text into both boxes to compare.'); return }
    if (a.split('\n').length > MAX_LINES || b.split('\n').length > MAX_LINES) {
      showError(`Each side is limited to ${MAX_LINES} lines.`); return
    }
    const opts = currentOpts()
    const rows = cp_diffLines(a, b, opts)
    const stats = cp_diffStats(rows)
    outputEl.innerHTML = cp_renderRows(rows, opts)
    outputEl.hidden = false
    statsEl.textContent = `${stats.added} added · ${stats.removed} removed · ${stats.changed} changed · ${stats.similarity}% similar`
    statsEl.hidden = false
    lastReport = cp_buildStandaloneHtml(rows, stats, opts)
    downloadBtn.hidden = false
  }

  function showError(msg) {
    errorEl.textContent = msg
    errorEl.hidden = false
  }

  function download() {
    if (!lastReport) return
    const blob = new Blob([lastReport], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'text-comparison.html'
    document.body.appendChild(link)
    link.click()
    link.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  compareBtn.addEventListener('click', compare)
  downloadBtn.addEventListener('click', download)

  // Persistence + reset — options only; pasted text is never stored.
  const resetBtn = document.getElementById('cp-reset-btn')
  const SETTINGS_KEY = 'compare-tool-settings'
  const DEFAULTS = { ignoreCase: false, ignoreWhitespace: false, trim: false }
  function saveSettings() {
    syncSet({ [SETTINGS_KEY]: { ignoreCase: ignoreCaseEl.checked, ignoreWhitespace: ignoreWsEl.checked, trim: trimEl.checked } })
  }
  function applySettings(s) {
    ignoreCaseEl.checked = s.ignoreCase
    ignoreWsEl.checked = s.ignoreWhitespace
    trimEl.checked = s.trim
  }
  ;[ignoreCaseEl, ignoreWsEl, trimEl].forEach(el => el.addEventListener('change', saveSettings))
  resetBtn.addEventListener('click', () => {
    applySettings(DEFAULTS)
    aEl.value = ''
    bEl.value = ''
    outputEl.hidden = true
    statsEl.hidden = true
    downloadBtn.hidden = true
    errorEl.hidden = true
    lastReport = null
    updateCounters()
    saveSettings()
  })
  updateCounters()
  syncGet([SETTINGS_KEY]).then(d => { if (d[SETTINGS_KEY]) applySettings({ ...DEFAULTS, ...d[SETTINGS_KEY] }) })
})()
