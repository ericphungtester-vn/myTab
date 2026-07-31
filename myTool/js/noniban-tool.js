// ---- Non-IBAN Tool: generates SYNTHETIC domestic bank identifiers + account numbers + SWIFT/BIC
// for major countries that do NOT use IBAN. Nothing here is a real bank or a real account — bank,
// branch and routing codes are randomly generated and are NOT mapped to any real institution.
//
// Countries without IBAN have no single international account structure, so this is a curated set of
// 18 economies whose domestic formats are publicly documented (not a fabricated long tail). Three of
// the identifiers carry a real, verifiable check digit, implemented per the published algorithm and
// checked in the test suite against known reference values: the USA ABA routing number (weighted
// MOD-10), Mexico's CLABE (MOD-10), and Argentina's CBU (two check digits). Every other identifier
// and account number has no public checksum standard and is correct in format/length only.
// SWIFT/BIC follows ISO 9362 (format only — there is no BIC checksum).

function nb_randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function nb_randDigits(n) {
  let s = ''
  for (let i = 0; i < n; i++) s += nb_randInt(0, 9)
  return s
}

// First digit 1-9 so a fixed-length numeric id never renders shorter than its stated length
function nb_randDigitsNonZero(n) {
  return String(nb_randInt(1, 9)) + nb_randDigits(n - 1)
}

function nb_randLetters(n) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  let s = ''
  for (let i = 0; i < n; i++) s += alphabet[nb_randInt(0, 25)]
  return s
}

function nb_randAlnum(n) {
  const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  let s = ''
  for (let i = 0; i < n; i++) s += chars[nb_randInt(0, chars.length - 1)]
  return s
}

function nb_pick(arr) {
  return arr[nb_randInt(0, arr.length - 1)]
}

// ---- Verifiable checksums (each verified against known reference values in the test suite) ----

// USA ABA routing number (9 digits). Check: 3(d1+d4+d7) + 7(d2+d5+d8) + (d3+d6+d9) ≡ 0 (mod 10).
function abaChecksum(nine) {
  const d = nine.split('').map(Number)
  return (3 * (d[0] + d[3] + d[6]) + 7 * (d[1] + d[4] + d[7]) + (d[2] + d[5] + d[8])) % 10
}

function abaRoutingIsValid(n) {
  return /^\d{9}$/.test(n) && abaChecksum(n) === 0
}

function genAbaRouting() {
  // First two digits of real Fed routing numbers fall in specific ranges; keep the leading digit in
  // 0-3 for a plausible shape, then solve the last digit for a valid weighted-MOD-10 checksum.
  const first8 = String(nb_randInt(0, 3)) + nb_randDigits(7)
  const d = first8.split('').map(Number)
  const partial = 3 * (d[0] + d[3] + d[6]) + 7 * (d[1] + d[4] + d[7]) + (d[2] + d[5])
  return first8 + ((10 - (partial % 10)) % 10)
}

// Mexico CLABE (18 digits): 3 bank + 3 branch + 11 account + 1 check. Check digit per digit uses
// weights 3,7,1 cycling, taking (digit*weight) mod 10 before summing (python-stdnum mx.clabe).
function clabeCheckDigit(first17) {
  const weights = [3, 7, 1]
  let sum = 0
  for (let i = 0; i < 17; i++) sum += (Number(first17[i]) * weights[i % 3]) % 10
  return String((10 - (sum % 10)) % 10)
}

function clabeIsValid(n) {
  return /^\d{18}$/.test(n) && clabeCheckDigit(n.slice(0, 17)) === n[17]
}

function genClabe() {
  const body = nb_randDigits(3) + nb_randDigits(3) + nb_randDigits(11)
  return body + clabeCheckDigit(body)
}

// Argentina CBU (22 digits): block 1 = 7 body + 1 check (weights 7,1,3,9,7,1,3); block 2 = 13 body
// + 1 check (weights 3,9,7,1,3,9,7,1,3,9,7,1,3). Each check = (10 - weightedSum mod 10) mod 10.
const CBU_W1 = [7, 1, 3, 9, 7, 1, 3]
const CBU_W2 = [3, 9, 7, 1, 3, 9, 7, 1, 3, 9, 7, 1, 3]

function cbuCheckDigit(bodyDigits, weights) {
  let sum = 0
  for (let i = 0; i < weights.length; i++) sum += Number(bodyDigits[i]) * weights[i]
  return (10 - (sum % 10)) % 10
}

function cbuIsValid(n) {
  if (!/^\d{22}$/.test(n)) return false
  return cbuCheckDigit(n.slice(0, 7), CBU_W1) === Number(n[7]) &&
         cbuCheckDigit(n.slice(8, 21), CBU_W2) === Number(n[21])
}

function genCbu() {
  const b1 = nb_randDigits(7)
  const b2 = nb_randDigits(13)
  return b1 + cbuCheckDigit(b1, CBU_W1) + b2 + cbuCheckDigit(b2, CBU_W2)
}

// SWIFT/BIC (ISO 9362): 4-letter bank + 2-letter country + 2-char location, optional 3-char branch.
function nb_generateSwift(countryCode) {
  const bic = nb_randLetters(4) + countryCode + nb_randAlnum(2)
  return nb_randInt(0, 1) === 1 ? bic + nb_randAlnum(3) : bic
}

// ---- Country registry ----
// Each entry lists a country's documented domestic bank identifiers. `gen` returns the domestic
// fields (before Account Number + SWIFT, which are appended uniformly). `checksum` names the one
// identifier that carries a verifiable check digit, or null when the country is format-only.
const NONIBAN_COUNTRIES = [
  { code: 'US', name: 'United States', checksum: 'ABA routing number', gen: () => [['Routing Number (ABA)', genAbaRouting()]] },
  { code: 'CA', name: 'Canada', checksum: null, gen: () => [['Institution Number', nb_randDigits(3)], ['Transit Number', nb_randDigits(5)]] },
  { code: 'AU', name: 'Australia', checksum: null, gen: () => [['BSB', nb_randDigits(3) + '-' + nb_randDigits(3)]] },
  { code: 'NZ', name: 'New Zealand', checksum: null, gen: () => [['Bank Code', nb_randDigits(2)], ['Branch Code', nb_randDigits(4)]] },
  { code: 'JP', name: 'Japan', checksum: null, gen: () => [['Bank Code', nb_randDigits(4)], ['Branch Code', nb_randDigits(3)], ['Account Type', nb_pick(['Futsu (ordinary)', 'Toza (current)'])]] },
  { code: 'IN', name: 'India', checksum: null, gen: () => [['IFSC Code', nb_randLetters(4) + '0' + nb_randAlnum(6)]] },
  { code: 'CN', name: 'China', checksum: null, gen: () => [['CNAPS Code', nb_randDigits(12)]] },
  { code: 'VN', name: 'Vietnam', checksum: null, gen: () => [] },
  { code: 'SG', name: 'Singapore', checksum: null, gen: () => [['Bank Code', nb_randDigits(4)], ['Branch Code', nb_randDigits(3)]] },
  { code: 'MY', name: 'Malaysia', checksum: null, gen: () => [] },
  { code: 'ID', name: 'Indonesia', checksum: null, gen: () => [['Bank Code', nb_randDigits(3)]] },
  { code: 'HK', name: 'Hong Kong', checksum: null, gen: () => [['Bank Code', nb_randDigits(3)], ['Branch Code', nb_randDigits(3)]] },
  { code: 'ZA', name: 'South Africa', checksum: null, gen: () => [['Branch Code', nb_randDigits(6)]] },
  { code: 'TH', name: 'Thailand', checksum: null, gen: () => [['Bank Code', nb_randDigits(3)]] },
  { code: 'PH', name: 'Philippines', checksum: null, gen: () => [] },
  { code: 'KR', name: 'South Korea', checksum: null, gen: () => [['Bank Code', nb_randDigits(3)]] },
  { code: 'MX', name: 'Mexico', checksum: 'CLABE', gen: () => [['CLABE', genClabe()]] },
  { code: 'AR', name: 'Argentina', checksum: 'CBU', gen: () => [['CBU', genCbu()]] }
]

// How long the plain (domestic) account number should be for each country, as [min, max] digits.
const NONIBAN_ACCOUNT_LEN = {
  US: [8, 12], CA: [7, 12], AU: [6, 10], NZ: [7, 7], JP: [7, 7], IN: [9, 18], CN: [16, 19],
  VN: [8, 14], SG: [7, 10], MY: [10, 16], ID: [10, 15], HK: [6, 9], ZA: [7, 11], TH: [10, 10],
  PH: [10, 12], KR: [11, 14], MX: [10, 11], AR: [10, 14]
}

function generateNonIban(code) {
  const spec = NONIBAN_COUNTRIES.find(c => c.code === code)
  if (!spec) throw new Error('Unsupported country: ' + code)
  const [min, max] = NONIBAN_ACCOUNT_LEN[code]
  const fields = spec.gen().map(([label, value]) => ({ label, value }))
  fields.push({ label: 'Account Number', value: nb_randDigitsNonZero(nb_randInt(min, max)) })
  fields.push({ label: 'SWIFT / BIC', value: nb_generateSwift(code) })
  return { country: spec.name, countryCode: code, checksum: spec.checksum, fields }
}

// ---- Wiring ----
;(function initNonIbanTool() {
  const countryTrigger = document.getElementById('nb-country-trigger')
  const countryTriggerLabel = document.getElementById('nb-country-trigger-label')
  const countryPanel = document.getElementById('nb-country-panel')
  const generateBtn = document.getElementById('nb-generate')
  const fieldsEl = document.getElementById('nb-fields')
  const errorEl = document.getElementById('nb-error')

  if (!countryTrigger) return // Non-IBAN tab not present in this build

  let currentCountry = 'US'

  const COPY_ICON = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>'
  const CHECK_ICON = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>'

  const sortedCountries = [...NONIBAN_COUNTRIES].sort((a, b) => a.name.localeCompare(b.name))

  function renderCountryOptions() {
    countryPanel.innerHTML = sortedCountries.map(c =>
      `<button type="button" class="ft-select-option${c.code === currentCountry ? ' active' : ''}" data-value="${c.code}">${c.name}</button>`
    ).join('')
  }

  function setCountry(code) {
    currentCountry = code
    const c = NONIBAN_COUNTRIES.find(x => x.code === code)
    countryTriggerLabel.textContent = c ? c.name : code
    renderCountryOptions()
  }

  function openPanel() {
    countryPanel.hidden = false
    const rect = countryTrigger.getBoundingClientRect()
    countryPanel.style.left = rect.left + 'px'
    countryPanel.style.width = rect.width + 'px'
    countryPanel.style.top = (rect.bottom + 4) + 'px'
    countryPanel.style.maxHeight = Math.max(120, window.innerHeight - rect.bottom - 12) + 'px'
  }

  function closePanel() {
    countryPanel.hidden = true
  }

  countryTrigger.addEventListener('click', () => {
    const wasHidden = countryPanel.hidden
    closePanel()
    if (wasHidden) openPanel()
  })
  countryPanel.addEventListener('click', e => {
    const opt = e.target.closest('.ft-select-option')
    if (!opt) return
    setCountry(opt.dataset.value)
    closePanel()
    generate()
  })
  document.addEventListener('click', e => {
    if (!countryPanel.contains(e.target) && !countryTrigger.contains(e.target)) closePanel()
  })

  function escapeHtml(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
  }

  function fieldRow(label, value) {
    const escaped = escapeHtml(value)
    return `<div class="pf-field">
      <div class="pf-field-label">${label}</div>
      <div class="pf-field-value-wrap">
        <input type="text" class="pf-field-value" readonly value="${escaped}">
        <button type="button" class="tt-copy-icon-btn pf-copy-btn" data-copy="${escaped}" aria-label="Copy" title="Copy to clipboard">${COPY_ICON}</button>
      </div>
    </div>`
  }

  function renderNonIban(bank) {
    fieldsEl.innerHTML = bank.fields.map(f => fieldRow(f.label, f.value)).join('')
  }

  fieldsEl.addEventListener('click', e => {
    const btn = e.target.closest('.pf-copy-btn')
    if (!btn) return
    navigator.clipboard.writeText(btn.dataset.copy).then(() => {
      btn.innerHTML = CHECK_ICON
      btn.classList.add('copied')
      setTimeout(() => {
        btn.innerHTML = COPY_ICON
        btn.classList.remove('copied')
      }, 1400)
    })
  })

  function generate() {
    errorEl.hidden = true
    try {
      renderNonIban(generateNonIban(currentCountry))
    } catch (err) {
      errorEl.textContent = err.message
      errorEl.hidden = false
      fieldsEl.innerHTML = ''
    }
  }

  generateBtn.addEventListener('click', generate)

  setCountry('US')
  generate()
})()
