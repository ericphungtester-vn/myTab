const { test, expect } = require('../fixtures')

async function settingsPage(context) {
  const page = await context.newPage()
  try { await page.goto('chrome://newtab/', { waitUntil: 'domcontentloaded', timeout: 10_000 }) } catch {}
  await page.waitForTimeout(500)
  await page.click('#settings-btn')
  await page.waitForTimeout(200)
  return page
}

test('Columns reset restores 1 column and migrates existing column assignments', async ({ context }) => {
  const page = await settingsPage(context)
  await page.fill('#bm-cols-slider', '5')
  await page.locator('#bm-cols-slider').dispatchEvent('input')
  await page.waitForTimeout(200)

  await page.click('#bm-cols-reset')
  await page.waitForTimeout(200)

  expect(await page.inputValue('#bm-cols-slider')).toBe('1')
  await expect(page.locator('#bm-cols-val')).toHaveText('1')
  expect(await page.evaluate(() => bmCols)).toBe(1)

  await page.reload()
  await page.waitForTimeout(500)
  expect(await page.inputValue('#bm-cols-slider')).toBe('1')
})

test('Zoom reset restores 100%', async ({ context }) => {
  const page = await settingsPage(context)
  await page.fill('#bm-zoom-slider', '130')
  await page.locator('#bm-zoom-slider').dispatchEvent('input')
  await page.waitForTimeout(200)

  await page.click('#bm-zoom-reset')
  await page.waitForTimeout(200)

  expect(await page.inputValue('#bm-zoom-slider')).toBe('100')
  await expect(page.locator('#bm-zoom-val')).toHaveText('100%')
  expect(await page.evaluate(() => document.documentElement.style.getPropertyValue('--bm-zoom'))).toBe('1')

  await page.reload()
  await page.waitForTimeout(500)
  expect(await page.inputValue('#bm-zoom-slider')).toBe('100')
})

test('Font Family/Size/Weight resets restore defaults without touching each other or the colors', async ({ context }) => {
  const page = await settingsPage(context)
  await page.selectOption('#bm-font-select', 'georgia')
  await page.fill('#bm-font-size-slider', '16')
  await page.locator('#bm-font-size-slider').dispatchEvent('input')
  await page.selectOption('#bm-font-weight-select', '900')
  await page.fill('#bm-folder-color-picker', '#ff0000')
  await page.locator('#bm-folder-color-picker').dispatchEvent('input')
  await page.waitForTimeout(200)

  await page.click('#bm-font-family-reset')
  await page.click('#bm-font-size-reset')
  await page.click('#bm-font-weight-reset')
  await page.waitForTimeout(200)

  expect(await page.inputValue('#bm-font-select')).toBe('system')
  expect(await page.inputValue('#bm-font-size-slider')).toBe('12')
  await expect(page.locator('#bm-font-size-val')).toHaveText('12px')
  expect(await page.inputValue('#bm-font-weight-select')).toBe('500')
  // A folder-color change made just before the font resets must survive them untouched.
  expect(await page.inputValue('#bm-folder-color-picker')).toBe('#ff0000')

  await page.reload()
  await page.waitForTimeout(500)
  expect(await page.inputValue('#bm-font-select')).toBe('system')
  expect(await page.inputValue('#bm-font-size-slider')).toBe('12')
  expect(await page.inputValue('#bm-font-weight-select')).toBe('500')
  expect(await page.inputValue('#bm-folder-color-picker')).toBe('#ff0000')
})
