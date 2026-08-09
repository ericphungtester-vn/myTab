// ---- Calendar Tool: convert between the solar (dương lịch) and Vietnamese lunar (âm lịch)
// calendars, with Can Chi (sexagenary year/month/day) and weekday. Pure astronomical math — the
// Hồ Ngọc Đức algorithm (Julian day, new-moon and sun-longitude, evaluated at UTC+7 to place leap
// months) — so it's offline with no library. Everything above the wiring marker is unit-tested and
// touches no DOM.

var CAL_TZ = 7 // Vietnam (UTC+7); leap months are decided in local civil time.

function cal_INT(d) { return Math.floor(d) }

// Julian day number for a solar calendar date (Gregorian after 1582-10-15, Julian before).
function cal_jdFromDate(dd, mm, yy) {
  var a = cal_INT((14 - mm) / 12)
  var y = yy + 4800 - a
  var m = mm + 12 * a - 3
  var jd = dd + cal_INT((153 * m + 2) / 5) + 365 * y + cal_INT(y / 4) - cal_INT(y / 100) + cal_INT(y / 400) - 32045
  if (jd < 2299161) {
    jd = dd + cal_INT((153 * m + 2) / 5) + 365 * y + cal_INT(y / 4) - 32083
  }
  return jd
}

// Inverse of cal_jdFromDate: Julian day number -> [day, month, year].
function cal_jdToDate(jd) {
  var a, b, c
  if (jd > 2299160) { // after 1582-10-15, Gregorian
    a = jd + 32044
    b = cal_INT((4 * a + 3) / 146097)
    c = a - cal_INT((b * 146097) / 4)
  } else {
    b = 0
    c = jd + 32082
  }
  var d = cal_INT((4 * c + 3) / 1461)
  var e = c - cal_INT((1461 * d) / 4)
  var m = cal_INT((5 * e + 2) / 153)
  var day = e - cal_INT((153 * m + 2) / 5) + 1
  var month = m + 3 - 12 * cal_INT(m / 10)
  var year = b * 100 + d - 4800 + cal_INT(m / 10)
  return [day, month, year]
}

// Julian day (UT) of the k-th new moon since 1900-01-01, from Jean Meeus, Astronomical Algorithms.
function cal_NewMoon(k) {
  var T = k / 1236.85
  var T2 = T * T
  var T3 = T2 * T
  var dr = Math.PI / 180
  var Jd1 = 2415020.75933 + 29.53058868 * k + 0.0001178 * T2 - 0.000000155 * T3
  Jd1 = Jd1 + 0.00033 * Math.sin((166.56 + 132.87 * T - 0.009173 * T2) * dr)
  var M = 359.2242 + 29.10535608 * k - 0.0000333 * T2 - 0.00000347 * T3
  var Mpr = 306.0253 + 385.81691806 * k + 0.0107306 * T2 + 0.00001236 * T3
  var F = 21.2964 + 390.67050646 * k - 0.0016528 * T2 - 0.00000239 * T3
  var C1 = (0.1734 - 0.000393 * T) * Math.sin(M * dr) + 0.0021 * Math.sin(2 * dr * M)
  C1 = C1 - 0.4068 * Math.sin(Mpr * dr) + 0.0161 * Math.sin(dr * 2 * Mpr)
  C1 = C1 - 0.0004 * Math.sin(dr * 3 * Mpr)
  C1 = C1 + 0.0104 * Math.sin(dr * 2 * F) - 0.0051 * Math.sin(dr * (M + Mpr))
  C1 = C1 - 0.0074 * Math.sin(dr * (M - Mpr)) + 0.0004 * Math.sin(dr * (2 * F + M))
  C1 = C1 - 0.0004 * Math.sin(dr * (2 * F - M)) - 0.0006 * Math.sin(dr * (2 * F + Mpr))
  C1 = C1 + 0.0010 * Math.sin(dr * (2 * F - Mpr)) + 0.0005 * Math.sin(dr * (2 * Mpr + M))
  var deltat
  if (T < -11) {
    deltat = 0.001 + 0.000839 * T + 0.0002261 * T2 - 0.00000845 * T3 - 0.000000081 * T * T3
  } else {
    deltat = -0.000278 + 0.000265 * T + 0.000262 * T2
  }
  return Jd1 + C1 - deltat
}

// Ecliptic longitude of the Sun (radians, 0..2π) at Julian day jdn.
function cal_SunLongitude(jdn) {
  var T = (jdn - 2451545.0) / 36525
  var T2 = T * T
  var dr = Math.PI / 180
  var M = 357.52910 + 35999.05030 * T - 0.0001559 * T2 - 0.00000048 * T * T2
  var L0 = 280.46645 + 36000.76983 * T + 0.0003032 * T2
  var DL = (1.914600 - 0.004817 * T - 0.000014 * T2) * Math.sin(dr * M)
  DL = DL + (0.019993 - 0.000101 * T) * Math.sin(dr * 2 * M) + 0.000290 * Math.sin(dr * 3 * M)
  var L = (L0 + DL) * dr
  L = L - Math.PI * 2 * cal_INT(L / (Math.PI * 2))
  return L
}

// Sun longitude bucketed into 12 (0..11) at local midnight of `dayNumber` — used to find the month
// containing the winter solstice (month 11 = "Đông chí").
function cal_getSunLongitude(dayNumber, timeZone) {
  return cal_INT(cal_SunLongitude(dayNumber - 0.5 - timeZone / 24) / Math.PI * 6)
}

// Local-civil-time day of the k-th new moon.
function cal_getNewMoonDay(k, timeZone) {
  return cal_INT(cal_NewMoon(k) + 0.5 + timeZone / 24)
}

// Day that lunar month 11 (containing the winter solstice) of solar year yy begins.
function cal_getLunarMonth11(yy, timeZone) {
  var off = cal_jdFromDate(31, 12, yy) - 2415021
  var k = cal_INT(off / 29.530588853)
  var nm = cal_getNewMoonDay(k, timeZone)
  var sunLong = cal_getSunLongitude(nm, timeZone)
  if (sunLong >= 9) {
    nm = cal_getNewMoonDay(k - 1, timeZone)
  }
  return nm
}

// Which month (offset from month 11) is the leap month in a 13-month lunar year.
function cal_getLeapMonthOffset(a11, timeZone) {
  var k = cal_INT((a11 - 2415021.076998695) / 29.530588853 + 0.5)
  var last = 0
  var i = 1
  var arc = cal_getSunLongitude(cal_getNewMoonDay(k + i, timeZone), timeZone)
  do {
    last = arc
    i++
    arc = cal_getSunLongitude(cal_getNewMoonDay(k + i, timeZone), timeZone)
  } while (arc != last && i < 14)
  return i - 1
}

// Solar date -> [lunarDay, lunarMonth, lunarYear, isLeapMonth(0|1)].
function cal_convertSolar2Lunar(dd, mm, yy, timeZone) {
  var dayNumber = cal_jdFromDate(dd, mm, yy)
  var k = cal_INT((dayNumber - 2415021.076998695) / 29.530588853)
  var monthStart = cal_getNewMoonDay(k + 1, timeZone)
  if (monthStart > dayNumber) {
    monthStart = cal_getNewMoonDay(k, timeZone)
  }
  var a11 = cal_getLunarMonth11(yy, timeZone)
  var b11 = a11
  var lunarYear
  if (a11 >= monthStart) {
    lunarYear = yy
    a11 = cal_getLunarMonth11(yy - 1, timeZone)
  } else {
    lunarYear = yy + 1
    b11 = cal_getLunarMonth11(yy + 1, timeZone)
  }
  var lunarDay = dayNumber - monthStart + 1
  var diff = cal_INT((monthStart - a11) / 29)
  var lunarLeap = 0
  var lunarMonth = diff + 11
  if (b11 - a11 > 365) {
    var leapMonthDiff = cal_getLeapMonthOffset(a11, timeZone)
    if (diff >= leapMonthDiff) {
      lunarMonth = diff + 10
      if (diff == leapMonthDiff) {
        lunarLeap = 1
      }
    }
  }
  if (lunarMonth > 12) {
    lunarMonth = lunarMonth - 12
  }
  if (lunarMonth >= 11 && diff < 4) {
    lunarYear -= 1
  }
  return [lunarDay, lunarMonth, lunarYear, lunarLeap]
}

// Lunar date -> [day, month, year] solar, or [0, 0, 0] if the leap-month flag is impossible.
function cal_convertLunar2Solar(lunarDay, lunarMonth, lunarYear, lunarLeap, timeZone) {
  var a11, b11
  if (lunarMonth < 11) {
    a11 = cal_getLunarMonth11(lunarYear - 1, timeZone)
    b11 = cal_getLunarMonth11(lunarYear, timeZone)
  } else {
    a11 = cal_getLunarMonth11(lunarYear, timeZone)
    b11 = cal_getLunarMonth11(lunarYear + 1, timeZone)
  }
  var k = cal_INT(0.5 + (a11 - 2415021.076998695) / 29.530588853)
  var off = lunarMonth - 11
  if (off < 0) {
    off += 12
  }
  if (b11 - a11 > 365) {
    var leapOff = cal_getLeapMonthOffset(a11, timeZone)
    var leapMonth = leapOff - 2
    if (leapMonth < 0) {
      leapMonth += 12
    }
    if (lunarLeap != 0 && lunarMonth != leapMonth) {
      return [0, 0, 0]
    } else if (lunarLeap != 0 || off >= leapOff) {
      off += 1
    }
  }
  var monthStart = cal_getNewMoonDay(k + off, timeZone)
  return cal_jdToDate(monthStart + lunarDay - 1)
}

// Sexagenary (Can Chi) names.
var CAL_CAN = ['Giáp', 'Ất', 'Bính', 'Đinh', 'Mậu', 'Kỷ', 'Canh', 'Tân', 'Nhâm', 'Quý']
var CAL_CHI = ['Tý', 'Sửu', 'Dần', 'Mão', 'Thìn', 'Tỵ', 'Ngọ', 'Mùi', 'Thân', 'Dậu', 'Tuất', 'Hợi']
// Julian Day 0 was a Monday, so (jd % 7) indexes this list.
var CAL_WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

function cal_yearCanChi(year) {
  return CAL_CAN[(year + 6) % 10] + ' ' + CAL_CHI[(year + 8) % 12]
}
function cal_dayCanChi(jd) {
  return CAL_CAN[(jd + 9) % 10] + ' ' + CAL_CHI[(jd + 1) % 12]
}
function cal_monthCanChi(lunarMonth, lunarYear) {
  return CAL_CAN[(lunarYear * 12 + lunarMonth + 3) % 10] + ' ' + CAL_CHI[(lunarMonth + 1) % 12]
}
function cal_weekday(jd) {
  return CAL_WEEKDAYS[jd % 7]
}

// Full info bundle for a solar date.
function cal_solarInfo(dd, mm, yy) {
  var lunar = cal_convertSolar2Lunar(dd, mm, yy, CAL_TZ)
  var jd = cal_jdFromDate(dd, mm, yy)
  return {
    solar: [dd, mm, yy],
    lunar: lunar,
    jd: jd,
    weekday: cal_weekday(jd),
    yearCanChi: cal_yearCanChi(lunar[2]),
    monthCanChi: cal_monthCanChi(lunar[1], lunar[2]),
    dayCanChi: cal_dayCanChi(jd)
  }
}

// A 6×7 month grid (Monday-first) for the given solar year/month. Returns 42 cells covering the
// whole weeks the month spans, each with its solar date, lunar day/month/leap, and whether it
// belongs to `month` (vs a spilled-over neighbouring month). Pure — the wiring only paints it.
function cal_monthGrid(year, month) {
  var firstJd = cal_jdFromDate(1, month, year)
  var startJd = firstJd - (firstJd % 7) // jd % 7 === 0 is a Monday, so this backs up to the Monday
  var cells = []
  for (var i = 0; i < 42; i++) {
    var jd = startJd + i
    var date = cal_jdToDate(jd)
    var lunar = cal_convertSolar2Lunar(date[0], date[1], date[2], CAL_TZ)
    cells.push({
      d: date[0], m: date[1], y: date[2], jd: jd,
      ld: lunar[0], lm: lunar[1], leap: lunar[3],
      inMonth: date[1] === month && date[2] === year
    })
  }
  return cells
}

// Vietnamese + international holidays. `type: 'solar'` matches a fixed Gregorian day/month;
// `type: 'lunar'` matches a lunar day/month (so it lands correctly every year). `cat` ('vn' | 'intl')
// drives the marker colour. Fixed rules only — no per-year table needed.
var CAL_HOLIDAYS = [
  // Vietnam — official days off
  { type: 'solar', d: 1, m: 1, cat: 'vn', name: "New Year's Day (Tết Dương lịch)" },
  { type: 'solar', d: 30, m: 4, cat: 'vn', name: 'Reunification Day (Giải phóng miền Nam)' },
  { type: 'solar', d: 1, m: 5, cat: 'vn', name: 'International Labour Day (Quốc tế Lao động)' },
  { type: 'solar', d: 2, m: 9, cat: 'vn', name: 'National Day (Quốc khánh)' },
  { type: 'lunar', d: 1, m: 1, cat: 'vn', name: 'Lunar New Year (Tết Nguyên Đán)' },
  { type: 'lunar', d: 10, m: 3, cat: 'vn', name: 'Hùng Kings Commemoration (Giỗ Tổ Hùng Vương)' },
  // Vietnam — cultural observances (not days off)
  { type: 'lunar', d: 15, m: 1, cat: 'vn', name: 'First Full Moon (Rằm tháng Giêng / Tết Nguyên Tiêu)' },
  { type: 'lunar', d: 3, m: 3, cat: 'vn', name: 'Cold Food Festival (Tết Hàn Thực)' },
  { type: 'lunar', d: 5, m: 5, cat: 'vn', name: 'Mid-year Festival (Tết Đoan Ngọ)' },
  { type: 'lunar', d: 15, m: 7, cat: 'vn', name: 'Ghost Festival / Vu Lan' },
  { type: 'lunar', d: 15, m: 8, cat: 'vn', name: 'Mid-Autumn Festival (Tết Trung Thu)' },
  { type: 'lunar', d: 23, m: 12, cat: 'vn', name: 'Kitchen Gods (Ông Công Ông Táo)' },
  // Vietnam — commemorative days (solar, not days off)
  { type: 'solar', d: 3, m: 2, cat: 'vn', name: 'Party Foundation Day (Thành lập Đảng CSVN)' },
  { type: 'solar', d: 27, m: 2, cat: 'vn', name: "Vietnamese Doctors' Day (Ngày Thầy thuốc VN)" },
  { type: 'solar', d: 26, m: 3, cat: 'vn', name: 'Youth Union Foundation Day (Thành lập Đoàn TNCS HCM)' },
  { type: 'solar', d: 7, m: 5, cat: 'vn', name: 'Điện Biên Phủ Victory Day (Chiến thắng Điện Biên Phủ)' },
  { type: 'solar', d: 19, m: 5, cat: 'vn', name: "President Hồ Chí Minh's Birthday (Sinh nhật Bác Hồ)" },
  { type: 'solar', d: 21, m: 6, cat: 'vn', name: 'Revolutionary Press Day (Báo chí Cách mạng VN)' },
  { type: 'solar', d: 28, m: 6, cat: 'vn', name: 'Vietnam Family Day (Gia đình Việt Nam)' },
  { type: 'solar', d: 27, m: 7, cat: 'vn', name: 'War Invalids & Martyrs Day (Thương binh - Liệt sĩ)' },
  { type: 'solar', d: 19, m: 8, cat: 'vn', name: 'August Revolution Day (Cách mạng tháng Tám)' },
  { type: 'solar', d: 13, m: 10, cat: 'vn', name: "Vietnamese Entrepreneurs' Day (Doanh nhân Việt Nam)" },
  { type: 'solar', d: 20, m: 10, cat: 'vn', name: "Vietnamese Women's Day (Phụ nữ Việt Nam)" },
  { type: 'solar', d: 9, m: 11, cat: 'vn', name: 'Vietnam Law Day (Pháp luật Việt Nam)' },
  { type: 'solar', d: 20, m: 11, cat: 'vn', name: "Vietnamese Teachers' Day (Nhà giáo Việt Nam)" },
  { type: 'solar', d: 22, m: 12, cat: 'vn', name: "People's Army Foundation Day (Thành lập QĐND VN)" },
  // International
  { type: 'solar', d: 14, m: 2, cat: 'intl', name: "Valentine's Day" },
  { type: 'solar', d: 8, m: 3, cat: 'intl', name: "International Women's Day" },
  { type: 'solar', d: 20, m: 3, cat: 'intl', name: 'International Day of Happiness' },
  { type: 'solar', d: 1, m: 4, cat: 'intl', name: "April Fools' Day" },
  { type: 'solar', d: 22, m: 4, cat: 'intl', name: 'Earth Day' },
  { type: 'solar', d: 1, m: 6, cat: 'intl', name: "International Children's Day" },
  { type: 'solar', d: 5, m: 6, cat: 'intl', name: 'World Environment Day' },
  { type: 'solar', d: 1, m: 10, cat: 'intl', name: 'International Day of Older Persons' },
  { type: 'solar', d: 5, m: 10, cat: 'intl', name: "World Teachers' Day" },
  { type: 'solar', d: 31, m: 10, cat: 'intl', name: 'Halloween' },
  { type: 'solar', d: 25, m: 12, cat: 'intl', name: 'Christmas' }
]

// Holidays on a grid cell (needs its solar d/m and lunar ld/lm) — matched by solar or lunar date.
function cal_holidaysOn(cell) {
  var out = []
  for (var i = 0; i < CAL_HOLIDAYS.length; i++) {
    var h = CAL_HOLIDAYS[i]
    var hit = h.type === 'solar' ? (h.d === cell.d && h.m === cell.m) : (h.d === cell.ld && h.m === cell.lm)
    if (hit) out.push(h)
  }
  return out
}

// ---- Wiring ----
;(function initCalendarTool() {
  const dEl = document.getElementById('cal-d')
  if (!dEl) return // Calendar tab not present in this build

  const mEl = document.getElementById('cal-m')
  const yEl = document.getElementById('cal-y')
  const errorEl = document.getElementById('cal-error')
  const fieldsEl = document.getElementById('cal-fields')
  const gridEl = document.getElementById('cal-grid')
  const titleEl = document.getElementById('cal-title')
  const holListEl = document.getElementById('cal-holidays')

  const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] // Monday-first
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
  let gridY, gridM // the month currently painted in the grid
  let selectedKey = '' // 'y-m-d' of the highlighted day, kept in sync with the form

  const COPY_ICON = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>'
  const CHECK_ICON = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>'

  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;') }
  function pad(n) { return String(n).padStart(2, '0') }
  function fmtSolar(a) { return pad(a[0]) + '/' + pad(a[1]) + '/' + a[2] }
  function fmtLunar(a) { return pad(a[0]) + '/' + pad(a[1]) + '/' + a[2] + (a[3] ? ' (leap)' : '') }

  function fieldRow(label, value) {
    const v = esc(value)
    return `<div class="pf-field"><div class="pf-field-label">${label}</div>
      <div class="pf-field-value-wrap"><input type="text" class="pf-field-value" readonly value="${v}">
      <button type="button" class="tt-copy-icon-btn pf-copy-btn" data-copy="${v}" title="Copy" aria-label="Copy">${COPY_ICON}</button></div></div>`
  }

  function showError(msg) { errorEl.textContent = msg; errorEl.hidden = false; fieldsEl.innerHTML = '' }

  const key = a => a[2] + '-' + a[1] + '-' + a[0]

  // Marker dot: red for a Vietnamese holiday, amber for international (VN wins if a day has both).
  function holDot(hs) {
    if (!hs.length) return ''
    return `<span class="cal-dot cal-dot--${hs.some(h => h.cat === 'vn') ? 'vn' : 'intl'}"></span>`
  }

  // Paint the month grid for gridY/gridM (marking today, the selected day and holidays) and the
  // list of this month's holidays below it.
  function renderGrid() {
    titleEl.textContent = MONTHS[gridM - 1] + ' ' + gridY
    const now = new Date()
    const todayKey = key([now.getDate(), now.getMonth() + 1, now.getFullYear()])
    const cells = cal_monthGrid(gridY, gridM)
    let html = DOW.map(d => `<div class="cal-dow">${d}</div>`).join('')
    for (const c of cells) {
      const k = c.y + '-' + c.m + '-' + c.d
      const hs = cal_holidaysOn(c)
      const cls = ['cal-cell']
      if (!c.inMonth) cls.push('out')
      if (k === todayKey) cls.push('today')
      if (k === selectedKey) cls.push('selected')
      // Show the lunar month (e.g. "1/7") on the first day of each lunar month, else just the day.
      const lun = c.ld === 1 ? `${c.ld}/${c.lm}${c.leap ? 'L' : ''}` : String(c.ld)
      const tip = hs.length ? ` title="${esc(hs.map(h => h.name).join(' · '))}"` : ''
      html += `<button type="button" class="${cls.join(' ')}"${tip} data-d="${c.d}" data-m="${c.m}" data-y="${c.y}">
        ${holDot(hs)}<span class="cal-cell-sol">${c.d}</span><span class="cal-cell-lun">${lun}</span></button>`
    }
    gridEl.innerHTML = html

    // Holidays falling inside this month (grid order is date-ascending).
    const items = []
    for (const c of cells) {
      if (!c.inMonth) continue
      for (const h of cal_holidaysOn(c)) items.push({ c, h })
    }
    holListEl.innerHTML = items.length
      ? items.map(({ c, h }) => `<div class="cal-hol-item"><span class="cal-dot cal-dot--${h.cat}"></span><span class="cal-hol-date">${c.d}/${c.m}</span><span class="cal-hol-name">${esc(h.name)}</span></div>`).join('')
      : '<p class="cal-hol-empty">No holidays this month.</p>'
  }

  // Show a computed date: fill the detail fields and sync the grid highlight to it.
  function showInfo(info) {
    errorEl.hidden = true
    const hs = cal_holidaysOn({ d: info.solar[0], m: info.solar[1], ld: info.lunar[0], lm: info.lunar[1] })
    fieldsEl.innerHTML = [
      fieldRow('Solar', fmtSolar(info.solar)),
      fieldRow('Lunar', fmtLunar(info.lunar)),
      fieldRow('Weekday', info.weekday),
      hs.length ? fieldRow('Holiday', hs.map(h => h.name).join(' · ')) : '',
      fieldRow('Year (Can Chi)', info.yearCanChi),
      fieldRow('Month (Can Chi)', info.monthCanChi),
      fieldRow('Day (Can Chi)', info.dayCanChi),
      fieldRow('Julian day', info.jd)
    ].join('')
    selectedKey = key(info.solar)
    gridY = info.solar[2]; gridM = info.solar[1]
    renderGrid()
  }

  // Solar date -> lunar date + Can Chi detail (the only direction now).
  function render() {
    const d = parseInt(dEl.value, 10)
    const m = parseInt(mEl.value, 10)
    const y = parseInt(yEl.value, 10)
    if (!(d >= 1 && d <= 31) || !(m >= 1 && m <= 12) || !(y >= 1 && y <= 9999)) {
      showError('Enter a valid day / month / year.')
      return
    }
    showInfo(cal_solarInfo(d, m, y))
  }

  // Select a solar date (from a grid click or "today") and render its detail.
  function selectSolar(d, m, y) {
    dEl.value = d; mEl.value = m; yEl.value = y
    render()
  }

  function setToday() {
    const now = new Date()
    selectSolar(now.getDate(), now.getMonth() + 1, now.getFullYear())
  }

  ;[dEl, mEl, yEl].forEach(el => el.addEventListener('input', render))
  document.getElementById('cal-today').addEventListener('click', setToday)
  document.getElementById('cal-reset-btn').addEventListener('click', setToday)

  // Month navigation moves only the grid; it doesn't touch the selected day or the form.
  document.getElementById('cal-prev').addEventListener('click', () => {
    if (--gridM < 1) { gridM = 12; gridY-- }
    renderGrid()
  })
  document.getElementById('cal-next').addEventListener('click', () => {
    if (++gridM > 12) { gridM = 1; gridY++ }
    renderGrid()
  })

  gridEl.addEventListener('click', e => {
    const cell = e.target.closest('.cal-cell')
    if (!cell) return
    selectSolar(+cell.dataset.d, +cell.dataset.m, +cell.dataset.y)
  })

  fieldsEl.addEventListener('click', e => {
    const btn = e.target.closest('.pf-copy-btn')
    if (!btn) return
    navigator.clipboard.writeText(btn.dataset.copy).then(() => {
      btn.innerHTML = CHECK_ICON; btn.classList.add('copied')
      setTimeout(() => { btn.innerHTML = COPY_ICON; btn.classList.remove('copied') }, 1200)
    })
  })

  setToday()
})()
