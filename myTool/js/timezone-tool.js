// ---- Timezone Tool: convert an instant between IANA time zones. Enter an epoch or date (blank =
// now); pick a From and To zone. Absolute inputs (epoch, or a date with Z/offset) are timezone-
// independent, so From is just how they're displayed; a naive wall-clock date (YYYY-MM-DD HH:mm) is
// interpreted as local time in the From zone. All offset math uses Intl (correct DST, no library).
// Everything above the wiring marker is pure (no DOM) and unit-tested.

// Offset (ms, east-positive) of `zone` at the absolute instant `utcMs`. Reads the zone's wall clock
// via Intl, reinterprets those components as if they were UTC, and diffs — the standard trick.
function tz_getOffsetMs(utcMs, zone) {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: zone, hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  })
  const p = {}
  for (const part of dtf.formatToParts(new Date(utcMs))) if (part.type !== 'literal') p[part.type] = part.value
  const asUTC = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second)
  // Round to the nearest minute: real zone offsets are always whole minutes, and `asUTC` is only
  // second-precise (Intl drops sub-second ms), so a fractional `utcMs` would otherwise leave the
  // raw difference a few hundred ms short and make Math.floor report e.g. UTC+06:59 for +07:00.
  return Math.round((asUTC - utcMs) / 60000) * 60000
}

// "UTC", "UTC+09:00", "UTC-04:00" for an offset in ms.
function tz_offsetLabel(offsetMs) {
  if (offsetMs === 0) return 'UTC'
  const sign = offsetMs > 0 ? '+' : '-'
  const abs = Math.abs(offsetMs)
  const h = Math.floor(abs / 3600000)
  const m = Math.floor((abs % 3600000) / 60000)
  return 'UTC' + sign + String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0')
}

// Interpret naive wall-clock components as local time IN `zone`, returning the absolute UTC ms. Two
// passes settle DST: the offset guessed at the naive instant may differ from the real one near a
// transition, so we recompute at the corrected instant.
function tz_wallToUtcMs(c, zone) {
  const wallMs = Date.UTC(c.year, c.month - 1, c.day, c.hour, c.minute, c.second || 0)
  let offset = tz_getOffsetMs(wallMs, zone)
  offset = tz_getOffsetMs(wallMs - offset, zone)
  return wallMs - offset
}

const TZ_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

// Format an absolute instant in a zone -> { date:'YYYY-MM-DD', time:'HH:mm:ss', weekday, offset,
// dateHuman:'Sat, 8 Aug 2026' } (dateHuman is the readable form shown in the UI).
function tz_formatInZone(utcMs, zone) {
  const dtf = new Intl.DateTimeFormat('en-GB', {
    timeZone: zone, hourCycle: 'h23', weekday: 'short',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  })
  const p = {}
  for (const part of dtf.formatToParts(new Date(utcMs))) if (part.type !== 'literal') p[part.type] = part.value
  return {
    date: p.year + '-' + p.month + '-' + p.day,
    time: p.hour + ':' + p.minute + ':' + p.second,
    weekday: p.weekday,
    dateHuman: p.weekday + ', ' + (+p.day) + ' ' + TZ_MONTHS[+p.month - 1] + ' ' + p.year,
    offset: tz_offsetLabel(tz_getOffsetMs(utcMs, zone))
  }
}

// Classify the input box. Returns { error:'empty' } for blank (caller uses now), { ms } for an
// absolute instant (epoch, or a date carrying Z / a numeric offset), { wall:{...} } for a naive
// wall-clock date to interpret in the From zone, or { error } with a message.
function tz_parseInput(raw) {
  const s = String(raw).trim()
  if (s === '') return { error: 'empty' }
  if (/^-?\d+$/.test(s)) {
    const digits = s.replace('-', '').length
    const n = Number(s)
    return { ms: digits <= 11 ? n * 1000 : n } // <=11 digits = seconds, longer = milliseconds
  }
  if (/[zZ]$|[+-]\d{2}:?\d{2}$/.test(s)) { // explicit UTC marker or offset -> absolute
    const t = Date.parse(s)
    if (Number.isNaN(t)) return { error: 'Unrecognized date format.' }
    return { ms: t }
  }
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?$/)
  if (m) {
    return { wall: { year: +m[1], month: +m[2], day: +m[3], hour: +(m[4] || 0), minute: +(m[5] || 0), second: +(m[6] || 0) } }
  }
  return { error: 'Unrecognized date — try an epoch or YYYY-MM-DD HH:mm.' }
}

// ---- Wiring ----
;(function initTimezoneTool() {
  const input = document.getElementById('tz-input')
  if (!input) return // Timezone tab not present in this build

  const nowBtn = document.getElementById('tz-now')
  const errorEl = document.getElementById('tz-error')
  const fieldsEl = document.getElementById('tz-fields')

  const COPY_ICON = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>'
  const CHECK_ICON = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>'

  // A system clock can report a legacy alias (e.g. Asia/Saigon) that isn't in the canonical picker
  // list; map it to its canonical zone (Asia/Ho_Chi_Minh) so it matches a real, labeled option.
  function canonicalZone(z) { return (typeof TZ_ALIAS !== 'undefined' && TZ_ALIAS[z]) || z }
  const LOCAL_ZONE = canonicalZone(Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC')

  // Label options "Country — City" (from the generated TZ_COUNTRY table) so typing a country name in
  // the native <select> jumps to it — the raw "America/…/Asia/…" prefix isn't searchable that way.
  // City is the zone's last path segment. UTC is pinned first; the local zone is added if missing.
  function zoneCity(z) { return z.split('/').pop().replace(/_/g, ' ') }
  function zoneLabel(z) {
    const country = (typeof TZ_COUNTRY !== 'undefined') && TZ_COUNTRY[z]
    return country ? country + ' — ' + zoneCity(z) : z
  }
  const OPTION_ZONES = (typeof TZ_COUNTRY !== 'undefined' ? Object.keys(TZ_COUNTRY) : [LOCAL_ZONE])
    .slice()
    .sort((a, b) => zoneLabel(a).localeCompare(zoneLabel(b)))
  if (LOCAL_ZONE !== 'UTC' && !OPTION_ZONES.includes(LOCAL_ZONE)) OPTION_ZONES.unshift(LOCAL_ZONE)
  const ZONES = ['UTC'].concat(OPTION_ZONES) // UTC pinned first; also the allow-list for saved settings

  const optionLabel = z => (z === 'UTC' ? 'UTC' : zoneLabel(z))

  // Searchable combobox over ZONES: the input filters an ft-select-panel list. Replaces the native
  // <select>, whose giant overlay jumped on scroll and couldn't be typed into. The panel is
  // position:fixed (like the other pickers) so it scrolls internally instead of moving the popup.
  function makeZoneCombo(inputEl, panelEl, initial) {
    let selected = initial
    let open = false

    function renderList(filter) {
      const f = filter.trim().toLowerCase()
      const html = ZONES.filter(z => !f || optionLabel(z).toLowerCase().includes(f) || z.toLowerCase().includes(f))
        .map(z => `<button type="button" class="ft-select-option${z === selected ? ' active' : ''}" data-value="${esc(z)}">${esc(optionLabel(z))}</button>`)
        .join('')
      panelEl.innerHTML = html || '<div class="tz-combo-empty">No match</div>'
    }
    function position() {
      const r = inputEl.getBoundingClientRect()
      panelEl.style.left = r.left + 'px'
      panelEl.style.width = r.width + 'px'
      panelEl.style.top = (r.bottom + 4) + 'px'
      panelEl.style.maxHeight = Math.max(120, window.innerHeight - r.bottom - 12) + 'px'
    }
    function openPanel(filter) {
      open = true
      renderList(filter || '')
      panelEl.hidden = false
      inputEl.setAttribute('aria-expanded', 'true')
      position()
      const act = panelEl.querySelector('.ft-select-option.active')
      if (act) act.scrollIntoView({ block: 'nearest' })
    }
    function closePanel() {
      open = false
      panelEl.hidden = true
      inputEl.setAttribute('aria-expanded', 'false')
      inputEl.value = optionLabel(selected) // restore the label if a filter was typed but nothing picked
    }
    function setSelected(z, fire) {
      selected = z
      inputEl.value = optionLabel(z)
      if (fire) { saveSettings(); render() }
    }

    inputEl.addEventListener('focus', () => { inputEl.select(); openPanel('') })
    inputEl.addEventListener('click', () => { if (!open) openPanel('') })
    inputEl.addEventListener('input', () => openPanel(inputEl.value))
    inputEl.addEventListener('keydown', e => {
      if (e.key === 'Escape') { closePanel(); inputEl.blur() }
      else if (e.key === 'Enter') {
        const first = panelEl.querySelector('.ft-select-option[data-value]')
        if (open && first) { e.preventDefault(); setSelected(first.dataset.value, true); closePanel() }
      }
    })
    panelEl.addEventListener('mousedown', e => {
      const opt = e.target.closest('.ft-select-option[data-value]')
      if (!opt) return
      e.preventDefault() // keep input focus, avoid a blur race closing before the click lands
      setSelected(opt.dataset.value, true)
      closePanel()
    })
    document.addEventListener('click', e => {
      if (open && e.target !== inputEl && !panelEl.contains(e.target)) closePanel()
    })

    setSelected(initial, false)
    return { get value() { return selected }, set: z => setSelected(z, false) }
  }

  const fromCombo = makeZoneCombo(document.getElementById('tz-from'), document.getElementById('tz-from-panel'), LOCAL_ZONE)
  const toCombo = makeZoneCombo(document.getElementById('tz-to'), document.getElementById('tz-to-panel'), 'UTC')

  function esc(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
  }

  function fieldRow(label, value) {
    const v = esc(value)
    return `<div class="pf-field"><div class="pf-field-label">${esc(label)}</div>
      <div class="pf-field-value-wrap"><input type="text" class="pf-field-value" readonly value="${v}">
      <button type="button" class="tt-copy-icon-btn pf-copy-btn" data-copy="${v}" title="Copy" aria-label="Copy">${COPY_ICON}</button></div></div>`
  }

  function render() {
    errorEl.hidden = true
    const res = tz_parseInput(input.value)
    let ms
    if (res.error === 'empty') ms = Date.now()
    else if (res.error) { errorEl.textContent = res.error; errorEl.hidden = false; fieldsEl.innerHTML = ''; return }
    else if (res.ms != null) ms = res.ms
    else ms = tz_wallToUtcMs(res.wall, fromCombo.value)

    const from = tz_formatInZone(ms, fromCombo.value)
    const to = tz_formatInZone(ms, toCombo.value)
    fieldsEl.innerHTML = [
      fieldRow('From — ' + fromCombo.value, `${from.dateHuman} · ${from.time} · ${from.offset}`),
      fieldRow('To — ' + toCombo.value, `${to.dateHuman} · ${to.time} · ${to.offset}`),
      fieldRow('UTC (ISO 8601)', new Date(ms).toISOString()),
      fieldRow('Unix (seconds)', Math.floor(ms / 1000))
    ].join('')
  }

  fieldsEl.addEventListener('click', e => {
    const btn = e.target.closest('.pf-copy-btn')
    if (!btn) return
    navigator.clipboard.writeText(btn.dataset.copy).then(() => {
      btn.innerHTML = CHECK_ICON; btn.classList.add('copied')
      setTimeout(() => { btn.innerHTML = COPY_ICON; btn.classList.remove('copied') }, 1200)
    })
  })

  input.addEventListener('input', render)
  nowBtn.addEventListener('click', () => { input.value = ''; render() })

  const SETTINGS_KEY = 'timezone-tool-settings'
  const DEFAULTS = { from: LOCAL_ZONE, to: 'UTC' }
  function saveSettings() { syncSet({ [SETTINGS_KEY]: { from: fromCombo.value, to: toCombo.value } }) }
  function applySettings(s) {
    const from = canonicalZone(s.from), to = canonicalZone(s.to)
    if (ZONES.includes(from)) fromCombo.set(from)
    if (ZONES.includes(to)) toCombo.set(to)
  }
  document.getElementById('tz-reset-btn').addEventListener('click', () => {
    input.value = ''; applySettings(DEFAULTS); saveSettings(); render()
  })

  syncGet([SETTINGS_KEY]).then(d => { applySettings({ ...DEFAULTS, ...(d[SETTINGS_KEY] || {}) }); render() })
})()
