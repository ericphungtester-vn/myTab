// ---- Storage (chrome.storage.sync with localStorage fallback) ----
function syncGet(keys) {
  if (typeof chrome !== 'undefined' && chrome.storage?.sync) {
    return new Promise(resolve => chrome.storage.sync.get(keys, resolve))
  }
  const result = {}
  keys.forEach(k => {
    const raw = localStorage.getItem(k)
    if (raw !== null) try { result[k] = JSON.parse(raw) } catch { result[k] = raw }
  })
  return Promise.resolve(result)
}

function syncSet(data) {
  if (typeof chrome !== 'undefined' && chrome.storage?.sync) {
    chrome.storage.sync.set(data, () => {
      if (chrome.runtime.lastError) console.warn('sync quota:', chrome.runtime.lastError.message)
    })
    return
  }
  Object.entries(data).forEach(([k, v]) => localStorage.setItem(k, JSON.stringify(v)))
}

// ---- Helpers ----
const FAVICON_COLORS = ['#3B82F6', '#8B5CF6', '#EC4899', '#10B981', '#F59E0B', '#EF4444', '#06B6D4', '#84CC16']

function faviconHTML(url, title) {
  try {
    const domain = new URL(url).hostname
    const letter = (title || domain)[0].toUpperCase()
    const color = FAVICON_COLORS[letter.charCodeAt(0) % FAVICON_COLORS.length]
    const src = `https://www.google.com/s2/favicons?sz=32&domain_url=${encodeURIComponent(url)}`
    // letter is attacker-influenceable (first char of a bookmark title) and lands inside a JS
    // string literal within an inline onerror= attribute — escape backslash/quote so it can't
    // break out of that string.
    const safeLetter = letter.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
    return `<div class="bookmark-favicon" style="background:#F3F4F6">
      <img src="${src}" width="16" height="16" style="width:16px;height:16px;object-fit:contain" draggable="false"
           onerror="const p=this.closest('.bookmark-favicon');p.style.background='${color}';p.textContent='${safeLetter}'">
    </div>`
  } catch {
    return `<div class="bookmark-favicon" style="background:#E5E7EB"></div>`
  }
}

// Safe for both text content AND double-quoted HTML attributes — the textContent->innerHTML
// trick alone only escapes &, <, > (quotes aren't special in a text-node context), but this
// output also gets interpolated into attributes like data-url="..." elsewhere in this file, where
// an unescaped " would break out of the attribute and inject arbitrary markup/handlers.
function escapeHtml(str) {
  const d = document.createElement('div')
  d.textContent = str
  return d.innerHTML.replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

function getDomain(url) {
  try { return new URL(url).hostname.replace(/^www\./, '') } catch { return url }
}

function bookmarkItemHTML(bm, opts = {}) {
  const label = escapeHtml(bm.title || getDomain(bm.url))
  const draggable = opts.draggable ? 'draggable="true"' : ''
  const idAttr = bm.id !== undefined ? `data-item-id="${escapeHtml(String(bm.id))}"` : ''
  return `
    <div class="bookmark-item bookmark-item--clickable" tabindex="0" ${draggable} ${idAttr}
         data-url="${escapeHtml(bm.url)}" title="${label}">
      ${faviconHTML(bm.url, bm.title)}
      <div class="bookmark-info">
        <div class="bookmark-title">${label}</div>
      </div>
      ${opts.deletable ? `<button class="bookmark-delete" data-item-id="${escapeHtml(String(bm.id))}" title="Delete">×</button>` : ''}
    </div>
  `
}

// ---- Column state (populated async by initBookmarkState) ----
let bmCols = 1
let chromeBmColMap = {}
function saveChromeBmColMap() { syncSet({ 'chrome-bm-col-map': chromeBmColMap }) }
let chromeBmColOrder = {}
function saveChromeBmColOrder() { syncSet({ 'chrome-bm-col-order': chromeBmColOrder }) }
let virtualFolders = []
function saveVirtualFolders() { syncSet({ 'virtual-folders': virtualFolders }) }
let colOrder = []
function saveColOrder() { syncSet({ 'col-order': colOrder }) }
let chromeBmFolderOrder = {}
function saveChromeBmFolderOrder() { syncSet({ 'chrome-bm-folder-order': chromeBmFolderOrder }) }
let autoExpandSubfolders = false
let autoGroupTabs = true
let openAllMode = 'all-one-group'
let collapsedFolderIds = new Set()
let collapsedStateLoaded = false
let expandedVfIds = new Set()
let yourBmCollapsed = false
let warnSkipRename = false
let warnSkipDelete = false
let warnSkipItemRename = false
let warnSkipItemDelete = false
let warnSkipVfDelete = false
let warnSkipQuickBarReset = false

function saveCollapsedFolders() { syncSet({ 'bm-collapsed': [...collapsedFolderIds] }) }
function saveExpandedVfs() { syncSet({ 'vf-expanded': [...expandedVfIds] }) }

;(function initBmWarnModal() {
  const modal = document.getElementById('bm-warn-modal')
  const titleEl = document.getElementById('bm-warn-title')
  const textEl = document.getElementById('bm-warn-text')
  const inputWrap = document.getElementById('bm-warn-input-wrap')
  const inputEl = document.getElementById('bm-warn-input')
  const skipCb = document.getElementById('bm-warn-skip-cb')
  const okBtn = document.getElementById('bm-warn-ok')
  const cancelBtn = document.getElementById('bm-warn-cancel')

  let _onConfirm = null

  function closeModal() {
    modal.classList.remove('active')
    okBtn.removeEventListener('click', handleOk)
    cancelBtn.removeEventListener('click', closeModal)
    modal.removeEventListener('click', handleBackdrop)
    _onConfirm = null
  }

  function handleOk() {
    const skip = skipCb.checked
    const inputVal = inputWrap.classList.contains('hidden') ? null : inputEl.value
    // Capture the callback before closing — closeModal() clears _onConfirm, so reading it
    // afterward always saw null and silently no-op'd every confirmation in the app (rename,
    // delete item/folder, reset Quick Bar): the modal closed, but the actual action never ran.
    const onConfirm = _onConfirm
    closeModal()
    if (onConfirm) onConfirm(skip, inputVal)
  }

  function handleBackdrop(e) { if (e.target === modal) closeModal() }

  window.showBmWarnModal = function({ title, text, okLabel, isDanger, withInput, inputDefault, onConfirm }) {
    titleEl.textContent = title
    textEl.textContent = text
    okBtn.textContent = okLabel
    okBtn.className = 'bm-warn-btn ' + (isDanger ? 'bm-warn-btn--danger' : 'bm-warn-btn--ok')
    skipCb.checked = false

    if (withInput) {
      inputWrap.classList.remove('hidden')
      inputEl.value = inputDefault || ''
    } else {
      inputWrap.classList.add('hidden')
    }

    _onConfirm = onConfirm
    modal.classList.add('active')
    okBtn.addEventListener('click', handleOk)
    cancelBtn.addEventListener('click', closeModal)
    modal.addEventListener('click', handleBackdrop)

    if (withInput) setTimeout(() => { inputEl.focus(); inputEl.select() }, 50)
  }
})();

// ---- Chrome Bookmarks ----
let chromeBookmarkTree = []
let allChromeBookmarks = []
let lastChromeFilter = ''

function flattenBookmarks(nodes) {
  const result = []
  for (const node of nodes) {
    if (node.url) {
      result.push({ id: node.id, title: node.title || getDomain(node.url), url: node.url })
    } else if (node.children) {
      result.push(...flattenBookmarks(node.children))
    }
  }
  return result
}

function getRecentBookmarks(n) {
  const all = []
  function collect(nodes) {
    for (const node of nodes) {
      if (node.url) all.push(node)
      else if (node.children) collect(node.children)
    }
  }
  collect(chromeBookmarkTree)
  return all.sort((a, b) => (b.dateAdded || 0) - (a.dateAdded || 0)).slice(0, n)
}

function getBookmarksInFolder(nodeId) {
  function findNode(nodes) {
    for (const n of nodes) {
      if (n.id === nodeId) return n
      if (n.children) { const f = findNode(n.children); if (f) return f }
    }
    return null
  }
  const folder = findNode(chromeBookmarkTree)
  if (!folder?.children) return []
  const urls = []
  function collect(nodes) {
    for (const n of nodes) {
      if (n.url) urls.push(n.url)
      if (n.children) collect(n.children)
    }
  }
  collect(folder.children)
  return urls
}

function initCollapsedState() {
  const columnRoots = collectColumnRoots()
  columnRoots.forEach((roots) => {
    const collapseRoots = roots.filter(n => !n.url).length >= 2
    function processNode(node, shouldCollapse) {
      if (node.url) return
      if (shouldCollapse) collapsedFolderIds.add(node.id)
      if (node.children) node.children.forEach(child => processNode(child, !autoExpandSubfolders))
    }
    roots.forEach(n => processNode(n, collapseRoots))
  })
  collapsedStateLoaded = true
  saveCollapsedFolders()
}

// A "Your Bookmarks" node is either a folder (no .url) or an actual bookmark item (.url set,
// added by dragging a Chrome bookmark in) — dispatch to the right renderer for either case.
function renderYourBookmarkNode(node) {
  return node.url ? bookmarkItemHTML(node, { deletable: true }) : renderVirtualFolder(node)
}

function renderYourBookmarks() {
  const el = document.getElementById('your-bookmarks')
  if (!el) return
  const arrowStyle = yourBmCollapsed ? 'style="transform:rotate(-90deg)"' : ''
  const colsHtml = colOrder.map((dataCol, displayPos) => {
    const roots = virtualFolders.filter(vf => !vf.parentId && vf.col === dataCol)
    // Bar (drag handle + "New folder") is always shown, even on an empty column — otherwise an
    // empty column has no way to ever create its first folder.
    const barHtml = `<div class="bm-col-bar"><div class="bm-col-handle" draggable="true" title="Drag to reorder column">⠿</div><button class="bm-col-add-btn your-bm-col-add-btn" data-col="${dataCol}" title="New folder">+</button></div>`
    return `<div class="bm-column" data-col="${dataCol}" data-display-pos="${displayPos}">
      ${barHtml}
      ${roots.map(renderYourBookmarkNode).join('')}
    </div>`
  }).join('')
  el.innerHTML = `
    <div class="your-bm-header">
      <span class="bm-folder-arrow" ${arrowStyle}>▾</span>
      <span>Your Bookmarks</span>
    </div>
    <p class="vf-note">Stored in extension storage — not saved in Chrome's bookmarks</p>
    <div class="your-bm-body bm-columns"${yourBmCollapsed ? ' style="display:none"' : ''}>
      ${colsHtml}
    </div>
  `
}

// Effective column for a node: explicit assignment or inherit from parentCol
function effectiveColForNode(nodeId, parentCol) {
  if (chromeBmColMap[nodeId] !== undefined) {
    return Math.min(chromeBmColMap[nodeId], bmCols - 1)
  }
  return Math.max(0, parentCol) // parentCol=-1 for top-level chrome nodes → defaults to 0
}

function applyOrder(items, order) {
  const byId = new Map(items.map(n => [n.id, n]))
  const sorted = order.filter(id => byId.has(id)).map(id => byId.get(id))
  const seen = new Set(order)
  const rest = items.filter(n => !seen.has(n.id))
  rest.sort((a, b) => {
    const af = a.url ? 1 : 0
    const bf = b.url ? 1 : 0
    if (af !== bf) return af - bf
    return (a.title || '').localeCompare(b.title || '')
  })
  return [...sorted, ...rest]
}

function sortRootsForCol(roots, col) {
  return applyOrder(roots, chromeBmColOrder[String(col)] || [])
}

function sortChildrenForFolder(children, folderId) {
  return applyOrder(children, chromeBmFolderOrder[folderId] || [])
}

function insertIntoOrder(order, nodeId, insertBeforeId, insertAfterId) {
  if (insertBeforeId) {
    const idx = order.indexOf(insertBeforeId)
    idx >= 0 ? order.splice(idx, 0, nodeId) : order.push(nodeId)
  } else if (insertAfterId) {
    const idx = order.indexOf(insertAfterId)
    idx >= 0 ? order.splice(idx + 1, 0, nodeId) : order.push(nodeId)
  } else {
    order.push(nodeId)
  }
}

function removeFromAllOrders(nodeId) {
  Object.keys(chromeBmColOrder).forEach(c => {
    chromeBmColOrder[c] = (chromeBmColOrder[c] || []).filter(id => id !== nodeId)
  })
  Object.keys(chromeBmFolderOrder).forEach(fid => {
    chromeBmFolderOrder[fid] = (chromeBmFolderOrder[fid] || []).filter(id => id !== nodeId)
  })
}

function updateChromeBmOrder(nodeId, toCol, insertBeforeId, insertAfterId) {
  removeFromAllOrders(nodeId)
  const key = String(toCol)
  if (!chromeBmColOrder[key]) chromeBmColOrder[key] = []
  insertIntoOrder(chromeBmColOrder[key], nodeId, insertBeforeId, insertAfterId)
  saveChromeBmColOrder()
  saveChromeBmFolderOrder()
}

function updateChromeBmFolderOrder(nodeId, folderId, insertBeforeId, insertAfterId) {
  removeFromAllOrders(nodeId)
  if (!chromeBmFolderOrder[folderId]) chromeBmFolderOrder[folderId] = []
  insertIntoOrder(chromeBmFolderOrder[folderId], nodeId, insertBeforeId, insertAfterId)
  saveChromeBmFolderOrder()
  saveChromeBmColOrder()
}

// Collect which folder nodes appear as "roots" in each column.
// A folder is a root in column C when:
//   - it is a top-level chrome node (Bookmarks Bar, Other Bookmarks, …) assigned to C, OR
//   - it is a sub-folder whose effective column C differs from its parent's effective column
function collectColumnRoots() {
  const roots = Array.from({ length: bmCols }, () => [])

  function traverse(nodes, parentEffCol) {
    for (const node of nodes) {
      const nodeEffCol = effectiveColForNode(node.id, parentEffCol === -1 ? 0 : parentEffCol)
      if (parentEffCol === -1 || nodeEffCol !== parentEffCol) {
        roots[nodeEffCol].push(node)
      }
      if (node.children) traverse(node.children, nodeEffCol)
    }
  }

  traverse(chromeBookmarkTree, -1)
  return roots.map((r, col) => sortRootsForCol(r, col))
}

// Render a node's subtree for a given column context.
// Sub-folders extracted to a different column are skipped (they appear as roots in their column).
function renderNodeForCol(node, col) {
  if (node.url) {
    const label = escapeHtml(node.title || getDomain(node.url))
    return `<div class="bookmark-item bookmark-item--clickable" tabindex="0" draggable="true" data-node-id="${node.id}" data-url="${escapeHtml(node.url)}" title="${label}">
      ${faviconHTML(node.url, node.title)}
      <div class="bookmark-info"><div class="bookmark-title">${label}</div></div>
    </div>`
  }

  // Include only children whose effective column matches this column (covers both folders and bookmarks)
  const visibleChildren = sortChildrenForFolder(
    (node.children || []).filter(child => effectiveColForNode(child.id, col) === col),
    node.id
  )

  const childrenHTML = visibleChildren.map(child => renderNodeForCol(child, col)).join('')
  const count = visibleChildren.length
  const countBadge = count > 0 ? `<span class="bm-folder-count">${count}</span>` : ''
  const isCollapsed = collapsedFolderIds.has(node.id)

  return `<div class="bm-folder${isCollapsed ? ' collapsed' : ''}" data-node-id="${node.id}">
    <div class="bm-folder-header" draggable="true">
      <span class="bm-folder-arrow">▾</span>
      <svg class="bm-folder-icon" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none">
        <path d="M20 6h-8l-2-2H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2z"/>
      </svg>
      <span class="bm-folder-name">${escapeHtml(node.title || 'Bookmarks')}</span>
      ${countBadge}
    </div>
    <div class="bm-folder-body">${childrenHTML}</div>
  </div>`
}

function renderVirtualFolder(vf) {
  const title = escapeHtml(vf.title || 'New folder')
  const collapsedClass = expandedVfIds.has(vf.id) ? '' : ' collapsed'
  const noteHtml = ''
  const children = virtualFolders.filter(v => v.parentId === vf.id)
  const childHtml = children.map(renderYourBookmarkNode).join('')
  return `<div class="bm-folder vf-folder${collapsedClass}" data-vf-id="${vf.id}">
    <div class="bm-folder-header">
      <span class="bm-folder-arrow">▾</span>
      <svg class="bm-folder-icon bm-folder-icon--vf" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none">
        <path d="M20 6h-8l-2-2H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2z"/>
      </svg>
      <span class="bm-folder-name vf-folder-name" title="Double-click to rename">${title}</span>
    </div>
    ${noteHtml}
    <div class="bm-folder-body">${childHtml}</div>
  </div>`
}

function renderChromeBookmarks(filter) {
  const container = document.getElementById('chrome-bookmarks-list')
  if (!container) return
  lastChromeFilter = filter || ''
  const query = lastChromeFilter.toLowerCase()

  renderYourBookmarks()
  renderQuickBar()

  if (query) {
    // Also search "Your Bookmarks" items (not the Chrome tree) so search covers everything visible
    const yourItems = virtualFolders.filter(v => v.url)
    const filtered = [...allChromeBookmarks, ...yourItems].filter(bm =>
      bm.title.toLowerCase().includes(query) || bm.url.toLowerCase().includes(query)
    )
    container.className = 'bookmarks-list'
    if (!filtered.length) {
      container.innerHTML = '<div class="empty-state">No results</div>'
      return
    }
    container.innerHTML = filtered.slice(0, 100).map(bm => bookmarkItemHTML(bm)).join('')
    if (filtered.length > 100) {
      container.innerHTML += `<div class="empty-state" style="font-size:11px">Showing 100 of ${filtered.length} — refine search to narrow</div>`
    }
    return
  }

  if (!chromeBookmarkTree.length) {
    container.className = 'bookmarks-list'
    container.innerHTML = '<div class="empty-state">No bookmarks found</div>'
    return
  }

  // Build column HTMLs using extraction-aware rendering
  const columnRoots = collectColumnRoots()

  container.innerHTML = ''
  container.className = 'bm-columns'
  colOrder.forEach((dataCol, displayPos) => {
    const roots = columnRoots[dataCol]
    const collapseRoots = roots.filter(n => !n.url).length >= 2
    const chromeHtml = roots.map(node => renderNodeForCol(node, dataCol)).join('')
    const col = document.createElement('div')
    col.className = 'bm-column'
    col.dataset.col = dataCol
    col.dataset.displayPos = displayPos
    const colBar = chromeHtml ? `<div class="bm-col-bar"><div class="bm-col-handle" draggable="true" title="Drag to reorder column">⠿</div></div>` : ''
    col.innerHTML = `${colBar}${chromeHtml}`
    container.appendChild(col)
  })
}

async function loadChromeBookmarks() {
  if (typeof chrome === 'undefined' || !chrome.bookmarks) {
    const container = document.getElementById('chrome-bookmarks-list')
    container.className = 'bookmarks-list'
    container.innerHTML = '<div class="empty-state">Chrome bookmarks available after loading as extension</div>'
    return
  }
  chrome.bookmarks.getTree(tree => {
    chromeBookmarkTree = tree[0]?.children || []
    allChromeBookmarks = flattenBookmarks(chromeBookmarkTree)
    if (!collapsedStateLoaded) initCollapsedState()
    renderChromeBookmarks('')
  })
}

// ---- Quick Bar: pinned bookmarks/folders, shown below the header on every tab ----
const QUICK_BAR_MAX_ITEMS = 37
let quickBarItems = [] // Chrome bookmark/folder node ids, in pinned order
function saveQuickBarItems() { syncSet({ 'quick-bar-items': quickBarItems }) }
let quickBarExpanded = false
function saveQuickBarExpanded() { syncSet({ 'quick-bar-expanded': quickBarExpanded }) }

function renderQuickBar() {
  const bar = document.getElementById('quick-bar')
  if (!bar) return
  const nodes = quickBarItems.map(id => findInTree(chromeBookmarkTree, id)).filter(Boolean)
  // Drop stale ids (bookmark/folder was deleted elsewhere) instead of silently rendering nothing
  if (nodes.length !== quickBarItems.length) {
    quickBarItems = nodes.map(n => n.id)
    saveQuickBarItems()
  }
  bar.hidden = nodes.length === 0
  if (!nodes.length) { bar.innerHTML = ''; return }

  bar.innerHTML = nodes.map(node => {
    const label = escapeHtml(node.title || (node.url ? getDomain(node.url) : 'Folder'))
    if (node.url) {
      return `<button class="quick-bar-item" data-node-id="${escapeHtml(node.id)}" title="${label}">
        ${faviconHTML(node.url, node.title)}<span class="quick-bar-label">${label}</span>
      </button>`
    }
    return `<button class="quick-bar-item" data-node-id="${escapeHtml(node.id)}" data-folder="true" title="${label}">
      <svg class="bm-folder-icon" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M20 6h-8l-2-2H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2z"/></svg>
      <span class="quick-bar-label">${label}</span><span class="quick-bar-chevron">▾</span>
    </button>`
  }).join('') +
    '<div class="quick-bar-controls">' +
      '<button class="quick-bar-item quick-bar-overflow-btn" title="Show all pinned items" hidden>▾</button>' +
      '<button class="quick-bar-item quick-bar-reset-btn" title="Unpin all">⟲</button>' +
    '</div>'

  window.recalcQuickBarOverflow?.()
}

function doResetQuickBar() {
  quickBarItems = []
  saveQuickBarItems()
  renderQuickBar()
  showToast?.('Unpinned all Quick Bar items')
}

function resetQuickBar() {
  if (warnSkipQuickBarReset) {
    if (window.confirm(`Unpin all ${quickBarItems.length} Quick Bar items?`)) doResetQuickBar()
    return
  }
  showBmWarnModal({
    title: 'Reset Quick Bar',
    text: `This will unpin all ${quickBarItems.length} items from the Quick Bar. Nothing is deleted from your actual bookmarks, but this can't be undone here.`,
    okLabel: 'Unpin all',
    isDanger: true,
    withInput: false,
    onConfirm: (skip) => {
      if (skip) { warnSkipQuickBarReset = true; syncSet({ 'bm-warn-skip-quickbar-reset': true }) }
      doResetQuickBar()
    }
  })
}

function isPinnedToQuickBar(nodeId) { return quickBarItems.includes(nodeId) }
function toggleQuickBarPin(nodeId) {
  if (isPinnedToQuickBar(nodeId)) {
    quickBarItems = quickBarItems.filter(id => id !== nodeId)
  } else {
    if (quickBarItems.length >= QUICK_BAR_MAX_ITEMS) {
      showToast?.(`Quick Bar is full (max ${QUICK_BAR_MAX_ITEMS} items) — unpin something first`, 'error')
      return
    }
    quickBarItems.push(nodeId)
  }
  saveQuickBarItems()
  renderQuickBar()
}

// Dropdown for a pinned folder — a single panel that drills into subfolders (replacing its own
// content and pushing a "back" entry) rather than opening real sibling flyouts side by side.
// Simpler and more robust than nested hover-menus, at the cost of a little visual fidelity.
;(function initQuickBar() {
  const bar = document.getElementById('quick-bar')
  const menu = document.getElementById('quick-bar-menu')
  let menuStack = [] // folder nodes, root-first; last entry is the level currently shown

  function hideMenu() { menu.hidden = true; menuStack = [] }

  function renderMenuLevel() {
    const folder = menuStack[menuStack.length - 1]
    const children = sortChildrenForFolder(folder.children || [], folder.id)
    const backRow = menuStack.length > 1
      ? `<button class="quick-bar-menu-row quick-bar-menu-back" data-back="true">‹ ${escapeHtml(menuStack[menuStack.length - 2].title || 'Back')}</button>`
      : ''
    if (!children.length) {
      menu.innerHTML = backRow + '<div class="quick-bar-menu-empty">Empty folder</div>'
      return
    }
    menu.innerHTML = backRow + children.map(child => {
      const label = escapeHtml(child.title || (child.url ? getDomain(child.url) : 'Folder'))
      if (child.url) {
        return `<button class="quick-bar-menu-row" data-url="${escapeHtml(child.url)}" title="${label}">
          ${faviconHTML(child.url, child.title)}<span class="quick-bar-menu-label">${label}</span>
        </button>`
      }
      return `<button class="quick-bar-menu-row" data-node-id="${escapeHtml(child.id)}" title="${label}">
        <svg class="bm-folder-icon" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M20 6h-8l-2-2H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2z"/></svg>
        <span class="quick-bar-menu-label">${label}</span><span class="quick-bar-chevron">›</span>
      </button>`
    }).join('')
  }

  function positionMenu(anchorEl) {
    const rect = anchorEl.getBoundingClientRect()
    const width = Math.min(320, Math.max(200, menu.scrollWidth))
    menu.style.left = Math.min(rect.left, window.innerWidth - width - 8) + 'px'
    menu.style.top = Math.min(rect.bottom + 4, window.innerHeight - 100) + 'px'
  }

  function openMenu(folderNode, anchorEl) {
    menuStack = [folderNode]
    renderMenuLevel()
    menu.hidden = false
    positionMenu(anchorEl)
  }

  bar.addEventListener('click', e => {
    const btn = e.target.closest('.quick-bar-item')
    if (!btn) return
    if (btn.classList.contains('quick-bar-overflow-btn')) {
      quickBarExpanded = !quickBarExpanded
      saveQuickBarExpanded()
      recalcOverflow()
      return
    }
    if (btn.classList.contains('quick-bar-reset-btn')) {
      resetQuickBar()
      return
    }
    const nodeId = btn.dataset.nodeId
    const node = findInTree(chromeBookmarkTree, nodeId)
    if (!node) return
    if (node.url) { window.open(node.url, '_blank'); return }
    if (!menu.hidden && menuStack[0]?.id === nodeId) { hideMenu(); return }
    openMenu(node, btn)
  })

  // Pinned items that don't fit in the bar's single-row width are hidden by default (not just
  // left to overflow behind a hidden scrollbar, which would give no clue they exist), folded
  // behind a ▾ toggle that expands the bar to wrap onto extra rows and show everything — pressing
  // it again (▴) collapses back to one row. Re-measured on resize and whenever the pinned set
  // changes (renderQuickBar calls this).
  function recalcOverflow() {
    const toggleBtn = bar.querySelector('.quick-bar-overflow-btn')
    if (!toggleBtn) return
    const items = [...bar.querySelectorAll('.quick-bar-item:not(.quick-bar-overflow-btn):not(.quick-bar-reset-btn)')]
    items.forEach(el => { el.hidden = false })
    bar.classList.remove('expanded')
    toggleBtn.hidden = true

    if (quickBarExpanded) {
      bar.classList.add('expanded')
      toggleBtn.hidden = false
      toggleBtn.textContent = '▴'
      toggleBtn.title = 'Show fewer'
      return
    }

    if (bar.scrollWidth <= bar.clientWidth) return
    toggleBtn.hidden = false
    toggleBtn.textContent = '▾'
    toggleBtn.title = 'Show all pinned items'
    for (let i = items.length - 1; i >= 0 && bar.scrollWidth > bar.clientWidth; i--) {
      items[i].hidden = true
    }
  }
  window.recalcQuickBarOverflow = recalcOverflow

  let overflowRaf = null
  new ResizeObserver(() => {
    if (overflowRaf) cancelAnimationFrame(overflowRaf)
    overflowRaf = requestAnimationFrame(recalcOverflow)
  }).observe(bar)

  menu.addEventListener('click', e => {
    const row = e.target.closest('.quick-bar-menu-row')
    if (!row) return
    if (row.dataset.back) { menuStack.pop(); renderMenuLevel(); return }
    if (row.dataset.url) { window.open(row.dataset.url, '_blank'); hideMenu(); return }
    const child = findInTree(chromeBookmarkTree, row.dataset.nodeId)
    if (child) { menuStack.push(child); renderMenuLevel() }
  })

  // Right-click a pinned item to get the same context menu (rename/delete/copy/pin-toggle) as
  // its counterpart in the main list — reuses that menu rather than duplicating it, since it's
  // the exact same underlying Chrome bookmark/folder either way.
  bar.addEventListener('contextmenu', e => {
    const btn = e.target.closest('.quick-bar-item')
    if (!btn) return
    e.preventDefault()
    e.stopPropagation() // matches the pattern in chrome-bookmarks-list's own contextmenu handler
                         // — without it, document's "close menu on outside contextmenu" listener
                         // (initBmContextMenus) sees this same event bubble past and immediately
                         // hides the menu that openBmItemCtx/openBmFolderCtx just opened below
    hideMenu()
    const nodeId = btn.dataset.nodeId
    const node = findInTree(chromeBookmarkTree, nodeId)
    if (!node) return
    if (node.url) window.openBmItemCtx(nodeId, node.title || '', node.url, e.clientX, e.clientY)
    else window.openBmFolderCtx(nodeId, node.title || '', e.clientX, e.clientY)
  })

  // Uses composedPath() (a dispatch-time snapshot) rather than e.target + .contains() — clicking
  // a row inside the menu rebuilds menu.innerHTML synchronously (renderMenuLevel), which detaches
  // e.target from the DOM before this listener runs later in the same bubble phase, making a
  // .contains(e.target) check wrongly conclude the click landed outside the menu.
  document.addEventListener('click', e => {
    if (menu.hidden) return
    const path = e.composedPath()
    if (!path.includes(menu) && !path.includes(bar)) hideMenu()
  })
  document.addEventListener('keydown', e => { if (e.key === 'Escape') hideMenu() })
})()

// Your Bookmarks panel: add button + folder toggle + dblclick rename + context menu
;(function initYourBookmarks() {
  const panel = document.getElementById('your-bookmarks')

  panel.addEventListener('click', e => {
    const delBtn = e.target.closest('.bookmark-delete')
    if (delBtn) {
      e.stopPropagation()
      const itemId = delBtn.dataset.itemId
      virtualFolders = virtualFolders.filter(v => v.id !== itemId)
      saveVirtualFolders()
      renderYourBookmarks()
      return
    }
    if (e.target.closest('.your-bm-col-add-btn')) {
      e.stopPropagation()
      const btn = e.target.closest('.your-bm-col-add-btn')
      const col = parseInt(btn.dataset.col)
      virtualFolders.push({ id: 'vf-' + Date.now(), title: 'New folder', col, isNew: true })
      saveVirtualFolders()
      renderYourBookmarks()
      return
    }
    if (e.target.closest('.your-bm-header')) {
      yourBmCollapsed = !yourBmCollapsed
      syncSet({ 'your-bm-collapsed': yourBmCollapsed })
      renderYourBookmarks()
      return
    }
    const header = e.target.closest('.bm-folder-header')
    if (header) {
      if (e.target.closest('.vf-folder-name')) return
      const folder = header.closest('.vf-folder[data-vf-id]')
      folder?.classList.toggle('collapsed')
      if (folder) {
        const vfId = folder.dataset.vfId
        if (folder.classList.contains('collapsed')) expandedVfIds.delete(vfId)
        else expandedVfIds.add(vfId)
        saveExpandedVfs()
      }
    }
    const item = e.target.closest('.bookmark-item--clickable')
    if (item) window.open(item.dataset.url, '_blank')
  })

  panel.addEventListener('dblclick', e => {
    const nameEl = e.target.closest('.vf-folder-name')
    if (!nameEl) return
    const vfEl = nameEl.closest('.vf-folder[data-vf-id]')
    if (!vfEl) return
    const vfId = vfEl.dataset.vfId
    const input = document.createElement('input')
    input.type = 'text'
    input.value = nameEl.textContent
    input.className = 'vf-rename-input'
    nameEl.replaceWith(input)
    input.focus()
    input.select()
    let saved = false
    function commitRename() {
      if (saved) return
      saved = true
      const vf = virtualFolders.find(v => v.id === vfId)
      if (vf) { vf.title = input.value.trim() || 'New folder'; vf.isNew = false; saveVirtualFolders() }
      renderYourBookmarks()
    }
    input.addEventListener('blur', commitRename)
    input.addEventListener('keydown', ke => {
      if (ke.key === 'Enter') { ke.preventDefault(); commitRename() }
      if (ke.key === 'Escape') { saved = true; renderYourBookmarks() }
    })
  })
})()

// Drop a Chrome bookmark onto "Your Bookmarks" (a folder, or empty column space) to copy it in as
// a real bookmark item. Reads the node id off the same dataTransfer payload initChromeDragDrop
// already sets on dragstart — folders aren't accepted here, only actual bookmarks (nodes with a url).
;(function initYourBookmarksDropTarget() {
  const panel = document.getElementById('your-bookmarks')

  function clearDropIndicator() {
    panel.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'))
  }

  panel.addEventListener('dragover', e => {
    if (!e.dataTransfer.types.includes('text/plain')) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
    clearDropIndicator()
    const vfFolder = e.target.closest('.vf-folder[data-vf-id]')
    const target = vfFolder || e.target.closest('.bm-column')
    target?.classList.add('drag-over')
  })

  panel.addEventListener('dragleave', e => {
    if (!panel.contains(e.relatedTarget)) clearDropIndicator()
  })

  panel.addEventListener('drop', e => {
    const nodeId = e.dataTransfer.getData('text/plain')
    if (!nodeId) return
    e.preventDefault()
    clearDropIndicator()
    const node = findInTree(chromeBookmarkTree, nodeId)
    if (!node || !node.url) return
    const vfFolderEl = e.target.closest('.vf-folder[data-vf-id]')
    const parentId = vfFolderEl ? vfFolderEl.dataset.vfId : null
    const parentVf = parentId ? virtualFolders.find(v => v.id === parentId) : null
    const col = parentVf ? parentVf.col : parseInt(e.target.closest('.bm-column')?.dataset.col ?? '0')
    virtualFolders.push({
      id: 'vfitem-' + Date.now().toString(36) + Math.random().toString(36).slice(2),
      title: node.title || getDomain(node.url),
      url: node.url,
      parentId,
      col
    })
    saveVirtualFolders()
    renderYourBookmarks()
  })
})()

// Chrome: folder toggle + item click (delegated, registered once)
document.getElementById('chrome-bookmarks-list').addEventListener('click', e => {
  const header = e.target.closest('.bm-folder-header')
  if (header) {
    if (e.target.closest('.vf-folder-name')) return
    const folder = header.closest('.bm-folder')
    folder.classList.toggle('collapsed')
    const nodeId = folder.dataset.nodeId
    if (nodeId) {
      if (folder.classList.contains('collapsed')) collapsedFolderIds.add(nodeId)
      else collapsedFolderIds.delete(nodeId)
      saveCollapsedFolders()
    }
    return
  }
  const item = e.target.closest('.bookmark-item--clickable')
  if (item) window.open(item.dataset.url, '_blank')
})


function findInTree(nodes, id) {
  for (const n of nodes) {
    if (n.id === id) return n
    if (n.children) { const f = findInTree(n.children, id); if (f) return f }
  }
  return null
}

function collectUrlsDeep(node) {
  const urls = []
  if (node.url) urls.push(node.url)
  if (node.children) node.children.forEach(c => urls.push(...collectUrlsDeep(c)))
  return urls
}

function buildOpenAllGroups(nodeId, folderTitle) {
  const folder = findInTree(chromeBookmarkTree, nodeId)
  if (!folder) return []
  if (openAllMode === 'direct-only') {
    const urls = (folder.children || []).filter(c => c.url).map(c => c.url)
    return [{ title: folderTitle, urls }]
  }
  if (openAllMode === 'per-subfolder') {
    const groups = []
    const directUrls = (folder.children || []).filter(c => c.url).map(c => c.url)
    if (directUrls.length) groups.push({ title: folderTitle, urls: directUrls })
    for (const sub of (folder.children || []).filter(c => c.children)) {
      const urls = collectUrlsDeep(sub)
      if (urls.length) groups.push({ title: sub.title, urls })
    }
    return groups
  }
  return [{ title: folderTitle, urls: getBookmarksInFolder(nodeId) }]
}

function buildVfOpenAllGroups(vfId, vfTitle, vfEl) {
  if (openAllMode === 'direct-only') {
    const urls = [...vfEl.querySelectorAll('[data-url]')]
      .filter(el => el.closest('.vf-folder') === vfEl)
      .map(el => el.dataset.url)
    return [{ title: vfTitle, urls }]
  }
  if (openAllMode === 'per-subfolder') {
    const groups = []
    const directUrls = [...vfEl.querySelectorAll('[data-url]')]
      .filter(el => el.closest('.vf-folder') === vfEl)
      .map(el => el.dataset.url)
    if (directUrls.length) groups.push({ title: vfTitle, urls: directUrls })
    for (const childVf of virtualFolders.filter(v => v.parentId === vfId)) {
      const childEl = vfEl.querySelector(`.vf-folder[data-vf-id="${childVf.id}"]`)
      if (childEl) {
        const urls = [...childEl.querySelectorAll('[data-url]')].map(el => el.dataset.url)
        if (urls.length) groups.push({ title: childVf.title, urls })
      }
    }
    return groups
  }
  const urls = [...vfEl.querySelectorAll('[data-url]')].map(el => el.dataset.url)
  return [{ title: vfTitle, urls }]
}

function openGroups(groups) {
  const total = groups.reduce((s, g) => s + g.urls.length, 0)
  if (!total) return
  if (total > 15 && !confirm(`Open ${total} tabs?`)) return
  groups.forEach(g => { if (g.urls.length) openUrlsGrouped(g.urls, g.title) })
}

async function openUrlsGrouped(urls, groupTitle) {
  if (!urls.length) return
  if (typeof chrome === 'undefined' || !chrome.tabs) {
    urls.forEach(url => window.open(url, '_blank'))
    return
  }
  const tabIds = []
  for (const url of urls) {
    const tab = await chrome.tabs.create({ url, active: false })
    if (tab?.id != null) tabIds.push(tab.id)
  }
  if (!tabIds.length) return
  if (!autoGroupTabs || !chrome.tabs.group || !chrome.tabGroups) return
  try {
    const groupId = await chrome.tabs.group({ tabIds })
    if (typeof groupId === 'number') {
      await chrome.tabGroups.update(groupId, { title: groupTitle || 'Group' })
    }
  } catch (e) {
    console.error('[openUrlsGrouped]', e)
  }
}

// Virtual folder context menu (right-click → Delete)
;(function initVfContextMenu() {
  const menu = document.getElementById('vf-context-menu')
  let activeVfId = null

  function hideMenu() { menu.classList.remove('active'); activeVfId = null }
  window._hideVfCtxMenu = hideMenu

  document.getElementById('your-bookmarks').addEventListener('contextmenu', e => {
    const vfEl = e.target.closest('.vf-folder[data-vf-id]')
    if (!vfEl) return
    e.preventDefault()
    activeVfId = vfEl.dataset.vfId
    const x = Math.min(e.clientX, window.innerWidth - 170)
    const y = Math.min(e.clientY, window.innerHeight - 120)
    menu.style.left = x + 'px'
    menu.style.top = y + 'px'
    menu.classList.add('active')
  })

  document.getElementById('vf-ctx-open-all').addEventListener('click', e => {
    e.stopPropagation()
    if (!activeVfId) return hideMenu()
    const vfEl = document.querySelector(`.vf-folder[data-vf-id="${activeVfId}"]`)
    const vf = virtualFolders.find(v => v.id === activeVfId)
    const title = vf ? vf.title : 'Bookmarks'
    hideMenu()
    if (!vfEl) return
    openGroups(buildVfOpenAllGroups(activeVfId, title, vfEl))
  })

  document.getElementById('vf-ctx-new-subfolder').addEventListener('click', e => {
    e.stopPropagation()
    const vfId = activeVfId
    hideMenu()
    if (!vfId) return
    const parentVf = virtualFolders.find(v => v.id === vfId)
    if (!parentVf) return
    const name = window.prompt('Subfolder name:', 'New folder')
    if (name === null) return
    const newVf = { id: Date.now().toString(36) + Math.random().toString(36).slice(2), title: name.trim() || 'New folder', col: parentVf.col, parentId: vfId, isNew: true }
    virtualFolders.push(newVf)
    saveVirtualFolders()
    renderYourBookmarks()
  })

  document.getElementById('vf-delete-btn').addEventListener('click', e => {
    e.stopPropagation()
    const vfId = activeVfId
    const vf = virtualFolders.find(v => v.id === vfId)
    const title = vf ? vf.title : 'folder'
    hideMenu()
    if (!vfId) return

    function doDelete() {
      function deleteSubtree(id) {
        virtualFolders.filter(v => v.parentId === id).forEach(child => deleteSubtree(child.id))
        virtualFolders = virtualFolders.filter(v => v.id !== id)
        expandedVfIds.delete(id)
      }
      deleteSubtree(vfId)
      saveVirtualFolders()
      saveExpandedVfs()
      renderYourBookmarks()
    }

    if (warnSkipVfDelete) {
      if (window.confirm(`Xóa "${title}" và toàn bộ nội dung bên trong khỏi Your Bookmarks?`)) doDelete()
      return
    }

    showBmWarnModal({
      title: 'Xóa folder',
      text: `Thao tác này sẽ xóa "${title}" và toàn bộ nội dung bên trong khỏi Your Bookmarks. Dữ liệu này không nằm trong Chrome Bookmarks nên không thể khôi phục.`,
      okLabel: 'Xóa',
      isDanger: true,
      withInput: false,
      onConfirm: (skip) => {
        if (skip) { warnSkipVfDelete = true; syncSet({ 'bm-warn-skip-vf-delete': true }) }
        doDelete()
      }
    })
  })

  document.addEventListener('click', hideMenu)
  document.addEventListener('contextmenu', e => {
    if (!e.target.closest('.vf-folder[data-vf-id]')) hideMenu()
  })
})()

// Bookmark item + Chrome folder context menus
;(function initBmContextMenus() {
  const itemCtx = document.getElementById('bm-item-ctx')
  const folderCtx = document.getElementById('bm-folder-ctx')
  let ctxUrl = null, ctxTitle = null, ctxNodeId = null, ctxFolderNodeId = null, ctxFolderTitle = null

  function hideCtx() {
    itemCtx.classList.remove('active')
    folderCtx.classList.remove('active')
    ctxUrl = ctxTitle = ctxNodeId = ctxFolderNodeId = ctxFolderTitle = null
  }

  function showMenu(menu, ex, ey, w, h) {
    menu.style.left = Math.min(ex, window.innerWidth - w) + 'px'
    menu.style.top = Math.min(ey, window.innerHeight - h) + 'px'
    menu.classList.add('active')
  }

  function reloadChromeTree() {
    chrome.bookmarks.getTree(tree => {
      chromeBookmarkTree = tree[0]?.children || []
      allChromeBookmarks = flattenBookmarks(chromeBookmarkTree)
      renderChromeBookmarks(lastChromeFilter)
    })
  }

  // Exposed so other UI that represents the same underlying Chrome bookmark/folder (currently
  // just the Quick Bar) can open the exact same context menu instead of duplicating it.
  function openItemCtx(nodeId, title, url, x, y) {
    window._hideVfCtxMenu?.()
    hideCtx()
    ctxUrl = url
    ctxTitle = title
    ctxNodeId = nodeId
    document.getElementById('bm-ctx-toggle-pin').textContent =
      nodeId && isPinnedToQuickBar(nodeId) ? 'Unpin from Quick Bar' : 'Pin to Quick Bar'
    showMenu(itemCtx, x, y, 170, 175)
  }
  window.openBmItemCtx = openItemCtx

  function openFolderCtx(nodeId, title, x, y) {
    window._hideVfCtxMenu?.()
    hideCtx()
    ctxFolderNodeId = nodeId
    ctxFolderTitle = title
    document.getElementById('bm-ctx-folder-toggle-pin').textContent =
      isPinnedToQuickBar(nodeId) ? 'Unpin from Quick Bar' : 'Pin to Quick Bar'
    showMenu(folderCtx, x, y, 190, 160)
  }
  window.openBmFolderCtx = openFolderCtx

  document.getElementById('chrome-bookmarks-list').addEventListener('contextmenu', e => {
    const item = e.target.closest('.bookmark-item--clickable')
    if (item) {
      e.preventDefault()
      e.stopPropagation()
      openItemCtx(item.dataset.nodeId || null, item.querySelector('.bookmark-title')?.textContent || '', item.dataset.url, e.clientX, e.clientY)
      return
    }
    const header = e.target.closest('.bm-folder-header')
    const folder = header?.closest('.bm-folder[data-node-id]:not(.vf-folder)')
    if (folder) {
      e.preventDefault()
      e.stopPropagation()
      openFolderCtx(folder.dataset.nodeId, folder.querySelector('.bm-folder-name')?.textContent || '', e.clientX, e.clientY)
    }
  })

  document.getElementById('bm-ctx-new-tab').addEventListener('click', () => { if (ctxUrl) window.open(ctxUrl, '_blank'); hideCtx() })
  document.getElementById('bm-ctx-same-tab').addEventListener('click', () => { if (ctxUrl) window.location.href = ctxUrl; hideCtx() })
  document.getElementById('bm-ctx-copy-url').addEventListener('click', () => { if (ctxUrl) navigator.clipboard.writeText(ctxUrl); hideCtx() })
  document.getElementById('bm-ctx-copy-title').addEventListener('click', () => { if (ctxTitle) navigator.clipboard.writeText(ctxTitle); hideCtx() })
  document.getElementById('bm-ctx-toggle-pin').addEventListener('click', () => { if (ctxNodeId) toggleQuickBarPin(ctxNodeId); hideCtx() })
  document.getElementById('bm-ctx-folder-toggle-pin').addEventListener('click', () => { if (ctxFolderNodeId) toggleQuickBarPin(ctxFolderNodeId); hideCtx() })

  document.getElementById('bm-ctx-rename-item').addEventListener('click', () => {
    const nodeId = ctxNodeId
    const currentTitle = ctxTitle
    hideCtx()
    if (!nodeId || !chrome.bookmarks) return

    function doRename(newName) {
      if (!newName || !newName.trim()) return
      chrome.bookmarks.update(nodeId, { title: newName.trim() }, reloadChromeTree)
    }

    if (warnSkipItemRename) {
      const name = window.prompt('Rename bookmark:', currentTitle)
      if (name !== null) doRename(name)
      return
    }

    showBmWarnModal({
      title: 'Đổi tên bookmark',
      text: 'Thao tác này sẽ thay đổi tên bookmark trực tiếp trong Chrome Bookmarks và đồng bộ sang tất cả thiết bị.',
      okLabel: 'Lưu',
      isDanger: false,
      withInput: true,
      inputDefault: currentTitle,
      onConfirm: (skip, newName) => {
        if (skip) { warnSkipItemRename = true; syncSet({ 'bm-warn-skip-item-rename': true }) }
        doRename(newName)
      }
    })
  })

  document.getElementById('bm-ctx-delete-item').addEventListener('click', () => {
    const nodeId = ctxNodeId
    const title = ctxTitle
    hideCtx()
    if (!nodeId || !chrome.bookmarks) return

    function doDelete() {
      chrome.bookmarks.remove(nodeId, reloadChromeTree)
    }

    if (warnSkipItemDelete) {
      if (window.confirm(`Xóa bookmark "${title}"?`)) doDelete()
      return
    }

    showBmWarnModal({
      title: 'Xóa bookmark',
      text: `Thao tác này sẽ xóa vĩnh viễn "${title}" khỏi Chrome Bookmarks. Không thể hoàn tác.`,
      okLabel: 'Xóa',
      isDanger: true,
      withInput: false,
      onConfirm: (skip) => {
        if (skip) { warnSkipItemDelete = true; syncSet({ 'bm-warn-skip-item-delete': true }) }
        doDelete()
      }
    })
  })

  document.getElementById('bm-ctx-open-all').addEventListener('click', () => {
    if (!ctxFolderNodeId) return hideCtx()
    const title = ctxFolderTitle || 'Bookmarks'
    const groups = buildOpenAllGroups(ctxFolderNodeId, title)
    hideCtx()
    openGroups(groups)
  })

  document.getElementById('bm-ctx-new-subfolder').addEventListener('click', () => {
    const parentId = ctxFolderNodeId
    hideCtx()
    if (!parentId || !chrome.bookmarks) return
    const name = window.prompt('Subfolder name:', 'New folder')
    if (name === null) return
    chrome.bookmarks.create({ parentId, title: name.trim() || 'New folder' }, reloadChromeTree)
  })

  document.getElementById('bm-ctx-rename-folder').addEventListener('click', () => {
    const nodeId = ctxFolderNodeId
    const currentTitle = ctxFolderTitle
    hideCtx()
    if (!nodeId || !chrome.bookmarks) return

    function doRename(newName) {
      if (!newName || !newName.trim()) return
      chrome.bookmarks.update(nodeId, { title: newName.trim() }, reloadChromeTree)
    }

    if (warnSkipRename) {
      const name = window.prompt('Rename folder:', currentTitle)
      if (name !== null) doRename(name)
      return
    }

    showBmWarnModal({
      title: 'Đổi tên folder',
      text: 'Thao tác này sẽ thay đổi tên folder trực tiếp trong Chrome Bookmarks và đồng bộ sang tất cả thiết bị.',
      okLabel: 'Lưu',
      isDanger: false,
      withInput: true,
      inputDefault: currentTitle,
      onConfirm: (skip, newName) => {
        if (skip) { warnSkipRename = true; syncSet({ 'bm-warn-skip-rename': true }) }
        doRename(newName)
      }
    })
  })

  document.getElementById('bm-ctx-delete-folder').addEventListener('click', () => {
    const nodeId = ctxFolderNodeId
    const title = ctxFolderTitle
    hideCtx()
    if (!nodeId || !chrome.bookmarks) return

    function doDelete() {
      chrome.bookmarks.removeTree(nodeId, reloadChromeTree)
    }

    if (warnSkipDelete) {
      if (window.confirm(`Xóa "${title}" và toàn bộ nội dung bên trong?`)) doDelete()
      return
    }

    showBmWarnModal({
      title: 'Xóa folder',
      text: `Thao tác này sẽ xóa vĩnh viễn "${title}" và toàn bộ bookmark bên trong khỏi Chrome Bookmarks. Không thể hoàn tác.`,
      okLabel: 'Xóa',
      isDanger: true,
      withInput: false,
      onConfirm: (skip) => {
        if (skip) { warnSkipDelete = true; syncSet({ 'bm-warn-skip-delete': true }) }
        doDelete()
      }
    })
  })

  document.addEventListener('click', hideCtx)
  document.addEventListener('contextmenu', e => {
    if (!e.target.closest('#bm-item-ctx') && !e.target.closest('#bm-folder-ctx')) hideCtx()
  })
})()

// Middle-click opens in new tab
document.getElementById('chrome-bookmarks-list').addEventListener('auxclick', e => {
  if (e.button !== 1) return
  const item = e.target.closest('.bookmark-item--clickable')
  if (item) { e.preventDefault(); window.open(item.dataset.url, '_blank') }
})

// '/' focuses search
document.addEventListener('keydown', e => {
  if (e.key === '/' && !['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) {
    e.preventDefault()
    document.getElementById('chrome-bm-search').focus()
  }
})

// Escape clears search
document.getElementById('chrome-bm-search').addEventListener('keydown', e => {
  if (e.key === 'Escape') { e.target.value = ''; renderChromeBookmarks(''); e.target.blur() }
})

// Arrow key navigation + Enter to open focused bookmark
document.getElementById('chrome-bookmarks-list').addEventListener('keydown', e => {
  const focused = document.activeElement
  if (!focused?.classList.contains('bookmark-item--clickable')) return
  if (e.key === 'Enter') { e.preventDefault(); window.open(focused.dataset.url, '_blank'); return }
  if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
  e.preventDefault()
  const items = [...document.querySelectorAll('#chrome-bookmarks-list .bookmark-item--clickable')]
  const idx = items.indexOf(focused)
  items[idx + (e.key === 'ArrowDown' ? 1 : -1)]?.focus()
})

document.getElementById('chrome-bm-search').addEventListener('input', e => {
  renderChromeBookmarks(e.target.value)
})

// Chrome drag-drop (registered once — survives re-renders since container is static)
;(function initChromeDragDrop() {
  const container = document.getElementById('chrome-bookmarks-list')
  let dragNodeId = null
  let dragParentFolderId = null  // null = dragging from column root level

  function getParentFolderId(el) {
    const body = el.parentElement
    if (body?.classList.contains('bm-folder-body')) {
      return body.closest('.bm-folder[data-node-id]')?.dataset.nodeId || null
    }
    return null
  }

  container.addEventListener('dragstart', e => {
    const header = e.target.closest('.bm-folder-header[draggable]')
    if (header) {
      const folder = header.closest('.bm-folder[data-node-id]')
      if (!folder) return
      dragNodeId = folder.dataset.nodeId
      dragParentFolderId = getParentFolderId(folder)
      e.dataTransfer.effectAllowed = 'move'
      e.dataTransfer.setData('text/plain', dragNodeId)
      folder.classList.add('dragging')
      return
    }
    const item = e.target.closest('.bookmark-item[data-node-id][draggable]')
    if (item) {
      dragNodeId = item.dataset.nodeId
      dragParentFolderId = getParentFolderId(item)
      e.dataTransfer.effectAllowed = 'move'
      e.dataTransfer.setData('text/plain', dragNodeId)
      item.classList.add('dragging')
    }
  })

  function clearDragIndicators() {
    container.querySelectorAll('.dragging').forEach(el => el.classList.remove('dragging'))
    container.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'))
    container.querySelectorAll('.drop-before, .drop-after').forEach(el => el.classList.remove('drop-before', 'drop-after'))
  }

  container.addEventListener('dragend', () => {
    dragNodeId = null
    dragParentFolderId = null
    clearDragIndicators()
  })

  function findDropSibling(e) {
    if (dragParentFolderId) {
      const inFolder = e.target.closest(
        `.bm-folder[data-node-id="${dragParentFolderId}"] > .bm-folder-body > .bm-folder[data-node-id],` +
        `.bm-folder[data-node-id="${dragParentFolderId}"] > .bm-folder-body > .bookmark-item[data-node-id]`
      )
      if (inFolder) return inFolder
    }
    const colRoot = e.target.closest(
      '.bm-column > .bm-folder[data-node-id],' +
      '.bm-column > .bookmark-item[data-node-id]'
    )
    // Exclude the drag source's own parent folder to avoid spurious indicators
    if (colRoot && dragParentFolderId && colRoot.dataset.nodeId === dragParentFolderId) return null
    return colRoot
  }

  container.addEventListener('dragover', e => {
    if (!dragNodeId) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    clearDragIndicators()
    const col = e.target.closest('.bm-column')
    if (!col) return
    const sibling = findDropSibling(e)
    if (sibling && sibling.dataset.nodeId !== dragNodeId) {
      const rect = sibling.getBoundingClientRect()
      sibling.classList.add(e.clientY < rect.top + rect.height / 2 ? 'drop-before' : 'drop-after')
    } else {
      col.classList.add('drag-over')
    }
  })

  container.addEventListener('dragleave', e => {
    if (!container.contains(e.relatedTarget)) clearDragIndicators()
  })

  container.addEventListener('drop', e => {
    e.preventDefault()
    const col = e.target.closest('.bm-column')
    if (!col || !dragNodeId) return
    const toCol = parseInt(col.dataset.col)
    const sibling = findDropSibling(e)
    let insertBeforeId = null, insertAfterId = null
    if (sibling && sibling.dataset.nodeId !== dragNodeId) {
      const rect = sibling.getBoundingClientRect()
      if (e.clientY < rect.top + rect.height / 2) insertBeforeId = sibling.dataset.nodeId
      else insertAfterId = sibling.dataset.nodeId
    }
    // Determine if the drop lands inside the same parent folder or at column root
    const inSameFolder = dragParentFolderId && sibling?.parentElement?.closest('.bm-folder[data-node-id]')?.dataset.nodeId === dragParentFolderId
    chromeBmColMap[dragNodeId] = toCol
    saveChromeBmColMap()
    if (inSameFolder) {
      updateChromeBmFolderOrder(dragNodeId, dragParentFolderId, insertBeforeId, insertAfterId)
    } else {
      updateChromeBmOrder(dragNodeId, toCol, insertBeforeId, insertAfterId)
    }
    dragNodeId = null
    dragParentFolderId = null
    renderChromeBookmarks(lastChromeFilter)
  })
})()

// Column reorder drag-drop (document-scoped so it covers both Chrome and Your Bookmarks columns)
;(function initColDragDrop() {
  let dragDisplayPos = null

  document.addEventListener('dragstart', e => {
    const handle = e.target.closest('.bm-col-handle')
    if (!handle) return
    const col = handle.closest('.bm-column')
    if (!col) return
    dragDisplayPos = parseInt(col.dataset.displayPos)
    e.dataTransfer.effectAllowed = 'move'
    col.classList.add('col-dragging')
  })

  document.addEventListener('dragend', () => {
    if (dragDisplayPos === null) return
    document.querySelectorAll('.bm-column').forEach(c =>
      c.classList.remove('col-dragging', 'col-drop-left', 'col-drop-right')
    )
    dragDisplayPos = null
  })

  document.addEventListener('dragover', e => {
    if (dragDisplayPos === null) return
    e.preventDefault()
    document.querySelectorAll('.bm-column').forEach(c =>
      c.classList.remove('col-drop-left', 'col-drop-right')
    )
    const targetCol = e.target.closest('.bm-column')
    if (!targetCol) return
    const targetPos = parseInt(targetCol.dataset.displayPos)
    if (targetPos === dragDisplayPos) return
    const rect = targetCol.getBoundingClientRect()
    targetCol.classList.add(e.clientX < rect.left + rect.width / 2 ? 'col-drop-left' : 'col-drop-right')
  })

  document.addEventListener('drop', e => {
    if (dragDisplayPos === null) return
    const targetCol = e.target.closest('.bm-column')
    if (!targetCol) return
    e.preventDefault()
    const fromPos = dragDisplayPos
    const toPos = parseInt(targetCol.dataset.displayPos)

    document.querySelectorAll('.bm-column').forEach(c =>
      c.classList.remove('col-dragging', 'col-drop-left', 'col-drop-right')
    )
    dragDisplayPos = null

    if (toPos === fromPos) return

    const moved = colOrder[fromPos]
    const remaining = colOrder.filter((_, i) => i !== fromPos)
    const rect = targetCol.getBoundingClientRect()
    const insertBefore = e.clientX < rect.left + rect.width / 2

    let insertIdx = toPos
    if (fromPos < toPos) insertIdx--
    if (!insertBefore) insertIdx++
    insertIdx = Math.max(0, Math.min(remaining.length, insertIdx))

    remaining.splice(insertIdx, 0, moved)
    colOrder = remaining
    saveColOrder()
    renderChromeBookmarks(lastChromeFilter)
    renderYourBookmarks()
  })
})()

// ---- Column count change (from settings slider in main.js) ----
window.addEventListener('bm-cols-change', e => {
  const { oldCols, newCols } = e.detail
  bmCols = newCols

  if (newCols < oldCols) {
    let chromeChanged = false
    Object.keys(chromeBmColMap).forEach(id => {
      if (chromeBmColMap[id] >= newCols) {
        chromeBmColMap[id] = newCols - 1
        chromeChanged = true
      }
    })
    if (chromeChanged) saveChromeBmColMap()

    // Clamp virtual folders from removed columns
    let vfChanged = false
    virtualFolders.forEach(vf => {
      if (vf.col >= newCols) { vf.col = newCols - 1; vfChanged = true }
    })
    if (vfChanged) saveVirtualFolders()

    // Migrate order entries from removed columns into the last remaining column
    for (let col = newCols; col < oldCols; col++) {
      const key = String(col)
      if (chromeBmColOrder[key]?.length) {
        const targetKey = String(newCols - 1)
        if (!chromeBmColOrder[targetKey]) chromeBmColOrder[targetKey] = []
        chromeBmColOrder[targetKey].push(...chromeBmColOrder[key])
        delete chromeBmColOrder[key]
      }
    }
    saveChromeBmColOrder()
  }

  colOrder = Array.from({ length: newCols }, (_, i) => i)
  saveColOrder()
  renderChromeBookmarks(lastChromeFilter)
})

// ---- Reset ----
window.addEventListener('bm-reset', () => {
  chromeBmColMap = {}
  chromeBmColOrder = {}
  chromeBmFolderOrder = {}
  saveChromeBmColMap()
  saveChromeBmColOrder()
  saveChromeBmFolderOrder()
  colOrder = Array.from({ length: bmCols }, (_, i) => i)
  saveColOrder()
  collapsedFolderIds = new Set()
  collapsedStateLoaded = false
  saveCollapsedFolders()
  renderChromeBookmarks(lastChromeFilter)
})

document.getElementById('bm-auto-expand-toggle').addEventListener('change', e => {
  autoExpandSubfolders = e.target.checked
  syncSet({ 'bm-auto-expand': autoExpandSubfolders })
  renderChromeBookmarks(lastChromeFilter)
})

document.getElementById('bm-auto-group-toggle').addEventListener('change', e => {
  autoGroupTabs = e.target.checked
  syncSet({ 'bm-auto-group': autoGroupTabs })
})

document.getElementById('bm-open-all-mode-select').addEventListener('change', e => {
  openAllMode = e.target.value
  syncSet({ 'bm-open-all-mode': openAllMode })
})

// ---- Init ----
async function initBookmarkState() {
  const data = await syncGet(['bm-cols', 'chrome-bm-col-map', 'chrome-bm-col-order', 'chrome-bm-folder-order', 'virtual-folders', 'col-order', 'bm-auto-expand', 'bm-auto-group', 'bm-open-all-mode', 'bm-collapsed', 'vf-expanded', 'your-bm-collapsed', 'bm-warn-skip-rename', 'bm-warn-skip-delete', 'bm-warn-skip-item-rename', 'bm-warn-skip-item-delete', 'bm-warn-skip-vf-delete', 'bm-warn-skip-quickbar-reset', 'quick-bar-items', 'quick-bar-expanded'])
  quickBarItems = Array.isArray(data['quick-bar-items']) ? data['quick-bar-items'] : []
  quickBarExpanded = data['quick-bar-expanded'] ?? false
  bmCols = parseInt(data['bm-cols'] ?? '1')
  chromeBmColMap = data['chrome-bm-col-map'] ?? {}
  chromeBmColOrder = data['chrome-bm-col-order'] ?? {}
  chromeBmFolderOrder = data['chrome-bm-folder-order'] ?? {}
  autoExpandSubfolders = data['bm-auto-expand'] ?? false
  document.getElementById('bm-auto-expand-toggle').checked = autoExpandSubfolders
  autoGroupTabs = data['bm-auto-group'] ?? true
  document.getElementById('bm-auto-group-toggle').checked = autoGroupTabs
  openAllMode = data['bm-open-all-mode'] ?? 'all-one-group'
  document.getElementById('bm-open-all-mode-select').value = openAllMode
  virtualFolders = data['virtual-folders'] ?? []
  const rawColOrder = data['col-order']
  if (Array.isArray(rawColOrder) && rawColOrder.length === bmCols) {
    colOrder = rawColOrder
  } else {
    colOrder = Array.from({ length: bmCols }, (_, i) => i)
  }
  const rawCollapsed = data['bm-collapsed']
  if (Array.isArray(rawCollapsed)) {
    collapsedFolderIds = new Set(rawCollapsed)
    collapsedStateLoaded = true
  }
  const rawExpanded = data['vf-expanded']
  if (Array.isArray(rawExpanded)) expandedVfIds = new Set(rawExpanded)
  yourBmCollapsed = data['your-bm-collapsed'] ?? false
  warnSkipRename = data['bm-warn-skip-rename'] ?? false
  warnSkipDelete = data['bm-warn-skip-delete'] ?? false
  warnSkipItemRename = data['bm-warn-skip-item-rename'] ?? false
  warnSkipItemDelete = data['bm-warn-skip-item-delete'] ?? false
  warnSkipVfDelete = data['bm-warn-skip-vf-delete'] ?? false
  warnSkipQuickBarReset = data['bm-warn-skip-quickbar-reset'] ?? false
  loadChromeBookmarks()
}
initBookmarkState()
