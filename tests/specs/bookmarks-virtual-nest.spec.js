const { test, expect } = require('../fixtures')

// Playwright's synthetic mouse-drag doesn't reliably trigger genuine HTML5 drag events (same
// limitation already documented elsewhere in this suite) — dispatch real DragEvents directly.
// folderHeaderText is looked up via plain JS text matching since page.evaluate() runs in the
// browser's own context, where Playwright's :has()/:text() selector extensions don't exist.
async function dragOntoFolderHeader(page, sourceSelector, folderHeaderText) {
  await page.evaluate(({ sourceSelector, folderHeaderText }) => {
    const dt = new DataTransfer()
    const source = document.querySelector(sourceSelector)
    const header = [...document.querySelectorAll('.bm-folder-header')]
      .find(h => h.querySelector('.bm-folder-name')?.textContent.trim() === folderHeaderText)
    source.dispatchEvent(new DragEvent('dragstart', { bubbles: true, cancelable: true, dataTransfer: dt }))
    header.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: dt }))
    header.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt }))
    source.dispatchEvent(new DragEvent('dragend', { bubbles: true, cancelable: true, dataTransfer: dt }))
  }, { sourceSelector, folderHeaderText })
}

async function bookmarksPage(context) {
  const page = await context.newPage()
  try { await page.goto('chrome://newtab/', { waitUntil: 'domcontentloaded', timeout: 10_000 }) } catch {}
  await page.waitForTimeout(500)
  return page
}

async function seedTree(page) {
  await page.evaluate(async () => {
    // parentId '1' = Bookmarks Bar, a stable Chrome node id
    await new Promise(r => chrome.bookmarks.create({ title: 'Loose Link', url: 'https://example.com/loose', parentId: '1' }, r))
    await new Promise(r => chrome.bookmarks.create({ title: 'Target Folder', parentId: '1' }, r))
  })
  await page.reload()
  await page.waitForTimeout(500)
  await page.click('.bm-folder-header') // expand Bookmarks Bar
  await page.waitForTimeout(200)
}

test('dragging a bookmark onto a folder header nests it there in myTab without moving it in Chrome', async ({ context }) => {
  const page = await bookmarksPage(context)
  await seedTree(page)

  const realParentBefore = await page.evaluate(() =>
    allChromeBookmarks.find(b => b.title === 'Loose Link'))
  const looseId = realParentBefore.id

  await dragOntoFolderHeader(
    page,
    '.bookmark-item--clickable[title^="Loose Link"]',
    'Target Folder'
  )
  await page.waitForTimeout(200)

  // Now rendered nested inside "Target Folder" in the DOM
  const nestedUnderTarget = await page.locator('.bm-folder:has(.bm-folder-name:text("Target Folder")) .bookmark-item--clickable[title^="Loose Link"]')
  await expect(nestedUnderTarget).toBeVisible()
  await expect(nestedUnderTarget).toHaveClass(/virtually-nested/)

  // But chrome.bookmarks.move() was never called — real Chrome parent is untouched
  const realNodeAfter = await page.evaluate(id => new Promise(r =>
    chrome.bookmarks.get(id, nodes => r(nodes[0]))), looseId)
  expect(realNodeAfter.parentId).toBe('1')
})

test('dragging it back out to the column root clears the virtual nesting', async ({ context }) => {
  const page = await bookmarksPage(context)
  await seedTree(page)

  await dragOntoFolderHeader(
    page,
    '.bookmark-item--clickable[title^="Loose Link"]',
    'Target Folder'
  )
  await page.waitForTimeout(200)
  const looseId = await page.evaluate(() => allChromeBookmarks.find(b => b.title === 'Loose Link').id)
  expect(await page.evaluate(id => chromeBmParentMap[id], looseId)).toBeTruthy()

  // Drag it onto the column itself (empty space, not a specific folder header) to pull it back to root
  await page.evaluate(({ looseId }) => {
    const dt = new DataTransfer()
    const source = document.querySelector('.bookmark-item--clickable[title^="Loose Link"]')
    const col = document.querySelector('#chrome-bookmarks-list .bm-column[data-col="0"]')
    source.dispatchEvent(new DragEvent('dragstart', { bubbles: true, cancelable: true, dataTransfer: dt }))
    col.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: dt }))
    col.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt }))
    source.dispatchEvent(new DragEvent('dragend', { bubbles: true, cancelable: true, dataTransfer: dt }))
  }, { looseId })
  await page.waitForTimeout(200)

  expect(await page.evaluate(id => chromeBmParentMap[id], looseId)).toBeUndefined()
})

test('dragging a folder onto its own subfolder is rejected (no cycle)', async ({ context }) => {
  const page = await bookmarksPage(context)
  await page.evaluate(async () => {
    const parent = await new Promise(r => chrome.bookmarks.create({ title: 'Parent Folder', parentId: '1' }, r))
    await new Promise(r => chrome.bookmarks.create({ title: 'Child Folder', parentId: parent.id }, r))
  })
  await page.reload()
  await page.waitForTimeout(500)
  await page.click('.bm-folder-header')
  await page.waitForTimeout(200)
  await page.locator('.bm-folder-header', { hasText: 'Parent Folder' }).click()
  await page.waitForTimeout(200)

  // Both source and target are looked up by folder-header text here, so this doesn't reuse
  // dragOntoFolderHeader (which expects a plain CSS selector for the source)
  await page.evaluate(() => {
    const dt = new DataTransfer()
    const headerByName = name => [...document.querySelectorAll('.bm-folder-header')]
      .find(h => h.querySelector('.bm-folder-name')?.textContent.trim() === name)
    const source = headerByName('Parent Folder')
    const target = headerByName('Child Folder')
    source.dispatchEvent(new DragEvent('dragstart', { bubbles: true, cancelable: true, dataTransfer: dt }))
    target.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: dt }))
    target.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt }))
    source.dispatchEvent(new DragEvent('dragend', { bubbles: true, cancelable: true, dataTransfer: dt }))
  })
  await page.waitForTimeout(200)

  await expect(page.locator('.flashpaint-toast')).toBeVisible()
  const parentId = await page.evaluate(() => {
    const findFolder = (nodes, title) => {
      for (const n of nodes) {
        if (n.title === title) return n.id
        if (n.children) { const f = findFolder(n.children, title); if (f) return f }
      }
    }
    return findFolder(chromeBookmarkTree, 'Parent Folder')
  })
  expect(await page.evaluate(id => chromeBmParentMap[id], parentId)).toBeUndefined()
})

test('the virtual nesting persists across a reload', async ({ context }) => {
  const page = await bookmarksPage(context)
  await seedTree(page)

  await dragOntoFolderHeader(
    page,
    '.bookmark-item--clickable[title^="Loose Link"]',
    'Target Folder'
  )
  await page.waitForTimeout(200)

  // Bookmarks Bar's expanded state was already saved by seedTree()'s click and persists across
  // reload — clicking the header again here would toggle it back closed
  await page.reload()
  await page.waitForTimeout(500)

  const nestedUnderTarget = page.locator('.bm-folder:has(.bm-folder-name:text("Target Folder")) .bookmark-item--clickable[title^="Loose Link"]')
  await expect(nestedUnderTarget).toBeVisible()
})

test('Reset layout clears virtual nesting too', async ({ context }) => {
  const page = await bookmarksPage(context)
  await seedTree(page)

  await dragOntoFolderHeader(
    page,
    '.bookmark-item--clickable[title^="Loose Link"]',
    'Target Folder'
  )
  await page.waitForTimeout(200)

  await page.evaluate(() => window.dispatchEvent(new CustomEvent('bm-reset')))
  await page.waitForTimeout(200)

  expect(await page.evaluate(() => Object.keys(chromeBmParentMap).length)).toBe(0)
})
