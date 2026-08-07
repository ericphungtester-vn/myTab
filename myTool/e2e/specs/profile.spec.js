const { test, expect } = require('@playwright/test')

// Regression guard: renderProfile lives in DOM wiring (not covered by the Node unit tests), so a
// render-time throw (e.g. a numeric field hitting str.replace) only shows up here.
test('Profile: generates without error and renders the grouped fields', async ({ page }) => {
  await page.goto('/popup.html')
  await page.click('.tab-btn[data-tab="profile"]')

  for (const cc of ['us', 'vn']) {
    await page.click('#pf-country-trigger')
    await page.click(`#pf-country-panel .ft-select-option[data-value="${cc}"]`)
    await expect(page.locator('#pf-error')).toBeHidden()
    for (const label of ['Full Name', 'Date of Birth', 'Age', 'Nationality', 'Full Address', 'Email', 'Username', 'Password', 'Company Website']) {
      await expect(page.locator('#pf-fields .pf-field', { hasText: label }).first()).toBeVisible()
    }
  }
})

test('Profile: the email domain selector changes the generated email', async ({ page }) => {
  await page.goto('/popup.html')
  await page.click('.tab-btn[data-tab="profile"]')
  await page.selectOption('#pf-email-domain', 'mailinator.com')
  const email = await page.locator('#pf-fields .pf-field', { hasText: 'Email' }).first().locator('.pf-field-value').inputValue()
  expect(email).toContain('@mailinator.com')
})
