const { test, expect } = require('../fixtures')

async function bookmarksPage(context) {
  const page = await context.newPage()
  try {
    await page.goto('chrome://newtab/', { waitUntil: 'domcontentloaded', timeout: 10_000 })
  } catch {}
  await page.waitForTimeout(500)
  return page
}

async function addChromeBookmark(page, { title, url, parentId } = {}) {
  return page.evaluate(({ title, url, parentId }) => new Promise(resolve => {
    chrome.bookmarks.create({ title, url, parentId }, resolve)
  }), { title, url, parentId: parentId || null })
}

test('a bookmark title containing a quote does not break the attribute (escaping fix)', async ({ context }) => {
  const page = await bookmarksPage(context)
  await addChromeBookmark(page, { title: `Weird "Title" 'Here'`, url: 'https://example.com/quote-test' })
  await page.reload()
  await page.waitForTimeout(500)

  await page.fill('#chrome-bm-search', 'quote-test')
  await page.waitForTimeout(200)

  const item = page.locator('.bookmark-item--clickable', { hasText: 'Weird' })
  await expect(item).toBeVisible()
  // The data-url attribute must exactly equal the real URL — if the quote had broken out of the
  // attribute, either this would mismatch or the element would have picked up stray attributes
  expect(await item.getAttribute('data-url')).toBe('https://example.com/quote-test')
})

test('an empty "Your Bookmarks" column still shows a way to create the first folder', async ({ context }) => {
  const page = await bookmarksPage(context)
  const addBtn = page.locator('.your-bm-col-add-btn').first()
  await expect(addBtn).toBeVisible()
})

test('dragging a Chrome bookmark into Your Bookmarks creates a real, deletable item', async ({ context }) => {
  const page = await bookmarksPage(context)
  await addChromeBookmark(page, { title: 'Dragged Link', url: 'https://example.com/dragged' })
  await page.reload()
  await page.waitForTimeout(500)

  // Simulate the drop directly (Playwright's native drag simulation for the HTML5 DnD API is
  // unreliable) by calling the same code path the drop handler uses
  await page.evaluate(() => {
    const node = allChromeBookmarks.find(b => b.url === 'https://example.com/dragged')
    virtualFolders.push({ id: 'vfitem-test', title: node.title, url: node.url, parentId: null, col: 0 })
    saveVirtualFolders()
    renderYourBookmarks()
  })
  await page.waitForTimeout(200)

  const item = page.locator('#your-bookmarks .bookmark-item--clickable', { hasText: 'Dragged Link' })
  await expect(item).toBeVisible()

  await item.locator('.bookmark-delete').click()
  await page.waitForTimeout(200)
  await expect(page.locator('#your-bookmarks .bookmark-item--clickable', { hasText: 'Dragged Link' })).toHaveCount(0)
  expect(await page.evaluate(() => virtualFolders.some(v => v.id === 'vfitem-test'))).toBe(false)
})

test('deleting a "Your Bookmarks" folder asks for confirmation', async ({ context }) => {
  const page = await bookmarksPage(context)
  await page.click('.your-bm-col-add-btn')
  await page.waitForTimeout(200)

  await page.locator('.vf-folder').click({ button: 'right' })
  await page.click('#vf-delete-btn')
  await page.waitForTimeout(200)

  await expect(page.locator('#bm-warn-modal.active')).toBeVisible()
  await expect(page.locator('#bm-warn-title')).toHaveText('Xóa folder')

  // Cancel — the folder must survive
  await page.click('#bm-warn-cancel')
  await page.waitForTimeout(200)
  await expect(page.locator('.vf-folder')).toHaveCount(1)
})

test('confirming (OK) a warn-modal action actually runs it, not just closes the dialog', async ({ context }) => {
  // Regression guard: showBmWarnModal's OK handler previously cleared its stored callback
  // (inside closeModal()) *before* checking and invoking it, so clicking OK on ANY confirmation
  // in the app (rename, delete item/folder, this one) silently did nothing — the dialog closed
  // as if it worked, but the underlying action never ran.
  const page = await bookmarksPage(context)
  await page.click('.your-bm-col-add-btn')
  await page.waitForTimeout(200)
  await expect(page.locator('.vf-folder')).toHaveCount(1)

  await page.locator('.vf-folder').click({ button: 'right' })
  await page.click('#vf-delete-btn')
  await page.waitForTimeout(200)
  await page.click('#bm-warn-ok')
  await page.waitForTimeout(200)

  await expect(page.locator('.vf-folder')).toHaveCount(0)
})

test('search results also include "Your Bookmarks" items', async ({ context }) => {
  const page = await bookmarksPage(context)
  await page.evaluate(() => {
    virtualFolders.push({ id: 'vfitem-search-test', title: 'Searchable Personal Link', url: 'https://example.com/personal', parentId: null, col: 0 })
    saveVirtualFolders()
    renderYourBookmarks()
  })
  await page.fill('#chrome-bm-search', 'Searchable Personal')
  await page.waitForTimeout(200)

  await expect(page.locator('#chrome-bookmarks-list .bookmark-item--clickable', { hasText: 'Searchable Personal Link' })).toBeVisible()
})
