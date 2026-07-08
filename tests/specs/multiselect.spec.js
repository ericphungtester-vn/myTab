const { test, expect } = require('../fixtures')

async function drawTwoShapes(page) {
  await page.click('#shape-btn')
  await page.click('button[data-shape="rectFill"]')
  const canvasBox = await page.locator('#flashpaint-canvas').boundingBox()
  await page.mouse.move(canvasBox.x + 100, canvasBox.y + 100)
  await page.mouse.down()
  await page.mouse.move(canvasBox.x + 150, canvasBox.y + 150)
  await page.mouse.up()
  await page.waitForTimeout(150)
  await page.mouse.move(canvasBox.x + 300, canvasBox.y + 200)
  await page.mouse.down()
  await page.mouse.move(canvasBox.x + 350, canvasBox.y + 250)
  await page.mouse.up()
  await page.waitForTimeout(150)
  await page.click('button[data-tool="select"]')
  return canvasBox
}

async function shiftClick(page, x, y) {
  await page.keyboard.down('Shift')
  await page.mouse.click(x, y)
  await page.keyboard.up('Shift')
}

test('Shift+click selects a second object into a group', async ({ flashpaintPage: page }) => {
  const canvasBox = await drawTwoShapes(page)
  await page.mouse.click(canvasBox.x + 125, canvasBox.y + 125)
  await shiftClick(page, canvasBox.x + 325, canvasBox.y + 225)
  await page.waitForTimeout(150)

  expect(await page.evaluate(() => document.querySelectorAll('.img-overlay.multi-selected').length)).toBe(2)
  expect(await page.locator('#align-selection-btn').isEnabled()).toBe(true)
})

test('dragging one member of a group moves all selected objects together', async ({ flashpaintPage: page }) => {
  const canvasBox = await drawTwoShapes(page)
  await page.mouse.click(canvasBox.x + 125, canvasBox.y + 125)
  await shiftClick(page, canvasBox.x + 325, canvasBox.y + 225)
  await page.waitForTimeout(150)

  const before = await page.evaluate(() =>
    [...document.querySelectorAll('.img-overlay.multi-selected')].map(o => ({ left: parseInt(o.style.left), top: parseInt(o.style.top) }))
  )
  const activeBox = await page.locator('.img-overlay.active').boundingBox()
  await page.mouse.move(activeBox.x + activeBox.width / 2, activeBox.y + activeBox.height / 2)
  await page.mouse.down()
  await page.mouse.move(activeBox.x + activeBox.width / 2 + 40, activeBox.y + activeBox.height / 2 + 30, { steps: 4 })
  await page.mouse.up()
  await page.waitForTimeout(150)
  const after = await page.evaluate(() =>
    [...document.querySelectorAll('.img-overlay.multi-selected')].map(o => ({ left: parseInt(o.style.left), top: parseInt(o.style.top) }))
  )

  for (let i = 0; i < before.length; i++) {
    expect(after[i].left - before[i].left).toBe(40)
    expect(after[i].top - before[i].top).toBe(30)
  }
})

test('Align Selection lines up the left edges of the group', async ({ flashpaintPage: page }) => {
  const canvasBox = await drawTwoShapes(page)
  await page.mouse.click(canvasBox.x + 125, canvasBox.y + 125)
  await shiftClick(page, canvasBox.x + 325, canvasBox.y + 225)
  await page.waitForTimeout(150)

  await page.click('#align-selection-btn')
  await page.click('button[data-align-mode="left"]')
  await page.waitForTimeout(150)

  const lefts = await page.evaluate(() => [...document.querySelectorAll('.img-overlay.multi-selected')].map(o => parseInt(o.style.left)))
  expect(lefts[0]).toBe(lefts[1])
})

test('a plain (non-Shift) click clears the group back to a single selection', async ({ flashpaintPage: page }) => {
  const canvasBox = await drawTwoShapes(page)
  await page.mouse.click(canvasBox.x + 125, canvasBox.y + 125)
  await shiftClick(page, canvasBox.x + 325, canvasBox.y + 225)
  await page.waitForTimeout(150)
  expect(await page.evaluate(() => document.querySelectorAll('.img-overlay.multi-selected').length)).toBe(2)

  await page.mouse.click(canvasBox.x + 700, canvasBox.y + 700) // empty area
  await page.waitForTimeout(100)
  await page.mouse.click(canvasBox.x + 125, canvasBox.y + 125)
  await page.waitForTimeout(150)

  expect(await page.evaluate(() => document.querySelectorAll('.img-overlay.multi-selected').length)).toBe(0)
})

test('Delete removes every object in the group', async ({ flashpaintPage: page }) => {
  const canvasBox = await drawTwoShapes(page)
  await page.mouse.click(canvasBox.x + 125, canvasBox.y + 125)
  await shiftClick(page, canvasBox.x + 325, canvasBox.y + 225)
  await page.waitForTimeout(150)

  await page.keyboard.press('Delete')
  await page.waitForTimeout(150)

  expect(await page.evaluate(() => document.querySelectorAll('.shape-overlay').length)).toBe(0)
})
