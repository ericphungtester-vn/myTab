const { test, expect } = require('@playwright/test')

test('Number: formats across locales with the right separators', async ({ page }) => {
  const errors = []
  page.on('pageerror', e => errors.push(e.message))
  await page.goto('/popup.html')
  await page.click('.tab-btn[data-tab="number"]')

  await page.fill('#nf-input', '1234567.89')
  await page.selectOption('#nf-currency', 'USD')

  const us = page.locator('#nf-output tbody tr', { hasText: 'en-US' })
  await expect(us).toContainText('1,234,567.89')
  await expect(us).toContainText('$1,234,567.89')

  const de = page.locator('#nf-output tbody tr', { hasText: 'de-DE' })
  await expect(de).toContainText('1.234.567,89') // dot grouping, comma decimal
  expect(errors).toEqual([])
})

test('Number: a zero-decimal currency (VND) shows no decimals', async ({ page }) => {
  await page.goto('/popup.html')
  await page.click('.tab-btn[data-tab="number"]')

  await page.fill('#nf-input', '1234.5')
  await page.selectOption('#nf-currency', 'VND')
  const vn = page.locator('#nf-output tbody tr', { hasText: 'vi-VN' })
  await expect(vn).toContainText('₫')
  await expect(vn.locator('td').last()).not.toContainText(',5') // no fractional part
})

test('Number: invalid input shows an error; currency persists across reload', async ({ page }) => {
  await page.goto('/popup.html')
  await page.click('.tab-btn[data-tab="number"]')

  await page.fill('#nf-input', 'abc')
  await expect(page.locator('#nf-error')).toBeVisible()

  await page.fill('#nf-input', '99')
  await page.selectOption('#nf-currency', 'EUR')
  await page.reload()
  await page.click('.tab-btn[data-tab="number"]')
  await expect(page.locator('#nf-currency')).toHaveValue('EUR')
  await expect(page.locator('#nf-output table')).toBeVisible()
})
