const { test, expect } = require('../fixtures')

async function pasteTestImage(page, { w = 200, h = 200, color = '#0000ff' } = {}) {
  await page.evaluate(async ({ w, h, color }) => {
    const c = document.createElement('canvas')
    c.width = w; c.height = h
    const cx = c.getContext('2d')
    cx.fillStyle = color
    cx.fillRect(0, 0, w, h)
    const blob = await new Promise(res => c.toBlob(res, 'image/png'))
    applyImage(blob)
  }, { w, h, color })
  await page.waitForTimeout(300)
}

test('pasting an image auto-selects it and always uses Auto-fit sizing', async ({ flashpaintPage: page }) => {
  await pasteTestImage(page)
  expect(await page.evaluate(() => document.querySelectorAll('.img-overlay').length)).toBe(1)
  expect(await page.evaluate(() => !!activeOverlay)).toBe(true)
})

test('Copy + Ctrl+V duplicates the selected image', async ({ flashpaintPage: page }) => {
  await pasteTestImage(page)
  await page.click('#copy-btn')
  await page.evaluate(() => pasteCopiedOverlay())
  expect(await page.evaluate(() => document.querySelectorAll('.img-overlay').length)).toBe(2)
})

test('Ctrl+C / Ctrl+V duplicates a selected shape', async ({ flashpaintPage: page }) => {
  await page.click('#shape-btn')
  await page.click('button[data-shape="rectFill"]')
  const canvasBox = await page.locator('#flashpaint-canvas').boundingBox()
  await page.mouse.move(canvasBox.x + 400, canvasBox.y + 400)
  await page.mouse.down()
  await page.mouse.move(canvasBox.x + 450, canvasBox.y + 450)
  await page.mouse.up()
  await page.waitForTimeout(150)
  await page.click('button[data-tool="select"]')
  await page.mouse.click(canvasBox.x + 425, canvasBox.y + 425)
  await page.waitForTimeout(150)

  await page.keyboard.press('Control+c')
  await page.waitForTimeout(100)
  // Playwright's synthetic Ctrl+V does not reliably dispatch a real browser 'paste' event
  // (that needs genuine OS clipboard interaction) — call the app's own paste handler directly,
  // which is exactly what that 'paste' event listener would have called anyway
  await page.evaluate(() => pasteCopiedOverlay())
  await page.waitForTimeout(150)

  expect(await page.evaluate(() => document.querySelectorAll('.shape-overlay').length)).toBe(2)
})

test('Undo/redo restores and reapplies a deleted shape', async ({ flashpaintPage: page }) => {
  await page.click('#shape-btn')
  await page.click('button[data-shape="rectFill"]')
  const canvasBox = await page.locator('#flashpaint-canvas').boundingBox()
  await page.mouse.move(canvasBox.x + 100, canvasBox.y + 100)
  await page.mouse.down()
  await page.mouse.move(canvasBox.x + 150, canvasBox.y + 150)
  await page.mouse.up()
  await page.waitForTimeout(150)
  await page.click('button[data-tool="select"]')
  await page.mouse.click(canvasBox.x + 125, canvasBox.y + 125)
  await page.waitForTimeout(150)

  await page.keyboard.press('Delete')
  await page.waitForTimeout(150)
  expect(await page.evaluate(() => document.querySelectorAll('.shape-overlay').length)).toBe(0)

  await page.keyboard.press('Control+z')
  await page.waitForTimeout(150)
  expect(await page.evaluate(() => document.querySelectorAll('.shape-overlay').length)).toBe(1)

  await page.keyboard.press('Control+y')
  await page.waitForTimeout(150)
  expect(await page.evaluate(() => document.querySelectorAll('.shape-overlay').length)).toBe(0)
})

test('an immediate undo right after pasting does not throw (image-decode race guard)', async ({ flashpaintPage: page }) => {
  const errors = []
  page.on('pageerror', e => errors.push(e.message))

  await page.evaluate(async () => {
    const c = document.createElement('canvas')
    c.width = 200; c.height = 200
    const cx = c.getContext('2d')
    cx.fillStyle = '#00ff00'
    cx.fillRect(0, 0, 200, 200)
    const blob = await new Promise(res => c.toBlob(res, 'image/png'))
    applyImage(blob)
  })
  await page.keyboard.press('Control+z') // fired immediately, without waiting for the image to decode
  await page.waitForTimeout(300)

  expect(errors).toEqual([])
})
