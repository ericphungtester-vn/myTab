const { test, expect } = require('@playwright/test')

test('Icons: Symbols mode copies the character', async ({ page }) => {
  const errors = []
  page.on('pageerror', e => errors.push(e.message))
  await page.goto('/popup.html')
  await page.click('.tab-btn[data-tab="icons"]')

  // Symbols is the default mode.
  await expect(page.locator('#ic-symbols')).toBeVisible()
  await expect(page.locator('#ic-grid')).toBeHidden()

  await page.click('#ic-symbols .ic-sym[data-char="✓"]')
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('✓')

  // Search narrows the symbol grid.
  await page.fill('#ic-search', 'euro')
  await expect(page.locator('#ic-symbols .ic-sym[data-char="€"]')).toBeVisible()
  await expect(page.locator('#ic-symbols .ic-sym[data-char="✓"]')).toHaveCount(0)
  expect(errors).toEqual([])
})

test('Icons: SVG mode lazy-loads Lucide and copies SVG / data-URI', async ({ page }) => {
  const errors = []
  page.on('pageerror', e => errors.push(e.message))
  await page.goto('/popup.html')
  await page.click('.tab-btn[data-tab="icons"]')

  await page.click('#ic-mode .seg-btn[data-value="icons"]')
  await expect(page.locator('#ic-icon-ctrls')).toBeVisible()

  await page.fill('#ic-search', 'house')
  const house = page.locator('#ic-grid .ic-icon[data-name="house"]')
  await expect(house).toBeVisible() // library loaded and rendered
  await expect(house.locator('svg')).toBeVisible()

  // Copy as SVG (default) at stroke 2.
  await house.click()
  const svg = await page.evaluate(() => navigator.clipboard.readText())
  expect(svg.startsWith('<svg')).toBe(true)
  expect(svg).toContain('stroke-width="2"')
  expect(svg).toContain('viewBox="0 0 24 24"')

  // Switch to Data-URI and copy again.
  await page.click('#ic-format .seg-btn[data-value="uri"]')
  await house.click()
  const uri = await page.evaluate(() => navigator.clipboard.readText())
  expect(uri.startsWith('data:image/svg+xml,')).toBe(true)
  expect(errors).toEqual([])
})

test('Icons: size and stroke controls change the copied SVG', async ({ page }) => {
  await page.goto('/popup.html')
  await page.click('.tab-btn[data-tab="icons"]')
  await page.click('#ic-mode .seg-btn[data-value="icons"]')
  await page.fill('#ic-search', 'star')
  const star = page.locator('#ic-grid .ic-icon[data-name="star"]')
  await expect(star).toBeVisible()

  await page.click('#ic-size .seg-btn[data-value="48"]')
  await page.click('#ic-stroke .seg-btn[data-value="1"]')
  await star.click()
  const svg = await page.evaluate(() => navigator.clipboard.readText())
  expect(svg).toContain('width="48"')
  expect(svg).toContain('stroke-width="1"')
})
