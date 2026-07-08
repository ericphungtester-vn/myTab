const { test, expect } = require('../fixtures')

async function addAShape(page) {
  await page.click('#shape-btn')
  await page.click('button[data-shape="rectFill"]')
  const canvasBox = await page.locator('#flashpaint-canvas').boundingBox()
  await page.mouse.move(canvasBox.x + 300, canvasBox.y + 300)
  await page.mouse.down()
  await page.mouse.move(canvasBox.x + 400, canvasBox.y + 400)
  await page.mouse.up()
  await page.waitForTimeout(150)
  await page.click('button[data-tool="select"]')
}

test('toolbar button opens the collapsed dot, not the full panel', async ({ flashpaintPage: page }) => {
  await addAShape(page)
  await page.click('#layers-panel-btn')
  await page.waitForTimeout(100)

  expect(await page.evaluate(() => document.getElementById('layers-panel-dot').hidden)).toBe(false)
  expect(await page.evaluate(() => document.getElementById('layers-panel').hidden)).toBe(true)
})

test('clicking the dot expands the panel, and the collapse button returns to a dot', async ({ flashpaintPage: page }) => {
  await addAShape(page)
  await page.click('#layers-panel-btn')
  await page.waitForTimeout(100)

  await page.click('#layers-panel-dot')
  await page.waitForTimeout(100)
  expect(await page.evaluate(() => document.getElementById('layers-panel').hidden)).toBe(false)
  expect(await page.evaluate(() => document.getElementById('layers-panel-dot').hidden)).toBe(true)
  expect(await page.locator('.layers-panel-row').count()).toBeGreaterThan(0)

  await page.click('#layers-panel-collapse-btn')
  await page.waitForTimeout(100)
  expect(await page.evaluate(() => document.getElementById('layers-panel').hidden)).toBe(true)
  expect(await page.evaluate(() => document.getElementById('layers-panel-dot').hidden)).toBe(false)
})

test('the dot can be dragged to a new position without expanding', async ({ flashpaintPage: page }) => {
  await addAShape(page)
  await page.click('#layers-panel-btn')
  await page.waitForTimeout(100)

  const box = await page.locator('#layers-panel-dot').boundingBox()
  const startX = box.x + box.width / 2, startY = box.y + box.height / 2
  await page.mouse.move(startX, startY)
  await page.mouse.down()
  await page.mouse.move(startX - 200, startY + 150, { steps: 8 })
  await page.mouse.up()
  await page.waitForTimeout(100)

  // A real drag (>3px movement) must NOT trigger the click-to-expand behavior
  expect(await page.evaluate(() => document.getElementById('layers-panel').hidden)).toBe(true)
  const newBox = await page.locator('#layers-panel-dot').boundingBox()
  expect(Math.abs(newBox.x - box.x)).toBeGreaterThan(100)
  expect(Math.abs(newBox.y - box.y)).toBeGreaterThan(100)
})

test('the expanded panel can be dragged by its header, and list clicks still select a layer', async ({ flashpaintPage: page }) => {
  await addAShape(page)
  await page.click('#layers-panel-btn')
  await page.click('#layers-panel-dot')
  await page.waitForTimeout(100)

  const headerBox = await page.locator('#layers-panel-header').boundingBox()
  const panelBoxBefore = await page.locator('#layers-panel').boundingBox()
  await page.mouse.move(headerBox.x + headerBox.width / 2, headerBox.y + headerBox.height / 2)
  await page.mouse.down()
  await page.mouse.move(headerBox.x - 100, headerBox.y + 80, { steps: 8 })
  await page.mouse.up()
  await page.waitForTimeout(100)

  const panelBoxAfter = await page.locator('#layers-panel').boundingBox()
  expect(Math.abs(panelBoxAfter.x - panelBoxBefore.x)).toBeGreaterThan(50)

  await page.click('.layers-panel-row')
  await page.waitForTimeout(100)
  expect(await page.evaluate(() => !!activeOverlay)).toBe(true)
})

test('the expanded panel has a semi-transparent background', async ({ flashpaintPage: page }) => {
  await addAShape(page)
  await page.click('#layers-panel-btn')
  await page.click('#layers-panel-dot')
  await page.waitForTimeout(100)

  const bg = await page.evaluate(() => getComputedStyle(document.getElementById('layers-panel')).backgroundColor)
  const alphaMatch = bg.match(/[\d.]+\)$/)
  expect(alphaMatch).not.toBeNull()
  const alpha = parseFloat(alphaMatch[0])
  expect(alpha).toBeLessThan(1)
  expect(alpha).toBeGreaterThan(0)
})
