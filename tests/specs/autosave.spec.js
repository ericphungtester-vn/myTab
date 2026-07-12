const { test, expect } = require('../fixtures')

test('drawing content gets auto-saved and restored after a reload', async ({ flashpaintPage: page }) => {
  await page.click('#shape-btn')
  await page.click('button[data-shape="rectFill"]')
  const canvasBox = await page.locator('#flashpaint-canvas').boundingBox()
  await page.mouse.move(canvasBox.x + 100, canvasBox.y + 100)
  await page.mouse.down()
  await page.mouse.move(canvasBox.x + 200, canvasBox.y + 200)
  await page.mouse.up()
  await page.waitForTimeout(4500) // autosave runs on a 4s interval

  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(500)
  await page.click('button[data-tab="flashpaint"]')
  await page.waitForTimeout(500)

  expect(await page.evaluate(() => document.querySelectorAll('.shape-overlay').length)).toBe(1)
})

test('the "Restored your previous session" toast only appears when FlashPaint is the active tab', async ({ flashpaintPage: page }) => {
  await page.click('.tool-btn[data-tool="draw"]')
  const canvasBox = await page.locator('#flashpaint-canvas').boundingBox()
  await page.mouse.move(canvasBox.x + 50, canvasBox.y + 50)
  await page.mouse.down()
  await page.mouse.move(canvasBox.x + 150, canvasBox.y + 150)
  await page.mouse.up()
  await page.waitForTimeout(4500) // autosave runs on a 4s interval

  // Switch to Bookmarks (persisted as the active tab) before reloading — the restore itself still
  // runs (it's not tab-scoped), but a toast about content the user can't currently see would be
  // confusing, so it should stay silent here.
  await page.click('button[data-tab="bookmarks"]')
  await page.waitForTimeout(300)
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1000)
  expect(await page.locator('.flashpaint-toast').count()).toBe(0)

  // Reloading while FlashPaint IS the active tab should show it.
  await page.click('button[data-tab="flashpaint"]')
  await page.waitForTimeout(300)
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1000)
  await expect(page.locator('.flashpaint-toast').first()).toHaveText('Restored your previous session')
})

test('Clear removes the autosave so a reload starts blank', async ({ flashpaintPage: page }) => {
  await page.click('#shape-btn')
  await page.click('button[data-shape="rectFill"]')
  const canvasBox = await page.locator('#flashpaint-canvas').boundingBox()
  await page.mouse.move(canvasBox.x + 100, canvasBox.y + 100)
  await page.mouse.down()
  await page.mouse.move(canvasBox.x + 200, canvasBox.y + 200)
  await page.mouse.up()
  await page.waitForTimeout(4500)

  await page.click('#clear-btn')
  await page.waitForTimeout(150)

  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(500)
  await page.click('button[data-tab="flashpaint"]')
  await page.waitForTimeout(500)

  expect(await page.evaluate(() => document.querySelectorAll('.shape-overlay').length)).toBe(0)
})
