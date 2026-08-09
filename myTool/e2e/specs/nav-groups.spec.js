const { test, expect } = require('@playwright/test')

// data-tabs listed under a given group header (until the next header), in sidebar order.
const tabsUnder = (page, headerText) => page.evaluate(h => {
  const out = []
  let inSection = false
  for (const el of document.querySelectorAll('#nav-items > *')) {
    if (el.classList.contains('nav-group-header')) { inSection = el.textContent === h; continue }
    if (inSection && el.classList.contains('tool-nav-item')) out.push(el.querySelector('.tab-btn').dataset.tab)
  }
  return out
}, headerText)

test('Sidebar: groups by Action by default, and every tab is kept', async ({ page }) => {
  await page.goto('/popup.html')
  await expect(page.locator('#nav-items .tool-nav-item')).toHaveCount(29) // no tab lost in the regroup

  await expect(page.locator('.nav-mode-btn[data-value="action"]')).toHaveClass(/active/)
  for (const g of ['Generate', 'Convert', 'Inspect', 'Check', 'Other']) {
    await expect(page.locator('.nav-group-header', { hasText: g })).toBeVisible()
  }
  expect(await tabsUnder(page, 'Check')).toEqual(['compare', 'regex', 'validator'])
  expect(await tabsUnder(page, 'Generate')).toContain('qr') // QR is a generator here
})

test('Sidebar: switching to Object regroups (Codes keeps QR/Barcode/Scan together)', async ({ page }) => {
  await page.goto('/popup.html')
  await page.click('.nav-mode-btn[data-value="object"]')

  await expect(page.locator('.nav-group-header', { hasText: 'Bank & Payment' })).toBeVisible()
  expect(await tabsUnder(page, 'Codes')).toEqual(['barcode', 'qr', 'scan'])
  expect(await tabsUnder(page, 'Bank & Payment')).toEqual(['bban', 'card', 'iban', 'noniban', 'validator'])
  await expect(page.locator('.nav-group-header', { hasText: 'Generate' })).toHaveCount(0) // action headers gone
})

test('Sidebar: the chosen grouping persists, and tabs still work after regrouping', async ({ page }) => {
  await page.goto('/popup.html')
  await page.click('.nav-mode-btn[data-value="object"]')

  // a tab still activates after being moved into a group
  await page.click('.tab-btn[data-tab="qr"]')
  await expect(page.locator('#tab-qr')).toHaveClass(/active/)

  await page.reload()
  await expect(page.locator('.nav-mode-btn[data-value="object"]')).toHaveClass(/active/)
  await expect(page.locator('.nav-group-header', { hasText: 'Codes' })).toBeVisible()
})
