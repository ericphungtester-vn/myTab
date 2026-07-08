const { test, expect } = require('../fixtures')

test('toggling dark mode sets data-theme and persists across reload', async ({ flashpaintPage: page }) => {
  expect(await page.evaluate(() => document.documentElement.getAttribute('data-theme'))).toBeNull()

  await page.click('#theme-toggle-btn')
  await page.waitForTimeout(150)
  expect(await page.evaluate(() => document.documentElement.getAttribute('data-theme'))).toBe('dark')

  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(400)
  expect(await page.evaluate(() => document.documentElement.getAttribute('data-theme'))).toBe('dark')

  await page.click('#theme-toggle-btn')
  await page.waitForTimeout(150)
  expect(await page.evaluate(() => document.documentElement.getAttribute('data-theme'))).toBeNull()
})

test('dark mode overrides the default body background but not an explicitly customized one', async ({ flashpaintPage: page }) => {
  await page.click('#theme-toggle-btn')
  await page.waitForTimeout(150)

  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor)
  expect(bg).toBe('rgb(20, 23, 28)') // the dark --bg value, not the light default
})
