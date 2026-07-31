// ---- Timestamp Tool: converts between Unix epoch and human-readable dates (ISO 8601, UTC, local)
// and shows a relative "x ago / in x" note. Pure parsing/formatting is unit-tested; the wiring uses
// Date for the live "now". Nothing above the wiring marker touches the DOM.

// Numeric input -> milliseconds. Up to 11 digits is treated as seconds, longer as milliseconds.
function ts_detectEpoch(str) {
  const s = String(str).trim()
  if (!/^\d+$/.test(s)) return null
  return s.length <= 11 ? Number(s) * 1000 : Number(s)
}

function ts_parse(str) {
  const s = String(str).trim()
  if (s === '') return { error: 'empty' }
  const epoch = ts_detectEpoch(s)
  if (epoch !== null) return { ms: epoch }
  const parsed = Date.parse(s)
  if (isNaN(parsed)) return { error: 'Unrecognized date/time — try an epoch or an ISO date.' }
  return { ms: parsed }
}

function ts_isoFromMs(ms) {
  return new Date(ms).toISOString()
}

// Relative phrase for `ms` compared to `nowMs`: "3 hours ago", "in 2 days", or "just now".
function ts_relative(ms, nowMs) {
  const diff = ms - nowMs
  const abs = Math.abs(diff)
  if (abs < 1000) return 'just now'
  const units = [['year', 31536000000], ['day', 86400000], ['hour', 3600000], ['minute', 60000], ['second', 1000]]
  for (const [name, size] of units) {
    if (abs >= size) {
      const v = Math.round(abs / size)
      const label = `${v} ${name}${v !== 1 ? 's' : ''}`
      return diff >= 0 ? `in ${label}` : `${label} ago`
    }
  }
  return 'just now'
}

// ---- Wiring ----
;(function initTimestampTool() {
  const input = document.getElementById('ts-input')
  if (!input) return

  const nowBtn = document.getElementById('ts-now')
  const errorEl = document.getElementById('ts-error')
  const fieldsEl = document.getElementById('ts-fields')

  const COPY_ICON = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>'
  const CHECK_ICON = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>'

  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;') }
  function fieldRow(label, value) {
    const v = esc(value)
    return `<div class="pf-field"><div class="pf-field-label">${label}</div>
      <div class="pf-field-value-wrap"><input type="text" class="pf-field-value" readonly value="${v}">
      <button type="button" class="tt-copy-icon-btn pf-copy-btn" data-copy="${v}" title="Copy" aria-label="Copy">${COPY_ICON}</button></div></div>`
  }

  function render() {
    errorEl.hidden = true
    const raw = input.value.trim()
    const res = ts_parse(raw === '' ? String(Date.now()) : raw)
    if (res.error && res.error !== 'empty') { errorEl.textContent = res.error; errorEl.hidden = false; fieldsEl.innerHTML = ''; return }
    const ms = res.ms
    const d = new Date(ms)
    fieldsEl.innerHTML = [
      fieldRow('Unix (seconds)', Math.floor(ms / 1000)),
      fieldRow('Unix (millis)', ms),
      fieldRow('ISO 8601 (UTC)', ts_isoFromMs(ms)),
      fieldRow('UTC', d.toUTCString()),
      fieldRow('Local', d.toString()),
      fieldRow('Relative', ts_relative(ms, Date.now()))
    ].join('')
  }

  fieldsEl.addEventListener('click', e => {
    const btn = e.target.closest('.pf-copy-btn')
    if (!btn) return
    navigator.clipboard.writeText(btn.dataset.copy).then(() => {
      btn.innerHTML = CHECK_ICON; btn.classList.add('copied')
      setTimeout(() => { btn.innerHTML = COPY_ICON; btn.classList.remove('copied') }, 1200)
    })
  })

  input.addEventListener('input', render)
  nowBtn.addEventListener('click', () => { input.value = ''; render() })
  document.getElementById('ts-reset-btn').addEventListener('click', () => { input.value = ''; render() })

  render()
})()
