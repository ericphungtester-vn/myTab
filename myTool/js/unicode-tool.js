// ---- Unicode Tool: break text down code point by code point — glyph, U+ code point, category (with
// a proper name for the notable invisible/control characters), UTF-8 bytes, and a flag for hidden or
// suspicious characters. Helps catch zero-width/invisible characters, precomposed-vs-combining
// accents, and emoji length surprises. Everything above the wiring marker is pure and unit-tested.

// Named characters that matter for QA (invisible, control, spaces, bidi) — the ones no one can eyeball.
var UC_NAMES = {
  0x00: 'NULL', 0x09: 'TAB', 0x0A: 'LINE FEED (LF)', 0x0D: 'CARRIAGE RETURN (CR)',
  0x20: 'SPACE', 0xA0: 'NO-BREAK SPACE', 0xAD: 'SOFT HYPHEN',
  0x2003: 'EM SPACE', 0x2009: 'THIN SPACE', 0x3000: 'IDEOGRAPHIC SPACE',
  0x200B: 'ZERO WIDTH SPACE', 0x200C: 'ZERO WIDTH NON-JOINER', 0x200D: 'ZERO WIDTH JOINER',
  0x200E: 'LEFT-TO-RIGHT MARK', 0x200F: 'RIGHT-TO-LEFT MARK',
  0x202A: 'LEFT-TO-RIGHT EMBEDDING', 0x202B: 'RIGHT-TO-LEFT EMBEDDING', 0x202C: 'POP DIRECTIONAL FORMATTING',
  0x202D: 'LEFT-TO-RIGHT OVERRIDE', 0x202E: 'RIGHT-TO-LEFT OVERRIDE',
  0x2060: 'WORD JOINER', 0xFEFF: 'ZERO WIDTH NO-BREAK SPACE (BOM)', 0xFFFD: 'REPLACEMENT CHARACTER'
}

function uc_cpHex(cp) { return 'U+' + cp.toString(16).toUpperCase().padStart(4, '0') }

// UTF-8 bytes of a code point, as spaced uppercase hex ("F0 9F 91 8D").
function uc_utf8Hex(cp) {
  const b = []
  if (cp <= 0x7F) b.push(cp)
  else if (cp <= 0x7FF) b.push(0xC0 | (cp >> 6), 0x80 | (cp & 0x3F))
  else if (cp <= 0xFFFF) b.push(0xE0 | (cp >> 12), 0x80 | ((cp >> 6) & 0x3F), 0x80 | (cp & 0x3F))
  else b.push(0xF0 | (cp >> 18), 0x80 | ((cp >> 12) & 0x3F), 0x80 | ((cp >> 6) & 0x3F), 0x80 | (cp & 0x3F))
  return b.map(x => x.toString(16).toUpperCase().padStart(2, '0')).join(' ')
}

// Category label + hidden flag for a single code-point string. `hidden` marks invisible/control/bidi
// characters (and NBSP/soft-hyphen/BOM) that look like nothing or plain space but aren't.
function uc_classify(ch) {
  const cp = ch.codePointAt(0)
  if (UC_NAMES[cp] != null) return { label: UC_NAMES[cp], hidden: cp !== 0x20 }
  try {
    if (/\p{Cf}/u.test(ch)) return { label: 'Format (invisible)', hidden: true }
    if (/\p{Cc}/u.test(ch)) return { label: 'Control', hidden: true }
    if (cp >= 0x1F3FB && cp <= 0x1F3FF) return { label: 'Emoji skin-tone modifier', hidden: false }
    if (/\p{Extended_Pictographic}/u.test(ch)) return { label: 'Emoji', hidden: false }
    if (/\p{M}/u.test(ch)) return { label: 'Combining mark', hidden: false }
    if (/\p{Zs}/u.test(ch)) return { label: 'Space', hidden: true }
    if (/\p{L}/u.test(ch)) return { label: 'Letter', hidden: false }
    if (/\p{N}/u.test(ch)) return { label: 'Number', hidden: false }
    if (/\p{P}/u.test(ch)) return { label: 'Punctuation', hidden: false }
    if (/\p{S}/u.test(ch)) return { label: 'Symbol', hidden: false }
    if (/\p{Co}/u.test(ch)) return { label: 'Private use', hidden: false }
  } catch (e) { /* engine without \p support — fall through */ }
  return { label: 'Other', hidden: false }
}

// ---- Wiring ----
;(function initUnicodeTool() {
  const input = document.getElementById('uc-input')
  if (!input) return // Unicode tab not present in this build

  const summaryEl = document.getElementById('uc-summary')
  const outputEl = document.getElementById('uc-output')
  const hintEl = document.getElementById('uc-hint')
  const MAX = 1000

  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') }

  function render() {
    const str = input.value
    if (str === '') { hintEl.hidden = false; summaryEl.hidden = true; outputEl.innerHTML = ''; return }
    hintEl.hidden = true

    const cps = Array.from(str) // splits by code point (surrogate pairs handled)
    let bytes = 0, hidden = 0, rows = ''
    const shown = cps.slice(0, MAX)
    for (let i = 0; i < shown.length; i++) {
      const ch = shown[i]
      const cp = ch.codePointAt(0)
      const cls = uc_classify(ch)
      const hex = uc_utf8Hex(cp)
      bytes += hex.split(' ').length
      if (cls.hidden) hidden++
      const disp = (cls.hidden || /\s/u.test(ch)) ? '␣' : esc(ch)
      rows += '<tr' + (cls.hidden ? ' class="uc-hidden"' : '') + '><td class="uc-glyph">' + disp + '</td>' +
        '<td class="uc-mono">' + uc_cpHex(cp) + '</td><td>' + esc(cls.label) + '</td>' +
        '<td class="uc-mono">' + hex + '</td><td class="uc-flag">' + (cls.hidden ? '⚠' : '') + '</td></tr>'
    }
    // full-string byte total (not just the shown slice)
    let totalBytes = bytes
    if (cps.length > MAX) for (let i = MAX; i < cps.length; i++) totalBytes += uc_utf8Hex(cps[i].codePointAt(0)).split(' ').length

    let graphemes = null
    if (typeof Intl !== 'undefined' && Intl.Segmenter) {
      try { graphemes = 0; const seg = new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(str); for (const _ of seg) graphemes++ } catch (e) { graphemes = null }
    }
    summaryEl.innerHTML = '<b>' + cps.length + '</b> code points · <b>' + str.length + '</b> UTF-16 · <b>' + totalBytes + '</b> bytes' +
      (graphemes != null ? ' · <b>' + graphemes + '</b> graphemes' : '') +
      (hidden ? ' · <b class="uc-warn">' + hidden + '</b> hidden ⚠' : '')
    summaryEl.hidden = false

    outputEl.innerHTML = '<table class="uc-table"><thead><tr><th>Char</th><th>Code point</th><th>Category</th><th>UTF-8</th><th></th></tr></thead><tbody>' +
      rows + '</tbody></table>' + (cps.length > MAX ? '<p class="uc-more">Showing first ' + MAX + ' of ' + cps.length + ' code points.</p>' : '')
  }

  input.addEventListener('input', render)
  document.getElementById('uc-reset-btn').addEventListener('click', () => { input.value = ''; render() })
  render()
})()
