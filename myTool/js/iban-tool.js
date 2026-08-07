// ---- IBAN Tool: generates SYNTHETIC IBAN / SWIFT-BIC / bank account numbers per country for
// form/validation testing. Nothing here is a real bank or a real account — bank/branch codes are
// randomly generated and are NOT mapped to any real institution.
//
// IBANs are built to the official ISO 13616 per-country structure (correct total length and
// bank/branch/account layout) and carry correct ISO 7064 MOD-97-10 check digits, so every one
// passes the universal IBAN checksum that virtually all validators/payment libraries use (verified
// in the test suite against known reference IBANs). NOTE: some countries also embed a *national*
// check digit inside the BBAN (e.g. France's RIB key, Belgium's mod-97, Italy's CIN, Spain's DC).
// Those national check digits are NOT separately computed here — the digits in those positions are
// random — so a strict national-level validator may reject them, even though the IBAN checksum is
// valid. SWIFT/BIC values are format-correct only (there is no BIC checksum).

function ib_randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function ib_randDigits(n) {
  let s = ''
  for (let i = 0; i < n; i++) s += ib_randInt(0, 9)
  return s
}

function ib_randLetters(n) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  let s = ''
  for (let i = 0; i < n; i++) s += alphabet[ib_randInt(0, 25)]
  return s
}

function ib_randAlnum(n) {
  const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  let s = ''
  for (let i = 0; i < n; i++) s += chars[ib_randInt(0, chars.length - 1)]
  return s
}

// ---- IBAN country registry (ISO 13616) ----
// `bban` describes the Basic Bank Account Number as ordered segments: [role, length, charset].
//   role:    'bank' | 'branch' | 'account' | 'x'   ('x' = national check digit / account type /
//            other filler — part of the BBAN and the checksum, but not surfaced as its own field)
//   charset: 'n' digits | 'a' A-Z letters | 'c' alphanumeric (0-9A-Z)
// The segment lengths always sum to (ibanLength - 4): the 4 being the country code + 2 check digits.
const IBAN_COUNTRIES = [
  { code: 'AD', name: 'Andorra', ibanLength: 24, bban: [['bank', 4, 'n'], ['branch', 4, 'n'], ['account', 12, 'c']] },
  { code: 'AT', name: 'Austria', ibanLength: 20, bban: [['bank', 5, 'n'], ['account', 11, 'n']] },
  { code: 'BE', name: 'Belgium', ibanLength: 16, bban: [['bank', 3, 'n'], ['account', 7, 'n'], ['x', 2, 'n']] },
  { code: 'BG', name: 'Bulgaria', ibanLength: 22, bban: [['bank', 4, 'a'], ['branch', 4, 'n'], ['x', 2, 'n'], ['account', 8, 'c']] },
  { code: 'HR', name: 'Croatia', ibanLength: 21, bban: [['bank', 7, 'n'], ['account', 10, 'n']] },
  { code: 'CY', name: 'Cyprus', ibanLength: 28, bban: [['bank', 3, 'n'], ['branch', 5, 'n'], ['account', 16, 'c']] },
  { code: 'CZ', name: 'Czechia', ibanLength: 24, bban: [['bank', 4, 'n'], ['account', 16, 'n']] },
  { code: 'DK', name: 'Denmark', ibanLength: 18, bban: [['bank', 4, 'n'], ['account', 10, 'n']] },
  { code: 'EE', name: 'Estonia', ibanLength: 20, bban: [['bank', 2, 'n'], ['account', 14, 'n']] },
  { code: 'FI', name: 'Finland', ibanLength: 18, bban: [['bank', 3, 'n'], ['account', 11, 'n']] },
  { code: 'FR', name: 'France', ibanLength: 27, bban: [['bank', 5, 'n'], ['branch', 5, 'n'], ['account', 11, 'c'], ['x', 2, 'n']] },
  { code: 'DE', name: 'Germany', ibanLength: 22, bban: [['bank', 8, 'n'], ['account', 10, 'n']] },
  { code: 'GR', name: 'Greece', ibanLength: 27, bban: [['bank', 3, 'n'], ['branch', 4, 'n'], ['account', 16, 'c']] },
  { code: 'HU', name: 'Hungary', ibanLength: 28, bban: [['bank', 8, 'n'], ['account', 16, 'n']] },
  { code: 'IS', name: 'Iceland', ibanLength: 26, bban: [['bank', 4, 'n'], ['account', 18, 'n']] },
  { code: 'IE', name: 'Ireland', ibanLength: 22, bban: [['bank', 4, 'a'], ['branch', 6, 'n'], ['account', 8, 'n']] },
  { code: 'IT', name: 'Italy', ibanLength: 27, bban: [['x', 1, 'a'], ['bank', 5, 'n'], ['branch', 5, 'n'], ['account', 12, 'c']] },
  { code: 'LV', name: 'Latvia', ibanLength: 21, bban: [['bank', 4, 'a'], ['account', 13, 'c']] },
  { code: 'LI', name: 'Liechtenstein', ibanLength: 21, bban: [['bank', 5, 'n'], ['account', 12, 'c']] },
  { code: 'LT', name: 'Lithuania', ibanLength: 20, bban: [['bank', 5, 'n'], ['account', 11, 'n']] },
  { code: 'LU', name: 'Luxembourg', ibanLength: 20, bban: [['bank', 3, 'n'], ['account', 13, 'c']] },
  { code: 'MT', name: 'Malta', ibanLength: 31, bban: [['bank', 4, 'a'], ['branch', 5, 'n'], ['account', 18, 'c']] },
  { code: 'MC', name: 'Monaco', ibanLength: 27, bban: [['bank', 5, 'n'], ['branch', 5, 'n'], ['account', 11, 'c'], ['x', 2, 'n']] },
  { code: 'NL', name: 'Netherlands', ibanLength: 18, bban: [['bank', 4, 'a'], ['account', 10, 'n']] },
  { code: 'NO', name: 'Norway', ibanLength: 15, bban: [['bank', 4, 'n'], ['account', 7, 'n']] },
  { code: 'PL', name: 'Poland', ibanLength: 28, bban: [['bank', 8, 'n'], ['account', 16, 'n']] },
  { code: 'PT', name: 'Portugal', ibanLength: 25, bban: [['bank', 4, 'n'], ['branch', 4, 'n'], ['account', 11, 'n'], ['x', 2, 'n']] },
  { code: 'RO', name: 'Romania', ibanLength: 24, bban: [['bank', 4, 'a'], ['account', 16, 'c']] },
  { code: 'SM', name: 'San Marino', ibanLength: 27, bban: [['x', 1, 'a'], ['bank', 5, 'n'], ['branch', 5, 'n'], ['account', 12, 'c']] },
  { code: 'SK', name: 'Slovakia', ibanLength: 24, bban: [['bank', 4, 'n'], ['account', 16, 'n']] },
  { code: 'SI', name: 'Slovenia', ibanLength: 19, bban: [['bank', 5, 'n'], ['account', 8, 'n'], ['x', 2, 'n']] },
  { code: 'ES', name: 'Spain', ibanLength: 24, bban: [['bank', 4, 'n'], ['branch', 4, 'n'], ['x', 2, 'n'], ['account', 10, 'n']] },
  { code: 'SE', name: 'Sweden', ibanLength: 24, bban: [['bank', 3, 'n'], ['account', 17, 'n']] },
  { code: 'CH', name: 'Switzerland', ibanLength: 21, bban: [['bank', 5, 'n'], ['account', 12, 'c']] },
  { code: 'GB', name: 'United Kingdom', ibanLength: 22, bban: [['bank', 4, 'a'], ['branch', 6, 'n'], ['account', 8, 'n']] }
]

// ISO 7064 MOD-97-10: rearrange (BBAN + country code + "00"), map letters A-Z -> 10-35, take the
// whole thing mod 97 (digit-by-digit to avoid bignum overflow); the check digits are 98 - that.
function ibanMod97(str) {
  const numeric = str.replace(/[A-Z]/g, ch => String(ch.charCodeAt(0) - 55))
  let remainder = 0
  for (let i = 0; i < numeric.length; i++) {
    remainder = (remainder * 10 + Number(numeric[i])) % 97
  }
  return remainder
}

function ibanCheckDigits(countryCode, bban) {
  const remainder = ibanMod97(bban + countryCode + '00')
  return String(98 - remainder).padStart(2, '0')
}

// True iff `iban` satisfies the ISO 7064 MOD-97-10 checksum (the universal IBAN validity test).
function ibanIsValid(iban) {
  const s = String(iban).replace(/\s+/g, '').toUpperCase()
  if (!/^[A-Z]{2}[0-9]{2}[A-Z0-9]+$/.test(s)) return false
  return ibanMod97(s.slice(4) + s.slice(0, 4)) === 1
}

// SWIFT/BIC (ISO 9362): 4-letter bank code + 2-letter country code + 2-char location code, plus an
// optional 3-char branch code (8 or 11 chars total). No checksum exists — format only.
function generateBIC(countryCode) {
  const bic = ib_randLetters(4) + countryCode + ib_randAlnum(2)
  return ib_randInt(0, 1) === 1 ? bic + ib_randAlnum(3) : bic
}

function generateBBAN(spec) {
  let bban = ''
  const roles = { bank: '', branch: '', account: '' }
  for (const [role, len, charset] of spec.bban) {
    const seg = charset === 'n' ? ib_randDigits(len) : charset === 'a' ? ib_randLetters(len) : ib_randAlnum(len)
    bban += seg
    if (role in roles) roles[role] += seg
  }
  return { bban, roles }
}

function generateIban(countryCode) {
  const spec = IBAN_COUNTRIES.find(c => c.code === countryCode)
  if (!spec) throw new Error('Unsupported country: ' + countryCode)
  const { bban, roles } = generateBBAN(spec)
  const iban = spec.code + ibanCheckDigits(spec.code, bban) + bban
  return {
    country: spec.name,
    countryCode: spec.code,
    iban,
    ibanPretty: iban.replace(/(.{4})/g, '$1 ').trim(),
    bic: generateBIC(spec.code),
    bankCode: roles.bank,
    branchCode: roles.branch,
    accountNumber: roles.account
  }
}

// ---- Wiring ----
;(function initIbanTool() {
  const countryTrigger = document.getElementById('ib-country-trigger')
  const countryTriggerLabel = document.getElementById('ib-country-trigger-label')
  const countryPanel = document.getElementById('ib-country-panel')
  const generateBtn = document.getElementById('ib-generate')
  const fieldsEl = document.getElementById('ib-fields')
  const errorEl = document.getElementById('ib-error')

  if (!countryTrigger) return // Bank tab not present in this build

  let currentCountry = 'DE'

  const COPY_ICON = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>'
  const CHECK_ICON = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>'

  // Countries listed A-Z by name, matching the Profile tab's selector ordering
  const sortedCountries = [...IBAN_COUNTRIES].sort((a, b) => a.name.localeCompare(b.name))

  function renderCountryOptions() {
    countryPanel.innerHTML = sortedCountries.map(c =>
      `<button type="button" class="ft-select-option${c.code === currentCountry ? ' active' : ''}" data-value="${c.code}">${c.name}</button>`
    ).join('')
  }

  function setCountry(code) {
    currentCountry = code
    const c = IBAN_COUNTRIES.find(x => x.code === code)
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
    saveSettings()
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

  function renderIban(bank) {
    const rows = [
      fieldRow('IBAN', bank.iban),
      fieldRow('IBAN (spaced)', bank.ibanPretty),
      fieldRow('SWIFT / BIC', bank.bic),
      fieldRow('Bank Code', bank.bankCode)
    ]
    if (bank.branchCode) rows.push(fieldRow('Branch Code', bank.branchCode))
    rows.push(fieldRow('Account Number', bank.accountNumber))
    fieldsEl.innerHTML = rows.join('')
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
      const data = generateIban(currentCountry)
      renderIban(data)
      syncSet({ [LAST_KEY]: data }) // keep the result across popup open/close
    } catch (err) {
      errorEl.textContent = err.message
      errorEl.hidden = false
      fieldsEl.innerHTML = ''
    }
  }

  generateBtn.addEventListener('click', generate)

  const resetBtn = document.getElementById('ib-reset-btn')
  const SETTINGS_KEY = 'iban-tool-country'
  const LAST_KEY = 'iban-tool-last'
  const DEFAULT_COUNTRY = 'DE'
  function saveSettings() { syncSet({ [SETTINGS_KEY]: currentCountry }) }
  resetBtn.addEventListener('click', () => { setCountry(DEFAULT_COUNTRY); saveSettings(); generate() })

  syncGet([SETTINGS_KEY, LAST_KEY]).then(d => {
    setCountry(d[SETTINGS_KEY] || DEFAULT_COUNTRY)
    if (d[LAST_KEY]) renderIban(d[LAST_KEY]); else generate()
  })
})()
