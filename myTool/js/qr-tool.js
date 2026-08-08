// ---- QR Tool: generates a QR code from any text/URL, offline. Encoding is done by the vendored
// qrcode-generator library (js/vendor/qrcode.js, MIT, Kazuhiko Arase); this file only turns the
// resulting module matrix into an SVG and wires up the UI. The SVG builder above the wiring marker
// is pure (no DOM) and unit-tested; the encoder itself is covered by test/qr-vendor.test.js.

// Build an SVG string from a QR matrix. `count` is the module grid size; `isDark(row, col)` tells
// whether a module is dark. Dark modules become one combined <path>; a light <rect> is the quiet
// zone + background. crispEdges keeps the squares sharp at any scale.
function qr_svg(count, isDark, opts) {
  const o = opts || {}
  const cell = o.cellSize || 8
  const margin = (o.margin == null ? 4 : o.margin) // quiet zone, in modules (spec minimum is 4)
  const dark = o.dark || '#000000'
  const light = o.light || '#ffffff'
  const dim = (count + margin * 2) * cell
  let path = ''
  for (let r = 0; r < count; r++) {
    for (let c = 0; c < count; c++) {
      if (isDark(r, c)) {
        const x = (c + margin) * cell
        const y = (r + margin) * cell
        path += 'M' + x + ' ' + y + 'h' + cell + 'v' + cell + 'h' + (-cell) + 'z'
      }
    }
  }
  return '<svg xmlns="http://www.w3.org/2000/svg" width="' + dim + '" height="' + dim + '" viewBox="0 0 ' + dim + ' ' + dim + '" shape-rendering="crispEdges">'
    + '<rect width="' + dim + '" height="' + dim + '" fill="' + light + '"/>'
    + '<path d="' + path + '" fill="' + dark + '"/></svg>'
}

// QR version number (1-40) from the module count: count = 17 + 4*version.
function qr_version(count) { return (count - 17) / 4 }

// ---- Wiring ----
;(function initQrTool() {
  const input = document.getElementById('qr-input')
  if (!input) return // QR tab not present in this build

  // Encode input as UTF-8 so non-ASCII (Vietnamese, emoji, CJK) survives — the library defaults to
  // a Latin-1 byte mapping otherwise.
  if (typeof qrcode !== 'undefined' && qrcode.stringToBytesFuncs && qrcode.stringToBytesFuncs['UTF-8']) {
    qrcode.stringToBytes = qrcode.stringToBytesFuncs['UTF-8']
  }

  const ecSeg = document.getElementById('qr-ec')
  const outputEl = document.getElementById('qr-output')
  const infoEl = document.getElementById('qr-info')
  const errorEl = document.getElementById('qr-error')
  const pngBtn = document.getElementById('qr-download-png')
  const svgBtn = document.getElementById('qr-download-svg')
  const resetBtn = document.getElementById('qr-reset-btn')

  const DISPLAY_CELL = 8
  const EXPORT_CELL = 16 // higher resolution for the downloaded files
  let currentQr = null

  function ecLevel() {
    const btn = ecSeg.querySelector('.seg-btn.active')
    return btn ? btn.dataset.value : 'M'
  }
  function setEc(level) {
    ecSeg.querySelectorAll('.seg-btn').forEach(b => b.classList.toggle('active', b.dataset.value === level))
  }

  function render() {
    const text = input.value
    errorEl.hidden = true
    if (text === '') {
      currentQr = null
      outputEl.innerHTML = ''
      infoEl.hidden = true
      pngBtn.disabled = svgBtn.disabled = true
      return
    }
    let qr
    try {
      qr = qrcode(0, ecLevel()) // 0 = auto-pick the smallest fitting version
      qr.addData(text)
      qr.make()
    } catch (e) {
      currentQr = null
      outputEl.innerHTML = ''
      infoEl.hidden = true
      pngBtn.disabled = svgBtn.disabled = true
      errorEl.textContent = 'Content is too long to fit in a QR code — shorten it or lower the error-correction level.'
      errorEl.hidden = false
      return
    }
    currentQr = qr
    const count = qr.getModuleCount()
    outputEl.innerHTML = qr_svg(count, (r, c) => qr.isDark(r, c), { cellSize: DISPLAY_CELL })
    infoEl.textContent = 'Version ' + qr_version(count) + ' · EC ' + ecLevel() + ' · ' + count + '×' + count + ' modules'
    infoEl.hidden = false
    pngBtn.disabled = svgBtn.disabled = false
  }

  function exportSvg() {
    return qr_svg(currentQr.getModuleCount(), (r, c) => currentQr.isDark(r, c), { cellSize: EXPORT_CELL })
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  input.addEventListener('input', () => { render(); saveSettings() })
  ecSeg.addEventListener('click', e => {
    const btn = e.target.closest('.seg-btn')
    if (!btn) return
    setEc(btn.dataset.value)
    render()
    saveSettings()
  })

  svgBtn.addEventListener('click', () => {
    if (!currentQr) return
    downloadBlob(new Blob([exportSvg()], { type: 'image/svg+xml' }), 'qrcode.svg')
  })

  pngBtn.addEventListener('click', () => {
    if (!currentQr) return
    const svg = exportSvg()
    const img = new Image()
    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }))
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.width
      canvas.height = img.height
      canvas.getContext('2d').drawImage(img, 0, 0)
      URL.revokeObjectURL(url)
      canvas.toBlob(blob => downloadBlob(blob, 'qrcode.png'), 'image/png')
    }
    img.src = url
  })

  const SETTINGS_KEY = 'qr-tool-settings'
  const DEFAULTS = { text: '', ec: 'M' }
  function saveSettings() { syncSet({ [SETTINGS_KEY]: { text: input.value, ec: ecLevel() } }) }
  function applySettings(s) { input.value = s.text; setEc(s.ec) }
  resetBtn.addEventListener('click', () => { applySettings(DEFAULTS); saveSettings(); render() })

  syncGet([SETTINGS_KEY]).then(d => { applySettings({ ...DEFAULTS, ...(d[SETTINGS_KEY] || {}) }); render() })
})()
