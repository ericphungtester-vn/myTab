const { test, expect } = require('@playwright/test')

// The popup persists the content area's scroll position so reopening lands where you left off.
// Profile is a long tab — good for scrolling. Wiring lives in main.js (not unit-tested).

const scrollTop = page => page.locator('#app-main').evaluate(el => el.scrollTop)

test('reopening restores the scroll position of the content area', async ({ page }) => {
  await page.goto('/popup.html')
  await page.click('.tab-btn[data-tab="profile"]')
  // scroll the content area down and let the debounced save fire
  await page.locator('#app-main').evaluate(el => { el.scrollTop = 300 })
  await page.waitForTimeout(300)
  const saved = await scrollTop(page)
  expect(saved).toBeGreaterThan(0)

  await page.reload() // simulates closing and reopening the popup
  await expect.poll(() => scrollTop(page), { timeout: 2000 }).toBeGreaterThan(saved - 5)
})

test('switching tabs resets scroll to the top', async ({ page }) => {
  await page.goto('/popup.html')
  await page.click('.tab-btn[data-tab="profile"]')
  await page.locator('#app-main').evaluate(el => { el.scrollTop = 300 })
  await page.waitForTimeout(300)
  await page.click('.tab-btn[data-tab="uuid"]')
  expect(await scrollTop(page)).toBe(0)
})
