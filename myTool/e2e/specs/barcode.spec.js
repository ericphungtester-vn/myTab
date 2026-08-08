const { test, expect } = require('@playwright/test')

test('Barcode: renders the default code and shows format bars', async ({ page }) => {
  const errors = []
  page.on('pageerror', e => errors.push(e.message))
  await page.goto('/popup.html')
  await page.click('.tab-btn[data-tab="barcode"]')

  // default is the Code 128 sample -> the SVG has bars
  await expect(page.locator('#bc-svg rect').first()).toBeVisible()
  await expect(page.locator('#bc-download-png')).toBeEnabled()
  expect(errors).toEqual([])
})

test('Barcode: switching format loads a valid sample and renders its readable value', async ({ page }) => {
  await page.goto('/popup.html')
  await page.click('.tab-btn[data-tab="barcode"]')

  await page.selectOption('#bc-format', 'EAN13')
  await expect(page.locator('#bc-input')).toHaveValue('5901234123457')
  await expect(page.locator('#bc-svg rect').first()).toBeVisible()
  // JsBarcode prints the human-readable value as <text>; EAN-13 splits it (lead digit + two groups),
  // so join the pieces back and compare.
  const parts = await page.locator('#bc-svg text').allTextContents()
  expect(parts.join('')).toBe('5901234123457')
})

test('Barcode: invalid input for the format shows an error, not a code', async ({ page }) => {
  await page.goto('/popup.html')
  await page.click('.tab-btn[data-tab="barcode"]')

  await page.selectOption('#bc-format', 'EAN13')
  await page.fill('#bc-input', '5901234123458') // valid length, wrong check digit
  await expect(page.locator('#bc-error')).toBeVisible()
  await expect(page.locator('#bc-error')).toContainText('EAN-13')
  await expect(page.locator('#bc-svg rect')).toHaveCount(0)
  await expect(page.locator('#bc-download-png')).toBeDisabled()
})

test('Barcode: content and format persist across reload', async ({ page }) => {
  await page.goto('/popup.html')
  await page.click('.tab-btn[data-tab="barcode"]')
  await page.selectOption('#bc-format', 'CODE39')
  await page.fill('#bc-input', 'QA-TEST-42')

  await page.reload()
  await page.click('.tab-btn[data-tab="barcode"]')
  await expect(page.locator('#bc-format')).toHaveValue('CODE39')
  await expect(page.locator('#bc-input')).toHaveValue('QA-TEST-42')
  await expect(page.locator('#bc-svg rect').first()).toBeVisible()
})

test('Barcode: Download SVG and PNG produce files', async ({ page }) => {
  await page.goto('/popup.html')
  await page.click('.tab-btn[data-tab="barcode"]')

  const [svg] = await Promise.all([page.waitForEvent('download'), page.click('#bc-download-svg')])
  expect(svg.suggestedFilename()).toBe('barcode.svg')
  const [png] = await Promise.all([page.waitForEvent('download'), page.click('#bc-download-png')])
  expect(png.suggestedFilename()).toBe('barcode.png')
})
