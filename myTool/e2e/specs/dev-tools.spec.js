const { test, expect } = require('@playwright/test')

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

test('UUID: generates a valid v4, count changes line count, copy works', async ({ page }) => {
  await page.goto('/popup.html')
  await page.click('.tab-btn[data-tab="uuid"]')

  // auto-generated one v4 on open
  const first = await page.locator('#uu-output').inputValue()
  expect(first.trim()).toMatch(UUID_V4)

  await page.click('.segmented[data-group="uu-count"] .seg-btn[data-value="5"]')
  const five = (await page.locator('#uu-output').inputValue()).trim().split('\n')
  expect(five).toHaveLength(5)
  for (const line of five) expect(line).toMatch(UUID_V4)

  await page.click('#uu-copy')
  const clip = await page.evaluate(() => navigator.clipboard.readText())
  expect(clip).toBe(five.join('\n'))
})

test('UUID: ObjectId type produces 24 hex chars', async ({ page }) => {
  await page.goto('/popup.html')
  await page.click('.tab-btn[data-tab="uuid"]')
  await page.click('#uu-type-trigger')
  await page.click('#uu-type-panel .ft-select-option[data-value="objectid"]')
  expect((await page.locator('#uu-output').inputValue()).trim()).toMatch(/^[0-9a-f]{24}$/)
})

test('Encode: Base64 encode matches the known vector', async ({ page }) => {
  await page.goto('/popup.html')
  await page.click('.tab-btn[data-tab="encode"]')
  await page.fill('#eh-input', 'Hello, World!')
  await page.click('#eh-convert')
  await expect(page.locator('#eh-output')).toHaveValue('SGVsbG8sIFdvcmxkIQ==')
})

test('Encode: SHA-256 hash matches the known digest of "abc"', async ({ page }) => {
  await page.goto('/popup.html')
  await page.click('.tab-btn[data-tab="encode"]')
  await page.fill('#eh-input', 'abc')
  await page.click('#eh-op-trigger')
  await page.click('#eh-op-panel .ft-select-option[data-value="sha256"]') // selecting re-converts
  await expect(page.locator('#eh-output')).toHaveValue(
    'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'
  )
})

test('JWT: decodes header, payload, and expiry note', async ({ page }) => {
  await page.goto('/popup.html')
  await page.click('.tab-btn[data-tab="jwt"]')
  const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9' +
    '.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ' +
    '.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c'
  await page.fill('#jw-input', token)
  await page.click('#jw-decode')

  await expect(page.locator('#jw-result')).toBeVisible()
  await expect(page.locator('#jw-header')).toContainText('"alg": "HS256"')
  await expect(page.locator('#jw-payload')).toContainText('"name": "John Doe"')
  await expect(page.locator('#jw-claims')).toContainText('Issued (iat): 2018-01-18 01:30:22 UTC')
})

test('JWT: a non-token shows a clear error', async ({ page }) => {
  await page.goto('/popup.html')
  await page.click('.tab-btn[data-tab="jwt"]')
  await page.fill('#jw-input', 'not-a-jwt')
  await page.click('#jw-decode')
  await expect(page.locator('#jw-error')).toBeVisible()
  await expect(page.locator('#jw-result')).toBeHidden()
})

test('no uncaught console errors while loading the popup', async ({ page }) => {
  const errors = []
  page.on('pageerror', e => errors.push(e.message))
  await page.goto('/popup.html')
  // touch each new tab
  for (const t of ['uuid', 'encode', 'jwt']) await page.click(`.tab-btn[data-tab="${t}"]`)
  expect(errors).toEqual([])
})
