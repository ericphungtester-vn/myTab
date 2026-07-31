// ---- Card Tool: generates SYNTHETIC payment-card test data for form/validation testing. Nothing
// here is a real card — numbers are randomly generated with a valid Luhn check digit and the correct
// network IIN prefix + length, but they belong to NO real account and cannot be used for any
// transaction. The prefix identifies the card *network* (scheme), not any specific bank.
//
// Everything above the wiring section (far below) is pure — no DOM — so it is unit-tested. The Luhn
// checksum matches the algorithm already verified in profile-tool.js (python-stdnum reference).

function card_randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}
function card_randDigits(n) {
  let s = ''
  for (let i = 0; i < n; i++) s += card_randInt(0, 9)
  return s
}
function card_pick(arr) {
  return arr[card_randInt(0, arr.length - 1)]
}

// Luhn (mod-10): sum digits from the right, doubling every second one (subtracting 9 if >9).
function card_luhnChecksum(digitsStr) {
  const rev = digitsStr.split('').reverse().map(Number)
  let sum = 0
  for (let i = 0; i < rev.length; i++) {
    let v = rev[i]
    if (i % 2 === 1) { v *= 2; if (v > 9) v -= 9 }
    sum += v
  }
  return sum % 10
}
function card_luhnCheckDigit(bodyStr) {
  return String((10 - card_luhnChecksum(bodyStr + '0')) % 10)
}
function card_luhnValid(number) {
  const n = String(number).replace(/\D/g, '')
  return n.length > 0 && card_luhnChecksum(n) === 0
}

// name, total length, CVV length + its label per network. Prefix ranges are in card_prefix below.
const CARD_NETWORKS = [
  { key: 'visa', name: 'Visa', length: 16, cvv: 3, cvvLabel: 'CVV' },
  { key: 'mastercard', name: 'Mastercard', length: 16, cvv: 3, cvvLabel: 'CVC' },
  { key: 'amex', name: 'American Express', length: 15, cvv: 4, cvvLabel: 'CID' },
  { key: 'discover', name: 'Discover', length: 16, cvv: 3, cvvLabel: 'CVV' },
  { key: 'jcb', name: 'JCB', length: 16, cvv: 3, cvvLabel: 'CVV' },
  { key: 'diners', name: 'Diners Club', length: 14, cvv: 3, cvvLabel: 'CVV' },
  { key: 'unionpay', name: 'UnionPay', length: 16, cvv: 3, cvvLabel: 'CVN' }
]

// A valid starting IIN prefix for the given network.
function card_prefix(key) {
  switch (key) {
    case 'visa': return '4'
    case 'amex': return card_pick(['34', '37'])
    case 'mastercard': return Math.random() < 0.5 ? card_pick(['51', '52', '53', '54', '55']) : String(card_randInt(2221, 2720))
    case 'discover': return card_pick(['6011', '65', '644', '645', '646', '647', '648', '649'])
    case 'jcb': return String(card_randInt(3528, 3589))
    case 'diners': return card_pick(['300', '301', '302', '303', '304', '305', '36', '38', '39'])
    case 'unionpay': return '62'
    default: return '4'
  }
}

function card_generateNumber(key) {
  const net = CARD_NETWORKS.find(n => n.key === key)
  if (!net) throw new Error('Unknown network: ' + key)
  let body = card_prefix(key)
  while (body.length < net.length - 1) body += card_randInt(0, 9)
  body = body.slice(0, net.length - 1)
  return body + card_luhnCheckDigit(body)
}

// Detect a card's network from its number (real BIN-style prefix ranges), or 'unknown'.
function card_detectNetwork(number) {
  const n = String(number).replace(/\D/g, '')
  const p = len => parseInt(n.slice(0, len), 10)
  if (/^4/.test(n)) return 'visa'
  if (/^3[47]/.test(n)) return 'amex'
  if (/^5[1-5]/.test(n) || (p(4) >= 2221 && p(4) <= 2720)) return 'mastercard'
  if (/^6011/.test(n) || /^65/.test(n) || (p(3) >= 644 && p(3) <= 649)) return 'discover'
  if (p(4) >= 3528 && p(4) <= 3589) return 'jcb'
  if (/^3(0[0-5]|[689])/.test(n)) return 'diners'
  if (/^62/.test(n)) return 'unionpay'
  return 'unknown'
}

// Group digits the way each network prints them: Amex 4-6-5, Diners 4-6-4, everyone else in 4s.
function card_format(number, key) {
  const n = String(number)
  if (key === 'amex') return n.replace(/^(\d{4})(\d{6})(\d{5})$/, '$1 $2 $3')
  if (key === 'diners') return n.replace(/^(\d{4})(\d{6})(\d{4})$/, '$1 $2 $3')
  return n.replace(/(\d{4})(?=\d)/g, '$1 ').trim()
}

function card_generateCvv(key) {
  const net = CARD_NETWORKS.find(n => n.key === key)
  return card_randDigits(net.cvv)
}

function card_formatExpiry(month, year) {
  return String(month).padStart(2, '0') + '/' + String(year).slice(-2)
}

const CARD_FIRST = ['JAMES', 'MARIA', 'JOHN', 'LINDA', 'DAVID', 'SARAH', 'MICHAEL', 'EMMA', 'DANIEL', 'OLIVIA', 'THOMAS', 'SOPHIA', 'WILLIAM', 'ANNA', 'ROBERT', 'LAURA', 'KEVIN', 'JULIA', 'PETER', 'NINA']
const CARD_LAST = ['SMITH', 'GARCIA', 'JOHNSON', 'MULLER', 'BROWN', 'ROSSI', 'LEE', 'MARTIN', 'WILSON', 'DUBOIS', 'TAYLOR', 'SILVA', 'TRAN', 'NGUYEN', 'KIM', 'SATO', 'KHAN', 'SINGH', 'LOPEZ', 'WANG']
function card_generateName() {
  return card_pick(CARD_FIRST) + ' ' + card_pick(CARD_LAST)
}

// Assemble a full synthetic card. `key` may be a network key or 'random'/undefined for a random one.
function card_generate(key) {
  const netKey = (!key || key === 'random') ? card_pick(CARD_NETWORKS).key : key
  const net = CARD_NETWORKS.find(n => n.key === netKey)
  if (!net) throw new Error('Unknown network: ' + key)
  const raw = card_generateNumber(netKey)
  const now = new Date()
  const year = now.getFullYear() + card_randInt(1, 5)
  const month = card_randInt(1, 12)
  return {
    key: netKey,
    network: net.name,
    numberRaw: raw,
    number: card_format(raw, netKey),
    cvvLabel: net.cvvLabel,
    cvv: card_generateCvv(netKey),
    expiry: card_formatExpiry(month, year),
    name: card_generateName()
  }
}

// ---- Wiring ----
;(function initCardTool() {
  const networkTrigger = document.getElementById('cc-network-trigger')
  if (!networkTrigger) return // Card tab not present in this build

  const networkTriggerLabel = document.getElementById('cc-network-trigger-label')
  const networkPanel = document.getElementById('cc-network-panel')
  const generateBtn = document.getElementById('cc-generate')
  const fieldsEl = document.getElementById('cc-fields')

  let currentNetwork = 'random'

  const COPY_ICON = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>'
  const CHECK_ICON = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>'

  const OPTIONS = [{ key: 'random', name: 'Random network' }, ...CARD_NETWORKS.map(n => ({ key: n.key, name: n.name }))]

  function renderNetworkOptions() {
    networkPanel.innerHTML = OPTIONS.map(o =>
      `<button type="button" class="ft-select-option${o.key === currentNetwork ? ' active' : ''}" data-value="${o.key}">${o.name}</button>`
    ).join('')
  }

  function setNetwork(key) {
    currentNetwork = key
    const o = OPTIONS.find(x => x.key === key)
    networkTriggerLabel.textContent = o ? o.name : key
    renderNetworkOptions()
  }

  function openPanel() {
    networkPanel.hidden = false
    const rect = networkTrigger.getBoundingClientRect()
    networkPanel.style.left = rect.left + 'px'
    networkPanel.style.width = rect.width + 'px'
    networkPanel.style.top = (rect.bottom + 4) + 'px'
    networkPanel.style.maxHeight = Math.max(120, window.innerHeight - rect.bottom - 12) + 'px'
  }
  function closePanel() { networkPanel.hidden = true }

  networkTrigger.addEventListener('click', () => {
    const wasHidden = networkPanel.hidden
    closePanel()
    if (wasHidden) openPanel()
  })
  networkPanel.addEventListener('click', e => {
    const opt = e.target.closest('.ft-select-option')
    if (!opt) return
    setNetwork(opt.dataset.value)
    saveSettings()
    closePanel()
    generate()
  })
  document.addEventListener('click', e => {
    if (!networkPanel.contains(e.target) && !networkTrigger.contains(e.target)) closePanel()
  })

  function escapeHtml(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
  }

  function fieldRow(label, value, copyValue) {
    const shown = escapeHtml(value)
    const copy = escapeHtml(copyValue != null ? copyValue : value)
    return `<div class="pf-field">
      <div class="pf-field-label">${label}</div>
      <div class="pf-field-value-wrap">
        <input type="text" class="pf-field-value" readonly value="${shown}">
        <button type="button" class="tt-copy-icon-btn pf-copy-btn" data-copy="${copy}" aria-label="Copy" title="Copy to clipboard">${COPY_ICON}</button>
      </div>
    </div>`
  }

  function renderCard(card) {
    fieldsEl.innerHTML = [
      fieldRow('Network', card.network),
      fieldRow('Card Number', card.number, card.numberRaw),
      fieldRow(card.cvvLabel, card.cvv),
      fieldRow('Expiry (MM/YY)', card.expiry),
      fieldRow('Cardholder Name', card.name)
    ].join('')
  }

  fieldsEl.addEventListener('click', e => {
    const btn = e.target.closest('.pf-copy-btn')
    if (!btn) return
    navigator.clipboard.writeText(btn.dataset.copy).then(() => {
      btn.innerHTML = CHECK_ICON
      btn.classList.add('copied')
      setTimeout(() => { btn.innerHTML = COPY_ICON; btn.classList.remove('copied') }, 1400)
    })
  })

  function generate() {
    renderCard(card_generate(currentNetwork))
  }

  generateBtn.addEventListener('click', generate)

  const resetBtn = document.getElementById('cc-reset-btn')
  const SETTINGS_KEY = 'card-tool-network'
  const DEFAULT_NETWORK = 'random'
  function saveSettings() { syncSet({ [SETTINGS_KEY]: currentNetwork }) }
  resetBtn.addEventListener('click', () => { setNetwork(DEFAULT_NETWORK); saveSettings(); generate() })

  syncGet([SETTINGS_KEY]).then(d => { setNetwork(d[SETTINGS_KEY] || DEFAULT_NETWORK); generate() })
})()
