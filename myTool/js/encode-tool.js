// ---- Encode / Hash Tool: Base64 / URL / Hex encode+decode, and SHA-1/256/512 hashes. The encoders
// are pure and unit-tested; the hashes use the browser's Web Crypto in the wiring (async). Nothing
// above the wiring marker touches the DOM.

const EH_B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

function eh_bytesToBase64(bytes) {
  let out = ''
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i]
    const b1 = i + 1 < bytes.length ? bytes[i + 1] : 0
    const b2 = i + 2 < bytes.length ? bytes[i + 2] : 0
    out += EH_B64[b0 >> 2]
    out += EH_B64[((b0 & 3) << 4) | (b1 >> 4)]
    out += i + 1 < bytes.length ? EH_B64[((b1 & 15) << 2) | (b2 >> 6)] : '='
    out += i + 2 < bytes.length ? EH_B64[b2 & 63] : '='
  }
  return out
}

function eh_base64ToBytes(b64) {
  const clean = b64.replace(/[^A-Za-z0-9+/]/g, '')
  const lookup = {}
  for (let i = 0; i < EH_B64.length; i++) lookup[EH_B64[i]] = i
  const bytes = []
  for (let i = 0; i < clean.length; i += 4) {
    const c0 = lookup[clean[i]]
    const c1 = lookup[clean[i + 1]]
    if (c1 === undefined) break
    bytes.push((c0 << 2) | (c1 >> 4))
    const c2 = lookup[clean[i + 2]]
    if (c2 === undefined) break
    bytes.push(((c1 & 15) << 4) | (c2 >> 2))
    const c3 = lookup[clean[i + 3]]
    if (c3 === undefined) break
    bytes.push(((c2 & 3) << 6) | c3)
  }
  return bytes
}

function eh_base64Encode(str) {
  return eh_bytesToBase64([...new TextEncoder().encode(str)])
}
function eh_base64Decode(b64) {
  return new TextDecoder().decode(new Uint8Array(eh_base64ToBytes(b64)))
}

function eh_hexEncode(str) {
  return [...new TextEncoder().encode(str)].map(b => b.toString(16).padStart(2, '0')).join('')
}
function eh_hexDecode(hex) {
  const clean = hex.replace(/0x/gi, '').replace(/[^0-9a-fA-F]/g, '')
  if (clean.length % 2 !== 0) throw new Error('odd hex length')
  const bytes = []
  for (let i = 0; i < clean.length; i += 2) bytes.push(parseInt(clean.slice(i, i + 2), 16))
  return new TextDecoder().decode(new Uint8Array(bytes))
}

// Synchronous conversions. Returns { output } or { error }. (Hashes are handled async in the wiring.)
function eh_convert(op, input) {
  try {
    switch (op) {
      case 'b64enc': return { output: eh_base64Encode(input) }
      case 'b64dec': return { output: eh_base64Decode(input) }
      case 'urlenc': return { output: encodeURIComponent(input) }
      case 'urldec': return { output: decodeURIComponent(input) }
      case 'hexenc': return { output: eh_hexEncode(input) }
      case 'hexdec': return { output: eh_hexDecode(input) }
      default: return { error: 'Unknown operation.' }
    }
  } catch (e) {
    return { error: 'Invalid input for this operation.' }
  }
}

const EH_HASHES = { 'sha1': 'SHA-1', 'sha256': 'SHA-256', 'sha512': 'SHA-512' }

// ---- Wiring ----
;(function initEncodeTool() {
  const opTrigger = document.getElementById('eh-op-trigger')
  if (!opTrigger) return

  const opTriggerLabel = document.getElementById('eh-op-trigger-label')
  const opPanel = document.getElementById('eh-op-panel')
  const inputEl = document.getElementById('eh-input')
  const convertBtn = document.getElementById('eh-convert')
  const errorEl = document.getElementById('eh-error')
  const outputEl = document.getElementById('eh-output')
  const copyBtn = document.getElementById('eh-copy')

  const OPS = [
    { key: 'b64enc', name: 'Base64 encode' },
    { key: 'b64dec', name: 'Base64 decode' },
    { key: 'urlenc', name: 'URL encode' },
    { key: 'urldec', name: 'URL decode' },
    { key: 'hexenc', name: 'Hex encode' },
    { key: 'hexdec', name: 'Hex decode' },
    { key: 'sha1', name: 'SHA-1 hash' },
    { key: 'sha256', name: 'SHA-256 hash' },
    { key: 'sha512', name: 'SHA-512 hash' }
  ]
  let currentOp = 'b64enc'

  function renderOpOptions() {
    opPanel.innerHTML = OPS.map(o =>
      `<button type="button" class="ft-select-option${o.key === currentOp ? ' active' : ''}" data-value="${o.key}">${o.name}</button>`
    ).join('')
  }
  function setOp(key) {
    currentOp = key
    const o = OPS.find(x => x.key === key)
    opTriggerLabel.textContent = o ? o.name : key
    renderOpOptions()
  }
  function openPanel() {
    opPanel.hidden = false
    const rect = opTrigger.getBoundingClientRect()
    opPanel.style.left = rect.left + 'px'
    opPanel.style.width = rect.width + 'px'
    opPanel.style.top = (rect.bottom + 4) + 'px'
    opPanel.style.maxHeight = Math.max(120, window.innerHeight - rect.bottom - 12) + 'px'
  }
  function closePanel() { opPanel.hidden = true }

  opTrigger.addEventListener('click', () => {
    const wasHidden = opPanel.hidden
    closePanel()
    if (wasHidden) openPanel()
  })
  opPanel.addEventListener('click', e => {
    const opt = e.target.closest('.ft-select-option')
    if (!opt) return
    setOp(opt.dataset.value)
    saveSettings()
    closePanel()
    convert()
  })
  document.addEventListener('click', e => {
    if (!opPanel.contains(e.target) && !opTrigger.contains(e.target)) closePanel()
  })

  async function sha(algo, str) {
    const digest = await crypto.subtle.digest(algo, new TextEncoder().encode(str))
    return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('')
  }

  async function convert() {
    errorEl.hidden = true
    const input = inputEl.value
    if (EH_HASHES[currentOp]) {
      outputEl.value = input ? await sha(EH_HASHES[currentOp], input) : ''
      return
    }
    const res = eh_convert(currentOp, input)
    if (res.error) {
      errorEl.textContent = res.error
      errorEl.hidden = false
      outputEl.value = ''
    } else {
      outputEl.value = res.output
    }
  }

  convertBtn.addEventListener('click', convert)
  copyBtn.addEventListener('click', () => {
    if (!outputEl.value) return
    navigator.clipboard.writeText(outputEl.value).then(() => {
      copyBtn.classList.add('copied')
      setTimeout(() => copyBtn.classList.remove('copied'), 1200)
    })
  })

  const resetBtn = document.getElementById('eh-reset-btn')
  const SETTINGS_KEY = 'encode-tool-op'
  function saveSettings() { syncSet({ [SETTINGS_KEY]: currentOp }) }
  resetBtn.addEventListener('click', () => {
    setOp('b64enc')
    inputEl.value = ''
    outputEl.value = ''
    errorEl.hidden = true
    saveSettings()
  })

  syncGet([SETTINGS_KEY]).then(d => { setOp(d[SETTINGS_KEY] || 'b64enc') })
})()
