const { test, expect } = require('@playwright/test')

// Amount/paragraph-length had no upper bound — a huge value froze the popup. Now each is capped per
// unit, the cap is shown as a hint, and generate() clamps over-limit values. File/Resize show their
// (JS-enforced) caps inline too. All wiring, not unit-tested.

test('Text: the Amount hint reflects the selected unit', async ({ page }) => {
  await page.goto('/popup.html')
  await page.click('.tab-btn[data-tab="text"]')

  await expect(page.locator('#tt-amount-hint')).toHaveText('max 100,000 characters')

  await page.click('.segmented[data-group="unit"] .seg-btn[data-value="paragraphs"]')
  await expect(page.locator('#tt-amount-hint')).toHaveText('max 2,000 paragraphs')
  await expect(page.locator('#tt-para-length-row')).toBeVisible()
})

test('Text: generate clamps an over-limit Amount back to the cap', async ({ page }) => {
  await page.goto('/popup.html')
  await page.click('.tab-btn[data-tab="text"]')
  // Characters unit, cap 100,000
  await page.fill('#tt-amount', '999999')
  await page.click('#tt-generate')
  await expect(page.locator('#tt-amount')).toHaveValue('100000')
})

test('Text: generate clamps an over-limit Chars/paragraph back to the cap', async ({ page }) => {
  await page.goto('/popup.html')
  await page.click('.tab-btn[data-tab="text"]')
  await page.click('.segmented[data-group="unit"] .seg-btn[data-value="paragraphs"]')
  await page.fill('#tt-para-length', '999999')
  await page.click('#tt-generate')
  await expect(page.locator('#tt-para-length')).toHaveValue('2000')
})

test('File and Resize show their size/dimension caps inline', async ({ page }) => {
  await page.goto('/popup.html')

  await page.click('.tab-btn[data-tab="file"]')
  await expect(page.locator('#tab-file .tt-field-hint', { hasText: 'max 50 MB' })).toBeVisible()

  await page.click('.tab-btn[data-tab="resize"]')
  await expect(page.locator('#tab-resize .tt-field-hint', { hasText: 'max 20,000 px' })).toBeVisible()
})
