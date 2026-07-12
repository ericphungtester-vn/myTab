const { test, expect } = require('../fixtures')

async function newTabPage(context) {
  const page = await context.newPage()
  try { await page.goto('chrome://newtab/', { waitUntil: 'domcontentloaded', timeout: 10_000 }) } catch {}
  await page.waitForTimeout(500)
  return page
}

test('the 3 dev-only Guide sections (Sync/Load/Publish) are hidden by default', async ({ context }) => {
  const page = await newTabPage(context)
  await page.click('#help-btn')
  await page.waitForTimeout(200)

  const headings = await page.evaluate(() =>
    [...document.querySelectorAll('.guide-section-header')]
      .filter(h => h.closest('.guide-section').offsetParent !== null)
      .map(h => h.textContent.trim()))
  expect(headings.some(h => h.includes('Sync Across Devices'))).toBe(false)
  expect(headings.some(h => h.includes('Load Extension Locally'))).toBe(false)
  expect(headings.some(h => h.includes('Publish on Chrome Web Store'))).toBe(false)

  // Still present in the DOM/source, just not rendered — not actually deleted
  expect(await page.locator('.guide-section--dev-only').count()).toBe(3)
})

test('Ctrl+Shift+D reveals the dev-only sections, and toggles them back off', async ({ context }) => {
  const page = await newTabPage(context)
  const errors = []
  page.on('pageerror', e => errors.push(e.message))
  await page.click('#help-btn')
  await page.waitForTimeout(200)

  await page.keyboard.down('Control')
  await page.keyboard.down('Shift')
  await page.keyboard.press('D')
  await page.keyboard.up('Shift')
  await page.keyboard.up('Control')
  await page.waitForTimeout(200)

  await expect(page.locator('.guide-section-header', { hasText: 'Sync Across Devices' })).toBeVisible()
  await expect(page.locator('.guide-section-header', { hasText: 'Load Extension Locally' })).toBeVisible()
  await expect(page.locator('.guide-section-header', { hasText: 'Publish on Chrome Web Store' })).toBeVisible()

  await page.keyboard.down('Control')
  await page.keyboard.down('Shift')
  await page.keyboard.press('D')
  await page.keyboard.up('Shift')
  await page.keyboard.up('Control')
  await page.waitForTimeout(200)

  await expect(page.locator('.guide-section-header', { hasText: 'Sync Across Devices' })).toBeHidden()
  expect(errors).toEqual([])
})

test('the revealed dev-only sections are marked with a DEV badge, unlike the regular sections', async ({ context }) => {
  const page = await newTabPage(context)
  await page.click('#help-btn')
  await page.waitForTimeout(200)
  await page.keyboard.down('Control')
  await page.keyboard.down('Shift')
  await page.keyboard.press('D')
  await page.keyboard.up('Shift')
  await page.keyboard.up('Control')
  await page.waitForTimeout(200)

  expect(await page.locator('.guide-dev-badge').count()).toBe(3)
  await expect(page.locator('.guide-section-header', { hasText: 'Sync Across Devices' }).locator('.guide-dev-badge')).toHaveText('DEV')
  // A regular, always-visible section has no badge
  expect(await page.locator('.guide-section-header', { hasText: 'Column Layout' }).locator('.guide-dev-badge').count()).toBe(0)
})
