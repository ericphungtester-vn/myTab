// ---- Number Tool: format a number across locales and currencies with Intl.NumberFormat — to check
// how amounts render in different regions (thousand/decimal separators, currency symbol & placement,
// how many decimals a currency uses). Offline; the browser/Node ships the locale data. The input
// parser + reference data above the wiring marker are pure and unit-tested; formatting is delegated
// to Intl (spot-checked in the tests).

// Locales shown as rows — a spread of major + SEA regions relevant to fintech QA.
var NF_LOCALES = [
  { id: 'en-US', name: 'United States' },
  { id: 'en-GB', name: 'United Kingdom' },
  { id: 'de-DE', name: 'Germany' },
  { id: 'fr-FR', name: 'France' },
  { id: 'vi-VN', name: 'Vietnam' },
  { id: 'ja-JP', name: 'Japan' },
  { id: 'zh-CN', name: 'China' },
  { id: 'ko-KR', name: 'South Korea' },
  { id: 'th-TH', name: 'Thailand' },
  { id: 'id-ID', name: 'Indonesia' },
  { id: 'ms-MY', name: 'Malaysia' },
  { id: 'en-IN', name: 'India' }
]

var NF_CURRENCIES = ['USD', 'EUR', 'GBP', 'JPY', 'CNY', 'VND', 'SGD', 'THB', 'IDR', 'MYR', 'INR', 'KRW', 'AUD', 'CAD', 'CHF']

// Parse the input: a plain number, ignoring spaces/underscores and commas used as grouping.
function nf_parse(raw) {
  const s = String(raw).trim().replace(/[ _,]/g, '')
  if (s === '') return { ok: false, empty: true }
  const n = Number(s)
  return Number.isFinite(n) ? { ok: true, n: n } : { ok: false }
}

function nf_number(n, locale) { return new Intl.NumberFormat(locale).format(n) }
function nf_compact(n, locale) { return new Intl.NumberFormat(locale, { notation: 'compact', maximumFractionDigits: 1 }).format(n) }
function nf_currency(n, locale, cur) { return new Intl.NumberFormat(locale, { style: 'currency', currency: cur }).format(n) }

// ---- Wiring ----
;(function initNumberTool() {
  const input = document.getElementById('nf-input')
  if (!input) return // Number tab not present in this build

  const currencySel = document.getElementById('nf-currency')
  const outputEl = document.getElementById('nf-output')
  const hintEl = document.getElementById('nf-hint')
  const errorEl = document.getElementById('nf-error')

  currencySel.innerHTML = NF_CURRENCIES.map(c => `<option value="${c}">${c}</option>`).join('')

  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') }

  function render() {
    const res = nf_parse(input.value)
    if (res.empty) { hintEl.hidden = false; errorEl.hidden = true; outputEl.innerHTML = ''; return }
    hintEl.hidden = true
    if (!res.ok) { errorEl.textContent = 'Enter a plain number (use . for decimals).'; errorEl.hidden = false; outputEl.innerHTML = ''; return }
    errorEl.hidden = true

    const n = res.n
    const cur = currencySel.value
    const rows = NF_LOCALES.map(loc => {
      let number, compact, currency
      try { number = nf_number(n, loc.id) } catch (e) { number = '—' }
      try { compact = nf_compact(n, loc.id) } catch (e) { compact = '—' }
      try { currency = nf_currency(n, loc.id, cur) } catch (e) { currency = '—' }
      return '<tr><td class="nf-loc">' + esc(loc.name) + ' <span class="nf-id">' + loc.id + '</span></td>' +
        '<td class="nf-mono">' + esc(number) + '</td><td class="nf-mono nf-dim">' + esc(compact) + '</td>' +
        '<td class="nf-mono">' + esc(currency) + '</td></tr>'
    }).join('')
    outputEl.innerHTML = '<table class="nf-table"><thead><tr><th>Locale</th><th>Number</th><th>Compact</th><th>Currency (' + esc(cur) + ')</th></tr></thead><tbody>' + rows + '</tbody></table>'
  }

  input.addEventListener('input', () => { render(); saveSettings() })
  currencySel.addEventListener('change', () => { render(); saveSettings() })

  const SETTINGS_KEY = 'number-tool-settings'
  const DEFAULTS = { value: '1234567.89', currency: 'USD' }
  function saveSettings() { syncSet({ [SETTINGS_KEY]: { value: input.value, currency: currencySel.value } }) }
  function applySettings(s) { input.value = s.value; currencySel.value = s.currency }
  document.getElementById('nf-reset-btn').addEventListener('click', () => { applySettings(DEFAULTS); saveSettings(); render() })

  syncGet([SETTINGS_KEY]).then(d => { applySettings({ ...DEFAULTS, ...(d[SETTINGS_KEY] || {}) }); render() })
})()
