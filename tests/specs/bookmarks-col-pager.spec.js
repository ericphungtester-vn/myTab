const { test, expect } = require('../fixtures')

async function bookmarksPage(context) {
  const page = await context.newPage()
  try { await page.goto('chrome://newtab/', { waitUntil: 'domcontentloaded', timeout: 10_000 }) } catch {}
  await page.waitForTimeout(500)
  return page
}

async function seedSevenColumns(page) {
  await page.evaluate(async () => {
    const bar = (await new Promise(r => chrome.bookmarks.getTree(r)))[0].children[0]
    for (let i = 1; i <= 7; i++) {
      await new Promise(r => chrome.bookmarks.create({ title: `Folder ${i}`, parentId: bar.id }, r))
    }
  })
  await page.evaluate(async () => {
    const bar = (await new Promise(r => chrome.bookmarks.getTree(r)))[0].children[0]
    bar.children.forEach((child, i) => { chromeBmColMap[child.id] = i })
    saveChromeBmColMap()
  })
  await page.click('#settings-btn')
  await page.waitForTimeout(200)
  await page.fill('#bm-cols-slider', '7')
  await page.locator('#bm-cols-slider').dispatchEvent('input')
  await page.locator('#bm-cols-slider').dispatchEvent('change')
  await page.waitForTimeout(300)
}

test('a narrow window paginates columns instead of squeezing all of them in', async ({ context }) => {
  const page = await bookmarksPage(context)
  await seedSevenColumns(page)
  await page.setViewportSize({ width: 900, height: 900 })
  await page.reload()
  await page.waitForTimeout(500)

  const page1Count = await page.locator('#chrome-bookmarks-list .bm-column').count()
  expect(page1Count).toBeLessThan(7)
  await expect(page.locator('#bm-col-page-label')).toHaveText('1 / 2')
  await expect(page.locator('#bm-col-prev')).toBeDisabled()
  await expect(page.locator('#bm-col-next')).toBeEnabled()

  await page.click('#bm-col-next')
  await page.waitForTimeout(200)
  const page2Count = await page.locator('#chrome-bookmarks-list .bm-column').count()
  expect(page1Count + page2Count).toBe(7)
  await expect(page.locator('#bm-col-page-label')).toHaveText('2 / 2')
  await expect(page.locator('#bm-col-next')).toBeDisabled()

  await page.click('#bm-col-prev')
  await page.waitForTimeout(200)
  await expect(page.locator('#bm-col-page-label')).toHaveText('1 / 2')
  expect(await page.locator('#chrome-bookmarks-list .bm-column').count()).toBe(page1Count)
})

test('widening the window past the pagination threshold shows every column and hides the pager', async ({ context }) => {
  const page = await bookmarksPage(context)
  await seedSevenColumns(page)
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
  await seedSevenColumns(page)
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
  await seedSevenColumns(page)
  await page.setViewportSize({ width: 900, height: 900 })
  await page.reload()
  await page.waitForTimeout(500)

  await page.click('#bm-col-next')
  await page.waitForTimeout(200)
  await expect(page.locator('#bm-col-page-label')).toHaveText('2 / 2')

  await page.click('#settings-btn')
  await page.waitForTimeout(200)
  await page.fill('#bm-cols-slider', '3')
  await page.locator('#bm-cols-slider').dispatchEvent('input')
  await page.locator('#bm-cols-slider').dispatchEvent('change')
  await page.waitForTimeout(300)

  const label = await page.locator('#bm-col-page-label').textContent()
  if (label) expect(label).toMatch(/^1 \//)
})
