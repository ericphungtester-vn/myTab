const { test } = require('node:test')
const assert = require('node:assert')
const { loadToolScript } = require('./helpers/loadScript')

const tz = loadToolScript('js/timezone-tool.js')

test('tz_offsetLabel formats offsets', () => {
  assert.equal(tz.tz_offsetLabel(0), 'UTC')
  assert.equal(tz.tz_offsetLabel(9 * 3600000), 'UTC+09:00')
  assert.equal(tz.tz_offsetLabel(-4 * 3600000), 'UTC-04:00')
  assert.equal(tz.tz_offsetLabel(5.5 * 3600000), 'UTC+05:30') // India, half-hour zone
})

test('tz_getOffsetMs: fixed zones and DST', () => {
  const summer = Date.UTC(2026, 6, 15, 12, 0, 0)
  const winter = Date.UTC(2026, 0, 15, 12, 0, 0)
  assert.equal(tz.tz_getOffsetMs(summer, 'UTC'), 0)
  assert.equal(tz.tz_getOffsetMs(summer, 'Asia/Tokyo'), 9 * 3600000) // no DST year-round
  assert.equal(tz.tz_getOffsetMs(winter, 'Asia/Tokyo'), 9 * 3600000)
  assert.equal(tz.tz_getOffsetMs(winter, 'America/New_York'), -5 * 3600000) // EST
  assert.equal(tz.tz_getOffsetMs(summer, 'America/New_York'), -4 * 3600000) // EDT
  // Sub-second instants must still yield an exact whole-minute offset (regression: UTC+06:59 bug).
  assert.equal(tz.tz_getOffsetMs(summer + 517, 'Asia/Ho_Chi_Minh'), 7 * 3600000)
  assert.equal(tz.tz_getOffsetMs(summer + 999, 'Asia/Singapore'), 8 * 3600000)
})

test('tz_wallToUtcMs interprets wall-clock in the given zone (with DST)', () => {
  const wall = { year: 2026, month: 1, day: 15, hour: 12, minute: 0, second: 0 }
  // 12:00 in Tokyo (UTC+9) is 03:00 UTC
  assert.equal(tz.tz_wallToUtcMs(wall, 'Asia/Tokyo'), Date.UTC(2026, 0, 15, 3, 0, 0))
  // 12:00 in New York in January (EST -5) is 17:00 UTC
  assert.equal(tz.tz_wallToUtcMs(wall, 'America/New_York'), Date.UTC(2026, 0, 15, 17, 0, 0))
  // 12:00 in New York in July (EDT -4) is 16:00 UTC
  const summerWall = { year: 2026, month: 7, day: 15, hour: 12, minute: 0, second: 0 }
  assert.equal(tz.tz_wallToUtcMs(summerWall, 'America/New_York'), Date.UTC(2026, 6, 15, 16, 0, 0))
})

test('tz_formatInZone renders the instant in the zone', () => {
  const tokyo = tz.tz_formatInZone(0, 'Asia/Tokyo') // epoch 0 = 1970-01-01T00:00:00Z
  assert.equal(tokyo.date, '1970-01-01')
  assert.equal(tokyo.time, '09:00:00')
  assert.equal(tokyo.offset, 'UTC+09:00')
  assert.equal(tokyo.dateHuman, 'Thu, 1 Jan 1970') // readable form, no leading zero on the day
  const utc = tz.tz_formatInZone(0, 'UTC')
  assert.equal(utc.time, '00:00:00')
  assert.equal(utc.offset, 'UTC')
})

test('tz_parseInput classifies inputs', () => {
  assert.deepEqual(tz.tz_parseInput('   '), { error: 'empty' })
  // seconds epoch (<=11 digits) scaled to ms
  assert.equal(tz.tz_parseInput('1000000000').ms, 1000000000 * 1000)
  // millis epoch (longer) as-is
  assert.equal(tz.tz_parseInput('1600000000000').ms, 1600000000000)
  // explicit Z is absolute
  assert.equal(tz.tz_parseInput('2026-01-15T12:00:00Z').ms, Date.UTC(2026, 0, 15, 12, 0, 0))
  // naive wall-clock -> components, no ms
  const naive = tz.tz_parseInput('2026-01-15 12:30')
  assert.equal(naive.ms, undefined)
  assert.equal(naive.wall.hour, 12)
  assert.equal(naive.wall.minute, 30)
  // garbage -> error message
  assert.ok(tz.tz_parseInput('not a date').error)
})
