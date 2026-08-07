// ---- BBAN Tool: generates a SYNTHETIC domestic bank account number (BBAN) with a CORRECT national
// check digit, for the countries whose BBAN carries one and whose algorithm is verifiable. Unlike
// the IBAN tab (which is valid at the ISO 7064 mod-97 IBAN layer only, with random national digits),
// every BBAN here is valid at the *national* layer too — so the assembled IBAN is valid at BOTH
// layers. Bank/branch codes are random and are NOT mapped to any real institution.
//
// Coverage is intentionally limited to the 10 countries whose national check-digit algorithm was
// verified in the test suite against a real ISO 13616 registry IBAN (the algorithm reproduces the
// check digit embedded in a known-valid IBAN). Countries whose algorithm couldn't be unambiguously
// verified are deliberately left out rather than guessed. See bban-tool.test.js for the references.

function bb_randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function bb_randDigits(n) {
  let s = ''
  for (let i = 0; i < n; i++) s += bb_randInt(0, 9)
  return s
}

function bb_randAlnum(n) {
  const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  let s = ''
  for (let i = 0; i < n; i++) s += chars[bb_randInt(0, chars.length - 1)]
  return s
}

// Letters -> digits (A=10..Z=35), then whole string mod 97 digit-by-digit (ISO 7064 helper).
function bb_mod97(str) {
  const numeric = str.replace(/[A-Z]/g, ch => String(ch.charCodeAt(0) - 55))
  let r = 0
  for (let i = 0; i < numeric.length; i++) r = (r * 10 + Number(numeric[i])) % 97
  return r
}

function bb_ibanCheckDigits(cc, bban) {
  return String(98 - bb_mod97(bban + cc + '00')).padStart(2, '0')
}

function bb_ibanIsValid(iban) {
  const s = String(iban).replace(/\s+/g, '').toUpperCase()
  if (!/^[A-Z]{2}[0-9]{2}[A-Z0-9]+$/.test(s)) return false
  return bb_mod97(s.slice(4) + s.slice(0, 4)) === 1
}

// ---- National check-digit algorithms (each verified against a registry IBAN in the test suite) ----

// Belgium: 2 check digits = the 10-digit (bank+account) number mod 97 (a remainder of 0 becomes 97).
function beCheck(body10) {
  let r = Number(body10) % 97
  if (r === 0) r = 97
  return String(r).padStart(2, '0')
}

// Norway: 1 check digit, mod-11 weighted (5,4,3,2,7,6,5,4,3,2). A weighted result needing digit 10
// has no valid single-digit check, so the caller regenerates — signalled by returning null.
function noCheck(body10) {
  const w = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2]
  let sum = 0
  for (let i = 0; i < 10; i++) sum += Number(body10[i]) * w[i]
  let c = 11 - (sum % 11)
  if (c === 11) c = 0
  return c === 10 ? null : String(c)
}

// Portugal (NIB) and Slovenia: ISO 7064 mod 97-10 over the body, 2 check digits.
function isoMod97Check(body) {
  return String(98 - bb_mod97(body + '00')).padStart(2, '0')
}

// Finland: 1 check digit via Luhn over the 13-digit body.
function fiLuhn(body13) {
  const rev = body13.split('').reverse().map(Number)
  let sum = 0
  for (let i = 0; i < rev.length; i++) {
    let v = rev[i]
    if (i % 2 === 0) { v *= 2; if (v > 9) v -= 9 }
    sum += v
  }
  return String((10 - (sum % 10)) % 10)
}

// Spain: 2 control digits (DC). DC1 over "00"+bank+branch, DC2 over the 10-digit account, each with
// weights 1,2,4,8,5,10,9,7,3,6; digit = 11 - (sum mod 11), collapsing 11->0 and 10->1.
const ES_W = [1, 2, 4, 8, 5, 10, 9, 7, 3, 6]
function esDcDigit(ten) {
  let s = 0
  for (let i = 0; i < 10; i++) s += Number(ten[i]) * ES_W[i]
  let c = 11 - (s % 11)
  if (c === 11) c = 0
  if (c === 10) c = 1
  return String(c)
}
function esDc(bank, branch, account) {
  const dc1 = esDcDigit('00' + bank + branch)
  const dc2 = esDcDigit(account)
  return dc1 + dc2
}

// Italy / San Marino: CIN letter over ABI+CAB+account (22 chars), odd/even position value tables.
const IT_ODD = { '0': 1, '1': 0, '2': 5, '3': 7, '4': 9, '5': 13, '6': 15, '7': 17, '8': 19, '9': 21, A: 1, B: 0, C: 5, D: 7, E: 9, F: 13, G: 15, H: 17, I: 19, J: 21, K: 2, L: 4, M: 18, N: 20, O: 11, P: 3, Q: 6, R: 8, S: 12, T: 14, U: 16, V: 10, W: 22, X: 25, Y: 24, Z: 23 }
const IT_EVEN = { '0': 0, '1': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, A: 0, B: 1, C: 2, D: 3, E: 4, F: 5, G: 6, H: 7, I: 8, J: 9, K: 10, L: 11, M: 12, N: 13, O: 14, P: 15, Q: 16, R: 17, S: 18, T: 19, U: 20, V: 21, W: 22, X: 23, Y: 24, Z: 25 }
function itCin(body22) {
  let sum = 0
  for (let i = 0; i < body22.length; i++) sum += (i % 2 === 0) ? IT_ODD[body22[i]] : IT_EVEN[body22[i]]
  return String.fromCharCode('A'.charCodeAt(0) + (sum % 26))
}

// France / Monaco: 2-digit RIB key = 97 - ((89*bank + 15*branch + 3*account) mod 97), letters in the
// account first mapped to digits via the standard RIB letter table.
const FR_MAP = { A: 1, B: 2, C: 3, D: 4, E: 5, F: 6, G: 7, H: 8, I: 9, J: 1, K: 2, L: 3, M: 4, N: 5, O: 6, P: 7, Q: 8, R: 9, S: 2, T: 3, U: 4, V: 5, W: 6, X: 7, Y: 8, Z: 9 }
function frRibKey(bank, branch, account) {
  const conv = s => s.replace(/[A-Z]/g, ch => String(FR_MAP[ch]))
  const b = Number(conv(bank)), g = Number(conv(branch)), a = Number(conv(account))
  return String(97 - ((89 * b + 15 * g + 3 * a) % 97)).padStart(2, '0')
}

// ---- Country registry ----
// Each build() returns the domestic pieces plus the correct national check, and the assembled BBAN.
const BBAN_COUNTRIES = [
  {
    code: 'BE', name: 'Belgium', scheme: 'Belgium (mod-97)', build() {
      const bank = bb_randDigits(3), account = bb_randDigits(7)
      const check = beCheck(bank + account)
      return { parts: [['Bank Code', bank], ['Account Number', account]], checkLabel: 'Check Digits', check, bban: bank + account + check }
    }
  },
  {
    code: 'NO', name: 'Norway', scheme: 'Norway (mod-11)', build() {
      let bank, account, check
      do { bank = bb_randDigits(4); account = bb_randDigits(6); check = noCheck(bank + account) } while (check === null)
      return { parts: [['Bank Code', bank], ['Account Number', account]], checkLabel: 'Check Digit', check, bban: bank + account + check }
    }
  },
  {
    code: 'PT', name: 'Portugal', scheme: 'NIB (Portugal)', build() {
      const bank = bb_randDigits(4), branch = bb_randDigits(4), account = bb_randDigits(11)
      const check = isoMod97Check(bank + branch + account)
      return { parts: [['Bank Code', bank], ['Branch Code', branch], ['Account Number', account]], checkLabel: 'Check Digits', check, bban: bank + branch + account + check }
    }
  },
  {
    code: 'SI', name: 'Slovenia', scheme: 'Slovenia (mod-97)', build() {
      const bank = bb_randDigits(5), account = bb_randDigits(8)
      const check = isoMod97Check(bank + account)
      return { parts: [['Bank/Branch Code', bank], ['Account Number', account]], checkLabel: 'Check Digits', check, bban: bank + account + check }
    }
  },
  {
    code: 'FI', name: 'Finland', scheme: 'Finland (Luhn)', build() {
      const bank = bb_randDigits(6), account = bb_randDigits(7)
      const check = fiLuhn(bank + account)
      return { parts: [['Bank Code', bank], ['Account Number', account]], checkLabel: 'Check Digit', check, bban: bank + account + check }
    }
  },
  {
    code: 'ES', name: 'Spain', scheme: 'Spain (DC)', build() {
      const bank = bb_randDigits(4), branch = bb_randDigits(4), account = bb_randDigits(10)
      const check = esDc(bank, branch, account)
      return { parts: [['Bank Code', bank], ['Branch Code', branch], ['Account Number', account]], checkLabel: 'Control Digits (DC)', check, bban: bank + branch + check + account }
    }
  },
  {
    code: 'IT', name: 'Italy', scheme: 'CIN (Italy)', build() {
      const bank = bb_randDigits(5), branch = bb_randDigits(5), account = bb_randAlnum(12)
      const check = itCin(bank + branch + account)
      return { parts: [['ABI (Bank)', bank], ['CAB (Branch)', branch], ['Account Number', account]], checkLabel: 'CIN', check, bban: check + bank + branch + account }
    }
  },
  {
    code: 'SM', name: 'San Marino', scheme: 'CIN (San Marino)', build() {
      const bank = bb_randDigits(5), branch = bb_randDigits(5), account = bb_randAlnum(12)
      const check = itCin(bank + branch + account)
      return { parts: [['ABI (Bank)', bank], ['CAB (Branch)', branch], ['Account Number', account]], checkLabel: 'CIN', check, bban: check + bank + branch + account }
    }
  },
  {
    code: 'FR', name: 'France', scheme: 'RIB (France)', build() {
      const bank = bb_randDigits(5), branch = bb_randDigits(5), account = bb_randAlnum(11)
      const check = frRibKey(bank, branch, account)
      return { parts: [['Bank Code', bank], ['Branch Code', branch], ['Account Number', account]], checkLabel: 'RIB Key', check, bban: bank + branch + account + check }
    }
  },
  {
    code: 'MC', name: 'Monaco', scheme: 'RIB (Monaco)', build() {
      const bank = bb_randDigits(5), branch = bb_randDigits(5), account = bb_randAlnum(11)
      const check = frRibKey(bank, branch, account)
      return { parts: [['Bank Code', bank], ['Branch Code', branch], ['Account Number', account]], checkLabel: 'RIB Key', check, bban: bank + branch + account + check }
    }
  }
]

function generateBban(code) {
  const spec = BBAN_COUNTRIES.find(c => c.code === code)
  if (!spec) throw new Error('Unsupported country: ' + code)
  const r = spec.build()
  const iban = code + bb_ibanCheckDigits(code, r.bban) + r.bban
  const fields = [
    { label: 'Scheme', value: spec.scheme },
    ...r.parts.map(([label, value]) => ({ label, value })),
    { label: r.checkLabel, value: r.check },
    { label: 'BBAN', value: r.bban },
    { label: 'IBAN', value: iban }
  ]
  return { country: spec.name, countryCode: code, scheme: spec.scheme, bban: r.bban, iban, fields }
}

// ---- Wiring ----
;(function initBbanTool() {
  const countryTrigger = document.getElementById('bb-country-trigger')
  const countryTriggerLabel = document.getElementById('bb-country-trigger-label')
  const countryPanel = document.getElementById('bb-country-panel')
  const generateBtn = document.getElementById('bb-generate')
  const fieldsEl = document.getElementById('bb-fields')
  const errorEl = document.getElementById('bb-error')

  if (!countryTrigger) return // BBAN tab not present in this build

  let currentCountry = 'FR'

  const COPY_ICON = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>'
  const CHECK_ICON = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>'

  const sortedCountries = [...BBAN_COUNTRIES].sort((a, b) => a.name.localeCompare(b.name))

  function renderCountryOptions() {
    countryPanel.innerHTML = sortedCountries.map(c =>
      `<button type="button" class="ft-select-option${c.code === currentCountry ? ' active' : ''}" data-value="${c.code}">${c.name}</button>`
    ).join('')
  }

  function setCountry(code) {
    currentCountry = code
    const c = BBAN_COUNTRIES.find(x => x.code === code)
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

  function renderBban(bank) {
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
      const data = generateBban(currentCountry)
      renderBban(data)
      syncSet({ [LAST_KEY]: data }) // keep the result across popup open/close
    } catch (err) {
      errorEl.textContent = err.message
      errorEl.hidden = false
      fieldsEl.innerHTML = ''
    }
  }

  generateBtn.addEventListener('click', generate)

  const resetBtn = document.getElementById('bb-reset-btn')
  const SETTINGS_KEY = 'bban-tool-country'
  const LAST_KEY = 'bban-tool-last'
  const DEFAULT_COUNTRY = 'FR'
  function saveSettings() { syncSet({ [SETTINGS_KEY]: currentCountry }) }
  resetBtn.addEventListener('click', () => { setCountry(DEFAULT_COUNTRY); saveSettings(); generate() })

  syncGet([SETTINGS_KEY, LAST_KEY]).then(d => {
    setCountry(d[SETTINGS_KEY] || DEFAULT_COUNTRY)
    if (d[LAST_KEY]) renderBban(d[LAST_KEY]); else generate()
  })
})()
