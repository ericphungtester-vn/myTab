// Regression guard for a bug class that recurred repeatedly during development: a toolbar
// control (button, slider, dropdown) would incorrectly trigger the global "click outside active
// object -> deselect" listener, silently breaking the control's own action (e.g. clicking "Send
// to back" would deselect the object a split second before the reorder ran, or would deselect it
// right after, making follow-up actions on it fail). Every control below MUST leave the active
// object selected after being clicked once.
const { test, expect } = require('../fixtures')

async function selectAShape(page) {
  await page.click('#shape-btn')
  await page.click('button[data-shape="rectFill"]')
  const canvasBox = await page.locator('#flashpaint-canvas').boundingBox()
  await page.mouse.move(canvasBox.x + 300, canvasBox.y + 300)
  await page.mouse.down()
  await page.mouse.move(canvasBox.x + 400, canvasBox.y + 400)
  await page.mouse.up()
  await page.waitForTimeout(150)
  await page.click('button[data-tool="select"]')
  await page.mouse.click(canvasBox.x + 350, canvasBox.y + 350)
  await page.waitForTimeout(150)
}

const controlsThatMustNotDeselect = [
  { name: 'Copy button', click: page => page.click('#copy-btn') },
  { name: 'Reset style button', click: page => page.click('#reset-style-btn') },
  { name: 'Zoom in button', click: page => page.click('#zoom-in-btn') },
  { name: 'Canvas Size picker (open only)', click: page => page.click('#canvas-size-btn') },
  { name: 'Opacity slider value label', click: page => page.click('#opacity-value') },
  { name: 'A style-slider icon', click: page => page.locator('.style-slider-icon').first().click() },
  { name: 'File menu button (open only)', click: page => page.click('#file-menu-btn') },
  { name: 'Layers panel button', click: page => page.click('#layers-panel-btn') }
]

for (const control of controlsThatMustNotDeselect) {
  test(`${control.name} does not deselect the active object`, async ({ flashpaintPage: page }) => {
    await selectAShape(page)
    await expect.poll(() => page.evaluate(() => !!activeOverlay)).toBe(true)

    await control.click(page)
    await page.waitForTimeout(150)

    expect(await page.evaluate(() => !!activeOverlay)).toBe(true)
  })
}

test('clicking genuinely empty canvas still deselects (baseline still works)', async ({ flashpaintPage: page }) => {
  await selectAShape(page)
  expect(await page.evaluate(() => !!activeOverlay)).toBe(true)

  const canvasBox = await page.locator('#flashpaint-canvas').boundingBox()
  await page.mouse.click(canvasBox.x + 50, canvasBox.y + 50)
  await page.waitForTimeout(150)

  expect(await page.evaluate(() => !!activeOverlay)).toBe(false)
})

test('Layer order actually reorders (not just a no-op click)', async ({ flashpaintPage: page }) => {
  // Draw a large red square, then a smaller blue square on top of it
  await page.click('#shape-btn')
  await page.click('button[data-shape="rectFill"]')
  await page.evaluate(() => {
    document.getElementById('color-picker').value = '#ff0000'
    document.getElementById('color-picker').dispatchEvent(new Event('input', { bubbles: true }))
  })
  const canvasBox = await page.locator('#flashpaint-canvas').boundingBox()
  await page.mouse.move(canvasBox.x + 100, canvasBox.y + 100)
  await page.mouse.down()
  await page.mouse.move(canvasBox.x + 300, canvasBox.y + 300)
  await page.mouse.up()
  await page.waitForTimeout(150)

  await page.evaluate(() => {
    document.getElementById('color-picker').value = '#0000ff'
    document.getElementById('color-picker').dispatchEvent(new Event('input', { bubbles: true }))
  })
  await page.mouse.move(canvasBox.x + 150, canvasBox.y + 150)
  await page.mouse.down()
  await page.mouse.move(canvasBox.x + 250, canvasBox.y + 250)
  await page.mouse.up()
  await page.waitForTimeout(150)

  await page.click('button[data-tool="select"]')
  await page.mouse.click(canvasBox.x + 200, canvasBox.y + 200) // clicks the blue square (topmost)
  await page.waitForTimeout(150)

  await page.click('#layer-order-btn')
  await page.click('#layer-back') // send blue (selected) to back

  const topColorAfter = await page.evaluate(({ cx, cy }) => {
    const topShape = document.elementsFromPoint(cx, cy).find(el => el.classList?.contains('shape-overlay'))
    return topShape?.shapeData.color
  }, { cx: canvasBox.x + 200, cy: canvasBox.y + 200 })

  expect(topColorAfter).toBe('#ff0000') // red should now render on top since blue moved to the back
})
