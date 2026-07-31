const { test, expect } = require('@playwright/test')

// Feed a real image to the tool by generating one in-page (a 4x2 red PNG) and handing it to the
// hidden file input via a DataTransfer — exercising the actual createImageBitmap/canvas path.
async function loadImage(page, w = 4, h = 2) {
  await page.evaluate(async ({ w, h }) => {
    const c = document.createElement('canvas')
    c.width = w; c.height = h
    const ctx = c.getContext('2d')
    ctx.fillStyle = 'red'; ctx.fillRect(0, 0, w, h)
    const blob = await new Promise(r => c.toBlob(r, 'image/png'))
    const file = new File([blob], 'test.png', { type: 'image/png' })
    const dt = new DataTransfer()
    dt.items.add(file)
    const input = document.getElementById('rs-file')
    input.files = dt.files
    input.dispatchEvent(new Event('change', { bubbles: true }))
  }, { w, h })
}

test.beforeEach(async ({ page }) => {
  await page.goto('/popup.html')
  await page.click('.tab-btn[data-tab="resize"]')
})

test('loading an image auto-fills its dimensions and enables Generate', async ({ page }) => {
  await loadImage(page, 4, 2)
  await expect(page.locator('#rs-info')).toContainText('4×2')
  await expect(page.locator('#rs-width')).toHaveValue('4')
  await expect(page.locator('#rs-height')).toHaveValue('2')
  await expect(page.locator('#rs-generate')).toBeEnabled()
})

test('lock ratio keeps the aspect ratio when editing one dimension', async ({ page }) => {
  await loadImage(page, 4, 2)
  await page.fill('#rs-width', '8')
  await page.dispatchEvent('#rs-width', 'input')
  await expect(page.locator('#rs-height')).toHaveValue('4') // 4:2 -> 8:4
})

test('resize by dimensions downloads a resized image and shows a preview', async ({ page }) => {
  await loadImage(page, 4, 2)
  await page.fill('#rs-width', '2')
  await page.dispatchEvent('#rs-width', 'input') // lock -> height 1
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.click('#rs-generate')
  ])
  expect(download.suggestedFilename()).toMatch(/^test-resized\.(png|jpg|webp)$/)
  await expect(page.locator('#rs-preview')).toBeVisible()
  await expect(page.locator('#rs-result')).toContainText('2×1')
})

test('a file-size target with a lossless format is rejected with a clear error', async ({ page }) => {
  await loadImage(page, 4, 2)
  await page.selectOption('#rs-format', 'png')
  await page.fill('#rs-target', '10')
  await page.click('#rs-generate')
  await expect(page.locator('#rs-error')).toContainText('lossy')
})

test('reset clears the loaded image and disables Generate', async ({ page }) => {
  await loadImage(page, 4, 2)
  await expect(page.locator('#rs-generate')).toBeEnabled()
  await page.click('#rs-reset-btn')
  await expect(page.locator('#rs-generate')).toBeDisabled()
  await expect(page.locator('#rs-info')).toBeHidden()
  await expect(page.locator('#rs-format')).toHaveValue('original')
})
