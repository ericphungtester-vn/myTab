const { test, expect } = require('../fixtures')

async function bookmarksPage(context) {
  const page = await context.newPage()
  try { await page.goto('chrome://newtab/', { waitUntil: 'domcontentloaded', timeout: 10_000 }) } catch {}
  await page.waitForTimeout(500)
  return page
}

// Deleting a bookmark/folder through the extension's own context menu used to leave its id behind
// forever in chromeBmColMap/chromeBmColOrder/chromeBmFolderOrder/collapsedFolderIds (only
// chromeBmParentMap was pruned) — dead weight that could grow unbounded across repeated
// delete/recreate cycles and eventually hit chrome.storage.sync's per-item quota silently.

test('deleting a bookmark drops its id from column assignment, column order, and collapsed state', async ({ context }) => {
  const page = await bookmarksPage(context)
  const errors = []
  page.on('pageerror', e => errors.push(e.message))

  const nodeId = await page.evaluate(async () => {
    const bar = (await new Promise(r => chrome.bookmarks.getTree(r)))[0].children[0]
    const node = await new Promise(r =>
      chrome.bookmarks.create({ title: 'PruneTestItem', url: 'https://example.com/prune', parentId: bar.id }, r))
    chromeBmColMap[node.id] = 2
    saveChromeBmColMap()
    chromeBmColOrder['0'] = [node.id]
    saveChromeBmColOrder()
    collapsedFolderIds.add(node.id)
    saveCollapsedFolders()
    return node.id
  })

  const before = await page.evaluate(id => ({
    inColMap: id in chromeBmColMap,
    inColOrder: chromeBmColOrder['0']?.includes(id),
    inCollapsed: collapsedFolderIds.has(id),
  }), nodeId)
  expect(before).toEqual({ inColMap: true, inColOrder: true, inCollapsed: true })

  await page.evaluate(async id => { await new Promise(r => chrome.bookmarks.remove(id, r)) }, nodeId)
  await page.evaluate(() => loadChromeBookmarks())
  await page.waitForTimeout(500)

  const after = await page.evaluate(id => ({
    inColMap: id in chromeBmColMap,
    inColOrder: chromeBmColOrder['0']?.includes(id),
    inCollapsed: collapsedFolderIds.has(id),
  }), nodeId)
  expect(after).toEqual({ inColMap: false, inColOrder: false, inCollapsed: false })
  expect(errors).toEqual([])
})

test('deleting one child out of a folder drops just that id from folder order; deleting the whole folder drops its order key entirely', async ({ context }) => {
  const page = await bookmarksPage(context)
  const errors = []
  page.on('pageerror', e => errors.push(e.message))

  const ids = await page.evaluate(async () => {
    const bar = (await new Promise(r => chrome.bookmarks.getTree(r)))[0].children[0]
    const folder = await new Promise(r => chrome.bookmarks.create({ title: 'PruneFolder', parentId: bar.id }, r))
    const childA = await new Promise(r =>
      chrome.bookmarks.create({ title: 'ChildA', url: 'https://example.com/a', parentId: folder.id }, r))
    const childB = await new Promise(r =>
      chrome.bookmarks.create({ title: 'ChildB', url: 'https://example.com/b', parentId: folder.id }, r))
    chromeBmFolderOrder[folder.id] = [childA.id, childB.id]
    saveChromeBmFolderOrder()
    return { folderId: folder.id, childA: childA.id, childB: childB.id }
  })

  await page.evaluate(async childA => { await new Promise(r => chrome.bookmarks.remove(childA, r)) }, ids.childA)
  await page.evaluate(() => loadChromeBookmarks())
  await page.waitForTimeout(500)
  const afterChildDelete = await page.evaluate(ids => ({
    folderKeyExists: ids.folderId in chromeBmFolderOrder,
    order: chromeBmFolderOrder[ids.folderId],
  }), ids)
  expect(afterChildDelete.folderKeyExists).toBe(true)
  expect(afterChildDelete.order).toEqual([ids.childB])

  await page.evaluate(async folderId => { await new Promise(r => chrome.bookmarks.removeTree(folderId, r)) }, ids.folderId)
  await page.evaluate(() => loadChromeBookmarks())
  await page.waitForTimeout(500)
  const afterFolderDelete = await page.evaluate(ids => ids.folderId in chromeBmFolderOrder, ids)
  expect(afterFolderDelete).toBe(false)
  expect(errors).toEqual([])
})

test('unrelated, still-existing bookmarks keep their column/order/collapsed state untouched by pruning', async ({ context }) => {
  const page = await bookmarksPage(context)

  const survivorId = await page.evaluate(async () => {
    const bar = (await new Promise(r => chrome.bookmarks.getTree(r)))[0].children[0]
    const survivor = await new Promise(r =>
      chrome.bookmarks.create({ title: 'Survivor', url: 'https://example.com/survivor', parentId: bar.id }, r))
    const doomed = await new Promise(r =>
      chrome.bookmarks.create({ title: 'Doomed', url: 'https://example.com/doomed', parentId: bar.id }, r))
    chromeBmColMap[survivor.id] = 1
    chromeBmColMap[doomed.id] = 1
    saveChromeBmColMap()
    collapsedFolderIds.add(survivor.id)
    saveCollapsedFolders()
    window.__doomedId = doomed.id
    return survivor.id
  })

  await page.evaluate(async () => { await new Promise(r => chrome.bookmarks.remove(window.__doomedId, r)) })
  await page.evaluate(() => loadChromeBookmarks())
  await page.waitForTimeout(500)

  const survives = await page.evaluate(id => ({
    inColMap: id in chromeBmColMap,
    inCollapsed: collapsedFolderIds.has(id),
  }), survivorId)
  expect(survives).toEqual({ inColMap: true, inCollapsed: true })
})
