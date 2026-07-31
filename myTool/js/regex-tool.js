// ---- Regex Tool: tests a regular expression against sample text, listing every match (with capture
// groups) and highlighting them. Pure match/highlight logic is unit-tested; nothing above the wiring
// marker touches the DOM.

function rx_esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

// Run `pattern`/`flags` over `text`, always enumerating all matches. Returns { matches } or { error }.
function rx_run(pattern, flags, text) {
  let re
  const withG = flags.includes('g') ? flags : flags + 'g'
  try {
    re = new RegExp(pattern, withG)
  } catch (e) {
    return { error: e.message }
  }
  const matches = []
  let m
  let guard = 0
  while ((m = re.exec(text)) !== null) {
    matches.push({ match: m[0], index: m.index, groups: m.slice(1).map(g => g === undefined ? null : g) })
    if (m.index === re.lastIndex) re.lastIndex++ // zero-width match: advance to avoid an infinite loop
    if (++guard > 100000) break
  }
  return { matches }
}

// Escape `text` and wrap each match in <mark>…</mark> (skips zero-length matches).
function rx_highlight(text, matches) {
  let out = ''
  let last = 0
  for (const m of matches) {
    if (m.match.length === 0) continue
    out += rx_esc(text.slice(last, m.index))
    out += '<mark class="rx-hit">' + rx_esc(m.match) + '</mark>'
    last = m.index + m.match.length
  }
  out += rx_esc(text.slice(last))
  return out
}

// ---- Wiring ----
;(function initRegexTool() {
  const patternEl = document.getElementById('rx-pattern')
  if (!patternEl) return

  const flagsEl = document.getElementById('rx-flags')
  const textEl = document.getElementById('rx-text')
  const errorEl = document.getElementById('rx-error')
  const countEl = document.getElementById('rx-count')
  const outEl = document.getElementById('rx-output')

  function esc(s) { return rx_esc(s) }

  function render() {
    const pattern = patternEl.value
    if (pattern === '') { errorEl.hidden = true; countEl.hidden = true; outEl.innerHTML = esc(textEl.value); return }
    const res = rx_run(pattern, flagsEl.value, textEl.value)
    if (res.error) {
      errorEl.textContent = res.error
      errorEl.hidden = false
      countEl.hidden = true
      outEl.textContent = textEl.value
      return
    }
    errorEl.hidden = true
    const n = res.matches.length
    countEl.textContent = `${n} match${n === 1 ? '' : 'es'}`
    countEl.hidden = false
    outEl.innerHTML = rx_highlight(textEl.value, res.matches)
  }

  patternEl.addEventListener('input', render)
  flagsEl.addEventListener('input', render)
  textEl.addEventListener('input', render)
  document.getElementById('rx-reset-btn').addEventListener('click', () => {
    patternEl.value = ''
    flagsEl.value = 'g'
    textEl.value = ''
    render()
  })

  render()
})()
