// ---- Base Tool: converts an integer between decimal, hex, binary, and octal. Uses BigInt so
// arbitrarily large values stay exact. Pure and unit-tested; nothing above the wiring marker
// touches the DOM.

function bn_parse(value, base) {
  let s = String(value).trim().toLowerCase()
  if (s === '') throw new Error('empty')
  let neg = false
  if (s[0] === '-') { neg = true; s = s.slice(1) }
  else if (s[0] === '+') s = s.slice(1)
  const prefix = { 16: '0x', 2: '0b', 8: '0o' }[base]
  if (prefix && s.startsWith(prefix)) s = s.slice(2)
  if (s === '') throw new Error('empty')
  const digits = '0123456789abcdefghijklmnopqrstuvwxyz'.slice(0, base)
  const B = BigInt(base)
  let acc = 0n
  for (const ch of s) {
    const d = digits.indexOf(ch)
    if (d < 0) throw new Error(`Invalid digit "${ch}" for base ${base}.`)
    acc = acc * B + BigInt(d)
  }
  return neg ? -acc : acc
}

function bn_outputs(bigint) {
  const neg = bigint < 0n
  const abs = neg ? -bigint : bigint
  const sign = neg ? '-' : ''
  return {
    dec: sign + abs.toString(10),
    hex: sign + abs.toString(16).toUpperCase(),
    bin: sign + abs.toString(2),
    oct: sign + abs.toString(8)
  }
}

function bn_convert(value, base) {
  try {
    return { outputs: bn_outputs(bn_parse(value, base)) }
  } catch (e) {
    return { error: e.message === 'empty' ? 'empty' : e.message }
  }
}

// ---- Wiring ----
;(function initBaseTool() {
  const input = document.getElementById('bn-input')
  if (!input) return

  const baseSeg = document.querySelector('.segmented[data-group="bn-base"]')
  const errorEl = document.getElementById('bn-error')
  const fieldsEl = document.getElementById('bn-fields')

  const COPY_ICON = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>'
  const CHECK_ICON = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>'
  const BASE_MAP = { DEC: 10, HEX: 16, BIN: 2, OCT: 8 }

  function setSegmented(seg, value) {
    seg.querySelectorAll('.seg-btn').forEach(b => b.classList.toggle('active', b.dataset.value === value))
  }
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;') }
  function fieldRow(label, value) {
    const v = esc(value)
    return `<div class="pf-field"><div class="pf-field-label">${label}</div>
      <div class="pf-field-value-wrap"><input type="text" class="pf-field-value" readonly value="${v}">
      <button type="button" class="tt-copy-icon-btn pf-copy-btn" data-copy="${v}" title="Copy" aria-label="Copy">${COPY_ICON}</button></div></div>`
  }

  function render() {
    const raw = input.value.trim()
    if (raw === '') { errorEl.hidden = true; fieldsEl.innerHTML = ''; return }
    const base = BASE_MAP[baseSeg.querySelector('.seg-btn.active').dataset.value]
    const res = bn_convert(raw, base)
    if (res.error) { errorEl.textContent = res.error === 'empty' ? '' : res.error; errorEl.hidden = res.error === 'empty'; fieldsEl.innerHTML = ''; return }
    errorEl.hidden = true
    fieldsEl.innerHTML = [
      fieldRow('Decimal', res.outputs.dec),
      fieldRow('Hex', res.outputs.hex),
      fieldRow('Binary', res.outputs.bin),
      fieldRow('Octal', res.outputs.oct)
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
  baseSeg.addEventListener('click', e => {
    const btn = e.target.closest('.seg-btn')
    if (!btn) return
    setSegmented(baseSeg, btn.dataset.value)
    render()
  })
  document.getElementById('bn-reset-btn').addEventListener('click', () => {
    input.value = ''
    setSegmented(baseSeg, 'DEC')
    render()
  })
})()
