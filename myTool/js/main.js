// ---- Storage helpers (mirrors myTab's bookmarks.js/main.js — sync with fallback) ----
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

// Dark mode — an inline <head> script already applied the fast localStorage-cached value before
// first paint (avoids a flash); this reconciles with the synced value and wires up the toggle
const themeToggleBtn = document.getElementById('theme-toggle-btn')
const MOON_ICON = '<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M12 3a9 9 0 1 0 9 9c0-.46-.04-.92-.1-1.36a5.389 5.389 0 0 1-4.4 2.26 5.403 5.403 0 0 1-3.14-9.8c-.44-.06-.9-.1-1.36-.1z"/></svg>'
const SUN_ICON = '<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4 12H2M22 12h-2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>'
function applyTheme(theme) {
  if (theme === 'dark') document.documentElement.setAttribute('data-theme', 'dark')
  else document.documentElement.removeAttribute('data-theme')
  const label = theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'
  themeToggleBtn.innerHTML = theme === 'dark' ? SUN_ICON : MOON_ICON
  themeToggleBtn.title = label
  themeToggleBtn.setAttribute('aria-label', label)
}
applyTheme(localStorage.getItem('theme') === 'dark' ? 'dark' : 'light')
syncGet(['theme']).then(({ theme }) => { if (theme) applyTheme(theme) })
themeToggleBtn.addEventListener('click', () => {
  const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark'
  applyTheme(next)
  localStorage.setItem('theme', next)
  syncSet({ theme: next })
})

// Pop out into a standalone window that can be moved/resized anywhere and stays open (unlike the
// toolbar popup, which the browser closes on blur). Hidden unless we're the toolbar popup in a real
// extension context: the detached window itself (marked ?window=1) and the http test harness (no
// chrome.windows) both leave the button hidden.
const popoutBtn = document.getElementById('popout-btn')
if (popoutBtn) {
  const isDetached = new URLSearchParams(location.search).has('window')
  if (!isDetached && typeof chrome !== 'undefined' && chrome.windows && chrome.runtime) {
    popoutBtn.hidden = false
    popoutBtn.addEventListener('click', () => {
      chrome.windows.create({ url: chrome.runtime.getURL('popup.html?window=1'), type: 'popup', width: 576, height: 540 })
      window.close()
    })
  }
}

// Lazy-load a script once, resolving when it's ready. Lets heavy vendor libraries (ZXing, qrcode,
// JsBarcode — ~450KB together) load only when their tab is actually used, instead of on every popup
// open. Cached by src so repeated calls share one load.
const _scriptPromises = {}
function loadScriptOnce(src) {
  if (_scriptPromises[src]) return _scriptPromises[src]
  _scriptPromises[src] = new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = src
    s.onload = () => resolve()
    s.onerror = () => { delete _scriptPromises[src]; reject(new Error('Failed to load ' + src)) }
    document.head.appendChild(s)
  })
  return _scriptPromises[src]
}
window.loadScriptOnce = loadScriptOnce

// Tab Navigation
const tabBtns = document.querySelectorAll('.tab-btn')

function activateTab(tab) {
  const btn = [...tabBtns].find(b => b.dataset.tab === tab)
  const content = document.getElementById('tab-' + tab)
  if (!btn || !content) return
  tabBtns.forEach(b => b.classList.remove('active'))
  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'))
  btn.classList.add('active')
  content.classList.add('active')
  // Signal tools (e.g. QR/Barcode) so they can lazy-load their library the first time they're shown.
  document.dispatchEvent(new CustomEvent('tool-shown', { detail: tab }))
}

// Scroll position of the content area — persisted so reopening the popup lands where you left off.
const appMain = document.getElementById('app-main')
const SCROLL_KEY = 'scroll-top'
let scrollSaveTimer = null
appMain.addEventListener('scroll', () => {
  clearTimeout(scrollSaveTimer)
  scrollSaveTimer = setTimeout(() => syncSet({ [SCROLL_KEY]: appMain.scrollTop }), 150)
})

tabBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    activateTab(btn.dataset.tab)
    appMain.scrollTop = 0 // a different tab is a fresh view — start at the top
    syncSet({ 'active-tab': btn.dataset.tab, [SCROLL_KEY]: 0 })
  })
})

// Restore the tab + scroll position that were active before the last close. Tool content renders
// asynchronously (each tool does its own syncGet().then(render)), so the container may still be
// short when we first try — retry briefly until it's tall enough to reach the saved offset.
syncGet(['active-tab', SCROLL_KEY]).then(data => {
  if (data['active-tab']) activateTab(data['active-tab'])
  const top = data[SCROLL_KEY]
  if (top) {
    let tries = 0
    const apply = () => {
      appMain.scrollTop = top
      if (appMain.scrollTop < top - 1 && tries++ < 12) setTimeout(apply, 60)
    }
    requestAnimationFrame(apply)
  }
})

// Help Panel
const helpBtn = document.getElementById('help-btn')
const helpPanel = document.getElementById('help-panel')
const helpOverlay = document.getElementById('help-overlay')
const helpCloseBtn = document.getElementById('help-close-btn')

function closeHelpPanel() {
  helpBtn.classList.remove('active')
  helpPanel.classList.remove('active')
  helpOverlay.classList.remove('active')
}

function openHelpPanel() {
  helpBtn.classList.add('active')
  helpPanel.classList.add('active')
  helpOverlay.classList.add('active')
}

helpBtn.addEventListener('click', () => {
  if (helpPanel.classList.contains('active')) closeHelpPanel()
  else openHelpPanel()
})

helpCloseBtn.addEventListener('click', closeHelpPanel)
helpOverlay.addEventListener('click', closeHelpPanel)

helpPanel.addEventListener('click', e => {
  const header = e.target.closest('.guide-section-header')
  if (header) header.closest('.guide-section').classList.toggle('open')
})
