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
}

tabBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    activateTab(btn.dataset.tab)
    syncSet({ 'active-tab': btn.dataset.tab })
  })
})

// Restore the tab that was active before the last close
syncGet(['active-tab']).then(data => {
  if (data['active-tab']) activateTab(data['active-tab'])
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
