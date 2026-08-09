const { test, expect } = require('@playwright/test')

test('Responsive: shows the steps and reference tables without error', async ({ page }) => {
  const errors = []
  page.on('pageerror', e => errors.push(e.message))
  await page.goto('/popup.html')
  await page.click('.tab-btn[data-tab="responsive"]')

  await expect(page.locator('.rp-steps li')).toHaveCount(7)
  await expect(page.locator('#rp-devices table tbody tr').first()).toContainText('iPhone SE')
  await expect(page.locator('#rp-devices table tbody tr')).toHaveCount(14)
  await expect(page.locator('#rp-breakpoints')).toContainText('Tailwind CSS')
  await expect(page.locator('#rp-breakpoints')).toContainText('Bootstrap 5')
  expect(errors).toEqual([])
})

test('Responsive: copying a device size puts "WxH" on the clipboard', async ({ page }) => {
  await page.goto('/popup.html')
  await page.click('.tab-btn[data-tab="responsive"]')

  const row = page.locator('#rp-devices tbody tr', { hasText: 'iPhone SE' })
  await row.locator('.rp-copy').click()
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('375x667')
})

test('Responsive: copying a breakpoint puts the px value on the clipboard', async ({ page }) => {
  await page.goto('/popup.html')
  await page.click('.tab-btn[data-tab="responsive"]')

  await page.locator('#rp-breakpoints .rp-bp-chip', { hasText: 'md' }).first().click()
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('768')
})
