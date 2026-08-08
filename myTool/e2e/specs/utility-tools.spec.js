const { test, expect } = require('@playwright/test')

const fieldValue = (page, container, label) =>
  page.locator(`${container} .pf-field`, { hasText: label }).locator('.pf-field-value').inputValue()

test('Timestamp: epoch 0 renders the unix epoch', async ({ page }) => {
  await page.goto('/popup.html')
  await page.click('.tab-btn[data-tab="timestamp"]')
  await page.fill('#ts-input', '0')
  expect(await fieldValue(page, '#ts-fields', 'ISO 8601')).toBe('1970-01-01T00:00:00.000Z')
  expect(await fieldValue(page, '#ts-fields', 'Unix (seconds)')).toBe('0')
})

test('JSON: format pretty-prints and minify collapses', async ({ page }) => {
  await page.goto('/popup.html')
  await page.click('.tab-btn[data-tab="json"]')
  await page.fill('#jf-input', '{"b":1,"a":[2,3]}')
  await page.click('#jf-format')
  expect(await page.locator('#jf-output').inputValue()).toContain('\n  "b": 1')
  await page.click('#jf-minify')
  expect(await page.locator('#jf-output').inputValue()).toBe('{"b":1,"a":[2,3]}')
})

test('JSON: invalid input shows the parser error', async ({ page }) => {
  await page.goto('/popup.html')
  await page.click('.tab-btn[data-tab="json"]')
  await page.fill('#jf-input', '{bad}')
  await page.click('#jf-format')
  await expect(page.locator('#jf-error')).toBeVisible()
})

test('Base: 255 converts to every base at once', async ({ page }) => {
  await page.goto('/popup.html')
  await page.click('.tab-btn[data-tab="base"]')
  await page.fill('#bn-input', '255')
  expect(await fieldValue(page, '#bn-fields', 'Hex')).toBe('FF')
  expect(await fieldValue(page, '#bn-fields', 'Binary')).toBe('11111111')
})

test('Color: hex converts to rgb/hsl and syncs the picker', async ({ page }) => {
  await page.goto('/popup.html')
  await page.click('.tab-btn[data-tab="color"]')
  await page.fill('#cl-input', '#ff0000')
  expect(await fieldValue(page, '#cl-fields', 'RGB')).toBe('rgb(255, 0, 0)')
  expect(await page.locator('#cl-picker').inputValue()).toBe('#ff0000')
})

test('Color: picking from the color input updates every format', async ({ page }) => {
  await page.goto('/popup.html')
  await page.click('.tab-btn[data-tab="color"]')
  await page.locator('#cl-picker').evaluate(el => { el.value = '#00ff00'; el.dispatchEvent(new Event('input', { bubbles: true })) })
  expect(await page.locator('#cl-input').inputValue()).toBe('#00FF00')
  expect(await fieldValue(page, '#cl-fields', 'RGB')).toBe('rgb(0, 255, 0)')
})

test('Regex: matches are counted and highlighted', async ({ page }) => {
  await page.goto('/popup.html')
  await page.click('.tab-btn[data-tab="regex"]')
  await page.fill('#rx-pattern', '\\d+')
  await page.fill('#rx-text', 'a1b22c333')
  await expect(page.locator('#rx-count')).toHaveText('3 matches')
  await expect(page.locator('#rx-output .rx-hit')).toHaveCount(3)
})

test('no uncaught errors on load or across every tab', async ({ page }) => {
  const errors = []
  page.on('pageerror', e => errors.push(e.message))
  await page.goto('/popup.html')
  // Visit every tab, not a hand-picked few, so a missing element / wiring typo in any tool
  // (e.g. a null getElementById before addEventListener) surfaces as a load-time pageerror.
  const tabs = await page.locator('.tab-btn').evaluateAll(els => els.map(e => e.dataset.tab))
  expect(tabs.length).toBeGreaterThan(15)
  for (const t of tabs) await page.click(`.tab-btn[data-tab="${t}"]`)
  expect(errors).toEqual([])
})
