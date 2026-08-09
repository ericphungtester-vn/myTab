const { test } = require('node:test')
const assert = require('node:assert')
const { loadToolScript } = require('./helpers/loadScript')

const cal = loadToolScript('js/calendar-tool.js')
const TZ = 7

test('Vietnamese Tết (lunar 1/1) lands on the published solar dates', () => {
  // Widely published first days of Tết (mùng 1 Tết) — a strong end-to-end check of the algorithm.
  const cases = [
    [[10, 2, 2024], [1, 1, 2024, 0]], // Giáp Thìn
    [[29, 1, 2025], [1, 1, 2025, 0]], // Ất Tỵ
    [[17, 2, 2026], [1, 1, 2026, 0]]  // Bính Ngọ
  ]
  for (const [[dd, mm, yy], expected] of cases) {
    assert.deepEqual(cal.cal_convertSolar2Lunar(dd, mm, yy, TZ), expected, `${dd}/${mm}/${yy}`)
  }
})

test('Can Chi for the Tết years matches the traditional names', () => {
  assert.equal(cal.cal_yearCanChi(2024), 'Giáp Thìn')
  assert.equal(cal.cal_yearCanChi(2025), 'Ất Tỵ')
  assert.equal(cal.cal_yearCanChi(2026), 'Bính Ngọ')
})

test('solar <-> lunar round-trips over a range of dates', () => {
  for (let jd = cal.cal_jdFromDate(1, 1, 2000); jd <= cal.cal_jdFromDate(31, 12, 2030); jd += 37) {
    const [dd, mm, yy] = cal.cal_jdToDate(jd)
    const lunar = cal.cal_convertSolar2Lunar(dd, mm, yy, TZ)
    const back = cal.cal_convertLunar2Solar(lunar[0], lunar[1], lunar[2], lunar[3], TZ)
    assert.deepEqual(back, [dd, mm, yy], `round-trip ${dd}/${mm}/${yy}`)
  }
})

test('jdFromDate and jdToDate are inverses', () => {
  const [dd, mm, yy] = cal.cal_jdToDate(cal.cal_jdFromDate(9, 8, 2026))
  assert.deepEqual([dd, mm, yy], [9, 8, 2026])
})

test('cal_weekday matches the civil weekday from Date', () => {
  const names = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  for (const [dd, mm, yy] of [[9, 8, 2026], [10, 2, 2024], [1, 1, 2000], [15, 6, 1999]]) {
    const expected = names[new Date(Date.UTC(yy, mm - 1, dd)).getUTCDay()]
    assert.equal(cal.cal_weekday(cal.cal_jdFromDate(dd, mm, yy)), expected, `${dd}/${mm}/${yy}`)
  }
})

test('a leap month flagged on the wrong month is rejected', () => {
  // 2025 lunar year has a leap 6th month; flagging leap on a different month is impossible.
  assert.deepEqual(cal.cal_convertLunar2Solar(1, 1, 2025, 1, TZ), [0, 0, 0])
})

test('cal_monthGrid returns a Monday-first 6-week grid framing the month', () => {
  const cells = cal.cal_monthGrid(2026, 8) // August 2026
  assert.equal(cells.length, 42)
  // 1 Aug 2026 is a Saturday, so the grid starts on Monday 27 Jul (5 leading days).
  assert.deepEqual([cells[0].d, cells[0].m, cells[0].y], [27, 7, 2026])
  assert.equal(cells[0].inMonth, false)
  assert.deepEqual([cells[5].d, cells[5].m], [1, 8]) // 1 Aug sits in the Saturday column
  assert.equal(cells[5].inMonth, true)
  assert.equal(cells.filter(c => c.inMonth).length, 31) // August has 31 days
  // Every cell carries its lunar day for the "solar over lunar" display.
  assert.equal(typeof cells[0].ld, 'number')
})

test('cal_holidaysOn matches solar and lunar holidays with the right category', () => {
  assert.deepEqual(cal.cal_holidaysOn({ d: 25, m: 12, ld: 7, lm: 11 }).map(h => h.cat), ['intl']) // Christmas (solar)
  assert.deepEqual(cal.cal_holidaysOn({ d: 30, m: 4, ld: 5, lm: 3 }).map(h => h.cat), ['vn']) // Reunification (solar)
  const tet = cal.cal_holidaysOn({ d: 17, m: 2, ld: 1, lm: 1 }) // Tết Nguyên Đán matched by lunar date
  assert.equal(tet.length, 1)
  assert.equal(tet[0].cat, 'vn')
  assert.deepEqual(cal.cal_holidaysOn({ d: 3, m: 3, ld: 20, lm: 1 }), []) // ordinary day
})

test('cal_holidaysOn covers Vietnamese commemorative days', () => {
  const teachers = cal.cal_holidaysOn({ d: 20, m: 11, ld: 11, lm: 10 }) // 20 Nov
  assert.equal(teachers.length, 1)
  assert.equal(teachers[0].cat, 'vn')
  assert.match(teachers[0].name, /Teachers/)
  assert.equal(cal.cal_holidaysOn({ d: 22, m: 12, ld: 1, lm: 12 })[0].cat, 'vn') // Army Day 22/12
})

test('holidays surface on the right calendar days via cal_monthGrid', () => {
  // Christmas 2026 is a real grid cell in December carrying the intl holiday.
  const xmas = cal.cal_monthGrid(2026, 12).find(c => c.inMonth && c.d === 25)
  assert.equal(cal.cal_holidaysOn(xmas).some(h => h.name === 'Christmas'), true)
})

test('cal_solarInfo bundles lunar date, weekday and Can Chi together', () => {
  const info = cal.cal_solarInfo(17, 2, 2026)
  assert.deepEqual(info.lunar, [1, 1, 2026, 0])
  assert.equal(info.yearCanChi, 'Bính Ngọ')
  assert.equal(typeof info.dayCanChi, 'string')
  assert.equal(typeof info.weekday, 'string')
})
