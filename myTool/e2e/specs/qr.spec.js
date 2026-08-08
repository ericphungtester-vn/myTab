const { test, expect } = require('@playwright/test')

test('QR: renders a code for content and clears when emptied', async ({ page }) => {
  const errors = []
  page.on('pageerror', e => errors.push(e.message))
  await page.goto('/popup.html')
  await page.click('.tab-btn[data-tab="qr"]')

  // empty by default: no code, downloads disabled
  await expect(page.locator('#qr-output svg')).toHaveCount(0)
  await expect(page.locator('#qr-download-png')).toBeDisabled()

  await page.fill('#qr-input', 'https://example.com')
  await expect(page.locator('#qr-output svg')).toBeVisible()
  await expect(page.locator('#qr-info')).toContainText('modules')
  await expect(page.locator('#qr-download-png')).toBeEnabled()
  await expect(page.locator('#qr-download-svg')).toBeEnabled()

  await page.fill('#qr-input', '')
  await expect(page.locator('#qr-output svg')).toHaveCount(0)
  await expect(page.locator('#qr-download-png')).toBeDisabled()
  expect(errors).toEqual([])
})

test('QR: the error-correction level shows in the info line', async ({ page }) => {
  await page.goto('/popup.html')
  await page.click('.tab-btn[data-tab="qr"]')
  await page.fill('#qr-input', 'test')

  await page.click('#qr-ec .seg-btn[data-value="H"]')
  await expect(page.locator('#qr-info')).toContainText('EC H')
  await page.click('#qr-ec .seg-btn[data-value="L"]')
  await expect(page.locator('#qr-info')).toContainText('EC L')
})

test('QR: content persists across reload', async ({ page }) => {
  await page.goto('/popup.html')
  await page.click('.tab-btn[data-tab="qr"]')
  await page.fill('#qr-input', 'persist me')
  await expect(page.locator('#qr-output svg')).toBeVisible()

  await page.reload()
  await page.click('.tab-btn[data-tab="qr"]')
  await expect(page.locator('#qr-input')).toHaveValue('persist me')
  await expect(page.locator('#qr-output svg')).toBeVisible()
})

test('QR: content over the capacity limit shows an error, then recovers', async ({ page }) => {
  const errors = []
  page.on('pageerror', e => errors.push(e.message))
  await page.goto('/popup.html')
  await page.click('.tab-btn[data-tab="qr"]')

  await page.fill('#qr-input', 'A'.repeat(3000)) // over byte capacity at default EC M (2331)
  await expect(page.locator('#qr-error')).toBeVisible()
  await expect(page.locator('#qr-error')).toContainText('too long')
  await expect(page.locator('#qr-output svg')).toHaveCount(0)
  await expect(page.locator('#qr-download-png')).toBeDisabled()

  await page.fill('#qr-input', 'now it fits')
  await expect(page.locator('#qr-error')).toBeHidden()
  await expect(page.locator('#qr-output svg')).toBeVisible()
  expect(errors).toEqual([]) // an over-long input must not throw, just show the message
})

test('QR: Download SVG and PNG produce files', async ({ page }) => {
  await page.goto('/popup.html')
  await page.click('.tab-btn[data-tab="qr"]')
  await page.fill('#qr-input', 'download me')

  const [svg] = await Promise.all([page.waitForEvent('download'), page.click('#qr-download-svg')])
  expect(svg.suggestedFilename()).toBe('qrcode.svg')

  const [png] = await Promise.all([page.waitForEvent('download'), page.click('#qr-download-png')])
  expect(png.suggestedFilename()).toBe('qrcode.png')
})
