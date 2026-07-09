const { test, expect } = require('../fixtures')

async function bookmarksPage(context) {
  const page = await context.newPage()
  try { await page.goto('chrome://newtab/', { waitUntil: 'domcontentloaded', timeout: 10_000 }) } catch {}
  await page.waitForTimeout(500)
  return page
}

async function seedTree(page) {
  await page.evaluate(async () => {
    const bar = (await new Promise(r => chrome.bookmarks.getTree(r)))[0].children[0]
    // example.com itself is a real, always-resolvable domain (unlike arbitrary subdomains of it,
    // which typically fail DNS) — distinguish bookmarks by path instead
    await new Promise(r => chrome.bookmarks.create({ title: 'Solo Link', url: 'https://example.com/solo', parentId: bar.id }, r))
    const folder = await new Promise(r => chrome.bookmarks.create({ title: 'Work', parentId: bar.id }, r))
    await new Promise(r => chrome.bookmarks.create({ title: 'Dashboard', url: 'https://example.com/dash', parentId: folder.id }, r))
    const sub = await new Promise(r => chrome.bookmarks.create({ title: 'Reports', parentId: folder.id }, r))
    await new Promise(r => chrome.bookmarks.create({ title: 'Quarterly', url: 'https://example.com/quarterly', parentId: sub.id }, r))
  })
  await page.reload()
  await page.waitForTimeout(500)
  await page.click('.bm-folder-header') // expand Bookmarks Bar
  await page.waitForTimeout(200)
}

test('pinning a bookmark via context menu adds it to the Quick Bar, and it opens on click', async ({ context }) => {
  const page = await bookmarksPage(context)
  await seedTree(page)

  await expect(page.locator('#quick-bar')).toBeHidden()

  await page.locator('.bookmark-item--clickable[title="Solo Link"]').click({ button: 'right' })
  await page.click('#bm-ctx-toggle-pin')
  await page.waitForTimeout(200)

  await expect(page.locator('#quick-bar')).toBeVisible()
  const quickItem = page.locator('#quick-bar .quick-bar-item', { hasText: 'Solo Link' })
  await expect(quickItem).toBeVisible()

  const [popup] = await Promise.all([
    context.waitForEvent('page'),
    quickItem.click()
  ])
  expect(popup.url()).toContain('example.com/solo')
})

test('pinning a folder shows a chevron, and clicking it opens a dropdown of its contents', async ({ context }) => {
  const page = await bookmarksPage(context)
  await seedTree(page)

  await page.locator('.bm-folder-header', { hasText: 'Work' }).click({ button: 'right' })
  await page.click('#bm-ctx-folder-toggle-pin')
  await page.waitForTimeout(200)

  const workBtn = page.locator('#quick-bar .quick-bar-item[data-folder="true"]', { hasText: 'Work' })
  await expect(workBtn).toBeVisible()
  await expect(workBtn.locator('.quick-bar-chevron')).toBeVisible()

  await workBtn.click()
  const menu = page.locator('#quick-bar-menu')
  await expect(menu).toBeVisible()
  await expect(menu.locator('.quick-bar-menu-row', { hasText: 'Dashboard' })).toBeVisible()
  await expect(menu.locator('.quick-bar-menu-row', { hasText: 'Reports' })).toBeVisible()
})

test('drilling into a subfolder in the dropdown shows a Back row that returns to the parent level', async ({ context }) => {
  const page = await bookmarksPage(context)
  await seedTree(page)

  await page.locator('.bm-folder-header', { hasText: 'Work' }).click({ button: 'right' })
  await page.click('#bm-ctx-folder-toggle-pin')
  await page.waitForTimeout(200)
  await page.locator('#quick-bar .quick-bar-item', { hasText: 'Work' }).click()
  await page.waitForTimeout(150)

  await page.locator('#quick-bar-menu .quick-bar-menu-row', { hasText: 'Reports' }).click()
  await page.waitForTimeout(150)

  const menu = page.locator('#quick-bar-menu')
  await expect(menu.locator('.quick-bar-menu-row', { hasText: 'Quarterly' })).toBeVisible()
  await expect(menu.locator('.quick-bar-menu-back')).toBeVisible()
  await expect(menu.locator('.quick-bar-menu-row', { hasText: 'Dashboard' })).toHaveCount(0)

  await menu.locator('.quick-bar-menu-back').click()
  await page.waitForTimeout(150)
  await expect(menu.locator('.quick-bar-menu-row', { hasText: 'Dashboard' })).toBeVisible()
})

test('clicking a bookmark inside the dropdown opens it and closes the menu', async ({ context }) => {
  const page = await bookmarksPage(context)
  await seedTree(page)

  await page.locator('.bm-folder-header', { hasText: 'Work' }).click({ button: 'right' })
  await page.click('#bm-ctx-folder-toggle-pin')
  await page.waitForTimeout(200)
  await page.locator('#quick-bar .quick-bar-item', { hasText: 'Work' }).click()
  await page.waitForTimeout(150)

  const [popup] = await Promise.all([
    context.waitForEvent('page'),
    page.locator('#quick-bar-menu .quick-bar-menu-row', { hasText: 'Dashboard' }).click()
  ])
  expect(popup.url()).toContain('example.com/dash')
  await expect(page.locator('#quick-bar-menu')).toBeHidden()
})

test('clicking outside the dropdown closes it', async ({ context }) => {
  const page = await bookmarksPage(context)
  await seedTree(page)

  await page.locator('.bm-folder-header', { hasText: 'Work' }).click({ button: 'right' })
  await page.click('#bm-ctx-folder-toggle-pin')
  await page.waitForTimeout(200)
  await page.locator('#quick-bar .quick-bar-item', { hasText: 'Work' }).click()
  await expect(page.locator('#quick-bar-menu')).toBeVisible()

  await page.mouse.click(400, 500)
  await expect(page.locator('#quick-bar-menu')).toBeHidden()
})

test('the context menu label toggles to "Unpin" once pinned, and unpinning removes it from the bar', async ({ context }) => {
  const page = await bookmarksPage(context)
  await seedTree(page)

  const item = page.locator('.bookmark-item--clickable[title="Solo Link"]')
  await item.click({ button: 'right' })
  expect(await page.locator('#bm-ctx-toggle-pin').textContent()).toBe('Pin to Quick Bar')
  await page.click('#bm-ctx-toggle-pin')
  await page.waitForTimeout(150)

  await item.click({ button: 'right' })
  expect(await page.locator('#bm-ctx-toggle-pin').textContent()).toBe('Unpin from Quick Bar')
  await page.click('#bm-ctx-toggle-pin')
  await page.waitForTimeout(150)

  await expect(page.locator('#quick-bar')).toBeHidden()
})

test('the Quick Bar survives a reload (persisted via storage)', async ({ context }) => {
  const page = await bookmarksPage(context)
  await seedTree(page)

  await page.locator('.bookmark-item--clickable[title="Solo Link"]').click({ button: 'right' })
  await page.click('#bm-ctx-toggle-pin')
  await page.waitForTimeout(200)

  await page.reload()
  await page.waitForTimeout(500)

  await expect(page.locator('#quick-bar .quick-bar-item', { hasText: 'Solo Link' })).toBeVisible()
})

test('right-clicking a pinned bookmark directly in the Quick Bar offers Unpin', async ({ context }) => {
  const page = await bookmarksPage(context)
  await seedTree(page)

  await page.locator('.bookmark-item--clickable[title="Solo Link"]').click({ button: 'right' })
  await page.click('#bm-ctx-toggle-pin')
  await page.waitForTimeout(200)

  const quickItem = page.locator('#quick-bar .quick-bar-item', { hasText: 'Solo Link' })
  await quickItem.click({ button: 'right' })
  await expect(page.locator('#bm-item-ctx.active')).toBeVisible()
  expect(await page.locator('#bm-ctx-toggle-pin').textContent()).toBe('Unpin from Quick Bar')

  await page.click('#bm-ctx-toggle-pin')
  await page.waitForTimeout(200)
  await expect(page.locator('#quick-bar')).toBeHidden()
})

test('right-clicking a pinned folder directly in the Quick Bar offers Unpin', async ({ context }) => {
  const page = await bookmarksPage(context)
  await seedTree(page)

  await page.locator('.bm-folder-header', { hasText: 'Work' }).click({ button: 'right' })
  await page.click('#bm-ctx-folder-toggle-pin')
  await page.waitForTimeout(200)

  const quickFolder = page.locator('#quick-bar .quick-bar-item[data-folder="true"]', { hasText: 'Work' })
  await quickFolder.click({ button: 'right' })
  await expect(page.locator('#bm-folder-ctx.active')).toBeVisible()
  expect(await page.locator('#bm-ctx-folder-toggle-pin').textContent()).toBe('Unpin from Quick Bar')

  await page.click('#bm-ctx-folder-toggle-pin')
  await page.waitForTimeout(200)
  await expect(page.locator('#quick-bar .quick-bar-item', { hasText: 'Work' })).toHaveCount(0)
})

test('pinning more items than fit shows a ▾ toggle that expands the bar to show everything', async ({ context }) => {
  const page = await bookmarksPage(context)
  const ids = await page.evaluate(async () => {
    const bar = (await new Promise(r => chrome.bookmarks.getTree(r)))[0].children[0]
    const ids = []
    for (let i = 1; i <= 20; i++) {
      const node = await new Promise(r => chrome.bookmarks.create({ title: `Bookmark Number ${i}`, url: `https://example.com/${i}`, parentId: bar.id }, r))
      ids.push(node.id)
    }
    return ids
  })
  await page.reload()
  await page.waitForTimeout(500)
  await page.evaluate(ids => { quickBarItems = ids; saveQuickBarItems(); renderQuickBar() }, ids)
  await page.waitForTimeout(300)

  const toggleBtn = page.locator('#quick-bar .quick-bar-overflow-btn')
  await expect(toggleBtn).toBeVisible()
  expect(await toggleBtn.textContent()).toBe('▾')

  // Nothing should be left overflowing the bar's own single-row width once hidden items are
  // folded away
  const stillOverflowing = await page.evaluate(() => {
    const bar = document.getElementById('quick-bar')
    return bar.scrollWidth > bar.clientWidth
  })
  expect(stillOverflowing).toBe(false)

  const visibleBefore = await page.locator('#quick-bar .quick-bar-item:visible').count()

  await toggleBtn.click()
  await page.waitForTimeout(150)

  expect(await toggleBtn.textContent()).toBe('▴')
  await expect(page.locator('#quick-bar.expanded')).toBeVisible()
  const item20 = page.locator('#quick-bar .quick-bar-item', { hasText: 'Bookmark Number 20' })
  await expect(item20).toBeVisible()
  const visibleAfter = await page.locator('#quick-bar .quick-bar-item:visible').count()
  expect(visibleAfter).toBeGreaterThan(visibleBefore)

  // Toggling again collapses back to a single row
  await toggleBtn.click()
  await page.waitForTimeout(150)
  await expect(item20).toBeHidden()
  await expect(page.locator('#quick-bar.expanded')).toHaveCount(0)
})

test('the expanded/collapsed state survives a reload', async ({ context }) => {
  const page = await bookmarksPage(context)
  const ids = await page.evaluate(async () => {
    const bar = (await new Promise(r => chrome.bookmarks.getTree(r)))[0].children[0]
    const ids = []
    for (let i = 1; i <= 20; i++) {
      const node = await new Promise(r => chrome.bookmarks.create({ title: `Bookmark Number ${i}`, url: `https://example.com/${i}`, parentId: bar.id }, r))
      ids.push(node.id)
    }
    return ids
  })
  await page.reload()
  await page.waitForTimeout(500)
  await page.evaluate(ids => { quickBarItems = ids; saveQuickBarItems(); renderQuickBar() }, ids)
  await page.waitForTimeout(300)

  await page.click('.quick-bar-overflow-btn')
  await page.waitForTimeout(150)
  await expect(page.locator('#quick-bar.expanded')).toBeVisible()

  await page.reload()
  await page.waitForTimeout(500)

  await expect(page.locator('#quick-bar.expanded')).toBeVisible()
  expect(await page.locator('.quick-bar-overflow-btn').textContent()).toBe('▴')
  await expect(page.locator('#quick-bar .quick-bar-item', { hasText: 'Bookmark Number 20' })).toBeVisible()
})

test('shrinking the window folds more items into overflow, and growing it back restores them', async ({ context }) => {
  const page = await bookmarksPage(context)
  const ids = await page.evaluate(async () => {
    const bar = (await new Promise(r => chrome.bookmarks.getTree(r)))[0].children[0]
    const ids = []
    for (let i = 1; i <= 10; i++) {
      const node = await new Promise(r => chrome.bookmarks.create({ title: `Item ${i}`, url: `https://example.com/${i}`, parentId: bar.id }, r))
      ids.push(node.id)
    }
    return ids
  })
  await page.reload()
  await page.waitForTimeout(500)
  await page.evaluate(ids => { quickBarItems = ids; saveQuickBarItems(); renderQuickBar() }, ids)
  await page.waitForTimeout(300)

  const wideCount = await page.locator('#quick-bar .quick-bar-item:visible').count()

  await page.setViewportSize({ width: 500, height: 900 })
  await page.waitForTimeout(300)
  await expect(page.locator('#quick-bar .quick-bar-overflow-btn')).toBeVisible()
  const narrowCount = await page.locator('#quick-bar .quick-bar-item:visible').count()
  expect(narrowCount).toBeLessThan(wideCount)

  await page.setViewportSize({ width: 1600, height: 900 })
  await page.waitForTimeout(300)
  const restoredCount = await page.locator('#quick-bar .quick-bar-item:visible').count()
  expect(restoredCount).toBe(wideCount)
})

test('pinning past the 37-item limit is rejected with a toast, shown even on the Bookmarks tab', async ({ context }) => {
  const page = await bookmarksPage(context)
  const ids = await page.evaluate(async () => {
    const bar = (await new Promise(r => chrome.bookmarks.getTree(r)))[0].children[0]
    const ids = []
    for (let i = 1; i <= 38; i++) {
      const node = await new Promise(r => chrome.bookmarks.create({ title: `Item ${i}`, url: `https://example.com/${i}`, parentId: bar.id }, r))
      ids.push(node.id)
    }
    return ids
  })
  await page.reload()
  await page.waitForTimeout(500)

  // Pre-fill to exactly the limit directly (pinning one at a time through the UI would be slow
  // and isn't the thing under test), then attempt the one that should be rejected through the
  // real toggle function
  await page.evaluate(ids => {
    quickBarItems = ids.slice(0, 37)
    saveQuickBarItems()
    renderQuickBar()
  }, ids)
  await page.waitForTimeout(200)
  expect(await page.evaluate(() => quickBarItems.length)).toBe(37)

  await page.evaluate(id => toggleQuickBarPin(id), ids[37])
  await page.waitForTimeout(200)

  expect(await page.evaluate(() => quickBarItems.length)).toBe(37)
  expect(await page.evaluate(id => quickBarItems.includes(id), ids[37])).toBe(false)
  await expect(page.locator('.flashpaint-toast')).toBeVisible()
  await expect(page.locator('.flashpaint-toast')).toContainText('37')

  // Unpinning one frees a slot so the next pin succeeds
  await page.evaluate(id => toggleQuickBarPin(id), ids[0])
  await page.waitForTimeout(150)
  await page.evaluate(id => toggleQuickBarPin(id), ids[37])
  await page.waitForTimeout(150)
  expect(await page.evaluate(id => quickBarItems.includes(id), ids[37])).toBe(true)
})
