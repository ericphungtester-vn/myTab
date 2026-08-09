const { test, expect } = require('@playwright/test')

test('Unicode: breaks text into per-code-point rows with counts', async ({ page }) => {
  const errors = []
  page.on('pageerror', e => errors.push(e.message))
  await page.goto('/popup.html')
  await page.click('.tab-btn[data-tab="unicode"]')

  // "A" + ZERO WIDTH SPACE + thumbs-up emoji
  await page.fill('#uc-input', 'A​\u{1F44D}')
  await expect(page.locator('#uc-hint')).toBeHidden() // hint gives way to the summary once there's input
  const rows = page.locator('#uc-output tbody tr')
  await expect(rows).toHaveCount(3)

  await expect(rows.nth(0)).toContainText('U+0041')
  await expect(rows.nth(0)).toContainText('Letter')

  const zwsp = rows.nth(1)
  await expect(zwsp).toHaveClass(/uc-hidden/)
  await expect(zwsp).toContainText('ZERO WIDTH SPACE')
  await expect(zwsp).toContainText('⚠')

  await expect(rows.nth(2)).toContainText('U+1F44D')
  await expect(rows.nth(2)).toContainText('Emoji')
  await expect(rows.nth(2)).toContainText('F0 9F 91 8D') // UTF-8 bytes

  // summary: 3 code points, 4 UTF-16 units (emoji is a surrogate pair), 1 hidden
  const summary = page.locator('#uc-summary')
  await expect(summary).toContainText('3')
  await expect(summary).toContainText('bytes')
  await expect(summary).toContainText('hidden')
  expect(errors).toEqual([])
})

test('Unicode: clears when the input is emptied', async ({ page }) => {
  await page.goto('/popup.html')
  await page.click('.tab-btn[data-tab="unicode"]')
  await page.fill('#uc-input', 'hi')
  await expect(page.locator('#uc-output table')).toBeVisible()
  await page.fill('#uc-input', '')
  await expect(page.locator('#uc-output table')).toHaveCount(0)
  await expect(page.locator('#uc-hint')).toBeVisible()
})
