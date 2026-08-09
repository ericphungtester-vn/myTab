const { test, expect } = require('@playwright/test')

const vendorLoaded = (page, name) =>
  page.evaluate(n => [...document.scripts].some(s => s.src.includes('vendor/' + n)), name)

test('vendor libraries load only when their tab is used', async ({ page }) => {
  await page.goto('/popup.html') // opens on the Text tab; no code tabs touched

  // none of the heavy libs are fetched on popup open
  expect(await vendorLoaded(page, 'qrcode.js')).toBe(false)
  expect(await vendorLoaded(page, 'jsbarcode.js')).toBe(false)
  expect(await vendorLoaded(page, 'zxing.js')).toBe(false)

  // opening the QR tab pulls in qrcode.js (only)
  await page.click('.tab-btn[data-tab="qr"]')
  await expect.poll(() => vendorLoaded(page, 'qrcode.js')).toBe(true)
  expect(await vendorLoaded(page, 'jsbarcode.js')).toBe(false)
  expect(await vendorLoaded(page, 'zxing.js')).toBe(false)

  // opening Barcode pulls in jsbarcode.js; ZXing stays unloaded until an image is actually scanned
  await page.click('.tab-btn[data-tab="barcode"]')
  await expect.poll(() => vendorLoaded(page, 'jsbarcode.js')).toBe(true)
  await page.click('.tab-btn[data-tab="scan"]')
  expect(await vendorLoaded(page, 'zxing.js')).toBe(false)
})
