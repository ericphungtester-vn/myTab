// ---- UUID / ID Tool: generates identifiers in several common formats (UUID v4, UUID v7, ULID,
// NanoID, Mongo ObjectId). The bit/version/variant layout of each format is built exactly to spec,
// so every value validates against a real parser. All randomness comes from crypto.getRandomValues
// in the wiring; the pure builders below take the random bytes as input, so they're deterministic
// and unit-tested. (Nothing above the wiring marker touches the DOM.)

function uu_bytesToHex(bytes) {
  return bytes.map(b => (b & 0xff).toString(16).padStart(2, '0')).join('')
}

function uu_bytesToUuid(bytes16) {
  const h = uu_bytesToHex(bytes16)
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}

// UUID v4: 16 random bytes with the version (4) and variant (10xx) bits forced.
function uu_uuidV4(bytes16) {
  const b = bytes16.slice()
  b[6] = (b[6] & 0x0f) | 0x40
  b[8] = (b[8] & 0x3f) | 0x80
  return uu_bytesToUuid(b)
}

// UUID v7: 48-bit big-endian unix-ms timestamp, then version 7, variant, and random for the rest.
function uu_uuidV7(ms, rand10) {
  const b = new Array(16)
  b[0] = Math.floor(ms / 2 ** 40) & 0xff
  b[1] = Math.floor(ms / 2 ** 32) & 0xff
  b[2] = Math.floor(ms / 2 ** 24) & 0xff
  b[3] = Math.floor(ms / 2 ** 16) & 0xff
  b[4] = Math.floor(ms / 2 ** 8) & 0xff
  b[5] = ms & 0xff
  b[6] = 0x70 | (rand10[0] & 0x0f)
  b[7] = rand10[1] & 0xff
  b[8] = 0x80 | (rand10[2] & 0x3f)
  for (let i = 0; i < 7; i++) b[9 + i] = rand10[3 + i] & 0xff
  return uu_bytesToUuid(b)
}

// ULID: Crockford base32, 48-bit time (10 chars) + 80-bit randomness (16 chars) = 26 chars.
const ULID_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'
function uu_encodeUlidTime(ms) {
  const out = new Array(10)
  let t = ms
  for (let i = 9; i >= 0; i--) { out[i] = ULID_ALPHABET[t % 32]; t = Math.floor(t / 32) }
  return out.join('')
}
function uu_ulid(ms, rand16) {
  return uu_encodeUlidTime(ms) + rand16.map(x => ULID_ALPHABET[x % 32]).join('')
}
function uu_decodeUlidTime(ulid) {
  let t = 0
  for (const ch of ulid.slice(0, 10)) t = t * 32 + ULID_ALPHABET.indexOf(ch)
  return t
}

// NanoID: 21 chars from a 64-symbol URL-safe alphabet.
const NANOID_ALPHABET = '-_0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'
function uu_nanoid(indices) {
  return indices.map(x => NANOID_ALPHABET[x % 64]).join('')
}

// Mongo ObjectId: 24 hex = 4-byte seconds timestamp + 5-byte random + 3-byte counter.
function uu_objectId(secs, rand5, counter) {
  const ts = (secs >>> 0).toString(16).padStart(8, '0')
  const rnd = uu_bytesToHex(rand5.slice(0, 5))
  const cnt = (counter & 0xffffff).toString(16).padStart(6, '0')
  return ts + rnd + cnt
}

const UUID_TYPES = [
  { key: 'v4', name: 'UUID v4 (random)' },
  { key: 'v7', name: 'UUID v7 (time-ordered)' },
  { key: 'ulid', name: 'ULID' },
  { key: 'nanoid', name: 'NanoID' },
  { key: 'objectid', name: 'Mongo ObjectId' }
]

// ---- Wiring ----
;(function initUuidTool() {
  const typeTrigger = document.getElementById('uu-type-trigger')
  if (!typeTrigger) return

  const typeTriggerLabel = document.getElementById('uu-type-trigger-label')
  const typePanel = document.getElementById('uu-type-panel')
  const countSeg = document.querySelector('.segmented[data-group="uu-count"]')
  const generateBtn = document.getElementById('uu-generate')
  const output = document.getElementById('uu-output')
  const copyBtn = document.getElementById('uu-copy')

  let currentType = 'v4'

  function randBytes(n) {
    const a = new Uint8Array(n)
    crypto.getRandomValues(a)
    return [...a]
  }

  function makeOne(type) {
    switch (type) {
      case 'v4': return uu_uuidV4(randBytes(16))
      case 'v7': return uu_uuidV7(Date.now(), randBytes(10))
      case 'ulid': return uu_ulid(Date.now(), randBytes(16))
      case 'nanoid': return uu_nanoid(randBytes(21))
      case 'objectid': return uu_objectId(Math.floor(Date.now() / 1000), randBytes(5), uuidCounter++)
      default: return ''
    }
  }
  let uuidCounter = randBytes(3).reduce((a, b) => (a << 8) | b, 0)

  function setSegmented(seg, value) {
    seg.querySelectorAll('.seg-btn').forEach(b => b.classList.toggle('active', b.dataset.value === value))
  }
  function segValue(seg) { return seg.querySelector('.seg-btn.active').dataset.value }

  function renderTypeOptions() {
    typePanel.innerHTML = UUID_TYPES.map(t =>
      `<button type="button" class="ft-select-option${t.key === currentType ? ' active' : ''}" data-value="${t.key}">${t.name}</button>`
    ).join('')
  }
  function setType(key) {
    currentType = key
    const t = UUID_TYPES.find(x => x.key === key)
    typeTriggerLabel.textContent = t ? t.name : key
    renderTypeOptions()
  }
  function openPanel() {
    typePanel.hidden = false
    const rect = typeTrigger.getBoundingClientRect()
    typePanel.style.left = rect.left + 'px'
    typePanel.style.width = rect.width + 'px'
    typePanel.style.top = (rect.bottom + 4) + 'px'
    typePanel.style.maxHeight = Math.max(120, window.innerHeight - rect.bottom - 12) + 'px'
  }
  function closePanel() { typePanel.hidden = true }

  typeTrigger.addEventListener('click', () => {
    const wasHidden = typePanel.hidden
    closePanel()
    if (wasHidden) openPanel()
  })
  typePanel.addEventListener('click', e => {
    const opt = e.target.closest('.ft-select-option')
    if (!opt) return
    setType(opt.dataset.value)
    saveSettings()
    closePanel()
    generate()
  })
  document.addEventListener('click', e => {
    if (!typePanel.contains(e.target) && !typeTrigger.contains(e.target)) closePanel()
  })
  countSeg.addEventListener('click', e => {
    const btn = e.target.closest('.seg-btn')
    if (!btn) return
    setSegmented(countSeg, btn.dataset.value)
    saveSettings()
    generate()
  })

  function generate() {
    const n = parseInt(segValue(countSeg), 10)
    const lines = []
    for (let i = 0; i < n; i++) lines.push(makeOne(currentType))
    output.value = lines.join('\n')
  }

  copyBtn.addEventListener('click', () => {
    if (!output.value) return
    navigator.clipboard.writeText(output.value).then(() => {
      copyBtn.classList.add('copied')
      setTimeout(() => copyBtn.classList.remove('copied'), 1200)
    })
  })
  generateBtn.addEventListener('click', generate)

  const resetBtn = document.getElementById('uu-reset-btn')
  const SETTINGS_KEY = 'uuid-tool-settings'
  const DEFAULTS = { type: 'v4', count: '1' }
  function saveSettings() { syncSet({ [SETTINGS_KEY]: { type: currentType, count: segValue(countSeg) } }) }
  function applySettings(s) { setType(s.type); setSegmented(countSeg, s.count) }
  resetBtn.addEventListener('click', () => { applySettings(DEFAULTS); saveSettings(); generate() })

  syncGet([SETTINGS_KEY]).then(d => { applySettings({ ...DEFAULTS, ...(d[SETTINGS_KEY] || {}) }); generate() })
})()
