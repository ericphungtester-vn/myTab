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
