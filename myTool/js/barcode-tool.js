// ---- Barcode Tool: generates a 1D barcode from text/numbers, offline. Encoding + rendering is done
// by the vendored JsBarcode library (js/vendor/jsbarcode.js, MIT, Johan Lindell); this file only
// configures the formats and wires up the UI. The format table + GTIN check-digit helper above the
// wiring marker are pure (no DOM) and unit-tested.

// Supported symbologies: JsBarcode format name, a friendly label, a valid sample, and an input hint.
var BC_FORMATS = [
  { value: 'CODE128', label: 'Code 128', sample: 'ABC-1234', hint: 'Any ASCII text or numbers.' },
  { value: 'EAN13', label: 'EAN-13', sample: '5901234123457', hint: '13 digits (last is a check digit).' },
  { value: 'EAN8', label: 'EAN-8', sample: '96385074', hint: '8 digits (last is a check digit).' },
  { value: 'UPC', label: 'UPC-A', sample: '036000291452', hint: '12 digits (last is a check digit).' },
  { value: 'CODE39', label: 'Code 39', sample: 'CODE39', hint: 'A–Z, 0–9, and - . $ / + % space.' },
  { value: 'ITF', label: 'ITF', sample: '1234567890', hint: 'An even number of digits.' },
  { value: 'MSI', label: 'MSI', sample: '1234567', hint: 'Digits only.' },
  { value: 'codabar', label: 'Codabar', sample: 'A40156B', hint: 'Digits + - $ : / . +, wrapped in A–D start/stop letters.' },
  { value: 'pharmacode', label: 'Pharmacode', sample: '1234', hint: 'A whole number from 3 to 131070.' }
]

// Standard GTIN check digit (EAN-8/13, UPC-A): weight digits 3,1,3,1… from the right, then
// (10 - sum % 10) % 10. Used to keep the sample codes above honest (verified in the unit tests).
function bc_gtinCheck(payload) {
  const d = String(payload).split('').reverse().map(Number)
  let sum = 0
  for (let i = 0; i < d.length; i++) sum += d[i] * (i % 2 === 0 ? 3 : 1)
  return String((10 - (sum % 10)) % 10)
}

function bc_sampleFor(formatValue) {
  const f = BC_FORMATS.find(x => x.value === formatValue)
  return f ? f.sample : ''
}

// ---- Wiring ----
;(function initBarcodeTool() {
  const input = document.getElementById('bc-input')
  if (!input) return // Barcode tab not present in this build

  const formatSel = document.getElementById('bc-format')
  const svg = document.getElementById('bc-svg')
  const hintEl = document.getElementById('bc-hint')
  const errorEl = document.getElementById('bc-error')
  const pngBtn = document.getElementById('bc-download-png')
  const svgBtn = document.getElementById('bc-download-svg')
  const resetBtn = document.getElementById('bc-reset-btn')

  formatSel.innerHTML = BC_FORMATS.map(f => `<option value="${f.value}">${f.label}</option>`).join('')

  const SAMPLES = BC_FORMATS.map(f => f.sample)

  function currentFormat() { return BC_FORMATS.find(f => f.value === formatSel.value) || BC_FORMATS[0] }

  function clearOutput() {
    svg.innerHTML = ''
    svg.removeAttribute('width')
    svg.removeAttribute('height')
    pngBtn.disabled = svgBtn.disabled = true
  }

  function render() {
    const fmt = currentFormat()
    hintEl.textContent = fmt.hint
    errorEl.hidden = true
    clearOutput()
    if (input.value === '') return

    let ok = true
    try {
      JsBarcode(svg, input.value, {
        format: fmt.value,
        displayValue: true,
        margin: 10,
        height: 80,
        fontSize: 16,
        valid: v => { ok = v }
      })
    } catch (e) {
      ok = false
    }
    if (!ok) {
      clearOutput()
      errorEl.textContent = 'Invalid input for ' + fmt.label + ' — ' + fmt.hint
      errorEl.hidden = false
      return
    }
    pngBtn.disabled = svgBtn.disabled = false
  }

  function serializeSvg() {
    return new XMLSerializer().serializeToString(svg)
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
  formatSel.addEventListener('change', () => {
    // Switching format: if the box is empty or still holds a sample, load the new format's sample so
    // it renders something valid straight away; otherwise keep whatever the user typed.
    if (input.value === '' || SAMPLES.includes(input.value)) input.value = currentFormat().sample
    render()
    saveSettings()
  })

  svgBtn.addEventListener('click', () => {
    if (svgBtn.disabled) return
    downloadBlob(new Blob([serializeSvg()], { type: 'image/svg+xml' }), 'barcode.svg')
  })

  pngBtn.addEventListener('click', () => {
    if (pngBtn.disabled) return
    const img = new Image()
    const url = URL.createObjectURL(new Blob([serializeSvg()], { type: 'image/svg+xml' }))
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.width
      canvas.height = img.height
      canvas.getContext('2d').drawImage(img, 0, 0)
      URL.revokeObjectURL(url)
      canvas.toBlob(blob => downloadBlob(blob, 'barcode.png'), 'image/png')
    }
    img.src = url
  })

  const SETTINGS_KEY = 'barcode-tool-settings'
  const DEFAULTS = { text: BC_FORMATS[0].sample, format: BC_FORMATS[0].value }
  function saveSettings() { syncSet({ [SETTINGS_KEY]: { text: input.value, format: formatSel.value } }) }
  function applySettings(s) { formatSel.value = s.format; input.value = s.text }
  resetBtn.addEventListener('click', () => { applySettings(DEFAULTS); saveSettings(); render() })

  syncGet([SETTINGS_KEY]).then(d => { applySettings({ ...DEFAULTS, ...(d[SETTINGS_KEY] || {}) }); render() })
})()
