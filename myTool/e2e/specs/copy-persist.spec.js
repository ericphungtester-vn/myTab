const { test, expect } = require('@playwright/test')

test('copy button puts the field value on the clipboard', async ({ page }) => {
  await page.goto('/popup.html')
  await page.click('.tab-btn[data-tab="iban"]')
  await expect(page.locator('#ib-fields .pf-field').first()).toBeVisible()

  const value = await page.locator('#ib-fields .pf-field-value').first().inputValue()
  await page.locator('#ib-fields .pf-copy-btn').first().click()
  const clip = await page.evaluate(() => navigator.clipboard.readText())
  expect(clip).toBe(value)
})

test('Card copy button copies the raw card number (no spaces)', async ({ page }) => {
  await page.goto('/popup.html')
  await page.click('.tab-btn[data-tab="card"]')
  const numberField = page.locator('#cc-fields .pf-field', { hasText: 'Card Number' })
  await expect(numberField).toBeVisible()

  const shown = await numberField.locator('.pf-field-value').inputValue() // grouped, has spaces
  await numberField.locator('.pf-copy-btn').click()
  const clip = await page.evaluate(() => navigator.clipboard.readText())
  expect(clip).toBe(shown.replace(/\s/g, ''))
  expect(clip).toMatch(/^\d+$/)
})

test('remembers the last selected country across a reload', async ({ page }) => {
  await page.goto('/popup.html')
  await page.click('.tab-btn[data-tab="iban"]')
  await page.click('#ib-country-trigger')
  await page.click('#ib-country-panel .ft-select-option[data-value="FR"]')
  await expect(page.locator('#ib-country-trigger-label')).toHaveText('France')

  await page.reload()
  await expect(page.locator('#ib-country-trigger-label')).toHaveText('France')
})

test('reset restores the default country and regenerates', async ({ page }) => {
  await page.goto('/popup.html')
  await page.click('.tab-btn[data-tab="iban"]')
  await page.click('#ib-country-trigger')
  await page.click('#ib-country-panel .ft-select-option[data-value="FR"]')
  await expect(page.locator('#ib-country-trigger-label')).toHaveText('France')

  await page.click('#ib-reset-btn')
  await expect(page.locator('#ib-country-trigger-label')).toHaveText('Germany')
  await expect(page.locator('#ib-fields .pf-field').first()).toBeVisible()
})
