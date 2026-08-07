const { test, expect } = require('@playwright/test')

// The generator tools (Card, IBAN, Non-IBAN, BBAN, UUID) now persist their last-generated result and
// restore it on open, so closing the popup mid-form-fill no longer loses the data. These guards live
// in DOM wiring (not covered by the Node unit tests), so a reload regression only shows up here.

const firstFieldValue = (page, fieldsId) =>
  page.locator(`#${fieldsId} .pf-field-value`).first().inputValue()

for (const { tab, fields } of [
  { tab: 'card', fields: 'cc-fields' },
  { tab: 'iban', fields: 'ib-fields' },
  { tab: 'noniban', fields: 'nb-fields' },
  { tab: 'bban', fields: 'bb-fields' }
]) {
  test(`${tab}: reopening keeps the same generated result`, async ({ page }) => {
    await page.goto('/popup.html')
    await page.click(`.tab-btn[data-tab="${tab}"]`)
    const before = await firstFieldValue(page, fields)
    expect(before).not.toBe('')

    await page.reload() // simulates closing and reopening the popup
    await page.click(`.tab-btn[data-tab="${tab}"]`)
    expect(await firstFieldValue(page, fields)).toBe(before)
  })
}

test('uuid: reopening keeps the same generated result', async ({ page }) => {
  await page.goto('/popup.html')
  await page.click('.tab-btn[data-tab="uuid"]')
  const before = await page.locator('#uu-output').inputValue()
  expect(before).not.toBe('')

  await page.reload()
  await page.click('.tab-btn[data-tab="uuid"]')
  expect(await page.locator('#uu-output').inputValue()).toBe(before)
})
