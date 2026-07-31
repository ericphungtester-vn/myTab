// ---- Resize Tool: resize an image by exact pixel dimensions, or compress it down to a target file
// size. Runs entirely in the browser via <canvas> — the image never leaves the machine, and no
// permissions are needed (it's read from a file the user picks/drops and written back as a download).
//
// Two modes:
//   • Width & Height — scale to exact pixels, with an optional aspect-ratio lock.
//   • File size — binary-search the encoder quality (JPEG/WebP) to land at or under a target size,
//     downscaling the pixels as a fallback when even the lowest quality is still too big.
// Everything above the Wiring marker below is pure math (no DOM/canvas) so it can be unit-tested.

// KB/MB use 1000 (SI / macOS Finder convention) for both the target input and the readouts.
function rs_parseTargetBytes(value, unit) {
  const v = Number(value)
  if (!isFinite(v) || v <= 0) return null
  return Math.round(v * (unit === 'MB' ? 1000 * 1000 : 1000))
}

function rs_formatBytes(n) {
  if (n < 1000) return n + ' B'
  if (n < 1000 * 1000) return (n / 1000).toFixed(n < 10000 ? 1 : 0) + ' KB'
  return (n / 1e6).toFixed(2) + ' MB'
}

// Given the source dimensions and a new width (or height), the other dimension that preserves the
// source aspect ratio. Always returns integers ≥ 1.
function rs_dimsFromWidth(srcW, srcH, w) {
  const nw = Math.max(1, Math.round(w))
  return { w: nw, h: Math.max(1, Math.round(srcH * nw / srcW)) }
}

function rs_dimsFromHeight(srcW, srcH, h) {
  const nh = Math.max(1, Math.round(h))
  return { w: Math.max(1, Math.round(srcW * nh / srcH)), h: nh }
}

const RS_MAX_DIM = 20000
function rs_validateDimensions(w, h) {
  if (!Number.isFinite(w) || !Number.isFinite(h) || w < 1 || h < 1) {
    return { ok: false, error: 'Width and height must be whole numbers of at least 1px.' }
  }
  if (w > RS_MAX_DIM || h > RS_MAX_DIM) {
    return { ok: false, error: `Maximum dimension is ${RS_MAX_DIM}px.` }
  }
  return { ok: true }
}

// Byte size of a base64 data URL's payload, without decoding it.
function rs_dataUrlBytes(dataUrl) {
  const i = dataUrl.indexOf(',')
  if (i < 0) return 0
  const b64 = dataUrl.slice(i + 1)
  const pad = b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0
  return Math.max(0, Math.floor(b64.length * 3 / 4) - pad)
}

// Find the highest encoder quality whose output is ≤ targetBytes. `encodeSize(q)` returns the byte
// size at quality q (0-1) and is assumed roughly monotonic. Returns { quality, size, over } where
// `over` is true only when even the lowest quality still exceeds the target (caller then downscales).
function rs_searchQuality(encodeSize, targetBytes, opts = {}) {
  const steps = opts.steps != null ? opts.steps : 8
  const minQ = opts.minQ != null ? opts.minQ : 0.05
  const maxQ = opts.maxQ != null ? opts.maxQ : 1.0

  const maxSize = encodeSize(maxQ)
  if (maxSize <= targetBytes) return { quality: maxQ, size: maxSize, over: false }

  let lo = minQ, hi = maxQ, best = null
  for (let i = 0; i < steps; i++) {
    const mid = (lo + hi) / 2
    const size = encodeSize(mid)
    if (size <= targetBytes) { best = { quality: mid, size, over: false }; lo = mid } else { hi = mid }
  }
  if (best) return best
  const size = encodeSize(minQ)
  return { quality: minQ, size, over: size > targetBytes }
}

function rs_exportMime(format, originalMime) {
  if (format === 'jpeg') return 'image/jpeg'
  if (format === 'png') return 'image/png'
  if (format === 'webp') return 'image/webp'
  // 'original' — keep it if the browser can encode it, else fall back to PNG (e.g. GIF/BMP/TIFF)
  if (['image/jpeg', 'image/png', 'image/webp'].includes(originalMime)) return originalMime
  return 'image/png'
}

function rs_extForMime(mime) {
  return { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }[mime] || 'png'
}

function rs_isLossy(mime) {
  return mime === 'image/jpeg' || mime === 'image/webp'
}

// ---- Wiring ----
;(function initResizeTool() {
  const dropZone = document.getElementById('rs-drop')
  if (!dropZone) return // Resize tab not present in this build

  const fileInput = document.getElementById('rs-file')
  const browseBtn = document.getElementById('rs-browse')
  const infoEl = document.getElementById('rs-info')
  const unitSeg = document.querySelector('.segmented[data-group="rs-unit"]')
  const widthInput = document.getElementById('rs-width')
  const heightInput = document.getElementById('rs-height')
  const lockInput = document.getElementById('rs-lock')
  const targetInput = document.getElementById('rs-target')
  const formatSelect = document.getElementById('rs-format')
  const generateBtn = document.getElementById('rs-generate')
  const errorEl = document.getElementById('rs-error')
  const resultEl = document.getElementById('rs-result')
  const previewEl = document.getElementById('rs-preview')

  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')

  let bitmap = null       // decoded ImageBitmap of the loaded file (EXIF orientation applied)
  let origMime = ''
  let origName = 'image'
  let origSize = 0

  function setSegmented(seg, value) {
    seg.querySelectorAll('.seg-btn').forEach(b => b.classList.toggle('active', b.dataset.value === value))
  }
  function segValue(seg) {
    return seg.querySelector('.seg-btn.active').dataset.value
  }

  function showError(msg) {
    errorEl.textContent = msg
    errorEl.hidden = false
  }

  async function loadFile(file) {
    errorEl.hidden = true
    resultEl.hidden = true
    previewEl.hidden = true
    if (!file || !/^image\//.test(file.type || '')) {
      showError('Please choose an image file.')
      return
    }
    try {
      const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' })
      if (bitmap) bitmap.close()
      bitmap = bmp
      origMime = file.type
      origName = (file.name || 'image').replace(/\.[^.]+$/, '')
      origSize = file.size
      widthInput.value = bmp.width
      heightInput.value = bmp.height
      infoEl.textContent = `${file.name} — ${bmp.width}×${bmp.height}px, ${rs_formatBytes(file.size)}`
      infoEl.hidden = false
      generateBtn.disabled = false
    } catch {
      showError('Could not read that image.')
    }
  }

  function encodeSizerAt(mime, w, h) {
    canvas.width = w
    canvas.height = h
    ctx.clearRect(0, 0, w, h)
    ctx.drawImage(bitmap, 0, 0, w, h)
    return q => rs_dataUrlBytes(canvas.toDataURL(mime, q))
  }

  function renderTo(mime, w, h, quality) {
    canvas.width = w
    canvas.height = h
    ctx.clearRect(0, 0, w, h)
    ctx.drawImage(bitmap, 0, 0, w, h)
    return canvas.toDataURL(mime, quality)
  }

  function finish(dataUrl, w, h, note) {
    const bytes = rs_dataUrlBytes(dataUrl)
    previewEl.src = dataUrl
    previewEl.hidden = false
    resultEl.textContent = `${w}×${h} · ${rs_formatBytes(bytes)}${note ? ' · ' + note : ''}`
    resultEl.hidden = false
    const ext = rs_extForMime(dataUrl.slice(5, dataUrl.indexOf(';')))
    const a = document.createElement('a')
    a.href = dataUrl
    a.download = `${origName}-resized.${ext}`
    document.body.appendChild(a)
    a.click()
    a.remove()
  }

  // One combined form: dimensions + optional file-size target + format, applied together.
  function generate() {
    errorEl.hidden = true
    if (!bitmap) { showError('Load an image first.'); return }

    const w = parseInt(widthInput.value, 10)
    const h = parseInt(heightInput.value, 10)
    const dv = rs_validateDimensions(w, h)
    if (!dv.ok) { showError(dv.error); return }

    const mime = rs_exportMime(formatSelect.value, origMime)

    // File size is optional — a blank field means "don't constrain the size".
    const rawTarget = targetInput.value.trim()
    if (rawTarget === '') {
      const quality = rs_isLossy(mime) ? 0.92 : undefined
      finish(renderTo(mime, w, h, quality), w, h)
      return
    }

    const target = rs_parseTargetBytes(rawTarget, segValue(unitSeg))
    if (target == null) { showError('File size must be greater than 0, or left blank.'); return }
    if (!rs_isLossy(mime)) { showError('A file-size target needs a lossy format — pick JPEG or WebP (PNG can\'t be compressed to a size).'); return }

    // The chosen width/height act as the maximum: search quality first, then downscale below them
    // only if even the lowest quality can't reach the target.
    let cw = w, ch = h, chosen = null
    for (let attempt = 0; attempt < 14; attempt++) {
      const res = rs_searchQuality(encodeSizerAt(mime, cw, ch), target)
      chosen = { w: cw, h: ch, quality: res.quality }
      if (!res.over) break
      if (cw <= 40 || ch <= 40) break
      cw = Math.max(1, Math.round(cw * 0.85))
      ch = Math.max(1, Math.round(ch * 0.85))
    }
    const dataUrl = renderTo(mime, chosen.w, chosen.h, chosen.quality)
    const bytes = rs_dataUrlBytes(dataUrl)
    const note = bytes > target
      ? `couldn't reach ${rs_formatBytes(target)} (Q${Math.round(chosen.quality * 100)})`
      : `≤ ${rs_formatBytes(target)} (Q${Math.round(chosen.quality * 100)})`
    finish(dataUrl, chosen.w, chosen.h, note)
  }

  // Aspect-ratio lock: editing one dimension updates the other from the source ratio.
  widthInput.addEventListener('input', () => {
    if (!bitmap || !lockInput.checked) return
    heightInput.value = rs_dimsFromWidth(bitmap.width, bitmap.height, Number(widthInput.value) || 1).h
  })
  heightInput.addEventListener('input', () => {
    if (!bitmap || !lockInput.checked) return
    widthInput.value = rs_dimsFromHeight(bitmap.width, bitmap.height, Number(heightInput.value) || 1).w
  })

  browseBtn.addEventListener('click', () => fileInput.click())
  dropZone.addEventListener('click', e => { if (e.target === dropZone || e.target.tagName === 'P') fileInput.click() })
  fileInput.addEventListener('change', () => { if (fileInput.files[0]) loadFile(fileInput.files[0]) })

  dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('dragover') })
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'))
  dropZone.addEventListener('drop', e => {
    e.preventDefault()
    dropZone.classList.remove('dragover')
    if (e.dataTransfer.files[0]) loadFile(e.dataTransfer.files[0])
  })

  unitSeg.addEventListener('click', e => {
    const btn = e.target.closest('.seg-btn')
    if (!btn) return
    setSegmented(unitSeg, btn.dataset.value)
  })

  generateBtn.addEventListener('click', generate)
})()
