// ---- Validator Tool: paste an IBAN, card number, EAN/UPC, or US routing number and check whether
// it's valid (and why) — the reverse of the generator tools. All checks are standard checksums,
// implemented here (and unit-tested) rather than reused across the generator IIFEs so this tool is
// self-contained. Everything above the wiring marker is pure (no DOM).

function va_digits(s) { return String(s).replace(/\D/g, '') }

// Luhn (mod 10) — cards. Valid when the running total is a multiple of 10.
function va_luhnValid(num) {
  const n = va_digits(num)
  if (!n) return false
  let sum = 0
  const rev = n.split('').reverse()
  for (let i = 0; i < rev.length; i++) {
    let d = +rev[i]
    if (i % 2 === 1) { d *= 2; if (d > 9) d -= 9 }
    sum += d
  }
  return sum % 10 === 0
}

// Network from the IIN prefix + length (mirrors the Card tool's ranges), or null.
function va_cardNetwork(num) {
  const n = va_digits(num)
  const p = k => parseInt(n.slice(0, k), 10)
  if (/^4/.test(n) && (n.length === 13 || n.length === 16 || n.length === 19)) return 'Visa'
  if ((/^5[1-5]/.test(n) || (p(4) >= 2221 && p(4) <= 2720)) && n.length === 16) return 'Mastercard'
  if (/^3[47]/.test(n) && n.length === 15) return 'American Express'
  if ((/^6011/.test(n) || /^65/.test(n) || (p(3) >= 644 && p(3) <= 649)) && n.length === 16) return 'Discover'
  if (p(4) >= 3528 && p(4) <= 3589 && n.length === 16) return 'JCB'
  if (/^3(0[0-5]|[689])/.test(n) && n.length === 14) return 'Diners Club'
  if (/^62/.test(n) && n.length >= 16 && n.length <= 19) return 'UnionPay'
  return null
}

function va_validateCard(raw) {
  const n = va_digits(raw)
  if (n.length < 12 || n.length > 19) return { ok: false, detail: 'Card numbers are 12–19 digits (got ' + n.length + ').' }
  if (!va_luhnValid(n)) return { ok: false, detail: 'Fails the Luhn check digit.' }
  const net = va_cardNetwork(n)
  return { ok: true, detail: 'Luhn OK' + (net ? ' — ' + net : ' — network not recognized') }
}

// GTIN check digit (EAN-8/13, UPC-A/GTIN-12/14): weight 3,1,3,1… from the right of the payload.
function va_gtinCheck(payload) {
  const d = String(payload).split('').reverse().map(Number)
  let sum = 0
  for (let i = 0; i < d.length; i++) sum += d[i] * (i % 2 === 0 ? 3 : 1)
  return (10 - (sum % 10)) % 10
}
const VA_GTIN_NAMES = { 8: 'EAN-8', 12: 'UPC-A', 13: 'EAN-13', 14: 'ITF-14 / GTIN-14' }
function va_validateGtin(raw) {
  const n = va_digits(raw)
  if (!VA_GTIN_NAMES[n.length]) return { ok: false, detail: 'GTIN codes are 8, 12, 13, or 14 digits (got ' + n.length + ').' }
  const want = va_gtinCheck(n.slice(0, -1))
  const got = +n.slice(-1)
  return got === want
    ? { ok: true, detail: VA_GTIN_NAMES[n.length] + ' — check digit OK' }
    : { ok: false, detail: VA_GTIN_NAMES[n.length] + ' — check digit should be ' + want + ', got ' + got }
}

// US ABA routing number: 9 digits, weighted 3,7,1 repeating, sum a multiple of 10.
function va_validateAba(raw) {
  const n = va_digits(raw)
  if (n.length !== 9) return { ok: false, detail: 'Routing numbers are 9 digits (got ' + n.length + ').' }
  const w = [3, 7, 1, 3, 7, 1, 3, 7, 1]
  let sum = 0
  for (let i = 0; i < 9; i++) sum += +n[i] * w[i]
  return sum % 10 === 0 ? { ok: true, detail: 'Checksum OK' } : { ok: false, detail: 'Fails the ABA checksum.' }
}

// Official IBAN lengths per country (ISO 13616 registry) — the widely-used ones.
var VA_IBAN_LEN = {
  AD: 24, AE: 23, AL: 28, AT: 20, AZ: 28, BA: 20, BE: 16, BG: 22, BH: 22, BR: 29, CH: 21, CY: 28,
  CZ: 24, DE: 22, DK: 18, DO: 28, EE: 20, ES: 24, FI: 18, FO: 18, FR: 27, GB: 22, GE: 22, GI: 23,
  GL: 18, GR: 27, HR: 21, HU: 28, IE: 22, IL: 23, IS: 26, IT: 27, KW: 30, KZ: 20, LB: 28, LI: 21,
  LT: 20, LU: 20, LV: 21, MC: 27, MD: 24, ME: 22, MK: 19, MR: 27, MT: 31, MU: 30, NL: 18, NO: 15,
  PL: 28, PT: 25, QA: 29, RO: 24, RS: 22, SA: 24, SE: 24, SI: 19, SK: 24, SM: 27, TN: 24, TR: 26,
  UA: 29, VG: 24, XK: 20
}
// ISO 7064 mod-97-10: move the first 4 chars to the end, map letters A=10…Z=35, take mod 97.
function va_ibanMod97(iban) {
  const rearranged = iban.slice(4) + iban.slice(0, 4)
  let remainder = 0
  for (let i = 0; i < rearranged.length; i++) {
    const c = rearranged[i]
    const val = /[0-9]/.test(c) ? c : (c.charCodeAt(0) - 55).toString() // A(65)->10
    for (let j = 0; j < val.length; j++) remainder = (remainder * 10 + +val[j]) % 97
  }
  return remainder
}
function va_validateIban(raw) {
  const s = String(raw).replace(/\s/g, '').toUpperCase()
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]+$/.test(s)) return { ok: false, detail: 'Not IBAN format (2 letters, 2 digits, then alphanumerics).' }
  const cc = s.slice(0, 2)
  const expected = VA_IBAN_LEN[cc]
  if (expected && s.length !== expected) return { ok: false, detail: cc + ' IBANs are ' + expected + ' characters (got ' + s.length + ').' }
  if (va_ibanMod97(s) !== 1) return { ok: false, detail: 'Fails the mod-97 checksum.' }
  return { ok: true, detail: cc + ' — mod-97 OK' + (expected ? '' : ' (length not verified for ' + cc + ')') }
}

// ---- Wiring ----
;(function initValidatorTool() {
  const input = document.getElementById('va-input')
  if (!input) return // Validator tab not present in this build

  const resultsEl = document.getElementById('va-results')
  const hintEl = document.getElementById('va-hint')

  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') }

  // Show a result only for the types whose shape matches the input, so the list isn't all failures.
  function buildResults(raw) {
    const s = raw.trim()
    const compact = s.replace(/\s/g, '')
    const digits = va_digits(s)
    const rows = []
    if (/^[A-Za-z]{2}[0-9]{2}[A-Za-z0-9]*$/.test(compact)) rows.push(['IBAN', va_validateIban(s)])
    if (/^[\d ]+$/.test(s) && digits) {
      if (digits.length >= 12 && digits.length <= 19) rows.push(['Card', va_validateCard(digits)])
      if (VA_GTIN_NAMES[digits.length]) rows.push(['EAN / UPC', va_validateGtin(digits)])
      if (digits.length === 9) rows.push(['US routing (ABA)', va_validateAba(digits)])
    }
    return rows
  }

  function render() {
    const rows = buildResults(input.value)
    if (input.value.trim() === '') {
      resultsEl.innerHTML = ''
      hintEl.hidden = false
      return
    }
    hintEl.hidden = true
    if (!rows.length) {
      resultsEl.innerHTML = '<p class="va-none">Doesn\'t match a known format (IBAN, card, EAN/UPC, or 9-digit routing).</p>'
      return
    }
    resultsEl.innerHTML = rows.map(r => {
      const ok = r[1].ok
      return '<div class="va-row ' + (ok ? 'va-ok' : 'va-bad') + '">' +
        '<span class="va-badge">' + (ok ? '✓' : '✗') + '</span>' +
        '<span class="va-type">' + esc(r[0]) + '</span>' +
        '<span class="va-detail">' + esc(r[1].detail) + '</span></div>'
    }).join('')
  }

  input.addEventListener('input', render)
  document.getElementById('va-reset-btn').addEventListener('click', () => { input.value = ''; render() })
  render()
})()
