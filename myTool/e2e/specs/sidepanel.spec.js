const { test, expect } = require('@playwright/test')

// Mock just enough extension API to exercise the side-panel button.
const MOCK = () => {
  window.chrome = {
    runtime: { getURL: p => 'chrome-extension://abc/' + p },
    windows: { getCurrent: async () => ({ id: 7 }), create: o => { window.__popout = o } },
    sidePanel: { open: async o => { window.__panel = o } }
  }
  window.close = () => { window.__closed = true }
}

test('Side panel: button is hidden without the sidePanel API', async ({ page }) => {
  await page.goto('/popup.html')
  await expect(page.locator('#panel-btn')).toBeHidden()
})

test('Side panel: button opens the panel for the current window and closes the popup', async ({ page }) => {
  await page.addInitScript(MOCK)
  await page.goto('/popup.html')
  await expect(page.locator('#panel-btn')).toBeVisible()

  await page.click('#panel-btn')
  await expect.poll(() => page.evaluate(() => window.__panel && window.__panel.windowId)).toBe(7)
  expect(await page.evaluate(() => window.__closed)).toBe(true)
})

test('Side panel: ?panel=1 fills the surface and hides the pop-out/panel buttons', async ({ page }) => {
  await page.addInitScript(MOCK)
  await page.goto('/popup.html?panel=1')

  expect(await page.evaluate(() => document.documentElement.classList.contains('as-panel'))).toBe(true)
  // body fills the panel width rather than the fixed 560px popup box
  expect(await page.evaluate(() => getComputedStyle(document.body).width)).not.toBe('560px')
  await expect(page.locator('#panel-btn')).toBeHidden()
  await expect(page.locator('#popout-btn')).toBeHidden()
})
