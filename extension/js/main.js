// ---- Storage helpers (mirrors bookmarks.js — sync with fallback) ----
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

  // Settings only applies to Bookmarks — hide it (and close it if left open) on other tabs
  const settingsBtnEl = document.getElementById('settings-btn')
  settingsBtnEl.hidden = tab !== 'bookmarks'
  if (tab !== 'bookmarks') closeSettingsPanel()

  if (tab === 'flashpaint') window.resizeCanvas && window.resizeCanvas()
  if (window.inspectorActive) window.computeInspector()
}

tabBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    activateTab(btn.dataset.tab)
    syncSet({ 'active-tab': btn.dataset.tab })
  })
})

// Restore the tab that was active before the last refresh
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
  if (helpPanel.classList.contains('active')) {
    closeHelpPanel()
  } else {
    openHelpPanel()
  }
})

helpCloseBtn.addEventListener('click', closeHelpPanel)
helpOverlay.addEventListener('click', closeHelpPanel)

helpPanel.addEventListener('click', e => {
  const header = e.target.closest('.guide-section-header')
  if (header) header.closest('.guide-section').classList.toggle('open')
})

// Settings Panel
const settingsBtn = document.getElementById('settings-btn')
const settingsPanel = document.getElementById('settings-panel')
const settingsOverlay = document.getElementById('settings-overlay')
const settingsCloseBtn = document.getElementById('settings-close-btn')
const bmGapSlider = document.getElementById('bm-gap-slider')
const bmGapVal = document.getElementById('bm-gap-val')

function applyBmGap(val) {
  const paddingY = Math.round(2 + val / 3)
  document.documentElement.style.setProperty('--bm-gap', val + 'px')
  document.documentElement.style.setProperty('--bm-pad-y', paddingY + 'px')
  bmGapVal.textContent = val + 'px'
  bmGapSlider.value = val
}

function closeSettingsPanel() {
  settingsBtn.classList.remove('active')
  settingsPanel.classList.remove('active')
  settingsOverlay.classList.remove('active')
}

function openSettingsPanel() {
  closeHelpPanel()
  settingsBtn.classList.add('active')
  settingsPanel.classList.add('active')
  settingsOverlay.classList.add('active')
}

settingsBtn.addEventListener('click', () => {
  settingsPanel.classList.contains('active') ? closeSettingsPanel() : openSettingsPanel()
})

settingsCloseBtn.addEventListener('click', closeSettingsPanel)
settingsOverlay.addEventListener('click', closeSettingsPanel)

bmGapSlider.addEventListener('input', () => {
  const val = parseInt(bmGapSlider.value)
  applyBmGap(val)
  syncSet({ 'bm-gap': val })
})

// Zoom settings
const bmZoomSlider = document.getElementById('bm-zoom-slider')
const bmZoomVal = document.getElementById('bm-zoom-val')

function applyBmZoom(val) {
  document.documentElement.style.setProperty('--bm-zoom', val / 100)
  bmZoomVal.textContent = val + '%'
  bmZoomSlider.value = val
}

bmZoomSlider.addEventListener('input', () => {
  const val = parseInt(bmZoomSlider.value)
  applyBmZoom(val)
  syncSet({ 'bm-zoom': val })
})

// Column settings
const bmColsSlider = document.getElementById('bm-cols-slider')
const bmColsVal = document.getElementById('bm-cols-val')
let currentBmCols = 1

bmColsSlider.addEventListener('input', () => {
  const newCols = parseInt(bmColsSlider.value)
  const oldCols = currentBmCols
  currentBmCols = newCols
  bmColsVal.textContent = newCols
  syncSet({ 'bm-cols': newCols })
  window.dispatchEvent(new CustomEvent('bm-cols-change', { detail: { oldCols, newCols } }))
})

document.getElementById('bm-reset-btn').addEventListener('click', () => {
  if (!confirm('Reset all column assignments and ordering to defaults?')) return
  window.dispatchEvent(new CustomEvent('bm-reset'))
})

// ---- Font settings ----
const BM_FONTS = {
  system:   "system-ui, -apple-system, 'Segoe UI', sans-serif",
  arial:    'Arial, Helvetica, sans-serif',
  verdana:  'Verdana, Geneva, sans-serif',
  trebuchet:"'Trebuchet MS', sans-serif",
  georgia:  "Georgia, 'Times New Roman', serif",
  courier:  "'Courier New', Courier, monospace",
}

const bmFontSelect        = document.getElementById('bm-font-select')
const bmFontSizeSlider    = document.getElementById('bm-font-size-slider')
const bmFontSizeVal       = document.getElementById('bm-font-size-val')
const bmFontWeightSelect  = document.getElementById('bm-font-weight-select')
const bmFontItalicToggle  = document.getElementById('bm-font-italic-toggle')
const bmFolderColorPicker = document.getElementById('bm-folder-color-picker')
const bmFolderColorReset  = document.getElementById('bm-folder-color-reset')
const bmItemColorPicker   = document.getElementById('bm-item-color-picker')
const bmItemColorReset    = document.getElementById('bm-item-color-reset')

const BM_COLOR_DEFAULT = '#111827'

// Leaves the custom property unset at the default color so the CSS var(...) fallback (and
// therefore dark mode's --text-secondary) can control it — same fix as applyBodyBg
function applyBmTextColor(el, prop, color) {
  if (color && color !== BM_COLOR_DEFAULT) el.style.setProperty(prop, color)
  else el.style.removeProperty(prop)
}

function applyBmFont({ family, size, weight, italic, folderColor, itemColor }) {
  const el = document.getElementById('chrome-bookmarks-list')
  el.style.setProperty('--bm-font-family', BM_FONTS[family] || BM_FONTS.system)
  el.style.setProperty('--bm-content-size', size + 'px')
  el.style.setProperty('--bm-font-weight', String(weight))
  el.style.setProperty('--bm-font-style', italic ? 'italic' : 'normal')
  applyBmTextColor(el, '--bm-folder-color', folderColor)
  applyBmTextColor(el, '--bm-item-color', itemColor)
  bmFontSelect.value = family
  bmFontSizeSlider.value = size
  bmFontSizeVal.textContent = size + 'px'
  bmFontWeightSelect.value = String(weight)
  bmFontItalicToggle.checked = italic
  bmFolderColorPicker.value = folderColor || BM_COLOR_DEFAULT
  bmItemColorPicker.value = itemColor || BM_COLOR_DEFAULT
}

bmFontSelect.addEventListener('change', () => {
  const family = bmFontSelect.value
  syncSet({ 'bm-font': family })
  document.getElementById('chrome-bookmarks-list').style.setProperty('--bm-font-family', BM_FONTS[family] || BM_FONTS.system)
})

bmFontSizeSlider.addEventListener('input', () => {
  const size = parseInt(bmFontSizeSlider.value)
  bmFontSizeVal.textContent = size + 'px'
  syncSet({ 'bm-font-size': size })
  document.getElementById('chrome-bookmarks-list').style.setProperty('--bm-content-size', size + 'px')
})

bmFontWeightSelect.addEventListener('change', () => {
  const weight = bmFontWeightSelect.value
  syncSet({ 'bm-font-weight': parseInt(weight) })
  document.getElementById('chrome-bookmarks-list').style.setProperty('--bm-font-weight', weight)
})

bmFontItalicToggle.addEventListener('change', () => {
  const italic = bmFontItalicToggle.checked
  syncSet({ 'bm-font-italic': italic })
  document.getElementById('chrome-bookmarks-list').style.setProperty('--bm-font-style', italic ? 'italic' : 'normal')
})

bmFolderColorPicker.addEventListener('input', () => {
  const color = bmFolderColorPicker.value
  syncSet({ 'bm-folder-color': color })
  applyBmTextColor(document.getElementById('chrome-bookmarks-list'), '--bm-folder-color', color)
})
bmFolderColorReset.addEventListener('click', () => {
  syncSet({ 'bm-folder-color': BM_COLOR_DEFAULT })
  applyBmTextColor(document.getElementById('chrome-bookmarks-list'), '--bm-folder-color', BM_COLOR_DEFAULT)
  bmFolderColorPicker.value = BM_COLOR_DEFAULT
})

bmItemColorPicker.addEventListener('input', () => {
  const color = bmItemColorPicker.value
  syncSet({ 'bm-item-color': color })
  applyBmTextColor(document.getElementById('chrome-bookmarks-list'), '--bm-item-color', color)
})
bmItemColorReset.addEventListener('click', () => {
  syncSet({ 'bm-item-color': BM_COLOR_DEFAULT })
  applyBmTextColor(document.getElementById('chrome-bookmarks-list'), '--bm-item-color', BM_COLOR_DEFAULT)
  bmItemColorPicker.value = BM_COLOR_DEFAULT
})

// ---- Background settings ----
const bgColorPicker       = document.getElementById('bg-color-picker')
const bgColorReset        = document.getElementById('bg-color-reset')
const bgImageUrlInput     = document.getElementById('bg-image-url')
const bgImageClear        = document.getElementById('bg-image-clear')
const bgSizeSelect        = document.getElementById('bg-size-select')
const bgPosPad            = document.getElementById('bg-pos-pad')
const bgPosDot            = document.getElementById('bg-pos-dot')
const bgBlurSlider        = document.getElementById('bg-blur-slider')
const bgBlurVal           = document.getElementById('bg-blur-val')
const bgOpacitySlider     = document.getElementById('bg-opacity-slider')
const bgOpacityVal        = document.getElementById('bg-opacity-val')
const bgTintColorPicker   = document.getElementById('bg-tint-color-picker')
const bgTintColorReset    = document.getElementById('bg-tint-color-reset')
const bgTintOpacitySlider = document.getElementById('bg-tint-opacity-slider')
const bgTintOpacityVal    = document.getElementById('bg-tint-opacity-val')

const bgSizeCustomW    = document.getElementById('bg-size-custom-w')
const bgSizeCustomH    = document.getElementById('bg-size-custom-h')
const bgSizeWSlider    = document.getElementById('bg-size-w-slider')
const bgSizeWVal       = document.getElementById('bg-size-w-val')
const bgSizeHSlider    = document.getElementById('bg-size-h-slider')
const bgSizeHVal       = document.getElementById('bg-size-h-val')

const BG_COLOR_DEFAULT = '#f8f9fa'
const bgState = { color: BG_COLOR_DEFAULT, imageUrl: '', size: 'cover', sizeW: 100, sizeH: 100, posX: 50, posY: 50, blur: 0, opacity: 100, tintColor: '#000000', tintOpacity: 0 }

// Leaves the inline style unset at the default color so the CSS var(--bg) rule (and therefore
// dark mode) can control it — only an explicitly-customized color overrides the theme
function applyBodyBg(color) {
  document.body.style.backgroundColor = color === BG_COLOR_DEFAULT ? '' : color
}

function applyBgVisual() {
  const imgLayer = document.getElementById('bg-image-layer')
  const tintLayer = document.getElementById('bg-tint-layer')
  applyBodyBg(bgState.color)
  if (bgState.imageUrl) {
    imgLayer.style.backgroundImage = `url(${bgState.imageUrl})`
    imgLayer.style.backgroundSize = bgState.size === 'custom' ? `${bgState.sizeW}% ${bgState.sizeH}%` : bgState.size
    imgLayer.style.backgroundPosition = `${bgState.posX}% ${bgState.posY}%`
    imgLayer.style.filter = bgState.blur > 0 ? `blur(${bgState.blur}px)` : ''
    imgLayer.style.opacity = bgState.opacity / 100
    imgLayer.style.display = 'block'
  } else {
    imgLayer.style.display = 'none'
  }
  if (bgState.tintOpacity > 0) {
    const h = bgState.tintColor, r = parseInt(h.slice(1,3),16), g = parseInt(h.slice(3,5),16), b = parseInt(h.slice(5,7),16)
    tintLayer.style.backgroundColor = `rgba(${r},${g},${b},${bgState.tintOpacity/100})`
    tintLayer.style.display = 'block'
  } else {
    tintLayer.style.display = 'none'
  }
}

function toggleCustomSizeRows(show) {
  bgSizeCustomW.style.display = show ? '' : 'none'
  bgSizeCustomH.style.display = show ? '' : 'none'
}

function applyBackground({ color, imageUrl, size, sizeW, sizeH, posX, posY, blur, opacity, tintColor, tintOpacity }) {
  bgState.color = color; bgState.imageUrl = imageUrl; bgState.size = size
  bgState.sizeW = sizeW; bgState.sizeH = sizeH
  bgState.posX = posX; bgState.posY = posY; bgState.blur = blur; bgState.opacity = opacity
  bgState.tintColor = tintColor; bgState.tintOpacity = tintOpacity
  applyBgVisual()
  bgColorPicker.value = color
  bgImageUrlInput.value = imageUrl
  bgSizeSelect.value = size
  toggleCustomSizeRows(size === 'custom')
  bgSizeWSlider.value = sizeW; bgSizeWVal.textContent = sizeW + '%'
  bgSizeHSlider.value = sizeH; bgSizeHVal.textContent = sizeH + '%'
  bgPosDot.style.left = posX + '%'; bgPosDot.style.top = posY + '%'
  bgBlurSlider.value = blur; bgBlurVal.textContent = blur + 'px'
  bgOpacitySlider.value = opacity; bgOpacityVal.textContent = opacity + '%'
  bgTintColorPicker.value = tintColor
  bgTintOpacitySlider.value = tintOpacity; bgTintOpacityVal.textContent = tintOpacity + '%'
}

bgColorPicker.addEventListener('input', () => {
  bgState.color = bgColorPicker.value
  applyBodyBg(bgState.color)
  syncSet({ 'bg-color': bgState.color })
})
bgColorReset.addEventListener('click', () => {
  bgState.color = BG_COLOR_DEFAULT; bgColorPicker.value = BG_COLOR_DEFAULT
  applyBodyBg(BG_COLOR_DEFAULT)
  syncSet({ 'bg-color': BG_COLOR_DEFAULT })
})

const bgUrlStatusRow  = document.getElementById('bg-url-status-row')
const bgUrlStatusText = document.getElementById('bg-url-status')

function showBgUrlStatus(msg, isError) {
  bgUrlStatusText.textContent = msg
  bgUrlStatusText.style.color = isError ? '#ef4444' : '#16a34a'
  bgUrlStatusRow.style.display = msg ? '' : 'none'
}

function commitImageUrl() {
  const url = bgImageUrlInput.value.trim()
  if (!url) {
    bgState.imageUrl = ''; showBgUrlStatus('', false)
    applyBgVisual(); syncSet({ 'bg-image-url': '' })
    return
  }
  showBgUrlStatus('Loading…', false)
  const test = new Image()
  test.onload = () => {
    bgState.imageUrl = url
    showBgUrlStatus('', false)
    applyBgVisual()
    syncSet({ 'bg-image-url': url })
  }
  test.onerror = () => {
    showBgUrlStatus('✗ Could not load — try a direct image URL (ends in .jpg / .png / .webp)', true)
  }
  test.src = url
}
bgImageUrlInput.addEventListener('change', commitImageUrl)
bgImageUrlInput.addEventListener('keydown', e => { if (e.key === 'Enter') { bgImageUrlInput.blur(); commitImageUrl() } })
bgImageClear.addEventListener('click', () => {
  bgState.imageUrl = ''; bgImageUrlInput.value = ''
  showBgUrlStatus('', false)
  applyBgVisual()
  syncSet({ 'bg-image-url': '' })
})

bgSizeSelect.addEventListener('change', () => {
  bgState.size = bgSizeSelect.value
  toggleCustomSizeRows(bgState.size === 'custom')
  document.getElementById('bg-image-layer').style.backgroundSize =
    bgState.size === 'custom' ? `${bgState.sizeW}% ${bgState.sizeH}%` : bgState.size
  syncSet({ 'bg-size': bgState.size })
})

bgSizeWSlider.addEventListener('input', () => {
  bgState.sizeW = parseInt(bgSizeWSlider.value)
  bgSizeWVal.textContent = bgState.sizeW + '%'
  document.getElementById('bg-image-layer').style.backgroundSize = `${bgState.sizeW}% ${bgState.sizeH}%`
  syncSet({ 'bg-size-w': bgState.sizeW })
})

bgSizeHSlider.addEventListener('input', () => {
  bgState.sizeH = parseInt(bgSizeHSlider.value)
  bgSizeHVal.textContent = bgState.sizeH + '%'
  document.getElementById('bg-image-layer').style.backgroundSize = `${bgState.sizeW}% ${bgState.sizeH}%`
  syncSet({ 'bg-size-h': bgState.sizeH })
})

let posDragging = false
function posFromEvent(e) {
  const rect = bgPosPad.getBoundingClientRect()
  return {
    x: Math.round(Math.max(0, Math.min(100, (e.clientX - rect.left) / rect.width * 100))),
    y: Math.round(Math.max(0, Math.min(100, (e.clientY - rect.top) / rect.height * 100))),
  }
}
bgPosPad.addEventListener('mousedown', e => {
  posDragging = true
  const { x, y } = posFromEvent(e)
  bgState.posX = x; bgState.posY = y
  bgPosDot.style.left = x + '%'; bgPosDot.style.top = y + '%'
  document.getElementById('bg-image-layer').style.backgroundPosition = `${x}% ${y}%`
})
document.addEventListener('mousemove', e => {
  if (!posDragging) return
  const { x, y } = posFromEvent(e)
  bgState.posX = x; bgState.posY = y
  bgPosDot.style.left = x + '%'; bgPosDot.style.top = y + '%'
  document.getElementById('bg-image-layer').style.backgroundPosition = `${x}% ${y}%`
})
document.addEventListener('mouseup', () => {
  if (!posDragging) return
  posDragging = false
  syncSet({ 'bg-pos-x': bgState.posX, 'bg-pos-y': bgState.posY })
})

bgBlurSlider.addEventListener('input', () => {
  bgState.blur = parseInt(bgBlurSlider.value)
  bgBlurVal.textContent = bgState.blur + 'px'
  document.getElementById('bg-image-layer').style.filter = bgState.blur > 0 ? `blur(${bgState.blur}px)` : ''
  syncSet({ 'bg-blur': bgState.blur })
})

bgOpacitySlider.addEventListener('input', () => {
  bgState.opacity = parseInt(bgOpacitySlider.value)
  bgOpacityVal.textContent = bgState.opacity + '%'
  document.getElementById('bg-image-layer').style.opacity = bgState.opacity / 100
  syncSet({ 'bg-opacity': bgState.opacity })
})

bgTintColorPicker.addEventListener('input', () => {
  bgState.tintColor = bgTintColorPicker.value
  applyBgVisual()
  syncSet({ 'bg-tint-color': bgState.tintColor })
})
bgTintColorReset.addEventListener('click', () => {
  bgState.tintColor = '#000000'; bgTintColorPicker.value = '#000000'
  applyBgVisual()
  syncSet({ 'bg-tint-color': bgState.tintColor })
})
document.getElementById('bg-blur-reset').addEventListener('click', () => {
  bgBlurSlider.value = 0
  bgBlurSlider.dispatchEvent(new Event('input'))
})
document.getElementById('bg-opacity-reset').addEventListener('click', () => {
  bgOpacitySlider.value = 100
  bgOpacitySlider.dispatchEvent(new Event('input'))
})
document.getElementById('bg-tint-opacity-reset').addEventListener('click', () => {
  bgTintOpacitySlider.value = 0
  bgTintOpacitySlider.dispatchEvent(new Event('input'))
})
bgTintOpacitySlider.addEventListener('input', () => {
  bgState.tintOpacity = parseInt(bgTintOpacitySlider.value)
  bgTintOpacityVal.textContent = bgState.tintOpacity + '%'
  applyBgVisual()
  syncSet({ 'bg-tint-opacity': bgState.tintOpacity })
})

// ---- Column & bar color ----
const bmColColorPicker = document.getElementById('bm-col-color-picker')
const bmColColorReset  = document.getElementById('bm-col-color-reset')
const bmBarColorPicker = document.getElementById('bm-bar-color-picker')
const bmBarColorReset  = document.getElementById('bm-bar-color-reset')

function applyColColor(color) {
  document.documentElement.style.setProperty('--bm-col-bg', color || '')
  bmColColorPicker.value = color || '#ffffff'
  bmColColorPicker.style.opacity = color ? '1' : '0.35'
}
function applyBarColor(color) {
  if (color) {
    document.documentElement.style.setProperty('--bm-col-bar-bg', color)
  } else {
    document.documentElement.style.removeProperty('--bm-col-bar-bg')
  }
  bmBarColorPicker.value = color || '#ffffff'
  bmBarColorPicker.style.opacity = color ? '1' : '0.35'
}

bmColColorPicker.addEventListener('input', () => {
  const color = bmColColorPicker.value
  applyColColor(color)
  syncSet({ 'bm-col-color': color })
})
bmColColorReset.addEventListener('click', () => {
  applyColColor('')
  syncSet({ 'bm-col-color': '' })
})
bmBarColorPicker.addEventListener('input', () => {
  const color = bmBarColorPicker.value
  applyBarColor(color)
  syncSet({ 'bm-bar-color': color })
})
bmBarColorReset.addEventListener('click', () => {
  applyBarColor('')
  syncSet({ 'bm-bar-color': '' })
})

window.addEventListener('bm-reset', () => {
  applyColColor('')
  syncSet({ 'bm-col-color': '' })
  applyBarColor('')
  syncSet({ 'bm-bar-color': '' })
})

// ---- Load settings async ----
syncGet(['bm-gap', 'bm-cols', 'bm-zoom', 'bm-font', 'bm-font-size', 'bm-font-weight', 'bm-font-italic', 'bm-folder-color', 'bm-item-color', 'bm-col-color', 'bm-bar-color', 'bg-color', 'bg-image-url', 'bg-size', 'bg-size-w', 'bg-size-h', 'bg-pos-x', 'bg-pos-y', 'bg-blur', 'bg-opacity', 'bg-tint-color', 'bg-tint-opacity']).then(data => {
  applyBmGap(parseInt(data['bm-gap'] ?? '8'))
  currentBmCols = parseInt(data['bm-cols'] ?? '1')
  bmColsSlider.value = currentBmCols
  bmColsVal.textContent = currentBmCols
  applyBmZoom(parseInt(data['bm-zoom'] ?? '100'))
  applyBmFont({
    family: data['bm-font'] ?? 'system',
    size:   parseInt(data['bm-font-size'] ?? '12'),
    weight:      data['bm-font-weight'] ?? 500,
    italic:      data['bm-font-italic'] ?? false,
    folderColor: data['bm-folder-color'] ?? BM_COLOR_DEFAULT,
    itemColor:   data['bm-item-color'] ?? BM_COLOR_DEFAULT,
  })
  applyColColor(data['bm-col-color'] ?? '')
  applyBarColor(data['bm-bar-color'] ?? '')
  applyBackground({
    color:       data['bg-color']        ?? BG_COLOR_DEFAULT,
    imageUrl:    data['bg-image-url']    ?? '',
    size:        data['bg-size']         ?? 'cover',
    sizeW:       data['bg-size-w']       ?? 100,
    sizeH:       data['bg-size-h']       ?? 100,
    posX:        data['bg-pos-x']        ?? 50,
    posY:        data['bg-pos-y']        ?? 50,
    blur:        data['bg-blur']         ?? 0,
    opacity:     data['bg-opacity']      ?? 100,
    tintColor:   data['bg-tint-color']   ?? '#000000',
    tintOpacity: data['bg-tint-opacity'] ?? 0,
  })
})
