const { test, expect } = require('@playwright/test')

test('Calendar: entering a solar date shows the lunar date, weekday and Can Chi', async ({ page }) => {
  const errors = []
  page.on('pageerror', e => errors.push(e.message))
  await page.goto('/popup.html')
  await page.click('.tab-btn[data-tab="calendar"]')

  // First day of Tết 2026 (Bính Ngọ) = 17/02/2026 solar -> 01/01/2026 lunar.
  await page.fill('#cal-d', '17')
  await page.fill('#cal-m', '2')
  await page.fill('#cal-y', '2026')

  const fields = page.locator('#cal-fields')
  await expect(fields.locator('.pf-field', { hasText: 'Lunar' }).locator('.pf-field-value')).toHaveValue('01/01/2026')
  await expect(fields.locator('.pf-field', { hasText: 'Year (Can Chi)' }).locator('.pf-field-value')).toHaveValue('Bính Ngọ')
  expect(errors).toEqual([])
})

test('Calendar: month grid shows 6 weeks, marks today, and clicking a day shows its detail', async ({ page }) => {
  const errors = []
  page.on('pageerror', e => errors.push(e.message))
  await page.goto('/popup.html')
  await page.click('.tab-btn[data-tab="calendar"]')

  await expect(page.locator('#cal-grid .cal-dow')).toHaveCount(7)
  await expect(page.locator('#cal-grid .cal-cell')).toHaveCount(42)
  await expect(page.locator('#cal-grid .cal-cell.today')).toHaveCount(1) // exactly one "today"

  // The grid opens on the current month; click a specific in-month day and read its detail.
  const now = new Date()
  const cell = page.locator(`#cal-grid .cal-cell[data-d="15"][data-m="${now.getMonth() + 1}"][data-y="${now.getFullYear()}"]`)
  await cell.click()
  await expect(cell).toHaveClass(/selected/)
  const sol = `${String(15).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`
  await expect(page.locator('#cal-fields .pf-field', { hasText: 'Solar' }).locator('.pf-field-value')).toHaveValue(sol)
  expect(errors).toEqual([])
})

test('Calendar: holidays are dotted, listed, and shown in the detail', async ({ page }) => {
  await page.goto('/popup.html')
  await page.click('.tab-btn[data-tab="calendar"]')

  // Jump to Christmas 2026 (international -> amber dot).
  await page.fill('#cal-d', '25')
  await page.fill('#cal-m', '12')
  await page.fill('#cal-y', '2026')
  const xmas = page.locator('#cal-grid .cal-cell[data-d="25"][data-m="12"][data-y="2026"]')
  await expect(xmas.locator('.cal-dot--intl')).toHaveCount(1)
  await expect(page.locator('#cal-holidays')).toContainText('Christmas')
  await expect(page.locator('#cal-fields .pf-field', { hasText: 'Holiday' }).locator('.pf-field-value')).toHaveValue(/Christmas/)

  // Reunification Day 30/4 is a Vietnamese holiday -> red dot.
  await page.fill('#cal-d', '30')
  await page.fill('#cal-m', '4')
  await page.fill('#cal-y', '2026')
  const apr30 = page.locator('#cal-grid .cal-cell[data-d="30"][data-m="4"][data-y="2026"]')
  await expect(apr30.locator('.cal-dot--vn')).toHaveCount(1)

  // Vietnamese commemorative days are marked too (e.g. Teachers' Day 20/11 -> red dot).
  await page.fill('#cal-m', '11')
  await page.fill('#cal-d', '20')
  await expect(page.locator('#cal-holidays')).toContainText("Teachers' Day")
  const nov20 = page.locator('#cal-grid .cal-cell[data-d="20"][data-m="11"][data-y="2026"]')
  await expect(nov20.locator('.cal-dot--vn')).toHaveCount(1)
})

test('Calendar: prev/next move only the grid month', async ({ page }) => {
  await page.goto('/popup.html')
  await page.click('.tab-btn[data-tab="calendar"]')

  await page.fill('#cal-y', '2026')
  await page.fill('#cal-m', '8')
  await page.fill('#cal-d', '9')
  await expect(page.locator('#cal-title')).toHaveText('August 2026')

  await page.click('#cal-prev')
  await expect(page.locator('#cal-title')).toHaveText('July 2026')
  await page.click('#cal-next')
  await page.click('#cal-next')
  await expect(page.locator('#cal-title')).toHaveText('September 2026')
  // Navigation left the selected detail untouched.
  await expect(page.locator('#cal-fields .pf-field', { hasText: 'Solar' }).locator('.pf-field-value')).toHaveValue('09/08/2026')
})

test('Calendar: "Hôm nay" fills today and shows its lunar detail', async ({ page }) => {
  await page.goto('/popup.html')
  await page.click('.tab-btn[data-tab="calendar"]')

  await page.fill('#cal-y', '2000') // move away, then jump back to today
  await page.click('#cal-today')

  const now = new Date()
  await expect(page.locator('#cal-y')).toHaveValue(String(now.getFullYear()))
  await expect(page.locator('#cal-grid .cal-cell.today')).toHaveClass(/selected/)
})
