// ---- Icons Tool: paste icons anywhere. Two modes:
//   • Symbols — emoji + Unicode glyphs, click to copy the CHARACTER (pastes into any text field).
//   • SVG icons — the vendored Lucide set (js/vendor/lucide-icons.js, lazy-loaded), copy as SVG, PNG
//     (to the clipboard as an image) or a data-URI, with adjustable size / stroke / colour.
// Everything above the wiring marker is pure and unit-tested; it never touches the DOM or globals
// that only exist in the browser (the SVG string builders take their data as arguments).

// Wrap Lucide inner-SVG geometry into a full <svg> with the chosen size, stroke and colour.
function ic_svg(inner, opts) {
  var o = opts || {}
  var size = o.size || 24
  var color = o.color || 'currentColor'
  var stroke = o.stroke == null ? 2 : o.stroke
  return '<svg xmlns="http://www.w3.org/2000/svg" width="' + size + '" height="' + size +
    '" viewBox="0 0 24 24" fill="none" stroke="' + color + '" stroke-width="' + stroke +
    '" stroke-linecap="round" stroke-linejoin="round">' + inner + '</svg>'
}

// A data-URI for an SVG string (handy for CSS background: url(...)).
function ic_dataUri(svg) {
  return 'data:image/svg+xml,' + encodeURIComponent(svg)
}

// Filter icon names by a query, matched against the name (hyphens treated as spaces) and its tags.
// Every whitespace-separated word must be present. Returns at most `limit` names.
function ic_search(names, tags, query, limit) {
  var q = String(query || '').trim().toLowerCase()
  var cap = limit || names.length
  if (!q) return names.slice(0, cap)
  var words = q.split(/\s+/)
  var out = []
  for (var i = 0; i < names.length; i++) {
    var n = names[i]
    var hay = n.replace(/-/g, ' ') + ' ' + (tags[n] || '')
    var ok = true
    for (var w = 0; w < words.length; w++) { if (hay.indexOf(words[w]) < 0) { ok = false; break } }
    if (ok) { out.push(n); if (out.length >= cap) break }
  }
  return out
}

// Filter the symbol groups by a query (matched against each item's keywords + the glyph itself);
// returns only groups that still have matches.
function ic_filterSymbols(groups, query) {
  var q = String(query || '').trim().toLowerCase()
  var out = []
  for (var i = 0; i < groups.length; i++) {
    var g = groups[i]
    var items = q ? g.items.filter(function (it) { return (it[1] + ' ' + it[0]).toLowerCase().indexOf(q) >= 0 }) : g.items
    if (items.length) out.push({ name: g.name, items: items })
  }
  return out
}

// Icon names belonging to a Lucide category ('all' = every name). `cats` maps name -> [category…].
function ic_iconsInCategory(cats, names, category) {
  if (!category || category === 'all') return names.slice()
  var out = []
  for (var i = 0; i < names.length; i++) {
    var cs = cats[names[i]]
    if (cs && cs.indexOf(category) >= 0) out.push(names[i])
  }
  return out
}

// The distinct categories with their icon counts, alphabetically. Uses for-in (no Object.keys) so it
// runs in the unit-test sandbox too; caller passes the icon names.
function ic_categoryList(cats, names) {
  var counts = {}
  for (var i = 0; i < names.length; i++) {
    var cs = cats[names[i]] || []
    for (var j = 0; j < cs.length; j++) counts[cs[j]] = (counts[cs[j]] || 0) + 1
  }
  var out = []
  for (var k in counts) out.push({ name: k, count: counts[k] })
  out.sort(function (a, b) { return a.name < b.name ? -1 : a.name > b.name ? 1 : 0 })
  return out
}

// Curated emoji + Unicode symbols. Each item is [character, keywords]. Copying yields the character,
// which pastes as text anywhere.
var IC_SYMBOLS = [
  { name: 'Arrows', items: [
    ['←', 'arrow left'], ['→', 'arrow right'], ['↑', 'arrow up'], ['↓', 'arrow down'],
    ['↔', 'arrow left right horizontal'], ['↕', 'arrow up down vertical'],
    ['⇐', 'double arrow left'], ['⇒', 'double arrow right implies'], ['⇑', 'double arrow up'], ['⇓', 'double arrow down'],
    ['⇄', 'arrows swap exchange'], ['⇆', 'arrows swap exchange'], ['↩', 'return arrow'], ['↪', 'forward arrow'],
    ['➜', 'arrow'], ['➤', 'arrow triangle'], ['▶', 'play triangle right'], ['◀', 'triangle left'],
    ['▲', 'triangle up'], ['▼', 'triangle down'], ['»', 'chevron right guillemet'], ['«', 'chevron left guillemet'], ['↻', 'refresh rotate reload']
  ] },
  { name: 'Ticks & crosses', items: [
    ['✓', 'check tick'], ['✔', 'check tick bold'], ['✗', 'cross x'], ['✘', 'cross x bold'],
    ['☑', 'checkbox checked'], ['☐', 'checkbox empty'], ['☒', 'checkbox x'], ['✕', 'multiply cross'], ['✖', 'multiply cross heavy']
  ] },
  { name: 'Stars, bullets & shapes', items: [
    ['★', 'star filled'], ['☆', 'star empty'], ['✦', 'star sparkle'], ['✧', 'star sparkle outline'],
    ['●', 'circle filled dot'], ['○', 'circle empty'], ['•', 'bullet dot'], ['◦', 'bullet white'],
    ['▪', 'small square filled'], ['▫', 'small square empty'], ['‣', 'triangle bullet'], ['⁃', 'hyphen bullet'],
    ['■', 'square filled'], ['□', 'square empty'], ['◆', 'diamond filled'], ['◇', 'diamond empty'], ['▶', 'triangle']
  ] },
  { name: 'Math', items: [
    ['＋', 'plus'], ['−', 'minus'], ['×', 'multiply times'], ['÷', 'divide'], ['±', 'plus minus'],
    ['≈', 'approximately equal'], ['≠', 'not equal'], ['≤', 'less than or equal'], ['≥', 'greater than or equal'],
    ['<', 'less than'], ['>', 'greater than'], ['∞', 'infinity'], ['√', 'square root'], ['∑', 'sum sigma'],
    ['∏', 'product'], ['∆', 'delta change'], ['π', 'pi'], ['°', 'degree'], ['′', 'prime minute'], ['″', 'double prime second'],
    ['‰', 'per mille'], ['%', 'percent'], ['∅', 'empty set null']
  ] },
  { name: 'Currency', items: [
    ['$', 'dollar'], ['€', 'euro'], ['£', 'pound sterling'], ['¥', 'yen yuan'], ['₫', 'dong vietnam'],
    ['₩', 'won'], ['₽', 'ruble'], ['₹', 'rupee'], ['₿', 'bitcoin'], ['¢', 'cent'], ['₺', 'lira'], ['₦', 'naira']
  ] },
  { name: 'Punctuation', items: [
    ['…', 'ellipsis dots'], ['–', 'en dash'], ['—', 'em dash'], ['·', 'middle dot'], ['§', 'section'],
    ['¶', 'paragraph pilcrow'], ['†', 'dagger'], ['‡', 'double dagger'], ['“', 'left double quote'], ['”', 'right double quote'],
    ['‘', 'left single quote'], ['’', 'right single quote apostrophe'], ['«', 'guillemet left'], ['»', 'guillemet right'],
    ['¿', 'inverted question'], ['¡', 'inverted exclamation'], ['※', 'reference mark']
  ] },
  { name: 'Symbols', items: [
    ['©', 'copyright'], ['®', 'registered'], ['™', 'trademark'], ['✉', 'email envelope'], ['☎', 'phone telephone'],
    ['✂', 'scissors cut'], ['✎', 'pencil write'], ['⚙', 'gear settings'], ['⚠', 'warning caution'], ['⚡', 'lightning bolt power'],
    ['☀', 'sun sunny'], ['☁', 'cloud'], ['☂', 'umbrella'], ['❄', 'snowflake'], ['♻', 'recycle'], ['♥', 'heart love'],
    ['♦', 'diamond'], ['♠', 'spade'], ['♣', 'club'], ['♪', 'music note'], ['♫', 'music notes'], ['☯', 'yin yang'],
    ['⌘', 'command mac cmd'], ['⌥', 'option alt mac'], ['⇧', 'shift'], ['⏎', 'enter return'], ['⌫', 'backspace delete'],
    ['⏳', 'hourglass loading'], ['⏰', 'alarm clock'], ['✈', 'plane travel']
  ] },
  { name: 'Emoji — faces', items: [
    ['😀', 'grin happy smile'], ['😃', 'smile happy'], ['😄', 'laugh happy'], ['😁', 'grin beam'], ['😆', 'laugh'],
    ['😅', 'sweat laugh nervous'], ['😂', 'joy laugh cry'], ['🤣', 'rofl rolling'], ['😊', 'blush smile'], ['🙂', 'slight smile'],
    ['😉', 'wink'], ['😍', 'heart eyes love'], ['😘', 'kiss'], ['😜', 'tongue wink'], ['🤔', 'thinking hmm'],
    ['😐', 'neutral'], ['😴', 'sleep tired'], ['😢', 'cry sad'], ['😭', 'sob cry'], ['😡', 'angry mad'],
    ['😎', 'cool sunglasses'], ['🥳', 'party celebrate'], ['😱', 'scream shock'], ['🤯', 'mind blown'], ['🙃', 'upside down']
  ] },
  { name: 'Emoji — gestures', items: [
    ['👍', 'thumbs up like ok'], ['👎', 'thumbs down dislike'], ['👏', 'clap applause'], ['🙏', 'pray thanks please'],
    ['💪', 'muscle strong'], ['🙌', 'raise hands celebrate'], ['👋', 'wave hello hi bye'], ['🤝', 'handshake deal'],
    ['✌️', 'peace victory'], ['👌', 'ok perfect'], ['🤟', 'love you'], ['👉', 'point right'], ['👈', 'point left'], ['☝️', 'point up']
  ] },
  { name: 'Emoji — objects & status', items: [
    ['🔥', 'fire hot lit'], ['⭐', 'star'], ['✨', 'sparkles shiny new'], ['🎉', 'party tada celebrate'], ['🎊', 'confetti'],
    ['✅', 'check done green'], ['❌', 'cross no wrong'], ['⚠️', 'warning'], ['❓', 'question'], ['❗', 'exclamation important'],
    ['💯', 'hundred perfect'], ['💡', 'idea bulb'], ['📌', 'pin'], ['📎', 'paperclip attach'], ['🔒', 'lock secure'],
    ['🔓', 'unlock'], ['🔔', 'bell notify'], ['🎯', 'target goal'], ['🐛', 'bug'], ['🧪', 'test tube experiment'],
    ['⚙️', 'gear settings'], ['📁', 'folder'], ['📄', 'file document'], ['🖼️', 'image picture'], ['🎨', 'art design palette'],
    ['🌐', 'globe web internet'], ['💻', 'laptop computer'], ['📱', 'phone mobile'], ['💰', 'money bag'], ['🛒', 'cart shopping'],
    ['🚀', 'rocket launch ship'], ['⏱️', 'stopwatch timer'], ['📅', 'calendar date'], ['📈', 'chart up growth'], ['📉', 'chart down']
  ] }
]

// ---- Wiring ----
;(function initIconsTool() {
  const root = document.getElementById('tab-icons')
  if (!root) return // Icons tab not present in this build

  const modeSeg = document.getElementById('ic-mode')
  const searchEl = document.getElementById('ic-search')
  const symWrap = document.getElementById('ic-symbols')
  const ctrlsEl = document.getElementById('ic-icon-ctrls')
  const gridEl = document.getElementById('ic-grid')
  const catSel = document.getElementById('ic-category')
  const fmtSeg = document.getElementById('ic-format')
  const sizeSeg = document.getElementById('ic-size')
  const strokeSeg = document.getElementById('ic-stroke')
  const colorEl = document.getElementById('ic-color')
  const countEl = document.getElementById('ic-count')
  const toastEl = document.getElementById('ic-toast')
  const MAX = 300

  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;') }
  function segVal(seg) { const b = seg.querySelector('.seg-btn.active'); return b ? b.dataset.value : '' }
  function mode() { return segVal(modeSeg) || 'symbols' }

  let toastTimer = null
  function toast(msg) {
    toastEl.textContent = msg
    toastEl.classList.add('show')
    clearTimeout(toastTimer)
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), 1100)
  }
  function copyText(text, label) { navigator.clipboard.writeText(text).then(() => toast(label)) }

  // ---- Symbols ----
  function renderSymbols() {
    const groups = ic_filterSymbols(IC_SYMBOLS, searchEl.value)
    if (!groups.length) { symWrap.innerHTML = '<p class="ic-empty">No matching symbols.</p>'; return }
    symWrap.innerHTML = groups.map(g =>
      '<div class="ic-group">' + esc(g.name) + '</div><div class="ic-sym-grid">' +
      g.items.map(it => '<button type="button" class="ic-sym" data-char="' + esc(it[0]) + '" title="' + esc(it[1]) + '">' + esc(it[0]) + '</button>').join('') +
      '</div>'
    ).join('')
  }

  // ---- SVG icons (Lucide, lazy-loaded) ----
  let libReady = false
  let savedCat = 'all'
  function ensureLib() {
    return window.loadScriptOnce('js/vendor/lucide-icons.js').then(() => { libReady = true })
  }
  function iconOpts() { return { size: +segVal(sizeSeg) || 24, stroke: +segVal(strokeSeg) || 2, color: colorEl.value } }

  function cap(s) { s = String(s).replace(/-/g, ' '); return s.charAt(0).toUpperCase() + s.slice(1) }
  function populateCats() {
    if (catSel.dataset.filled) return
    const list = ic_categoryList(window.LUCIDE_CATS, Object.keys(window.LUCIDE_CATS))
    catSel.innerHTML = '<option value="all">All categories</option>' +
      list.map(c => '<option value="' + c.name + '">' + cap(c.name) + ' (' + c.count + ')</option>').join('')
    catSel.dataset.filled = '1'
    if (savedCat !== 'all' && [...catSel.options].some(o => o.value === savedCat)) catSel.value = savedCat
  }

  function renderIcons() {
    if (!libReady) { gridEl.innerHTML = '<p class="ic-empty">Loading icons…</p>'; ensureLib().then(renderIcons); return }
    populateCats()
    const base = ic_iconsInCategory(window.LUCIDE_CATS, Object.keys(window.LUCIDE_ICONS), catSel.value || 'all')
    const matched = ic_search(base, window.LUCIDE_TAGS, searchEl.value, MAX + 1)
    const shown = matched.slice(0, MAX)
    const o = iconOpts()
    gridEl.innerHTML = shown.length
      ? shown.map(n => '<button type="button" class="ic-icon" data-name="' + n + '" title="' + esc(n) + '">' +
          ic_svg(window.LUCIDE_ICONS[n], { size: 24, stroke: o.stroke, color: o.color }) + '</button>').join('')
      : '<p class="ic-empty">No matching icons.</p>'
    countEl.textContent = matched.length > MAX ? ('Showing first ' + MAX + ' — refine your search') : (shown.length + ' icon' + (shown.length === 1 ? '' : 's'))
  }

  function svgToPng(svg, size) {
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => {
        const s = Math.max(size, 16)
        const c = document.createElement('canvas'); c.width = s; c.height = s
        c.getContext('2d').drawImage(img, 0, 0, s, s)
        c.toBlob(b => b ? resolve(b) : reject(new Error('toBlob failed')), 'image/png')
      }
      img.onerror = reject
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)
    })
  }

  async function copyIcon(name) {
    const o = iconOpts()
    const svg = ic_svg(window.LUCIDE_ICONS[name], o)
    const fmt = segVal(fmtSeg) || 'svg'
    if (fmt === 'svg') { copyText(svg, 'SVG copied'); return }
    if (fmt === 'uri') { copyText(ic_dataUri(svg), 'Data-URI copied'); return }
    try {
      const blob = await svgToPng(svg, o.size)
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
      toast('PNG copied')
    } catch (e) { toast('PNG copy not supported here') }
  }

  // ---- Mode / controls ----
  function applyMode(m) {
    modeSeg.querySelectorAll('.seg-btn').forEach(b => b.classList.toggle('active', b.dataset.value === m))
    const sym = m === 'symbols'
    symWrap.hidden = !sym
    ctrlsEl.hidden = sym
    gridEl.hidden = sym
    searchEl.placeholder = sym ? 'Search symbols…' : 'Search 1,700+ icons…'
    if (sym) renderSymbols(); else renderIcons()
  }

  const CTRL_KEY = 'icons-ctrls'
  function saveCtrls() { syncSet({ [CTRL_KEY]: { size: segVal(sizeSeg), stroke: segVal(strokeSeg), color: colorEl.value, fmt: segVal(fmtSeg), cat: catSel.value } }) }
  function setSeg(seg, val) { seg.querySelectorAll('.seg-btn').forEach(b => b.classList.toggle('active', b.dataset.value === String(val))) }

  modeSeg.addEventListener('click', e => {
    const b = e.target.closest('.seg-btn'); if (!b) return
    applyMode(b.dataset.value); syncSet({ 'icons-mode': b.dataset.value })
  })
  searchEl.addEventListener('input', () => { mode() === 'symbols' ? renderSymbols() : renderIcons() })
  ;[sizeSeg, strokeSeg].forEach(seg => seg.addEventListener('click', e => {
    const b = e.target.closest('.seg-btn'); if (!b) return
    setSeg(seg, b.dataset.value); renderIcons(); saveCtrls()
  }))
  fmtSeg.addEventListener('click', e => { const b = e.target.closest('.seg-btn'); if (!b) return; setSeg(fmtSeg, b.dataset.value); saveCtrls() })
  colorEl.addEventListener('input', () => { renderIcons(); saveCtrls() })
  catSel.addEventListener('change', () => { savedCat = catSel.value; renderIcons(); saveCtrls() })

  symWrap.addEventListener('click', e => {
    const b = e.target.closest('.ic-sym'); if (!b) return
    copyText(b.dataset.char, 'Copied  ' + b.dataset.char)
  })
  gridEl.addEventListener('click', e => {
    const b = e.target.closest('.ic-icon'); if (!b) return
    copyIcon(b.dataset.name)
  })

  document.getElementById('ic-reset-btn').addEventListener('click', () => {
    searchEl.value = ''
    setSeg(sizeSeg, 24); setSeg(strokeSeg, 2); setSeg(fmtSeg, 'svg')
    colorEl.value = defaultColor()
    savedCat = 'all'; if (catSel.dataset.filled) catSel.value = 'all'
    saveCtrls(); applyMode('symbols'); syncSet({ 'icons-mode': 'symbols' })
  })

  // Lazy-render icons the first time the tab is shown in icons mode (library loads on demand).
  document.addEventListener('tool-shown', e => { if (e.detail === 'icons' && mode() === 'icons') renderIcons() })

  function defaultColor() {
    const c = getComputedStyle(document.documentElement).getPropertyValue('--text').trim()
    return /^#[0-9a-f]{6}$/i.test(c) ? c : '#111827'
  }

  // Init: default to Symbols; restore saved mode + controls.
  colorEl.value = defaultColor()
  applyMode('symbols')
  syncGet(['icons-mode', CTRL_KEY]).then(d => {
    const c = d[CTRL_KEY]
    if (c) { if (c.size) setSeg(sizeSeg, c.size); if (c.stroke) setSeg(strokeSeg, c.stroke); if (c.fmt) setSeg(fmtSeg, c.fmt); if (c.color) colorEl.value = c.color; if (c.cat) savedCat = c.cat }
    const m = d['icons-mode']
    if (m && m !== 'symbols') applyMode(m); else if (c) { /* controls updated; nothing to re-render in symbols mode */ }
  })
})()
