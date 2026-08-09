const { test, expect } = require('@playwright/test')

// The http test harness has no chrome.* APIs, so the pop-out button stays hidden (it can't work).
test('Pop out: button is hidden when the window API is unavailable', async ({ page }) => {
  await page.goto('/popup.html')
  await expect(page.locator('#popout-btn')).toBeHidden()
})

// Mock just enough of the extension APIs to prove the button opens a detached window and closes the popup.
const MOCK = () => {
  window.chrome = {
    windows: { create: o => { window.__popout = o } },
    runtime: { getURL: p => 'chrome-extension://abc/' + p }
  }
  window.close = () => { window.__closed = true }
}

test('Pop out: opens a movable popup window and closes the toolbar popup', async ({ page }) => {
  await page.addInitScript(MOCK)
  await page.goto('/popup.html')
  await expect(page.locator('#popout-btn')).toBeVisible()

  await page.click('#popout-btn')
  const popout = await page.evaluate(() => window.__popout)
  expect(popout.type).toBe('popup')
  expect(popout.url).toContain('popup.html?window=1')
  expect(await page.evaluate(() => window.__closed)).toBe(true)
})

test('Pop out: the detached window itself hides the button (no infinite pop-out)', async ({ page }) => {
  await page.addInitScript(MOCK)
  await page.goto('/popup.html?window=1')
  await expect(page.locator('#popout-btn')).toBeHidden()
})
