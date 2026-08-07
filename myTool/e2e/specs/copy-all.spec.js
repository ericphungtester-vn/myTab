const { test, expect } = require('@playwright/test')

// The four record-style generators (Card, IBAN, Non-IBAN, BBAN) each have a "Copy all" button that
// copies every field as "Label: value" lines. Wiring lives in DOM (not unit-tested).

for (const { tab, btn, fields, sample } of [
  { tab: 'card', btn: 'cc-copy-all', fields: 'cc-fields', sample: 'Card Number' },
  { tab: 'iban', btn: 'ib-copy-all', fields: 'ib-fields', sample: 'IBAN' },
  { tab: 'noniban', btn: 'nb-copy-all', fields: 'nb-fields', sample: 'Account Number' },
  { tab: 'bban', btn: 'bb-copy-all', fields: 'bb-fields', sample: 'BBAN' }
]) {
  test(`${tab}: Copy all copies every field as Label: value lines`, async ({ page }) => {
    await page.goto('/popup.html')
    await page.click(`.tab-btn[data-tab="${tab}"]`)

    const rowCount = await page.locator(`#${fields} .pf-field`).count()
    expect(rowCount).toBeGreaterThan(1)
    const firstValue = await page.locator(`#${fields} .pf-field-value`).first().inputValue()

    await page.click(`#${btn}`)
    await expect(page.locator(`#${btn}`)).toHaveText('Copied!')

    const clip = await page.evaluate(() => navigator.clipboard.readText())
    const lines = clip.split('\n')
    expect(lines.length).toBe(rowCount)          // one line per field
    expect(clip).toContain(`${sample}:`)          // a known label is present
    expect(clip).toContain(firstValue)            // a real generated value made it in
  })
}
