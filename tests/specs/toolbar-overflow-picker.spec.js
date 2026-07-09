const { test, expect } = require('../fixtures')

// Regression guard: toolbar groups (and the pickers inside them) get relocated into the
// right-anchored "»" overflow dropdown when the window is too narrow. Any picker that still
// opens with its normal left:0 (or centered) anchor there spills past the right edge of the
// screen and gets visually clipped.

async function openOverflowMenu(page) {
  // The fixtures' persistent-context viewport is fixed at launch, so shrink it here instead of
  // via test.use({ viewport }) — that option only applies to the default browser/page fixtures.
  await page.setViewportSize({ width: 900, height: 900 })
  await page.waitForTimeout(200)
  await expect(page.locator('#toolbar-overflow-btn')).toBeVisible()
  await page.click('#toolbar-overflow-btn')
  await page.waitForTimeout(150)
}

test('the File actions picker does not spill past the right edge when relocated into the overflow menu', async ({ flashpaintPage: page }) => {
  await openOverflowMenu(page)
  await page.click('#toolbar-overflow-menu #file-menu-btn')
  await page.waitForTimeout(150)

  const pickerBox = await page.locator('#file-menu-picker').boundingBox()
  const viewport = page.viewportSize()
  expect(pickerBox.x).toBeGreaterThanOrEqual(0)
  expect(pickerBox.x + pickerBox.width).toBeLessThanOrEqual(viewport.width)
  await expect(page.locator('#save-project-btn')).toBeInViewport()
})

test('the Canvas Size picker does not spill past the right edge when relocated into the overflow menu', async ({ flashpaintPage: page }) => {
  await openOverflowMenu(page)
  const btn = page.locator('#toolbar-overflow-menu #canvas-size-btn')
  if (await btn.count() === 0) return // didn't get pushed into overflow at this width, nothing to check
  await btn.click()
  await page.waitForTimeout(150)

  const pickerBox = await page.locator('#canvas-size-picker').boundingBox()
  const viewport = page.viewportSize()
  expect(pickerBox.x + pickerBox.width).toBeLessThanOrEqual(viewport.width)
})
