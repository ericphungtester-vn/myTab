const { test, expect } = require('@playwright/test')

const rowValue = (page, label) =>
  page.locator('#tz-fields .pf-field', { hasText: label }).first().locator('.pf-field-value').inputValue()

// Pick a zone through the searchable combobox: open it, then click the option by its IANA value
// (Playwright scrolls it into view inside the panel).
async function selectZone(page, which, zone) {
  await page.click(`#tz-${which}`)
  await page.click(`#tz-${which}-panel .ft-select-option[data-value="${zone}"]`)
}

test('Timezone: renders the four rows without error', async ({ page }) => {
  const errors = []
  page.on('pageerror', e => errors.push(e.message))
  await page.goto('/popup.html')
  await page.click('.tab-btn[data-tab="timezone"]')

  await expect(page.locator('#tz-error')).toBeHidden()
  for (const label of ['From —', 'To —', 'UTC (ISO 8601)', 'Unix (seconds)']) {
    await expect(page.locator('#tz-fields .pf-field', { hasText: label }).first()).toBeVisible()
  }
  expect(errors).toEqual([])
})

test('Timezone: the combobox lists "Country — City" options with UTC first', async ({ page }) => {
  await page.goto('/popup.html')
  await page.click('.tab-btn[data-tab="timezone"]')

  await page.click('#tz-to')
  await expect(page.locator('#tz-to-panel .ft-select-option').first()).toHaveText('UTC')
  await expect(page.locator('#tz-to-panel .ft-select-option[data-value="Asia/Ho_Chi_Minh"]')).toHaveText('Vietnam — Ho Chi Minh')
  await expect(page.locator('#tz-to-panel .ft-select-option[data-value="Asia/Saigon"]')).toHaveCount(0) // alias excluded
})

test('Timezone: typing in the field filters the list', async ({ page }) => {
  await page.goto('/popup.html')
  await page.click('.tab-btn[data-tab="timezone"]')

  await page.click('#tz-to')
  await page.fill('#tz-to', 'japan')
  await expect(page.locator('#tz-to-panel .ft-select-option[data-value="Asia/Tokyo"]')).toHaveText('Japan — Tokyo')
  await expect(page.locator('#tz-to-panel .ft-select-option')).toHaveCount(1)

  await page.fill('#tz-to', 'zzznotazone')
  await expect(page.locator('#tz-to-panel .tz-combo-empty')).toBeVisible()
})

test('Timezone: an absolute input converts into the selected To zone', async ({ page }) => {
  await page.goto('/popup.html')
  await page.click('.tab-btn[data-tab="timezone"]')

  await selectZone(page, 'to', 'Asia/Tokyo')
  await page.fill('#tz-input', '2026-01-15T12:00:00Z') // 12:00 UTC = 21:00 in Tokyo (UTC+9)

  expect(await rowValue(page, 'To —')).toBe('Thu, 15 Jan 2026 · 21:00:00 · UTC+09:00')
  expect(await rowValue(page, 'UTC (ISO 8601)')).toBe('2026-01-15T12:00:00.000Z')
})

test('Timezone: a naive wall-clock date is read in the From zone', async ({ page }) => {
  await page.goto('/popup.html')
  await page.click('.tab-btn[data-tab="timezone"]')

  await selectZone(page, 'from', 'Asia/Tokyo')
  await selectZone(page, 'to', 'UTC')
  await page.fill('#tz-input', '2026-01-15 12:00') // noon in Tokyo -> 03:00 UTC

  expect(await rowValue(page, 'To —')).toBe('Thu, 15 Jan 2026 · 03:00:00 · UTC')
})

test.describe('with the system clock on a legacy alias zone', () => {
  test.use({ timezoneId: 'Asia/Saigon' })
  test('Timezone: the local alias resolves to its canonical, labeled option', async ({ page }) => {
    await page.goto('/popup.html')
    await page.click('.tab-btn[data-tab="timezone"]')
    // From defaults to the local zone, canonicalized from Asia/Saigon -> Asia/Ho_Chi_Minh
    await expect(page.locator('#tz-from')).toHaveValue('Vietnam — Ho Chi Minh')
    await expect(page.locator('#tz-fields .pf-field', { hasText: 'From — Asia/Ho_Chi_Minh' }).first()).toBeVisible()
  })
})

test('Timezone: From/To selections persist across reload', async ({ page }) => {
  await page.goto('/popup.html')
  await page.click('.tab-btn[data-tab="timezone"]')
  await selectZone(page, 'to', 'Europe/London')

  await page.reload()
  await page.click('.tab-btn[data-tab="timezone"]')
  await expect(page.locator('#tz-to')).toHaveValue('Britain (UK) — London') // iso3166.tab's name for GB
})
