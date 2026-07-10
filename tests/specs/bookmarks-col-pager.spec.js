const { test, expect } = require('../fixtures')

async function bookmarksPage(context) {
  const page = await context.newPage()
  try { await page.goto('chrome://newtab/', { waitUntil: 'domcontentloaded', timeout: 10_000 }) } catch {}
  await page.waitForTimeout(500)
  return page
}

async function seedColumns(page, count) {
  await page.evaluate(async (count) => {
    const bar = (await new Promise(r => chrome.bookmarks.getTree(r)))[0].children[0]
    for (let i = 1; i <= count; i++) {
      await new Promise(r => chrome.bookmarks.create({ title: `Folder ${i}`, parentId: bar.id }, r))
    }
  }, count)
  await page.evaluate(async () => {
    const bar = (await new Promise(r => chrome.bookmarks.getTree(r)))[0].children[0]
    bar.children.forEach((child, i) => { chromeBmColMap[child.id] = i })
    saveChromeBmColMap()
  })
  await page.click('#settings-btn')
  await page.waitForTimeout(200)
  await page.fill('#bm-cols-slider', String(count))
  await page.locator('#bm-cols-slider').dispatchEvent('input')
  await page.locator('#bm-cols-slider').dispatchEvent('change')
  await page.waitForTimeout(300)
}

function scrollLeftOf(page, selector) {
  return page.$eval(selector, el => el.scrollLeft)
}

test('a narrow window paginates by scrolling, without ever removing columns from the DOM', async ({ context }) => {
  const page = await bookmarksPage(context)
  await seedColumns(page, 7)
  await page.setViewportSize({ width: 900, height: 900 })
  await page.reload()
  await page.waitForTimeout(500)

  // Every column stays mounted (just scrolled out of view) — this is what makes cross-page
  // drag possible, unlike the old approach of only rendering the current page's columns.
  expect(await page.locator('#chrome-bookmarks-list .bm-column').count()).toBe(7)
  expect(await scrollLeftOf(page, '#chrome-bookmarks-list')).toBe(0)
  await expect(page.locator('#bm-col-page-label')).toHaveText('1 / 2')
  await expect(page.locator('#bm-col-prev')).toBeDisabled()
  await expect(page.locator('#bm-col-next')).toBeEnabled()

  await page.click('#bm-col-next')
  // 7 columns / 4 per page isn't evenly divisible, so the last page's target scroll (1 * clientWidth)
  // exceeds the actual scrollable range — the browser clamps to the max, which flush-anchors the
  // last 3 columns to the right edge instead of leaving dead space. That's the expected outcome.
  const [clientWidth, scrollWidth] = await page.$eval('#chrome-bookmarks-list', el => [el.clientWidth, el.scrollWidth])
  const expectedScrollLeft = Math.min(clientWidth, scrollWidth - clientWidth)
  await expect.poll(() => scrollLeftOf(page, '#chrome-bookmarks-list'), { timeout: 2000 }).toBeCloseTo(expectedScrollLeft, -1)
  expect(await page.locator('#chrome-bookmarks-list .bm-column').count()).toBe(7)
  await expect(page.locator('#bm-col-page-label')).toHaveText('2 / 2')
  await expect(page.locator('#bm-col-next')).toBeDisabled()

  await page.click('#bm-col-prev')
  await expect.poll(() => scrollLeftOf(page, '#chrome-bookmarks-list'), { timeout: 2000 }).toBe(0)
  await expect(page.locator('#bm-col-page-label')).toHaveText('1 / 2')
})

test('widening the window past the pagination threshold hides the pager', async ({ context }) => {
  const page = await bookmarksPage(context)
  await seedColumns(page, 7)
  await page.setViewportSize({ width: 900, height: 900 })
  await page.reload()
  await page.waitForTimeout(500)
  await expect(page.locator('#bm-col-next')).toBeVisible()

  await page.setViewportSize({ width: 1600, height: 900 })
  await page.waitForTimeout(300)

  expect(await page.locator('#chrome-bookmarks-list .bm-column').count()).toBe(7)
  await expect(page.locator('#bm-col-next')).toBeHidden()
})

test('the pager is hidden while searching or when everything fits on one page', async ({ context }) => {
  const page = await bookmarksPage(context)
  await seedColumns(page, 7)
  await page.setViewportSize({ width: 900, height: 900 })
  await page.reload()
  await page.waitForTimeout(500)
  await expect(page.locator('#bm-col-next')).toBeVisible()

  await page.fill('#chrome-bm-search', 'Folder 1')
  await page.waitForTimeout(200)
  await expect(page.locator('#bm-col-next')).toBeHidden()
  await expect(page.locator('#bm-col-prev')).toBeHidden()

  await page.fill('#chrome-bm-search', '')
  await page.waitForTimeout(200)
  await expect(page.locator('#bm-col-next')).toBeVisible()
})

test('changing the column count in Settings resets back to page 1', async ({ context }) => {
  const page = await bookmarksPage(context)
  await seedColumns(page, 7)
  await page.setViewportSize({ width: 900, height: 900 })
  await page.reload()
  await page.waitForTimeout(500)

  await page.click('#bm-col-next')
  await expect(page.locator('#bm-col-page-label')).toHaveText('2 / 2')

  await page.click('#settings-btn')
  await page.waitForTimeout(200)
  await page.fill('#bm-cols-slider', '3')
  await page.locator('#bm-cols-slider').dispatchEvent('input')
  await page.locator('#bm-cols-slider').dispatchEvent('change')
  await page.waitForTimeout(300)

  expect(await scrollLeftOf(page, '#chrome-bookmarks-list')).toBe(0)
  const label = await page.locator('#bm-col-page-label').textContent()
  if (label) expect(label).toMatch(/^1 \//)
})

test('the Columns slider goes up to 14, and Your Bookmarks pages in sync with Chrome Bookmarks', async ({ context }) => {
  const page = await bookmarksPage(context)
  await page.evaluate(async () => {
    const bar = (await new Promise(r => chrome.bookmarks.getTree(r)))[0].children[0]
    for (let i = 1; i <= 10; i++) {
      await new Promise(r => chrome.bookmarks.create({ title: `Folder ${i}`, parentId: bar.id }, r))
    }
  })
  await page.evaluate(async () => {
    const bar = (await new Promise(r => chrome.bookmarks.getTree(r)))[0].children[0]
    bar.children.forEach((child, i) => { chromeBmColMap[child.id] = i })
    saveChromeBmColMap()
    for (let i = 0; i < 14; i++) {
      virtualFolders.push({ id: 'vf' + i, name: 'VF ' + i, col: i, parentId: null, items: [] })
    }
    saveVirtualFolders()
  })
  await page.click('#settings-btn')
  await page.waitForTimeout(200)
  expect(await page.getAttribute('#bm-cols-slider', 'max')).toBe('14')
  await page.fill('#bm-cols-slider', '14')
  await page.locator('#bm-cols-slider').dispatchEvent('input')
  await page.locator('#bm-cols-slider').dispatchEvent('change')
  await page.waitForTimeout(300)
  await page.setViewportSize({ width: 900, height: 900 })
  await page.reload()
  await page.waitForTimeout(500)

  expect(await page.locator('#chrome-bookmarks-list .bm-column').count()).toBe(14)
  expect(await page.locator('#your-bookmarks .bm-column').count()).toBe(14)

  await page.click('#bm-col-next')
  const [clientWidth, scrollWidth] = await page.$eval('#chrome-bookmarks-list', el => [el.clientWidth, el.scrollWidth])
  const expectedScrollLeft = Math.min(clientWidth, scrollWidth - clientWidth)
  // Wait for the smooth-scroll animation to fully settle before comparing the two containers —
  // otherwise reading them mid-animation can catch each at a slightly different frame.
  await expect.poll(() => scrollLeftOf(page, '#chrome-bookmarks-list'), { timeout: 2000 }).toBeCloseTo(expectedScrollLeft, -1)
  const chromeScroll = await scrollLeftOf(page, '#chrome-bookmarks-list')
  const yourScroll = await scrollLeftOf(page, '#your-bookmarks .your-bm-body')
  expect(yourScroll).toBeCloseTo(chromeScroll, 0)
})

test('dragging a folder near the right edge auto-scrolls to reveal columns on the next page, so it can be dropped there', async ({ context }) => {
  const page = await bookmarksPage(context)
  await seedColumns(page, 8)
  await page.setViewportSize({ width: 900, height: 900 })
  await page.reload()
  await page.waitForTimeout(500)

  const errors = []
  page.on('pageerror', e => errors.push(e.message))

  const result = await page.evaluate(async () => {
    const container = document.getElementById('chrome-bookmarks-list')
    const sourceHeader = [...document.querySelectorAll('.bm-folder-header')].find(h => h.textContent.includes('Folder 1'))
    const sourceEl = sourceHeader.closest('.bm-folder[data-node-id]')
    const sourceNodeId = sourceEl.dataset.nodeId
    const dt = new DataTransfer()
    const rect = container.getBoundingClientRect()
    // Below the folder header row, in each column's empty body — dropping ON a header nests
    // into that folder instead (a different feature), which isn't what this test is after.
    const y = rect.top + rect.height / 2
    const edgeX = rect.right - 10

    // draggable="true" lives on the header, not the outer .bm-folder — dragstart must originate
    // there so the app's dragstart handler's e.target.closest('.bm-folder-header') actually matches.
    sourceHeader.dispatchEvent(new DragEvent('dragstart', { bubbles: true, cancelable: true, dataTransfer: dt, clientX: rect.left + 40, clientY: y }))
    for (let i = 0; i < 50; i++) {
      container.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: dt, clientX: edgeX, clientY: y }))
      await new Promise(r => requestAnimationFrame(r))
    }
    const scrolledDuringDrag = container.scrollLeft > 0

    const dropTarget = document.elementFromPoint(edgeX, y)
    const targetCol = dropTarget?.closest('.bm-column')
    const targetColNum = targetCol ? parseInt(targetCol.dataset.col) : null
    dropTarget?.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt, clientX: edgeX, clientY: y }))
    sourceHeader.dispatchEvent(new DragEvent('dragend', { bubbles: true, cancelable: true, dataTransfer: dt, clientX: edgeX, clientY: y }))

    return { scrolledDuringDrag, targetColNum, sourceNodeId }
  })

  expect(errors).toEqual([])
  expect(result.scrolledDuringDrag).toBe(true)
  expect(result.targetColNum).not.toBeNull()
  expect(result.targetColNum).toBeGreaterThan(3) // landed on a column that wasn't visible on page 1

  await page.waitForTimeout(300)
  const assignedCol = await page.evaluate((id) => chromeBmColMap[id], result.sourceNodeId)
  expect(assignedCol).toBe(result.targetColNum)
})
