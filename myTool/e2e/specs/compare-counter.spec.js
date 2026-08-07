const { test, expect } = require('@playwright/test')

// The Compare tool's real limit is 2000 lines per side (no character cap). A live counter under each
// box surfaces that and turns red past the limit. Wiring lives in DOM (not unit-tested).

test('Compare: the counter reflects lines and chars as you type', async ({ page }) => {
  await page.goto('/popup.html')
  await page.click('.tab-btn[data-tab="compare"]')

  await expect(page.locator('#cp-a-lines')).toHaveText('0')
  await expect(page.locator('#cp-a-chars')).toHaveText('0')

  await page.fill('#cp-a', 'one\ntwo\nthree')
  await expect(page.locator('#cp-a-lines')).toHaveText('3')
  await expect(page.locator('#cp-a-chars')).toHaveText('13')
  // not over the limit yet
  await expect(page.locator('#cp-a-lines').locator('xpath=ancestor::span[contains(@class,"cp-counter")]')).not.toHaveClass(/over/)
})

test('Compare: the counter turns red past the 2000-line limit', async ({ page }) => {
  await page.goto('/popup.html')
  await page.click('.tab-btn[data-tab="compare"]')

  await page.locator('#cp-b').fill(Array.from({ length: 2001 }, (_, i) => 'L' + i).join('\n'))
  await expect(page.locator('#cp-b-lines')).toHaveText('2001')
  await expect(page.locator('#cp-b-lines').locator('xpath=ancestor::span[contains(@class,"cp-counter")]')).toHaveClass(/over/)
})
