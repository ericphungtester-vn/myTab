const { test, expect } = require('@playwright/test')

// Render a code to a PNG in the page (using the already-loaded qrcode / JsBarcode libs) and return
// its bytes, so the test can feed a real image into the Scan tool's file input.
async function qrPng(page, text) {
  const bytes = await page.evaluate(async (t) => {
    const qr = qrcode(0, 'M'); qr.addData(t); qr.make()
    const n = qr.getModuleCount(), cell = 8, margin = 4, dim = (n + margin * 2) * cell
    const c = document.createElement('canvas'); c.width = c.height = dim
    const ctx = c.getContext('2d')
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, dim, dim); ctx.fillStyle = '#000'
    for (let r = 0; r < n; r++) for (let col = 0; col < n; col++) if (qr.isDark(r, col)) ctx.fillRect((col + margin) * cell, (r + margin) * cell, cell, cell)
    const blob = await new Promise(res => c.toBlob(res, 'image/png'))
    return Array.from(new Uint8Array(await blob.arrayBuffer()))
  }, text)
  return Buffer.from(bytes)
}

async function barcodePng(page, text, format) {
  const bytes = await page.evaluate(async ({ t, f }) => {
    const c = document.createElement('canvas')
    JsBarcode(c, t, { format: f, height: 80, margin: 10 })
    const blob = await new Promise(res => c.toBlob(res, 'image/png'))
    return Array.from(new Uint8Array(await blob.arrayBuffer()))
  }, { t: text, f: format })
  return Buffer.from(bytes)
}

test('Scan: renders the drop zone without error', async ({ page }) => {
  const errors = []
  page.on('pageerror', e => errors.push(e.message))
  await page.goto('/popup.html')
  await page.click('.tab-btn[data-tab="scan"]')
  await expect(page.locator('#sc-drop')).toBeVisible()
  expect(errors).toEqual([])
})

test('Scan: decodes a QR image back to its content (generate -> scan round trip)', async ({ page }) => {
  await page.goto('/popup.html')
  await page.click('.tab-btn[data-tab="scan"]')

  const buffer = await qrPng(page, 'HELLO-SCAN-123')
  await page.setInputFiles('#sc-file', { name: 'qr.png', mimeType: 'image/png', buffer })

  const result = page.locator('#sc-result')
  await expect(result.locator('.pf-field', { hasText: 'Format' }).locator('.pf-field-value')).toHaveValue('QR Code')
  await expect(result.locator('.pf-field', { hasText: 'Content' }).locator('.pf-field-value')).toHaveValue('HELLO-SCAN-123')
})

test('Scan: decodes a Code 128 barcode image', async ({ page }) => {
  await page.goto('/popup.html')
  await page.click('.tab-btn[data-tab="scan"]')

  const buffer = await barcodePng(page, 'QA-987', 'CODE128')
  await page.setInputFiles('#sc-file', { name: 'bc.png', mimeType: 'image/png', buffer })

  const result = page.locator('#sc-result')
  await expect(result.locator('.pf-field', { hasText: 'Format' }).locator('.pf-field-value')).toHaveValue('Code 128')
  await expect(result.locator('.pf-field', { hasText: 'Content' }).locator('.pf-field-value')).toHaveValue('QA-987')
})

test('Scan: an image with no code shows a not-found message', async ({ page }) => {
  await page.goto('/popup.html')
  await page.click('.tab-btn[data-tab="scan"]')

  const blank = await page.evaluate(async () => {
    const c = document.createElement('canvas'); c.width = c.height = 120
    const ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, 120, 120)
    const blob = await new Promise(res => c.toBlob(res, 'image/png'))
    return Array.from(new Uint8Array(await blob.arrayBuffer()))
  })
  await page.setInputFiles('#sc-file', { name: 'blank.png', mimeType: 'image/png', buffer: Buffer.from(blank) })

  await expect(page.locator('#sc-error')).toBeVisible()
  await expect(page.locator('#sc-error')).toContainText('No QR code or barcode found')
})

test('Scan: copy button copies the decoded content', async ({ page }) => {
  await page.goto('/popup.html')
  await page.click('.tab-btn[data-tab="scan"]')
  const buffer = await qrPng(page, 'https://example.com/x')
  await page.setInputFiles('#sc-file', { name: 'qr.png', mimeType: 'image/png', buffer })

  const contentRow = page.locator('#sc-result .pf-field', { hasText: 'Content' })
  await contentRow.locator('.pf-copy-btn').click()
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('https://example.com/x')
})
