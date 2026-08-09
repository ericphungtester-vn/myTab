const { test, expect } = require('@playwright/test')

test('URL: splits a URL into components and decoded query params', async ({ page }) => {
  const errors = []
  page.on('pageerror', e => errors.push(e.message))
  await page.goto('/popup.html')
  await page.click('.tab-btn[data-tab="url"]')

  await page.fill('#ur-input', 'https://api.example.com:8443/v1/users?q=hello%20world&page=2#top')
  const out = page.locator('#ur-output')
  await expect(out.locator('.pf-field', { hasText: 'Host' }).locator('.pf-field-value')).toHaveValue('api.example.com')
  await expect(out.locator('.pf-field', { hasText: 'Port' }).locator('.pf-field-value')).toHaveValue('8443')
  await expect(out.locator('.pf-field', { hasText: 'Path' }).locator('.pf-field-value')).toHaveValue('/v1/users')
  await expect(out.locator('.pf-field', { hasText: 'Fragment' }).locator('.pf-field-value')).toHaveValue('top')
  // query param "q" (exact label, not the "Query" component) is decoded
  const qParam = out.locator('.pf-field', { has: page.locator('.pf-field-label', { hasText: /^q$/ }) })
  await expect(qParam.locator('.pf-field-value')).toHaveValue('hello world')
  expect(errors).toEqual([])
})

test('URL: an unparseable value shows an error', async ({ page }) => {
  await page.goto('/popup.html')
  await page.click('.tab-btn[data-tab="url"]')
  await page.fill('#ur-input', 'http://')
  await expect(page.locator('#ur-error')).toBeVisible()
})

test('Validator: recognizes a valid card, IBAN, EAN, and routing number', async ({ page }) => {
  await page.goto('/popup.html')
  await page.click('.tab-btn[data-tab="validator"]')

  const rows = page.locator('#va-results .va-row')

  await page.fill('#va-input', '4111 1111 1111 1111')
  await expect(page.locator('#va-results .va-row.va-ok', { hasText: 'Card' })).toContainText('Visa')

  await page.fill('#va-input', 'DE89 3704 0044 0532 0130 00')
  await expect(page.locator('#va-results .va-row.va-ok', { hasText: 'IBAN' })).toBeVisible()

  await page.fill('#va-input', '5901234123457')
  await expect(page.locator('#va-results .va-row.va-ok', { hasText: 'EAN / UPC' })).toContainText('EAN-13')

  await page.fill('#va-input', '021000021')
  await expect(page.locator('#va-results .va-row.va-ok', { hasText: 'US routing' })).toBeVisible()
})

test('Validator: flags an invalid value with the reason', async ({ page }) => {
  await page.goto('/popup.html')
  await page.click('.tab-btn[data-tab="validator"]')

  await page.fill('#va-input', '4111111111111112') // bad Luhn
  await expect(page.locator('#va-results .va-row.va-bad', { hasText: 'Card' })).toContainText('Luhn')

  await page.fill('#va-input', 'hello world') // matches nothing
  await expect(page.locator('#va-results')).toContainText("Doesn't match a known format")
})
