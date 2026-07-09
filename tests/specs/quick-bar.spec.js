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
