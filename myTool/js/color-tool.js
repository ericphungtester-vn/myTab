// ---- Color Tool: converts a color between HEX, RGB, and HSL and shows a swatch. Pure conversion
// math is unit-tested; nothing above the wiring marker touches the DOM.

function cl_parse(str) {
  const s = String(str).trim().toLowerCase()
  let m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/.exec(s)
  if (m) {
    let h = m[1]
    if (h.length === 3) h = h.split('').map(c => c + c).join('')
    return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16) }
  }
  m = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/.exec(s)
  if (m) {
    const r = +m[1], g = +m[2], b = +m[3]
    if (r <= 255 && g <= 255 && b <= 255) return { r, g, b }
    return null
  }
  m = /^hsla?\(\s*(\d+)\s*,\s*(\d+)%?\s*,\s*(\d+)%?/.exec(s)
  if (m) return cl_hslToRgb(+m[1], +m[2], +m[3])
  return null
}

function cl_rgbToHex(r, g, b) {
  return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('').toUpperCase()
}

function cl_rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  let h, s
  const l = (max + min) / 2
  if (max === min) {
    h = s = 0
  } else {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break
      case g: h = (b - r) / d + 2; break
      default: h = (r - g) / d + 4
    }
    h /= 6
  }
  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) }
}

function cl_hslToRgb(h, s, l) {
  h /= 360; s /= 100; l /= 100
  let r, g, b
  if (s === 0) {
    r = g = b = l
  } else {
    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1
      if (t > 1) t -= 1
      if (t < 1 / 6) return p + (q - p) * 6 * t
      if (t < 1 / 2) return q
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
      return p
    }
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s
    const p = 2 * l - q
    r = hue2rgb(p, q, h + 1 / 3)
    g = hue2rgb(p, q, h)
    b = hue2rgb(p, q, h - 1 / 3)
  }
  return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255) }
}

function cl_formats(rgb) {
  const hsl = cl_rgbToHsl(rgb.r, rgb.g, rgb.b)
  return {
    hex: cl_rgbToHex(rgb.r, rgb.g, rgb.b),
    rgb: `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`,
    hsl: `hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)`
  }
}

// ---- Wiring ----
;(function initColorTool() {
  const input = document.getElementById('cl-input')
  if (!input) return

  const picker = document.getElementById('cl-picker')
  const errorEl = document.getElementById('cl-error')
  const fieldsEl = document.getElementById('cl-fields')

  const COPY_ICON = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>'
  const CHECK_ICON = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>'

  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;') }
  function fieldRow(label, value) {
    const v = esc(value)
    return `<div class="pf-field"><div class="pf-field-label">${label}</div>
      <div class="pf-field-value-wrap"><input type="text" class="pf-field-value" readonly value="${v}">
      <button type="button" class="tt-copy-icon-btn pf-copy-btn" data-copy="${v}" title="Copy" aria-label="Copy">${COPY_ICON}</button></div></div>`
  }

  function renderFromRgb(rgb) {
    errorEl.hidden = true
    const f = cl_formats(rgb)
    picker.value = f.hex.toLowerCase()
    fieldsEl.innerHTML = [fieldRow('HEX', f.hex), fieldRow('RGB', f.rgb), fieldRow('HSL', f.hsl)].join('')
  }

  function render() {
    const rgb = cl_parse(input.value)
    if (!rgb) {
      if (input.value.trim() === '') { errorEl.hidden = true } else { errorEl.textContent = 'Unrecognized color — try #hex, rgb(...), or hsl(...).'; errorEl.hidden = false }
      fieldsEl.innerHTML = ''
      return
    }
    renderFromRgb(rgb)
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
  picker.addEventListener('input', () => { input.value = picker.value.toUpperCase(); render() })
  document.getElementById('cl-reset-btn').addEventListener('click', () => { input.value = '#2563EB'; render() })

  input.value = '#2563EB'
  render()
})()
