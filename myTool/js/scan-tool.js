// ---- Scan Tool: decode a QR code or 1D barcode from an image, offline. Drop / choose / paste an
// image and the vendored ZXing library (js/vendor/zxing.js, MIT) reads it — the reverse of the QR and
// Barcode generators. Fully local: nothing is uploaded, no camera, no extra permissions. The friendly
// format-name map above the wiring marker is pure and unit-tested; decoding is covered by e2e round
// trips (generate a code with the QR/Barcode tools, then scan it back).

// ZXing reports formats as enum names like "QR_CODE" / "CODE_128"; show them the way the generators do.
function sc_friendlyFormat(name) {
  const map = {
    QR_CODE: 'QR Code', DATA_MATRIX: 'Data Matrix', AZTEC: 'Aztec', PDF_417: 'PDF417', MAXICODE: 'MaxiCode',
    CODE_128: 'Code 128', CODE_39: 'Code 39', CODE_93: 'Code 93', CODABAR: 'Codabar', ITF: 'ITF',
    EAN_13: 'EAN-13', EAN_8: 'EAN-8', UPC_A: 'UPC-A', UPC_E: 'UPC-E', RSS_14: 'RSS-14'
  }
  return map[name] || String(name || '').replace(/_/g, ' ')
}

// ---- Wiring ----
;(function initScanTool() {
  const dropZone = document.getElementById('sc-drop')
  if (!dropZone) return // Scan tab not present in this build

  const fileInput = document.getElementById('sc-file')
  const preview = document.getElementById('sc-preview')
  const resultEl = document.getElementById('sc-result')
  const errorEl = document.getElementById('sc-error')

  const COPY_ICON = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>'
  const CHECK_ICON = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>'

  let lastUrl = null

  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;') }
  function fieldRow(label, value) {
    const v = esc(value)
    return `<div class="pf-field"><div class="pf-field-label">${label}</div>
      <div class="pf-field-value-wrap"><input type="text" class="pf-field-value" readonly value="${v}">
      <button type="button" class="tt-copy-icon-btn pf-copy-btn" data-copy="${v}" title="Copy" aria-label="Copy">${COPY_ICON}</button></div></div>`
  }

  function formatName(fmt) {
    const B = ZXing.BarcodeFormat
    if (typeof B[fmt] === 'string') return B[fmt] // numeric enums are reverse-mapped: B[11] === 'QR_CODE'
    for (const k in B) if (B[k] === fmt) return k
    return String(fmt)
  }

  function showError(msg) { resultEl.hidden = true; resultEl.innerHTML = ''; errorEl.textContent = msg; errorEl.hidden = false }

  function decodeBlob(blob) {
    errorEl.hidden = true
    resultEl.hidden = true
    resultEl.innerHTML = ''
    if (!blob || !/^image\//.test(blob.type || '')) { showError('Please provide an image file.'); return }
    if (lastUrl) URL.revokeObjectURL(lastUrl)
    lastUrl = URL.createObjectURL(blob)
    preview.src = lastUrl
    preview.hidden = false
    // Load the 328KB ZXing library only now, the first time an image is actually decoded.
    window.loadScriptOnce('js/vendor/zxing.js')
      .then(() => new ZXing.BrowserMultiFormatReader().decodeFromImageUrl(lastUrl))
      .then(res => {
        errorEl.hidden = true
        resultEl.innerHTML = fieldRow('Format', sc_friendlyFormat(formatName(res.getBarcodeFormat()))) + fieldRow('Content', res.getText())
        resultEl.hidden = false
      }).catch(() => {
      // ZXing rejects (NotFoundException etc.) when it can't read a code; the class name is mangled by
      // minification, so don't branch on it — a failed decode means "no readable code" either way.
      showError('No QR code or barcode found in this image. Try a clearer, straight-on, higher-contrast image.')
    })
  }

  fileInput.addEventListener('change', () => { if (fileInput.files[0]) decodeBlob(fileInput.files[0]) })
  dropZone.addEventListener('click', () => fileInput.click())

  ;['dragover', 'dragenter'].forEach(ev => dropZone.addEventListener(ev, e => { e.preventDefault(); dropZone.classList.add('sc-dragover') }))
  ;['dragleave', 'dragend'].forEach(ev => dropZone.addEventListener(ev, () => dropZone.classList.remove('sc-dragover')))
  dropZone.addEventListener('drop', e => {
    e.preventDefault(); dropZone.classList.remove('sc-dragover')
    const f = e.dataTransfer && e.dataTransfer.files[0]
    if (f) decodeBlob(f)
  })

  // Paste an image from the clipboard while the Scan tab is showing.
  document.addEventListener('paste', e => {
    const tab = document.getElementById('tab-scan')
    if (!tab || !tab.classList.contains('active')) return
    const items = e.clipboardData && e.clipboardData.items
    if (!items) return
    for (let i = 0; i < items.length; i++) {
      if (items[i].type && items[i].type.indexOf('image') === 0) {
        const blob = items[i].getAsFile()
        if (blob) { decodeBlob(blob); e.preventDefault(); break }
      }
    }
  })

  resultEl.addEventListener('click', e => {
    const btn = e.target.closest('.pf-copy-btn')
    if (!btn) return
    navigator.clipboard.writeText(btn.dataset.copy).then(() => {
      btn.innerHTML = CHECK_ICON; btn.classList.add('copied')
      setTimeout(() => { btn.innerHTML = COPY_ICON; btn.classList.remove('copied') }, 1200)
    })
  })

  document.getElementById('sc-reset-btn').addEventListener('click', () => {
    fileInput.value = ''
    if (lastUrl) { URL.revokeObjectURL(lastUrl); lastUrl = null }
    preview.hidden = true; preview.removeAttribute('src')
    resultEl.hidden = true; resultEl.innerHTML = ''
    errorEl.hidden = true
  })
})()
