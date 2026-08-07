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

const fullName = page => page.locator('#pf-fields .pf-field', { hasText: 'Full Name' }).first().locator('.pf-field-value').inputValue()

test('Profile: reopening keeps the same profile (no regenerate on open)', async ({ page }) => {
  await page.goto('/popup.html')
  await page.click('.tab-btn[data-tab="profile"]')
  const before = await fullName(page)
  expect(before).not.toBe('')

  await page.reload() // simulates closing and reopening the popup
  await page.click('.tab-btn[data-tab="profile"]')
  expect(await fullName(page)).toBe(before)
})

test('Profile: Generate replaces the saved profile', async ({ page }) => {
  await page.goto('/popup.html')
  await page.click('.tab-btn[data-tab="profile"]')
  const before = await fullName(page)
  // Generate a few times; at least one should differ (names are random)
  let changed = false
  for (let i = 0; i < 5 && !changed; i++) {
    await page.click('#pf-generate')
    if ((await fullName(page)) !== before) changed = true
  }
  expect(changed).toBe(true)
})

test('Profile: Copy all puts the whole profile on the clipboard', async ({ page }) => {
  await page.goto('/popup.html')
  await page.click('.tab-btn[data-tab="profile"]')
  const email = await page.locator('#pf-fields .pf-field', { hasText: 'Email' }).first().locator('.pf-field-value').inputValue()

  await page.click('#pf-copy-all')
  await expect(page.locator('#pf-copy-all')).toHaveText('Copied!')
  const clip = await page.evaluate(() => navigator.clipboard.readText())
  // grouped, multi-field, and contains an actual generated value
  expect(clip).toContain('== Name ==')
  expect(clip).toContain('Full Name:')
  expect(clip).toContain(`Email: ${email}`)
})
