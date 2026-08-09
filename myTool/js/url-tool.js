// ---- URL Tool: break a URL into its parts (protocol, host, port, path, query, fragment) and list
// its query parameters decoded, each copyable — for inspecting API calls and links. Uses the built-in
// URL API for the split; the query-string parser above the wiring marker is pure and unit-tested.

function up_decode(s) {
  try { return decodeURIComponent(String(s).replace(/\+/g, ' ')) } catch (e) { return String(s) }
}

// Parse a "?a=1&b=2" search string into [{name, value}] with both sides percent-decoded. A key with
// no "=" gets an empty value; a malformed %-escape is left as-is rather than throwing.
function up_parseQuery(search) {
  let s = String(search || '')
  if (s[0] === '?') s = s.slice(1)
  if (s === '') return []
  return s.split('&').filter(p => p !== '').map(pair => {
    const i = pair.indexOf('=')
    return i < 0
      ? { name: up_decode(pair), value: '' }
      : { name: up_decode(pair.slice(0, i)), value: up_decode(pair.slice(i + 1)) }
  })
}

// ---- Wiring ----
;(function initUrlTool() {
  const input = document.getElementById('ur-input')
  if (!input) return // URL tab not present in this build

  const errorEl = document.getElementById('ur-error')
  const hintEl = document.getElementById('ur-hint')
  const outputEl = document.getElementById('ur-output')

  const COPY_ICON = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>'
  const CHECK_ICON = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>'

  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;') }
  function fieldRow(label, value, copyValue) {
    const v = esc(value)
    const copy = esc(copyValue == null ? value : copyValue)
    return `<div class="pf-field"><div class="pf-field-label">${esc(label)}</div>
      <div class="pf-field-value-wrap"><input type="text" class="pf-field-value" readonly value="${v}">
      <button type="button" class="tt-copy-icon-btn pf-copy-btn" data-copy="${copy}" title="Copy" aria-label="Copy">${COPY_ICON}</button></div></div>`
  }

  function render() {
    const raw = input.value.trim()
    errorEl.hidden = true
    outputEl.innerHTML = ''
    if (raw === '') { hintEl.hidden = false; return }
    hintEl.hidden = true

    let u = null
    try { u = new URL(raw) } catch (e) { /* try the scheme-less fallback below */ }
    // Only assume https:// when the input has no scheme at all — don't "fix" a malformed one like http://
    if (!u && !/^[a-z][a-z0-9+.-]*:/i.test(raw)) { try { u = new URL('https://' + raw) } catch (e2) { /* still invalid */ } }
    if (!u) { errorEl.textContent = 'Not a valid URL.'; errorEl.hidden = false; return }

    const comps = [
      ['Protocol', u.protocol.replace(/:$/, '')],
      ['Host', u.hostname],
      ['Port', u.port || '(default)'],
      ['Path', u.pathname || '/'],
      ['Query', u.search || '(none)'],
      ['Fragment', u.hash ? u.hash.slice(1) : '(none)']
    ]
    let html = '<h3 class="pf-section-header">Components</h3>' + comps.map(c => fieldRow(c[0], c[1])).join('')

    const params = up_parseQuery(u.search)
    if (params.length) {
      html += '<h3 class="pf-section-header">Query parameters <span class="ur-count">' + params.length + '</span></h3>'
      html += params.map(p => fieldRow(p.name, p.value)).join('')
    }
    outputEl.innerHTML = html
  }

  outputEl.addEventListener('click', e => {
    const btn = e.target.closest('.pf-copy-btn')
    if (!btn) return
    navigator.clipboard.writeText(btn.dataset.copy).then(() => {
      btn.innerHTML = CHECK_ICON; btn.classList.add('copied')
      setTimeout(() => { btn.innerHTML = COPY_ICON; btn.classList.remove('copied') }, 1200)
    })
  })

  input.addEventListener('input', render)
  document.getElementById('ur-reset-btn').addEventListener('click', () => { input.value = ''; render() })
  render()
})()
