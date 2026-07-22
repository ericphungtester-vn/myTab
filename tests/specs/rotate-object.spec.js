const { test, expect } = require('../fixtures')

async function drawRect(page, canvasBox, { x = 300, y = 300, w = 80, h = 60 } = {}) {
  await page.click('#shape-btn')
  await page.click('button[data-shape="rect"]')
  const sx = canvasBox.x + x, sy = canvasBox.y + y
  await page.mouse.move(sx, sy)
  await page.mouse.down()
  await page.mouse.move(sx + w, sy + h, { steps: 5 })
  await page.mouse.up()
  await page.waitForTimeout(150)
  await page.click('button[data-tool="select"]')
  await page.mouse.click(sx + w / 2, sy + h / 2)
  await page.waitForTimeout(150)
}

async function dragRotateHandle(page, overlaySelector, dx, dy, { shift = false } = {}) {
  const handle = await page.$(`${overlaySelector} .img-rotate-handle`)
  const box = await handle.boundingBox()
  const cx = box.x + box.width / 2, cy = box.y + box.height / 2
  await page.mouse.move(cx, cy)
  await page.mouse.down()
  if (shift) await page.keyboard.down('Shift')
  await page.mouse.move(cx + dx, cy + dy, { steps: 15 })
  await page.mouse.up()
  if (shift) await page.keyboard.up('Shift')
  await page.waitForTimeout(150)
}

test('dragging a shape\'s rotate handle spins it and keeps it selected', async ({ flashpaintPage: page }) => {
  const canvasBox = await page.locator('#flashpaint-canvas').boundingBox()
  await drawRect(page, canvasBox)

  await dragRotateHandle(page, '.shape-overlay', 120, 20)

  const rotation = await page.evaluate(() => parseFloat(document.querySelector('.shape-overlay').dataset.rotation))
  expect(rotation).not.toBe(0)
  expect(await page.evaluate(() => document.querySelector('.shape-overlay').style.transform)).toContain('rotate(')
  // Rotating shouldn't leave the object deselected, even though the drag ends with the cursor
  // well outside its box (see the justFinishedOverlayDrag guard in flashpaint.js)
  expect(await page.evaluate(() => document.querySelector('.img-overlay.active') !== null)).toBe(true)
})

test('Shift while rotating snaps to 15-degree steps', async ({ flashpaintPage: page }) => {
  const canvasBox = await page.locator('#flashpaint-canvas').boundingBox()
  await drawRect(page, canvasBox)

  await dragRotateHandle(page, '.shape-overlay', 90, 55, { shift: true })

  const rotation = await page.evaluate(() => parseFloat(document.querySelector('.shape-overlay').dataset.rotation))
  expect(rotation % 15).toBeCloseTo(0, 5)
})

test('rotation survives undo/redo and copy/paste', async ({ flashpaintPage: page }) => {
  const canvasBox = await page.locator('#flashpaint-canvas').boundingBox()
  await drawRect(page, canvasBox)
  await dragRotateHandle(page, '.shape-overlay', 100, 0)
  const rotated = await page.evaluate(() => parseFloat(document.querySelector('.shape-overlay').dataset.rotation))
  expect(rotated).not.toBe(0)

  await page.keyboard.press('Control+z')
  await page.waitForTimeout(150)
  expect(await page.evaluate(() => parseFloat(document.querySelector('.shape-overlay')?.dataset.rotation || '0'))).toBe(0)

  await page.keyboard.press('Control+y')
  await page.waitForTimeout(150)
  expect(await page.evaluate(() => parseFloat(document.querySelector('.shape-overlay').dataset.rotation))).toBeCloseTo(rotated, 5)

  // reselect (undo/redo clears selection) before copying
  const box = await (await page.$('.shape-overlay')).boundingBox()
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
  await page.waitForTimeout(100)
  await page.keyboard.press('Control+c')
  // Playwright's synthetic Ctrl+V doesn't reliably dispatch a real browser 'paste' event —
  // call the app's own paste handler directly, same as other copy/paste specs in this suite
  await page.evaluate(() => pasteCopiedOverlay())
  await page.waitForTimeout(150)

  const rotations = await page.evaluate(() => [...document.querySelectorAll('.shape-overlay')].map(o => parseFloat(o.dataset.rotation)))
  expect(rotations).toHaveLength(2)
  expect(rotations[0]).toBeCloseTo(rotations[1], 5)
})

test('a rotated shape can still be resized without throwing', async ({ flashpaintPage: page }) => {
  const canvasBox = await page.locator('#flashpaint-canvas').boundingBox()
  await drawRect(page, canvasBox)
  await dragRotateHandle(page, '.shape-overlay', 60, 90)

  const overlay = await page.$('.img-overlay.active')
  const seHandle = await overlay.$('.img-resize-handle[data-handle="se"]')
  const seBox = await seHandle.boundingBox()
  await page.mouse.move(seBox.x + seBox.width / 2, seBox.y + seBox.height / 2)
  await page.mouse.down()
  await page.mouse.move(seBox.x + 40, seBox.y + 30, { steps: 8 })
  await page.mouse.up()
  await page.waitForTimeout(150)

  const box = await page.evaluate(() => {
    const o = document.querySelector('.img-overlay.active')
    return { w: parseFloat(o.style.width), h: parseFloat(o.style.height) }
  })
  expect(box.w).toBeGreaterThan(0)
  expect(box.h).toBeGreaterThan(0)
  expect(Number.isFinite(box.w)).toBe(true)
  expect(Number.isFinite(box.h)).toBe(true)
})

test('a text box can be rotated the same way as a shape', async ({ flashpaintPage: page }) => {
  const canvasBox = await page.locator('#flashpaint-canvas').boundingBox()
  await page.click('button[data-tool="text"]')
  await page.mouse.click(canvasBox.x + 500, canvasBox.y + 300)
  await page.waitForTimeout(100)
  await page.keyboard.type('Rotate me')
  await page.keyboard.press('Control+Enter')
  await page.waitForTimeout(150)

  await page.click('button[data-tool="select"]')
  const textBox = await (await page.$('.text-overlay')).boundingBox()
  await page.mouse.click(textBox.x + textBox.width / 2, textBox.y + textBox.height / 2)
  await page.waitForTimeout(150)

  await dragRotateHandle(page, '.text-overlay', 80, 60)

  const rotation = await page.evaluate(() => parseFloat(document.querySelector('.text-overlay').dataset.rotation))
  expect(rotation).not.toBe(0)
  expect(await page.evaluate(() => document.querySelector('.img-overlay.active') !== null)).toBe(true)
})
