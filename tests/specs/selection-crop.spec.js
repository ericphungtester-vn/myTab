const { test, expect } = require('../fixtures')

async function pasteImageWithRedSquare(page) {
  await page.evaluate(async () => {
    const c = document.createElement('canvas')
    c.width = 400; c.height = 400
    const cx = c.getContext('2d')
    cx.fillStyle = '#0000ff'; cx.fillRect(0, 0, 400, 400)
    cx.fillStyle = '#ff0000'; cx.fillRect(150, 150, 100, 100)
    const blob = await new Promise(res => c.toBlob(res, 'image/png'))
    applyImage(blob)
  })
  await page.waitForTimeout(300)
  await page.evaluate(() => activateImg(document.querySelector('.img-overlay')))
}

async function drawMarquee(page, fromPct, toPct) {
  const r = await page.evaluate(() => {
    const rect = document.querySelector('.img-overlay').getBoundingClientRect()
    return { left: rect.left, top: rect.top, width: rect.width, height: rect.height }
  })
  const sx = r.width / 400, sy = r.height / 400
  await page.mouse.move(r.left + fromPct[0] * sx, r.top + fromPct[1] * sy)
  await page.mouse.down()
  await page.mouse.move(r.left + toPct[0] * sx, r.top + toPct[1] * sy, { steps: 5 })
  await page.mouse.up()
  await page.waitForTimeout(150)
}

async function readNaturalPixel(page, x, y) {
  return page.evaluate(({ x, y }) => {
    const img = document.querySelector('.img-overlay img')
    const c = document.createElement('canvas')
    c.width = img.naturalWidth; c.height = img.naturalHeight
    const cx = c.getContext('2d')
    cx.drawImage(img, 0, 0)
    return [...cx.getImageData(x, y, 1, 1).data]
  }, { x, y })
}

test('Selection tool erases the marked region and fills with the surrounding color', async ({ flashpaintPage: page }) => {
  await pasteImageWithRedSquare(page)
  await page.click('#selection-btn')
  await drawMarquee(page, [140, 140], [260, 260])

  expect(await readNaturalPixel(page, 200, 200)).toEqual([255, 0, 0, 255]) // still red before applying

  await page.keyboard.press('Enter')
  await page.waitForTimeout(300)

  expect(await readNaturalPixel(page, 200, 200)).toEqual([0, 0, 255, 255]) // erased to the blue background
})

test('Selection tool Esc cancels without modifying the image', async ({ flashpaintPage: page }) => {
  await pasteImageWithRedSquare(page)
  await page.click('#selection-btn')
  await drawMarquee(page, [140, 140], [260, 260])
  await page.keyboard.press('Escape')
  await page.waitForTimeout(200)

  expect(await readNaturalPixel(page, 200, 200)).toEqual([255, 0, 0, 255])
  expect(await page.evaluate(() => tool)).toBe('select')
})

test('Crop tool trims the image to exactly the marked region', async ({ flashpaintPage: page }) => {
  await pasteImageWithRedSquare(page)
  await page.click('#crop-btn')
  await drawMarquee(page, [150, 150], [250, 250])
  await page.keyboard.press('Enter')
  await page.waitForTimeout(300)

  const size = await page.evaluate(() => {
    const img = document.querySelector('.img-overlay img')
    return { w: img.naturalWidth, h: img.naturalHeight }
  })
  expect(size).toEqual({ w: 100, h: 100 })
  expect(await readNaturalPixel(page, 50, 50)).toEqual([255, 0, 0, 255]) // fully red after crop
})

test('the pending marquee can be dragged to a new position before applying', async ({ flashpaintPage: page }) => {
  await pasteImageWithRedSquare(page)
  await page.click('#selection-btn')
  // Drawn AWAY from the red square, and deliberately a bit larger than it (120x120 vs the square's
  // 100x100) so that once dragged on top, the erase fully encompasses the red square and its
  // "nearby background" sampling ring lands on the surrounding blue rather than on more red
  await drawMarquee(page, [10, 10], [130, 130])

  // Work entirely in the marquee's own coordinate space (zoomLayer-relative, same space as the
  // image overlay's style.left/top) rather than converting through screen coordinates — the
  // canvas can be larger than the pasted image (it's sized to fill the viewport, with the image
  // centered inside it), so the image's on-screen position and its logical position don't share
  // the same origin.
  const overlayPos = await page.evaluate(() => {
    const el = document.querySelector('.img-overlay')
    return { left: parseFloat(el.style.left), top: parseFloat(el.style.top) }
  })
  const marqueeBefore = await page.evaluate(() => {
    const el = document.querySelector('.selection-indicator')
    return { left: parseFloat(el.style.left), top: parseFloat(el.style.top), width: parseFloat(el.style.width), height: parseFloat(el.style.height) }
  })
  // Desired: marquee centered on the image-relative point (200, 200), i.e. the middle of the red square
  const desiredCenter = { x: overlayPos.left + 200, y: overlayPos.top + 200 }
  const currentCenter = { x: marqueeBefore.left + marqueeBefore.width / 2, y: marqueeBefore.top + marqueeBefore.height / 2 }
  const deltaLogical = { x: desiredCenter.x - currentCenter.x, y: desiredCenter.y - currentCenter.y }

  const marqueeBox = await page.locator('.selection-indicator').boundingBox()
  const centerX = marqueeBox.x + marqueeBox.width / 2, centerY = marqueeBox.y + marqueeBox.height / 2
  await page.mouse.move(centerX, centerY)
  await page.mouse.down()
  await page.mouse.move(centerX + deltaLogical.x, centerY + deltaLogical.y, { steps: 5 }) // zoom is 1:1, so a logical-space delta equals a screen-space delta
  await page.mouse.up()
  await page.waitForTimeout(150)

  const marqueeAfter = await page.evaluate(() => {
    const el = document.querySelector('.selection-indicator')
    return { left: parseFloat(el.style.left), top: parseFloat(el.style.top) }
  })
  expect(Math.abs((marqueeAfter.left - marqueeBefore.left) - deltaLogical.x)).toBeLessThan(2)
  expect(Math.abs((marqueeAfter.top - marqueeBefore.top) - deltaLogical.y)).toBeLessThan(2)

  await page.keyboard.press('Enter')
  await page.waitForTimeout(300)

  expect(await readNaturalPixel(page, 200, 200)).toEqual([0, 0, 255, 255]) // now erased at the DRAGGED-TO location
})
