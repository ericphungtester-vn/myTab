const canvas = document.getElementById('flashpaint-canvas')
const ctx = canvas.getContext('2d')
const hint = document.getElementById('canvas-hint')
const colorPicker = document.getElementById('color-picker')
const strokeWidthInput = document.getElementById('stroke-width')
const opacityInput = document.getElementById('opacity-input')
const blurInput = document.getElementById('blur-input')
const shadowInput = document.getElementById('shadow-input')
const wrapper = document.getElementById('canvas-wrapper')
const zoomLayer = document.getElementById('canvas-zoom-layer')
const canvasBg = document.getElementById('canvas-bg')
const alignBtns = document.querySelectorAll('.align-opt')
const alignBtn = document.getElementById('align-btn')
const zoomLevelLabel = document.getElementById('zoom-level')

// Live value readouts next to the style sliders
function bindSliderValue(input, valueId, suffix) {
  const valueEl = document.getElementById(valueId)
  const update = () => { valueEl.textContent = input.value + suffix }
  input.addEventListener('input', update)
  update()
}
bindSliderValue(strokeWidthInput, 'stroke-width-value', 'px')
bindSliderValue(opacityInput, 'opacity-value', '%')
bindSliderValue(blurInput, 'blur-value', 'px')
bindSliderValue(shadowInput, 'shadow-value', 'px')

// Responsive toolbar overflow — when the toolbar is too narrow to show every group,
// trailing groups move (not clone) into a "»" dropdown so nothing is ever cut off or broken.
;(function () {
  const toolbarItems = document.getElementById('toolbar-items')
  const overflowBtn = document.getElementById('toolbar-overflow-btn')
  const overflowMenu = document.getElementById('toolbar-overflow-menu')
  const chunks = [...toolbarItems.children] // canonical left-to-right order, captured once

  function recalc() {
    chunks.forEach(chunk => toolbarItems.appendChild(chunk)) // put everything back, then re-measure
    overflowMenu.replaceChildren()

    while (toolbarItems.scrollWidth > toolbarItems.clientWidth && toolbarItems.childElementCount > 1) {
      overflowMenu.insertBefore(toolbarItems.lastElementChild, overflowMenu.firstChild)
    }

    const hasOverflow = overflowMenu.childElementCount > 0
    overflowBtn.hidden = !hasOverflow
    if (!hasOverflow) overflowMenu.hidden = true
  }

  let raf = null
  new ResizeObserver(() => {
    if (raf) cancelAnimationFrame(raf)
    raf = requestAnimationFrame(recalc)
  }).observe(toolbarItems)

  overflowBtn.addEventListener('click', e => {
    e.stopPropagation()
    overflowMenu.hidden = !overflowMenu.hidden
  })
  document.addEventListener('click', e => {
    if (!overflowMenu.hidden && !overflowMenu.contains(e.target) && !overflowBtn.contains(e.target)) overflowMenu.hidden = true
  })
})()

let tool = 'select'
let activeShape = 'rect'
let textAlign = 'left'
let editingText = false
let drawing = false
let startX = 0, startY = 0
let snapshot = null
let freehandPoints = []
let hasContent = false
let zoom = 1

// Selection tool — draws a pending rect/circle region on the active image; Enter applies (erase +
// fill with nearby background color), Esc cancels. selectionTargetOverlay remembers which image
// it applies to, since switching to this tool must not deselect the image like other tools do.
let selectionShapeType = 'rect'
let selectionIndicator = null
let selectionTargetOverlay = null
let selStartX = 0, selStartY = 0

// Once the initial drag finishes, the marquee stays adjustable (drag to move, handles to resize)
// until Enter/Esc — reuses resizeDirection from the object-resize system since only one drag can
// be active at a time
let marqueeAction = null
let marqueeStartMouse = { x: 0, y: 0 }
let marqueeStartRect = { left: 0, top: 0, w: 0, h: 0 }

// Multi-select — Shift+click adds/removes an overlay from this set (in addition to the single
// "primary" activeOverlay used for style controls/resize handles). Supports group move and group
// delete; activeOverlay is always the most-recently-toggled-in member of the set.
let selectedOverlays = new Set()
let groupStartRects = null

// Image layer
let activeOverlay = null
let imgAction = null
let resizeDirection = 'se'
let imgStartMouse = { x: 0, y: 0 }
let imgStartRect = { left: 0, top: 0, w: 0, h: 0 }
let copiedOverlayData = null

function syncCanvasBg() {
  canvasBg.style.width = canvas.width + 'px'
  canvasBg.style.height = canvas.height + 'px'
}

window.resizeCanvas = function () {
  if (!hasContent) {
    canvas.width = wrapper.clientWidth || 1200
    canvas.height = wrapper.clientHeight || 700
    syncCanvasBg()
  }
}

function getColor() { return colorPicker.value }
function getWidth() { return parseInt(strokeWidthInput.value) }
function getOpacity() { return parseInt(opacityInput.value) / 100 }
function getBlur() { return parseInt(blurInput.value) }
function getShadow() { return parseInt(shadowInput.value) }

function getPos(e) {
  const r = canvas.getBoundingClientRect()
  return { x: (e.clientX - r.left) / zoom, y: (e.clientY - r.top) / zoom }
}

const layerOrderBtn = document.getElementById('layer-order-btn')
function setLayerBtnsEnabled(on) { layerOrderBtn.disabled = !on }
function setAlignBtnsEnabled(on) { alignBtn.disabled = !on }
const selectionBtn = document.getElementById('selection-btn')
function setSelectionBtnEnabled(on) { selectionBtn.disabled = !on }
const cropBtn = document.getElementById('crop-btn')
function setCropBtnEnabled(on) { cropBtn.disabled = !on }
const alignSelectionBtn = document.getElementById('align-selection-btn')
function setAlignSelectionBtnEnabled(on) { alignSelectionBtn.disabled = !on }

function getOverlays() { return [...wrapper.querySelectorAll('.img-overlay')] }

// Layers panel — lists every image/shape/text on the canvas, top layer first (reverse DOM order,
// since later siblings render on top); click a row to select that object. Refreshes automatically
// via a MutationObserver whenever overlays are added/removed/reordered/(de)selected.
const layersPanelBtn = document.getElementById('layers-panel-btn')
const layersPanel = document.getElementById('layers-panel')
const layersPanelList = document.getElementById('layers-panel-list')

const LAYER_TYPE_ICON = {
  image: '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><rect x="3" y="4" width="18" height="16" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="8" cy="9.5" r="1.8"/><path d="M3 16.5L8 11.5L12 15.5L16 10.5L21 16V18C21 19.1 20.1 20 19 20H5C3.9 20 3 19.1 3 18V16.5Z"/></svg>',
  shape: '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><rect x="3" y="10" width="10" height="10" rx="1"/><circle cx="16" cy="8" r="5" fill-opacity="0.55"/></svg>',
  text: '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><rect x="4" y="4" width="16" height="3" rx="0.5"/><rect x="10.5" y="4" width="3" height="16" rx="0.5"/></svg>'
}

function getOverlayLayerInfo(overlay) {
  if (overlay.classList.contains('text-overlay')) {
    const textEl = overlay.querySelector('.text-overlay-content')
    const text = (textEl?.textContent || '').trim() || 'Text'
    return { type: 'text', label: text.length > 20 ? text.slice(0, 20) + '…' : text }
  }
  if (overlay.classList.contains('shape-overlay')) {
    const t = overlay.shapeData?.shapeType || 'shape'
    return { type: 'shape', label: t.charAt(0).toUpperCase() + t.slice(1) }
  }
  return { type: 'image', label: 'Image' }
}

function renderLayersPanel() {
  const overlays = getOverlays()
  layersPanelBtn.disabled = overlays.length === 0
  if (layersPanel.hidden) return
  layersPanelList.innerHTML = ''
  if (!overlays.length) {
    layersPanelList.innerHTML = '<div class="layers-panel-empty">No objects yet</div>'
    return
  }
  overlays.slice().reverse().forEach(overlay => {
    const info = getOverlayLayerInfo(overlay)
    const row = document.createElement('div')
    row.className = 'layers-panel-row' + (overlay === activeOverlay ? ' active' : '')
    row.innerHTML = LAYER_TYPE_ICON[info.type] + '<span class="layers-panel-row-label"></span>'
    row.querySelector('.layers-panel-row-label').textContent = info.label
    row.addEventListener('click', () => {
      if (tool !== 'select') {
        document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'))
        document.querySelector('.tool-btn[data-tool="select"]').classList.add('active')
        tool = 'select'
        canvas.style.pointerEvents = 'none'
        canvas.style.cursor = 'default'
      }
      activateImg(overlay)
      // Don't rebuild the panel synchronously here — that would detach this very row mid-click
      // (while the event is still bubbling), breaking outside-click checks elsewhere that test
      // whether e.target is still contained in a live element. The MutationObserver below picks
      // up activateImg's class change and re-renders on its own, after this event finishes.
    })
    layersPanelList.appendChild(row)
  })
}

layersPanelBtn.addEventListener('click', () => {
  layersPanel.hidden = !layersPanel.hidden
  layersPanelBtn.classList.toggle('active', !layersPanel.hidden)
  renderLayersPanel()
})

new MutationObserver(() => renderLayersPanel())
  .observe(zoomLayer, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] })

// Align Selection — repositions every Shift+click-selected object relative to the group's own
// bounding box (align their left/right/top/bottom edges, or center them on one axis)
function alignSelectedGroup(mode) {
  if (selectedOverlays.size < 2) return
  const rects = [...selectedOverlays].map(o => ({
    o,
    left: parseInt(o.style.left) || 0,
    top: parseInt(o.style.top) || 0,
    w: parseInt(o.style.width) || o.offsetWidth,
    h: parseInt(o.style.height) || o.offsetHeight
  }))
  pushHistory()
  if (mode === 'left') {
    const min = Math.min(...rects.map(r => r.left))
    rects.forEach(r => { r.o.style.left = min + 'px' })
  } else if (mode === 'right') {
    const max = Math.max(...rects.map(r => r.left + r.w))
    rects.forEach(r => { r.o.style.left = (max - r.w) + 'px' })
  } else if (mode === 'center-h') {
    const min = Math.min(...rects.map(r => r.left)), max = Math.max(...rects.map(r => r.left + r.w))
    const mid = (min + max) / 2
    rects.forEach(r => { r.o.style.left = (mid - r.w / 2) + 'px' })
  } else if (mode === 'top') {
    const min = Math.min(...rects.map(r => r.top))
    rects.forEach(r => { r.o.style.top = min + 'px' })
  } else if (mode === 'bottom') {
    const max = Math.max(...rects.map(r => r.top + r.h))
    rects.forEach(r => { r.o.style.top = (max - r.h) + 'px' })
  } else if (mode === 'middle-v') {
    const min = Math.min(...rects.map(r => r.top)), max = Math.max(...rects.map(r => r.top + r.h))
    const mid = (min + max) / 2
    rects.forEach(r => { r.o.style.top = (mid - r.h / 2) + 'px' })
  }
  showToast('Aligned ' + selectedOverlays.size + ' objects')
}

;(function () {
  const picker = document.getElementById('align-selection-picker')
  const showPicker = v => { picker.style.display = v ? 'flex' : 'none' }

  alignSelectionBtn.addEventListener('click', () => { showPicker(picker.style.display === 'none') })

  picker.querySelectorAll('.paste-mode-opt').forEach(opt => {
    opt.addEventListener('click', () => {
      alignSelectedGroup(opt.dataset.alignMode)
      showPicker(false)
    })
  })

  document.addEventListener('click', e => {
    if (picker.style.display !== 'none' && !picker.contains(e.target) && !alignSelectionBtn.contains(e.target)) showPicker(false)
  })
})()

// Zoom — only the canvas content zooms; the toolbar and page stay full size
const ZOOM_MIN = 0.25
const ZOOM_MAX = 3

function applyZoomVisual() {
  zoomLayer.style.transform = `scale(${zoom})`
  zoomLevelLabel.textContent = Math.round(zoom * 100) + '%'
}

// anchorClientX/Y: viewport point that should stay visually fixed under the cursor while zooming
function setZoom(newZoom, anchorClientX, anchorClientY) {
  const clamped = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, newZoom))
  if (clamped === zoom) return
  const wrapRect = wrapper.getBoundingClientRect()
  const anchorX = anchorClientX - wrapRect.left + wrapper.scrollLeft
  const anchorY = anchorClientY - wrapRect.top + wrapper.scrollTop
  const ratio = clamped / zoom
  zoom = clamped
  applyZoomVisual()
  wrapper.scrollLeft = anchorX * ratio - (anchorClientX - wrapRect.left)
  wrapper.scrollTop = anchorY * ratio - (anchorClientY - wrapRect.top)
}

function zoomStep(delta) {
  const r = wrapper.getBoundingClientRect()
  setZoom(zoom + delta, r.left + r.width / 2, r.top + r.height / 2)
}

document.getElementById('zoom-in-btn').addEventListener('click', () => zoomStep(0.1))
document.getElementById('zoom-out-btn').addEventListener('click', () => zoomStep(-0.1))
document.getElementById('zoom-reset-btn').addEventListener('click', () => {
  const r = wrapper.getBoundingClientRect()
  setZoom(1, r.left + r.width / 2, r.top + r.height / 2)
})

wrapper.addEventListener('wheel', e => {
  if (!e.ctrlKey && !e.metaKey) return
  e.preventDefault()
  setZoom(zoom - e.deltaY * 0.0025, e.clientX, e.clientY)
}, { passive: false })

// Full screen — fullscreens just the FlashPaint section, not the whole page
;(function () {
  const btn = document.getElementById('fullscreen-btn')
  const section = document.getElementById('tab-flashpaint')
  const ENTER_ICON = '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/></svg>'
  const EXIT_ICON = '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z"/></svg>'

  function syncBtn() {
    const isFs = document.fullscreenElement === section
    btn.innerHTML = isFs ? EXIT_ICON : ENTER_ICON
    btn.title = isFs ? 'Exit full screen' : 'Full screen'
  }

  btn.addEventListener('click', () => {
    if (document.fullscreenElement) document.exitFullscreen()
    else section.requestFullscreen().catch(() => {})
  })
  document.addEventListener('fullscreenchange', syncBtn)
})()

// 8-point resize handles (4 corners + 4 edge midpoints); text overlays only get the two side
// handles since their height is auto-derived from content, not manually resizable
const RESIZE_HANDLES = ['nw', 'n', 'ne', 'w', 'e', 'sw', 's', 'se']
const TEXT_RESIZE_HANDLES = ['w', 'e']
function addResizeHandles(overlay, { textOnly = false } = {}) {
  const dirs = textOnly ? TEXT_RESIZE_HANDLES : RESIZE_HANDLES
  dirs.forEach(dir => {
    const handle = document.createElement('div')
    handle.className = 'img-resize-handle'
    handle.dataset.handle = dir
    overlay.appendChild(handle)
  })
}

function wireOverlayDrag(overlay) {
  overlay.addEventListener('mousedown', e => {
    if (e.shiftKey && tool === 'select' && !e.target.classList.contains('img-resize-handle')) {
      e.stopPropagation()
      toggleMultiSelect(overlay)
      return
    }
    if (!overlay.classList.contains('active')) {
      if (tool !== 'select') return
      activateImg(overlay)
      e.stopPropagation()
      return
    }
    e.preventDefault()
    e.stopPropagation()
    imgAction = e.target.classList.contains('img-resize-handle') ? 'resize' : 'move'
    resizeDirection = e.target.dataset.handle || 'se'
    pendingDragSnapshot = captureSnapshot()
    imgStartMouse = { x: e.clientX, y: e.clientY }
    imgStartRect = {
      left: parseInt(overlay.style.left) || 0,
      top: parseInt(overlay.style.top) || 0,
      w: parseInt(overlay.style.width) || overlay.offsetWidth,
      h: parseInt(overlay.style.height) || overlay.offsetHeight
    }
    // If this overlay is part of a multi-selection, record every member's starting position so
    // the whole group moves together (resize still only ever applies to this one overlay)
    groupStartRects = (imgAction === 'move' && selectedOverlays.size > 1 && selectedOverlays.has(overlay))
      ? new Map([...selectedOverlays].map(o => [o, { left: parseInt(o.style.left) || 0, top: parseInt(o.style.top) || 0 }]))
      : null
  })
}

// Brief bottom-of-canvas confirmation for actions with no other visible feedback (export, save,
// copy, errors...) — type is 'info' | 'success' | 'error', purely cosmetic, never blocks input
const toastContainer = document.getElementById('flashpaint-toast-container')
function showToast(message, type = 'info') {
  const toast = document.createElement('div')
  toast.className = 'flashpaint-toast' + (type !== 'info' ? ` toast-${type}` : '')
  toast.textContent = message
  toastContainer.appendChild(toast)
  requestAnimationFrame(() => toast.classList.add('show'))
  setTimeout(() => {
    toast.classList.remove('show')
    setTimeout(() => toast.remove(), 200)
  }, 2200)
}

function isPlainImageOverlay(overlay) {
  return !!overlay && !overlay.classList.contains('shape-overlay') && !overlay.classList.contains('text-overlay')
}

// Clears the Shift+click multi-selection (except optionally one overlay that's about to become
// the new single selection) — called whenever a plain, non-Shift click activates something
function clearMultiSelectExcept(keepOverlay) {
  selectedOverlays.forEach(o => { if (o !== keepOverlay) o.classList.remove('multi-selected') })
  selectedOverlays.clear()
  setAlignSelectionBtnEnabled(false)
}

function toggleMultiSelect(overlay) {
  if (selectedOverlays.has(overlay)) {
    selectedOverlays.delete(overlay)
    overlay.classList.remove('multi-selected')
    if (selectedOverlays.size === 0) { deactivateImg(); return }
    if (activeOverlay === overlay) activateImg([...selectedOverlays].pop(), { keepGroup: true })
  } else {
    // Shift-clicking a second object folds the current single selection into a brand new group
    if (selectedOverlays.size === 0 && activeOverlay) {
      selectedOverlays.add(activeOverlay)
      activeOverlay.classList.add('multi-selected')
    }
    selectedOverlays.add(overlay)
    overlay.classList.add('multi-selected')
    activateImg(overlay, { keepGroup: true })
  }
  setAlignSelectionBtnEnabled(selectedOverlays.size >= 2)
}

function activateImg(overlay, { keepGroup = false } = {}) {
  if (!keepGroup) clearMultiSelectExcept(overlay)
  if (activeOverlay && activeOverlay !== overlay) activeOverlay.classList.remove('active')
  activeOverlay = overlay
  if (!overlay) return
  overlay.classList.add('active')
  canvas.style.pointerEvents = 'none'
  canvas.style.cursor = 'default'
  setLayerBtnsEnabled(true)
  setPasteModeBtnEnabled(isPlainImageOverlay(overlay))
  setCopyBtnEnabled(true)
  setSelectionBtnEnabled(isPlainImageOverlay(overlay))
  setCropBtnEnabled(isPlainImageOverlay(overlay))
}

function deactivateImg() {
  if (!activeOverlay) return
  activeOverlay.classList.remove('active')
  activeOverlay = null
  clearMultiSelectExcept(null)
  setLayerBtnsEnabled(false)
  setPasteModeBtnEnabled(false)
  setCopyBtnEnabled(false)
  setSelectionBtnEnabled(false)
  setCropBtnEnabled(false)
  if (tool !== 'select') {
    canvas.style.pointerEvents = 'auto'
    canvas.style.cursor = tool === 'text' ? 'text' : 'crosshair'
  }
}

function bringToFront() {
  if (!activeOverlay) return
  pushHistory()
  zoomLayer.insertBefore(activeOverlay, canvas)
}

function bringForward() {
  if (!activeOverlay) return
  const overlays = getOverlays()
  const idx = overlays.indexOf(activeOverlay)
  if (idx < overlays.length - 1) { pushHistory(); overlays[idx + 1].after(activeOverlay) }
}

function sendBackward() {
  if (!activeOverlay) return
  const overlays = getOverlays()
  const idx = overlays.indexOf(activeOverlay)
  if (idx > 0) { pushHistory(); zoomLayer.insertBefore(activeOverlay, overlays[idx - 1]) }
}

function sendToBack() {
  if (!activeOverlay) return
  const overlays = getOverlays()
  const first = overlays.find(o => o !== activeOverlay)
  if (first) { pushHistory(); zoomLayer.insertBefore(activeOverlay, first) }
}

// Tool selection
document.querySelectorAll('.tool-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    if (selectionIndicator) { selectionIndicator.remove(); selectionIndicator = null }
    selectionBtn.classList.remove('active')
    cropBtn.classList.remove('active')
    document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'))
    btn.classList.add('active')
    tool = btn.dataset.tool
    setAlignBtnsEnabled(tool === 'text' || editingText)
    if (tool === 'select') {
      canvas.style.pointerEvents = 'none'
      canvas.style.cursor = 'default'
    } else {
      deactivateImg()
      canvas.style.pointerEvents = 'auto'
      canvas.style.cursor = tool === 'text' ? 'text' : 'crosshair'
    }
  })
})

// Selection tool — click opens the rect/circle picker AND remembers which image it applies to,
// without deselecting it (unlike other tools, which always deactivate the current image)
;(function () {
  const picker = document.getElementById('selection-picker')
  const showPicker = v => { picker.style.display = v ? 'flex' : 'none' }

  selectionBtn.addEventListener('click', () => {
    showPicker(picker.style.display === 'none')
    if (!activeOverlay || !isPlainImageOverlay(activeOverlay)) return
    selectionTargetOverlay = activeOverlay
    document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'))
    selectionBtn.classList.add('active')
    tool = 'selection'
    setAlignBtnsEnabled(false)
    canvas.style.pointerEvents = 'auto'
    canvas.style.cursor = 'crosshair'
  })

  picker.querySelectorAll('.shape-opt').forEach(opt => {
    opt.addEventListener('click', e => {
      e.stopPropagation()
      picker.querySelectorAll('.shape-opt').forEach(o => o.classList.remove('active'))
      opt.classList.add('active')
      selectionShapeType = opt.dataset.selectionShape
      showPicker(false)
    })
  })

  document.addEventListener('click', e => {
    if (picker.style.display !== 'none' && !picker.contains(e.target) && !selectionBtn.contains(e.target)) showPicker(false)
  })
})()

// Crop tool — same drag-a-region mechanics as Selection (shares selectionIndicator/selStartX/Y),
// but always rectangular (no shape picker) and trims the image down instead of erasing a region
cropBtn.addEventListener('click', () => {
  if (!activeOverlay || !isPlainImageOverlay(activeOverlay)) return
  selectionTargetOverlay = activeOverlay
  document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'))
  selectionBtn.classList.remove('active')
  cropBtn.classList.add('active')
  tool = 'crop'
  setAlignBtnsEnabled(false)
  canvas.style.pointerEvents = 'auto'
  canvas.style.cursor = 'crosshair'
})

function cancelSelectionTool() {
  if (selectionIndicator) { selectionIndicator.remove(); selectionIndicator = null }
  selectionTargetOverlay = null
  marqueeAction = null
  selectionBtn.classList.remove('active')
  cropBtn.classList.remove('active')
  document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'))
  document.querySelector('.tool-btn[data-tool="select"]').classList.add('active')
  tool = 'select'
  canvas.style.pointerEvents = 'none'
  canvas.style.cursor = 'default'
  setAlignBtnsEnabled(false)
}

// Once the initial drag finishes, lets the user fine-tune the marquee — drag its body to move it,
// drag a corner/edge handle to resize it — before committing with Enter
function makeMarqueeInteractive(indicator) {
  indicator.style.pointerEvents = 'auto'
  RESIZE_HANDLES.forEach(dir => {
    const handle = document.createElement('div')
    handle.className = 'img-resize-handle'
    handle.dataset.handle = dir
    indicator.appendChild(handle)
  })
  indicator.addEventListener('mousedown', e => {
    e.preventDefault()
    e.stopPropagation()
    marqueeAction = e.target.classList.contains('img-resize-handle') ? 'resize' : 'move'
    resizeDirection = e.target.dataset.handle || 'se'
    marqueeStartMouse = { x: e.clientX, y: e.clientY }
    marqueeStartRect = {
      left: parseFloat(indicator.style.left) || 0,
      top: parseFloat(indicator.style.top) || 0,
      w: parseFloat(indicator.style.width) || 0,
      h: parseFloat(indicator.style.height) || 0
    }
  })
}

document.addEventListener('mousemove', e => {
  if (!marqueeAction || !selectionIndicator) return
  const dx = (e.clientX - marqueeStartMouse.x) / zoom
  const dy = (e.clientY - marqueeStartMouse.y) / zoom
  if (marqueeAction === 'move') {
    selectionIndicator.style.left = (marqueeStartRect.left + dx) + 'px'
    selectionIndicator.style.top = (marqueeStartRect.top + dy) + 'px'
  } else {
    let { left, top, w, h } = marqueeStartRect
    if (resizeDirection.includes('e')) w = Math.max(10, marqueeStartRect.w + dx)
    if (resizeDirection.includes('w')) { w = Math.max(10, marqueeStartRect.w - dx); left = marqueeStartRect.left + (marqueeStartRect.w - w) }
    if (resizeDirection.includes('s')) h = Math.max(10, marqueeStartRect.h + dy)
    if (resizeDirection.includes('n')) { h = Math.max(10, marqueeStartRect.h - dy); top = marqueeStartRect.top + (marqueeStartRect.h - h) }
    selectionIndicator.style.left = left + 'px'
    selectionIndicator.style.top = top + 'px'
    selectionIndicator.style.width = w + 'px'
    selectionIndicator.style.height = h + 'px'
  }
})

document.addEventListener('mouseup', () => { marqueeAction = null })

// Erases a rect/circle region of the given image overlay, filling it with a fill that
// approximates the background just outside the region — either a flat average color (for a
// uniform background) or a 2-stop gradient along whichever axis (vertical/horizontal) shows the
// most change (for simple gradient backgrounds like a sky or a wall), a step up from a single
// flat average without needing true content-aware inpainting
function clampedPixel(ctx, x, y, canvasW, canvasH) {
  x = Math.max(0, Math.min(canvasW - 1, Math.round(x)))
  y = Math.max(0, Math.min(canvasH - 1, Math.round(y)))
  const d = ctx.getImageData(x, y, 1, 1).data
  return [d[0], d[1], d[2]]
}

function averagePatchColor(ctx, cx, cy, radius, canvasW, canvasH) {
  const samples = []
  const step = Math.max(1, radius)
  for (let dx = -radius; dx <= radius; dx += step) {
    for (let dy = -radius; dy <= radius; dy += step) {
      const x = cx + dx, y = cy + dy
      if (x >= 0 && y >= 0 && x < canvasW && y < canvasH) samples.push(clampedPixel(ctx, x, y, canvasW, canvasH))
    }
  }
  if (!samples.length) return [255, 255, 255]
  return [0, 1, 2].map(i => Math.round(samples.reduce((s, c) => s + c[i], 0) / samples.length))
}

function buildNearbyFill(ctx, x, y, w, h, canvasW, canvasH) {
  const ring = Math.max(6, Math.round(Math.min(w, h) * 0.25))
  const patchR = Math.max(2, Math.round(ring * 0.4))
  const top = averagePatchColor(ctx, x + w / 2, y - ring, patchR, canvasW, canvasH)
  const bottom = averagePatchColor(ctx, x + w / 2, y + h + ring, patchR, canvasW, canvasH)
  const left = averagePatchColor(ctx, x - ring, y + h / 2, patchR, canvasW, canvasH)
  const right = averagePatchColor(ctx, x + w + ring, y + h / 2, patchR, canvasW, canvasH)

  const colorDist = (a, b) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2])
  const toRgb = c => `rgb(${c[0]},${c[1]},${c[2]})`
  const vertDiff = colorDist(top, bottom)
  const horizDiff = colorDist(left, right)

  const FLAT_THRESHOLD = 24 // below this, differences are likely noise — flat-fill instead of a gradient
  if (vertDiff < FLAT_THRESHOLD && horizDiff < FLAT_THRESHOLD) {
    const avg = [0, 1, 2].map(i => Math.round((top[i] + bottom[i] + left[i] + right[i]) / 4))
    return toRgb(avg)
  }
  const gradient = vertDiff >= horizDiff
    ? { grad: ctx.createLinearGradient(0, y, 0, y + h), from: top, to: bottom }
    : { grad: ctx.createLinearGradient(x, 0, x + w, 0), from: left, to: right }
  gradient.grad.addColorStop(0, toRgb(gradient.from))
  gradient.grad.addColorStop(1, toRgb(gradient.to))
  return gradient.grad
}

function eraseImageRegion(overlay, shapeType, localLeft, localTop, localW, localH) {
  const imgEl = overlay.querySelector('img')
  if (!imgEl || !imgEl.naturalWidth) return
  pushHistory()

  const dispW = parseInt(overlay.style.width) || overlay.offsetWidth
  const dispH = parseInt(overlay.style.height) || overlay.offsetHeight
  const scaleX = imgEl.naturalWidth / dispW
  const scaleY = imgEl.naturalHeight / dispH

  const nx = localLeft * scaleX, ny = localTop * scaleY
  const nw = localW * scaleX, nh = localH * scaleY

  const tmp = document.createElement('canvas')
  tmp.width = imgEl.naturalWidth
  tmp.height = imgEl.naturalHeight
  const tctx = tmp.getContext('2d')
  tctx.drawImage(imgEl, 0, 0)

  tctx.fillStyle = buildNearbyFill(tctx, nx, ny, nw, nh, tmp.width, tmp.height)
  if (shapeType === 'circle') {
    tctx.beginPath()
    tctx.ellipse(nx + nw / 2, ny + nh / 2, nw / 2, nh / 2, 0, 0, Math.PI * 2)
    tctx.fill()
  } else {
    tctx.fillRect(nx, ny, nw, nh)
  }

  imgEl.src = tmp.toDataURL()
}

// Intersects the drawn selection/crop indicator with the target image overlay's own bounds,
// returning both page-space (ix1/iy1, for repositioning) and image-local coordinates (for
// reading/writing pixel data) — shared by the Selection (erase) and Crop tools
function intersectIndicatorWithOverlay(indicator, overlay) {
  const selLeft = parseFloat(indicator.style.left) || 0
  const selTop = parseFloat(indicator.style.top) || 0
  const selW = parseFloat(indicator.style.width) || 0
  const selH = parseFloat(indicator.style.height) || 0

  const ovLeft = parseInt(overlay.style.left) || 0
  const ovTop = parseInt(overlay.style.top) || 0
  const ovW = parseInt(overlay.style.width) || overlay.offsetWidth
  const ovH = parseInt(overlay.style.height) || overlay.offsetHeight

  const ix1 = Math.max(selLeft, ovLeft), iy1 = Math.max(selTop, ovTop)
  const ix2 = Math.min(selLeft + selW, ovLeft + ovW), iy2 = Math.min(selTop + selH, ovTop + ovH)
  return { ix1, iy1, localLeft: ix1 - ovLeft, localTop: iy1 - ovTop, localW: ix2 - ix1, localH: iy2 - iy1 }
}

function applySelectionErase() {
  const overlay = selectionTargetOverlay
  const indicator = selectionIndicator
  if (!overlay || !indicator) { cancelSelectionTool(); return }

  const { localLeft, localTop, localW, localH } = intersectIndicatorWithOverlay(indicator, overlay)
  const shapeType = selectionShapeType
  cancelSelectionTool()

  if (localW < 2 || localH < 2) return
  eraseImageRegion(overlay, shapeType, localLeft, localTop, localW, localH)
  showToast('Region erased')
}

// Trims the image overlay down to the given region — resizes both its display box and its
// underlying pixel data, repositioning it so it doesn't visually jump
function cropImageOverlay(overlay, newLeft, newTop, localLeft, localTop, localW, localH) {
  const imgEl = overlay.querySelector('img')
  if (!imgEl || !imgEl.naturalWidth) return
  pushHistory()

  const dispW = parseInt(overlay.style.width) || overlay.offsetWidth
  const dispH = parseInt(overlay.style.height) || overlay.offsetHeight
  const scaleX = imgEl.naturalWidth / dispW
  const scaleY = imgEl.naturalHeight / dispH

  const nx = localLeft * scaleX, ny = localTop * scaleY
  const nw = localW * scaleX, nh = localH * scaleY

  const tmp = document.createElement('canvas')
  tmp.width = Math.round(nw)
  tmp.height = Math.round(nh)
  tmp.getContext('2d').drawImage(imgEl, nx, ny, nw, nh, 0, 0, tmp.width, tmp.height)

  overlay.style.left = newLeft + 'px'
  overlay.style.top = newTop + 'px'
  overlay.style.width = localW + 'px'
  overlay.style.height = localH + 'px'
  imgEl.src = tmp.toDataURL()
}

function applyCrop() {
  const overlay = selectionTargetOverlay
  const indicator = selectionIndicator
  if (!overlay || !indicator) { cancelSelectionTool(); return }

  const { ix1, iy1, localLeft, localTop, localW, localH } = intersectIndicatorWithOverlay(indicator, overlay)
  cancelSelectionTool()

  if (localW < 2 || localH < 2) return
  cropImageOverlay(overlay, ix1, iy1, localLeft, localTop, localW, localH)
  showToast('Image cropped')
}

// Shape picker
;(function () {
  const shapeBtn = document.getElementById('shape-btn')
  const picker = document.getElementById('shape-picker')
  const showPicker = v => { picker.style.display = v ? 'flex' : 'none' }

  shapeBtn.addEventListener('click', () => { showPicker(picker.style.display === 'none') })

  picker.querySelectorAll('.shape-opt').forEach(opt => {
    opt.addEventListener('click', e => {
      e.stopPropagation()
      picker.querySelectorAll('.shape-opt').forEach(o => o.classList.remove('active'))
      opt.classList.add('active')
      activeShape = opt.dataset.shape
      showPicker(false)
    })
  })

  document.addEventListener('click', e => {
    if (picker.style.display !== 'none' && !picker.contains(e.target) && !shapeBtn.contains(e.target)) showPicker(false)
  })
})()

// Custom canvas size — locks the canvas at this size so window resizes no longer auto-fit it
;(function () {
  const btn = document.getElementById('canvas-size-btn')
  const picker = document.getElementById('canvas-size-picker')
  const wInput = document.getElementById('canvas-size-w')
  const hInput = document.getElementById('canvas-size-h')
  const showPicker = v => { picker.style.display = v ? 'flex' : 'none' }

  btn.addEventListener('click', () => {
    wInput.value = canvas.width
    hInput.value = canvas.height
    showPicker(picker.style.display === 'none')
  })

  document.getElementById('canvas-size-apply').addEventListener('click', () => {
    const w = parseInt(wInput.value)
    const h = parseInt(hInput.value)
    if (!w || !h || w < 50 || h < 50) return
    pushHistory()
    canvas.width = w
    canvas.height = h
    syncCanvasBg()
    hasContent = true
    showPicker(false)
  })

  document.addEventListener('click', e => {
    if (picker.style.display !== 'none' && !picker.contains(e.target) && !btn.contains(e.target)) showPicker(false)
  })
})()

// Copy button — same effect as Ctrl+C, enabled whenever any image/shape/text is selected
const copyBtn = document.getElementById('copy-btn')
function setCopyBtnEnabled(on) { copyBtn.disabled = !on }
copyBtn.addEventListener('click', copyActiveOverlay)

// Paste mode — a new paste always uses Auto-fit; select an already-pasted image and pick one
// of these to re-fit that specific image (one-shot action, like the Layer order picker)
const pasteModeBtn = document.getElementById('paste-mode-btn')
function setPasteModeBtnEnabled(on) { pasteModeBtn.disabled = !on }
;(function () {
  const btn = pasteModeBtn
  const picker = document.getElementById('paste-mode-picker')
  const opts = picker.querySelectorAll('.paste-mode-opt')
  const showPicker = v => { picker.style.display = v ? 'flex' : 'none' }

  btn.addEventListener('click', () => { showPicker(picker.style.display === 'none') })

  opts.forEach(opt => {
    opt.addEventListener('click', () => {
      if (activeOverlay) fitImageOverlay(activeOverlay, opt.dataset.mode)
      showPicker(false)
    })
  })

  document.addEventListener('click', e => {
    if (picker.style.display !== 'none' && !picker.contains(e.target) && !btn.contains(e.target)) showPicker(false)
  })
})()

// Text alignment — single trigger button showing the current alignment; click opens a picker to change it
;(function () {
  const picker = document.getElementById('align-picker')
  const showPicker = v => { picker.style.display = v ? 'flex' : 'none' }

  alignBtn.addEventListener('click', () => { showPicker(picker.style.display === 'none') })

  document.addEventListener('click', e => {
    if (picker.style.display !== 'none' && !picker.contains(e.target) && !alignBtn.contains(e.target)) showPicker(false)
  })

  alignBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      alignBtns.forEach(b => b.classList.remove('active'))
      btn.classList.add('active')
      textAlign = btn.dataset.align
      alignBtn.innerHTML = btn.querySelector('svg').outerHTML
      showPicker(false)
    })
  })
})()

// Click outside active image → deactivate. Anything inside the toolbar itself (buttons, sliders,
// their icons/labels, any dropdown/picker) must never trigger this — only clicks that land outside
// both the image AND the whole toolbar count as "away". This replaces an earlier approach that
// individually excluded specific controls (STYLE_CONTROLS, pasteModeBtn, ...) — that list kept
// silently missing newly-added buttons (layer-order, canvas-size, copy, reset-style, file-menu,
// zoom, and even the slider value labels/icons), each time causing the same bug: the image gets
// deselected the instant you touch the new control, making its action silently do nothing.
const flashpaintToolbar = document.querySelector('.flashpaint-toolbar')
document.addEventListener('click', e => {
  // Uses composedPath() (a snapshot taken when the event was dispatched) rather than e.target +
  // .contains() — a listener earlier in the same bubble phase (e.g. the Layers panel row's own
  // click handler) can trigger a DOM rebuild that detaches e.target before this listener runs,
  // which would make .contains() checks against the (now-disconnected) target unreliable
  const path = e.composedPath()
  if (activeOverlay && tool !== 'selection' && tool !== 'crop' &&
      !path.includes(activeOverlay) && !path.includes(flashpaintToolbar) && !path.includes(layersPanel)) {
    deactivateImg()
  }
})

// Shared drop-shadow application for both the shape/freehand canvas paths
function applyShadow(c, shadow) {
  if (shadow > 0) {
    c.shadowColor = 'rgba(0, 0, 0, 0.45)'
    c.shadowBlur = shadow
    c.shadowOffsetX = shadow * 0.4
    c.shadowOffsetY = shadow * 0.4
  } else {
    c.shadowColor = 'transparent'
    c.shadowBlur = 0
    c.shadowOffsetX = 0
    c.shadowOffsetY = 0
  }
}

function drawShapeOnCtx(c, shapeType, strokeColor, strokeWidth, x1, y1, x2, y2, opacity = 1, blur = 0, shadow = 0) {
  const minX = Math.min(x1, x2), minY = Math.min(y1, y2)
  const maxX = Math.max(x1, x2), maxY = Math.max(y1, y2)
  const w = maxX - minX, h = maxY - minY
  const cx = minX + w / 2, cy = minY + h / 2
  c.globalCompositeOperation = 'source-over'
  c.globalAlpha = opacity
  c.filter = blur > 0 ? `blur(${blur}px)` : 'none'
  applyShadow(c, shadow)
  c.strokeStyle = strokeColor
  c.lineWidth = strokeWidth
  c.lineCap = 'round'
  c.lineJoin = 'round'
  c.setLineDash([])

  if (shapeType === 'darrow') {
    c.beginPath()
    c.setLineDash([8, 5])
    c.moveTo(x1, y1)
    c.lineTo(x2, y2)
    c.stroke()
    c.setLineDash([])
    const angle = Math.atan2(y2 - y1, x2 - x1)
    const size = Math.max(strokeWidth * 4, 12)
    const ha = Math.PI / 5
    c.beginPath()
    c.moveTo(x2, y2)
    c.lineTo(x2 - size * Math.cos(angle - ha), y2 - size * Math.sin(angle - ha))
    c.moveTo(x2, y2)
    c.lineTo(x2 - size * Math.cos(angle + ha), y2 - size * Math.sin(angle + ha))
    c.stroke()
    return
  }

  c.beginPath()
  if (shapeType === 'dline') c.setLineDash([8, 5])

  if (shapeType === 'rect' || shapeType === 'rectFill') {
    c.rect(minX, minY, w, h)
  } else if (shapeType === 'circle' || shapeType === 'circleFill') {
    if (w > 0 && h > 0) c.ellipse(cx, cy, w / 2, h / 2, 0, 0, Math.PI * 2)
  } else if (shapeType === 'check') {
    c.moveTo(minX + w * 0.1, cy)
    c.lineTo(minX + w * 0.38, minY + h * 0.78)
    c.lineTo(minX + w * 0.9, minY + h * 0.2)
  } else if (shapeType === 'cross') {
    c.moveTo(minX + w * 0.1, minY + h * 0.1)
    c.lineTo(minX + w * 0.9, minY + h * 0.9)
    c.moveTo(minX + w * 0.9, minY + h * 0.1)
    c.lineTo(minX + w * 0.1, minY + h * 0.9)
  } else if (shapeType === 'arrow') {
    const ah = Math.max(h * 0.35, 6)
    c.moveTo(minX, cy)
    c.lineTo(minX + w * 0.68, cy)
    c.moveTo(maxX, cy)
    c.lineTo(minX + w * 0.65, cy - ah)
    c.moveTo(maxX, cy)
    c.lineTo(minX + w * 0.65, cy + ah)
  } else if (shapeType === 'line' || shapeType === 'dline') {
    c.moveTo(x1, y1)
    c.lineTo(x2, y2)
  } else if (shapeType === 'paren') {
    c.moveTo(minX + w * 0.7, minY)
    c.quadraticCurveTo(minX, cy, minX + w * 0.7, maxY)
  } else if (shapeType === 'curly') {
    c.moveTo(maxX, minY)
    c.bezierCurveTo(minX + w * 0.35, minY, minX + w * 0.35, cy - h * 0.12, minX, cy)
    c.bezierCurveTo(minX + w * 0.35, cy + h * 0.12, minX + w * 0.35, maxY, maxX, maxY)
  } else if (shapeType === 'bracket') {
    c.moveTo(minX + w * 0.7, minY)
    c.lineTo(minX + w * 0.3, minY)
    c.lineTo(minX + w * 0.3, maxY)
    c.lineTo(minX + w * 0.7, maxY)
  }

  if (shapeType === 'rectFill' || shapeType === 'circleFill') {
    c.fillStyle = strokeColor
    c.fill()
  } else {
    c.stroke()
  }
  c.setLineDash([])
}

function drawShape(x1, y1, x2, y2) {
  drawShapeOnCtx(ctx, activeShape, getColor(), getWidth(), x1, y1, x2, y2, getOpacity(), getBlur(), getShadow())
}

function drawFreehandOnCtx(c, points, strokeColor, strokeWidth, opacity = 1, blur = 0, shadow = 0) {
  if (points.length < 2) return
  c.globalCompositeOperation = 'source-over'
  c.globalAlpha = opacity
  c.filter = blur > 0 ? `blur(${blur}px)` : 'none'
  applyShadow(c, shadow)
  c.strokeStyle = strokeColor
  c.lineWidth = strokeWidth
  c.lineCap = 'round'
  c.lineJoin = 'round'
  c.setLineDash([])
  c.beginPath()
  c.moveTo(points[0].x, points[0].y)
  for (let i = 1; i < points.length; i++) c.lineTo(points[i].x, points[i].y)
  c.stroke()
}

// Shared scaffolding for shape/freehand overlays — a small canvas drawn via drawFn, wrapped in a
// movable/selectable/resizable .shape-overlay element
function createRasterOverlay(left, top, width, height, shapeData, drawFn) {
  const overlay = document.createElement('div')
  overlay.className = 'img-overlay shape-overlay'
  overlay.style.left = left + 'px'
  overlay.style.top = top + 'px'
  overlay.style.width = width + 'px'
  overlay.style.height = height + 'px'

  const shapeCanvas = document.createElement('canvas')
  shapeCanvas.width = width
  shapeCanvas.height = height
  shapeCanvas.style.cssText = 'display: block; width: 100%; height: 100%; pointer-events: none;'
  const sctx = shapeCanvas.getContext('2d')
  sctx.translate(-left, -top)
  drawFn(sctx)
  overlay.appendChild(shapeCanvas)

  overlay.shapeCanvas = shapeCanvas
  overlay.shapeData = shapeData

  addResizeHandles(overlay)

  zoomLayer.insertBefore(overlay, canvas)

  hasContent = true
  hint.classList.add('hidden')

  wireOverlayDrag(overlay)
  return overlay
}

// Extra margin so thick strokes/arrowheads and blur don't clip against the mini-canvas edge
function shapePadding(strokeWidth, blur, shadow = 0) {
  return Math.max(20, strokeWidth * 3, blur * 2 + 10, shadow * 1.4 + 10)
}

// Shape overlay — kept as a movable/selectable/resizable element so it can be reselected with the Select tool
function createShapeOverlay(shapeType, x1, y1, x2, y2, color, strokeWidth, opacity = 1, blur = 0, shadow = 0) {
  const minX = Math.min(x1, x2), minY = Math.min(y1, y2)
  const maxX = Math.max(x1, x2), maxY = Math.max(y1, y2)
  const w = maxX - minX, h = maxY - minY
  if (w < 3 && h < 3) return

  const pad = shapePadding(strokeWidth, blur, shadow)
  const left = minX - pad
  const top = minY - pad
  return createRasterOverlay(left, top, w + pad * 2, h + pad * 2,
    { shapeType, x1, y1, x2, y2, color, strokeWidth, opacity, blur, shadow },
    sctx => drawShapeOnCtx(sctx, shapeType, color, strokeWidth, x1, y1, x2, y2, opacity, blur, shadow))
}

// Freehand overlay — same movable/selectable/resizable treatment as shapes
function createFreehandOverlay(points, color, strokeWidth, opacity = 1, blur = 0, shadow = 0) {
  if (points.length < 2) return
  const xs = points.map(p => p.x), ys = points.map(p => p.y)
  const minX = Math.min(...xs), maxX = Math.max(...xs)
  const minY = Math.min(...ys), maxY = Math.max(...ys)
  const w = maxX - minX, h = maxY - minY
  if (w < 3 && h < 3) return

  const pad = shapePadding(strokeWidth, blur, shadow)
  const left = minX - pad
  const top = minY - pad
  return createRasterOverlay(left, top, w + pad * 2, h + pad * 2,
    { shapeType: 'freehand', points, color, strokeWidth, opacity, blur, shadow },
    sctx => drawFreehandOnCtx(sctx, points, color, strokeWidth, opacity, blur, shadow))
}

// Restyle a selected shape overlay (color, stroke width, opacity, blur, shadow) in place
function restyleShapeOverlay(overlay, color, strokeWidth, opacity, blur, shadow) {
  const { shapeCanvas, shapeData } = overlay
  const sctx = shapeCanvas.getContext('2d')
  sctx.save()
  sctx.setTransform(1, 0, 0, 1, 0, 0)
  sctx.filter = 'none'
  sctx.clearRect(0, 0, shapeCanvas.width, shapeCanvas.height)
  sctx.restore()
  if (shapeData.shapeType === 'freehand') {
    drawFreehandOnCtx(sctx, shapeData.points, color, strokeWidth, opacity, blur, shadow)
  } else {
    drawShapeOnCtx(sctx, shapeData.shapeType, color, strokeWidth, shapeData.x1, shapeData.y1, shapeData.x2, shapeData.y2, opacity, blur, shadow)
  }
  shapeData.color = color
  shapeData.strokeWidth = strokeWidth
  shapeData.opacity = opacity
  shapeData.blur = blur
  shapeData.shadow = shadow
}

function liveRestyleActiveShape(source) {
  if (!activeOverlay || activeOverlay.classList.contains('text-overlay')) return
  if (activeOverlay.classList.contains('shape-overlay')) {
    restyleShapeOverlay(activeOverlay, getColor(), getWidth(), getOpacity(), getBlur(), getShadow())
  } else {
    // Plain image overlay — opacity/blur/shadow/color always live-update, but the border (stroke)
    // only changes when the user is actually touching the stroke-width slider, so adjusting
    // something else never silently adds/changes a border that wasn't there
    const strokeWidth = source === strokeWidthInput ? getWidth() : readImageStyle(activeOverlay).strokeWidth
    applyImageStyle(activeOverlay, getColor(), strokeWidth, getOpacity(), getBlur(), getShadow())
  }
}
colorPicker.addEventListener('input', () => liveRestyleActiveShape(colorPicker))
strokeWidthInput.addEventListener('input', () => liveRestyleActiveShape(strokeWidthInput))
opacityInput.addEventListener('input', () => liveRestyleActiveShape(opacityInput))
blurInput.addEventListener('input', () => liveRestyleActiveShape(blurInput))
shadowInput.addEventListener('input', () => liveRestyleActiveShape(shadowInput))

// Reset color/stroke-width/opacity/blur/shadow to defaults, live-updating a selected shape or open text box
const DEFAULT_STYLE = { color: '#2563eb', strokeWidth: 3, opacity: 100, blur: 0, shadow: 0 }
document.getElementById('reset-style-btn').addEventListener('click', () => {
  pushHistoryIfStyling()
  colorPicker.value = DEFAULT_STYLE.color
  strokeWidthInput.value = DEFAULT_STYLE.strokeWidth
  opacityInput.value = DEFAULT_STYLE.opacity
  blurInput.value = DEFAULT_STYLE.blur
  shadowInput.value = DEFAULT_STYLE.shadow
  ;[colorPicker, strokeWidthInput, opacityInput, blurInput, shadowInput].forEach(el => el.dispatchEvent(new Event('input', { bubbles: true })))
  // Images default to no border, even though the stroke-width slider itself resets to its normal default
  if (activeOverlay && !activeOverlay.classList.contains('shape-overlay') && !activeOverlay.classList.contains('text-overlay')) {
    applyImageStyle(activeOverlay, getColor(), 0, getOpacity(), getBlur(), getShadow())
  }
})

// Draw / Shape
canvas.addEventListener('mousedown', e => {
  const { x, y } = getPos(e)
  drawing = true
  startX = x; startY = y
  if (tool === 'draw') {
    ctx.beginPath()
    ctx.moveTo(x, y)
    snapshot = ctx.getImageData(0, 0, canvas.width, canvas.height)
    freehandPoints = [{ x, y }]
  }
  if (tool === 'shape') {
    snapshot = ctx.getImageData(0, 0, canvas.width, canvas.height)
  }
  if (tool === 'selection' || tool === 'crop') {
    if (selectionIndicator) { selectionIndicator.remove(); selectionIndicator = null }
    selStartX = x; selStartY = y
    selectionIndicator = document.createElement('div')
    selectionIndicator.className = 'selection-indicator' + (tool === 'selection' && selectionShapeType === 'circle' ? ' selection-circle' : '')
    zoomLayer.appendChild(selectionIndicator)
  }
})

canvas.addEventListener('mousemove', e => {
  if (!drawing) return
  const { x, y } = getPos(e)
  if ((tool === 'selection' || tool === 'crop') && selectionIndicator) {
    const left = Math.min(selStartX, x), top = Math.min(selStartY, y)
    const w = Math.abs(x - selStartX), h = Math.abs(y - selStartY)
    selectionIndicator.style.left = left + 'px'
    selectionIndicator.style.top = top + 'px'
    selectionIndicator.style.width = w + 'px'
    selectionIndicator.style.height = h + 'px'
  }
  if (tool === 'draw') {
    ctx.globalCompositeOperation = 'source-over'
    ctx.globalAlpha = getOpacity()
    ctx.filter = getBlur() > 0 ? `blur(${getBlur()}px)` : 'none'
    applyShadow(ctx, getShadow())
    ctx.strokeStyle = getColor()
    ctx.lineWidth = getWidth()
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.lineTo(x, y)
    ctx.stroke()
    freehandPoints.push({ x, y })
  }
  if (tool === 'shape') {
    ctx.putImageData(snapshot, 0, 0)
    drawShape(startX, startY, x, y)
  }
})

canvas.addEventListener('mouseup', e => {
  if (!drawing) return
  drawing = false
  ctx.globalCompositeOperation = 'source-over'
  ctx.globalAlpha = 1
  ctx.filter = 'none'
  applyShadow(ctx, 0)
  if (tool === 'draw') {
    ctx.putImageData(snapshot, 0, 0)
    const before = captureSnapshot()
    if (createFreehandOverlay(freehandPoints, getColor(), getWidth(), getOpacity(), getBlur(), getShadow())) commitHistoryEntry(before)
  }
  if (tool === 'shape') {
    const { x, y } = getPos(e)
    ctx.putImageData(snapshot, 0, 0)
    const before = captureSnapshot()
    if (createShapeOverlay(activeShape, startX, startY, x, y, getColor(), getWidth(), getOpacity(), getBlur(), getShadow())) commitHistoryEntry(before)
  }
  if ((tool === 'selection' || tool === 'crop') && selectionIndicator) makeMarqueeInteractive(selectionIndicator)
})

canvas.addEventListener('mouseleave', () => { drawing = false })

// Text tool
function textStyleCss(opacity, blur, shadow) {
  const shadowCss = shadow > 0 ? `${shadow * 0.4}px ${shadow * 0.4}px ${shadow}px rgba(0, 0, 0, 0.45)` : 'none'
  return `opacity: ${opacity}; filter: ${blur > 0 ? `blur(${blur}px)` : 'none'}; text-shadow: ${shadowCss};`
}

function parseBlurPx(filterStr) {
  const m = /blur\(([\d.]+)px\)/.exec(filterStr || '')
  return m ? parseFloat(m[1]) : 0
}

function parseTextShadowPx(shadowStr) {
  const m = /(-?[\d.]+)px\s+(-?[\d.]+)px\s+([\d.]+)px/.exec(shadowStr || '')
  return m ? parseFloat(m[3]) : 0
}

function openTextEditor({ left, top, fontSize, lineHeight, color, initialText = '', width = 240, align = 'left', opacity = 1, blur = 0, shadow = 0, onCommit, onCancel }) {
  const input = document.createElement('textarea')
  input.value = initialText
  input.style.cssText = `
    position: absolute;
    left: ${left}px;
    top: ${top}px;
    border: 1px dashed ${color};
    background: transparent;
    font-size: ${fontSize}px;
    line-height: ${lineHeight}px;
    color: ${color};
    text-align: ${align};
    text-align-last: ${align};
    ${textStyleCss(opacity, blur, shadow)}
    outline: none;
    width: ${width}px;
    min-height: ${lineHeight}px;
    resize: none;
    overflow: hidden;
    font-family: system-ui, sans-serif;
    padding: 0 2px;
    white-space: pre-wrap;
    word-wrap: break-word;
    z-index: 10;
  `
  zoomLayer.appendChild(input)
  input.focus()
  if (initialText) input.select()
  editingText = true
  setAlignBtnsEnabled(true)
  let curOpacity = opacity
  let curBlur = blur
  let curShadow = shadow
  function autoResize() {
    input.style.height = 'auto'
    input.style.height = input.scrollHeight + 'px'
  }
  autoResize()
  input.addEventListener('input', autoResize)

  // Live-follow the toolbar's color/stroke-width/alignment/opacity/blur/shadow controls while editing
  function applyLiveStyle() {
    const c = getColor()
    const fs = Math.max(14, getWidth() * 5)
    const lh = fs * 1.2
    curOpacity = getOpacity()
    curBlur = getBlur()
    curShadow = getShadow()
    input.style.color = c
    input.style.borderColor = c
    input.style.fontSize = fs + 'px'
    input.style.lineHeight = lh + 'px'
    input.style.minHeight = lh + 'px'
    input.style.textAlign = textAlign
    input.style.textAlignLast = textAlign
    input.style.opacity = curOpacity
    input.style.filter = curBlur > 0 ? `blur(${curBlur}px)` : 'none'
    input.style.textShadow = curShadow > 0 ? `${curShadow * 0.4}px ${curShadow * 0.4}px ${curShadow}px rgba(0, 0, 0, 0.45)` : 'none'
    autoResize()
    // Restyling controls steal keyboard focus (native behavior for buttons/inputs/sliders) — hand
    // it back to the text editor so typing and Ctrl+Enter/Esc keep working without an extra click
    input.focus()
  }
  colorPicker.addEventListener('input', applyLiveStyle)
  strokeWidthInput.addEventListener('input', applyLiveStyle)
  opacityInput.addEventListener('input', applyLiveStyle)
  blurInput.addEventListener('input', applyLiveStyle)
  shadowInput.addEventListener('input', applyLiveStyle)
  alignBtns.forEach(btn => btn.addEventListener('click', applyLiveStyle))

  function isStyleControl(el) { return el === colorPicker || el === strokeWidthInput || el === opacityInput || el === blurInput || el === shadowInput || alignBtn.contains(el) || document.getElementById('align-picker').contains(el) }
  function onDocMousedown(e) {
    if (e.target === input || isStyleControl(e.target)) return
    commit()
  }
  document.addEventListener('mousedown', onDocMousedown)

  let done = false
  function cleanup() {
    document.removeEventListener('mousedown', onDocMousedown)
    colorPicker.removeEventListener('input', applyLiveStyle)
    strokeWidthInput.removeEventListener('input', applyLiveStyle)
    opacityInput.removeEventListener('input', applyLiveStyle)
    blurInput.removeEventListener('input', applyLiveStyle)
    shadowInput.removeEventListener('input', applyLiveStyle)
    alignBtns.forEach(btn => btn.removeEventListener('click', applyLiveStyle))
    editingText = false
    setAlignBtnsEnabled(tool === 'text')
  }
  function commit() {
    if (done) return
    done = true
    cleanup()
    const style = {
      fontSize: parseFloat(input.style.fontSize),
      lineHeight: parseFloat(input.style.lineHeight),
      color: input.style.color,
      align: input.style.textAlign,
      opacity: curOpacity,
      blur: curBlur,
      shadow: curShadow
    }
    const text = input.value
    input.remove()
    onCommit(text, style)
  }
  function cancel() {
    if (done) return
    done = true
    cleanup()
    input.remove()
    if (onCancel) onCancel()
  }
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); commit() }
    if (e.key === 'Escape') cancel()
  })
  input.addEventListener('blur', e => {
    if (isStyleControl(e.relatedTarget)) return
    commit()
  })
}

canvas.addEventListener('click', e => {
  if (tool !== 'text') return
  const layerRect = zoomLayer.getBoundingClientRect()
  const fontSize = Math.max(14, getWidth() * 5)
  const lineHeight = fontSize * 1.2
  const left = (e.clientX - layerRect.left) / zoom
  const top = (e.clientY - layerRect.top) / zoom - fontSize / 2
  openTextEditor({
    left, top, fontSize, lineHeight, color: getColor(), align: textAlign, opacity: getOpacity(), blur: getBlur(), shadow: getShadow(),
    onCommit: (text, style) => { if (text.trim()) { pushHistory(); createTextOverlay(text, left, top, style.fontSize, style.lineHeight, style.color, undefined, style.align, style.opacity, style.blur, style.shadow) } }
  })
})

// Double-click an existing text overlay (Select tool) to edit it in place
function editTextOverlay(overlay) {
  const textEl = overlay.querySelector('.text-overlay-content')
  const fontSize = parseFloat(textEl.style.fontSize)
  const lineHeight = parseFloat(textEl.style.lineHeight)
  const color = textEl.style.color
  const align = textEl.style.textAlign || 'left'
  const opacity = textEl.style.opacity ? parseFloat(textEl.style.opacity) : 1
  const blur = parseBlurPx(textEl.style.filter)
  const shadow = parseTextShadowPx(textEl.style.textShadow)
  const left = parseInt(overlay.style.left) || 0
  const top = parseInt(overlay.style.top) || 0
  const width = parseInt(overlay.style.width) || overlay.offsetWidth
  pushHistory()
  deactivateImg()
  overlay.style.display = 'none'
  openTextEditor({
    left, top, fontSize, lineHeight, color, initialText: textEl.textContent, width, align, opacity, blur, shadow,
    onCommit: (text, style) => {
      if (text.trim()) {
        textEl.textContent = text
        textEl.style.fontSize = style.fontSize + 'px'
        textEl.style.lineHeight = style.lineHeight + 'px'
        textEl.style.color = style.color
        textEl.style.textAlign = style.align
        textEl.style.textAlignLast = style.align
        textEl.style.opacity = style.opacity
        textEl.style.filter = style.blur > 0 ? `blur(${style.blur}px)` : 'none'
        textEl.style.textShadow = style.shadow > 0 ? `${style.shadow * 0.4}px ${style.shadow * 0.4}px ${style.shadow}px rgba(0, 0, 0, 0.45)` : 'none'
        overlay.style.display = ''
      } else overlay.remove()
    },
    onCancel: () => { overlay.style.display = '' }
  })
}

// Image overlay
// Opacity/blur/shadow/stroke for plain image overlays — stored directly as inline CSS
// (border for stroke, opacity, and a combined filter for blur+drop-shadow)
function imageFilterCss(blur, shadow) {
  const parts = []
  if (blur > 0) parts.push(`blur(${blur}px)`)
  if (shadow > 0) parts.push(`drop-shadow(${shadow * 0.4}px ${shadow * 0.4}px ${shadow}px rgba(0, 0, 0, 0.45))`)
  return parts.length ? parts.join(' ') : 'none'
}

function parseDropShadowPx(filterStr) {
  const m = /drop-shadow\(([-\d.]+)px\s+([-\d.]+)px\s+([\d.]+)px/.exec(filterStr || '')
  return m ? parseFloat(m[3]) : 0
}

function applyImageStyle(overlay, color = '#2563eb', strokeWidth = 0, opacity = 1, blur = 0, shadow = 0) {
  overlay.style.borderWidth = strokeWidth + 'px'
  overlay.style.borderStyle = strokeWidth > 0 ? 'solid' : 'none'
  overlay.style.borderColor = color
  overlay.style.opacity = opacity
  overlay.style.filter = imageFilterCss(blur, shadow)
}

function readImageStyle(overlay) {
  return {
    color: overlay.style.borderColor || getColor(),
    strokeWidth: parseInt(overlay.style.borderWidth) || 0,
    opacity: overlay.style.opacity ? parseFloat(overlay.style.opacity) : 1,
    blur: parseBlurPx(overlay.style.filter),
    shadow: parseDropShadowPx(overlay.style.filter)
  }
}

function applyImage(blob) {
  pushHistory()
  // No border by default — stroke-width only becomes a visible border once you explicitly
  // set it on a selected image (color/opacity/blur/shadow still apply immediately, though)
  const color = getColor(), strokeWidth = 0, opacity = getOpacity(), blur = getBlur(), shadow = getShadow()
  const img = new Image()
  img.onload = () => {
    // Every new paste always uses Auto-fit; use the Paste Mode picker afterward (with the
    // image selected) to re-fit it with a different mode.
    // (viewport size is converted from screen pixels to logical content units via the current zoom)
    const viewW = (wrapper.clientWidth || 1200) / zoom
    const viewH = (wrapper.clientHeight || 700) / zoom
    const maxW = viewW * 0.9
    const maxH = viewH * 0.9
    let w = img.width, h = img.height
    if (w > maxW || h > maxH) {
      const scale = Math.min(maxW / w, maxH / h)
      w = Math.round(w * scale)
      h = Math.round(h * scale)
    }
    const left = Math.max(0, (viewW - w) / 2)
    const top = Math.max(0, (viewH - h) / 2)

    const overlay = document.createElement('div')
    overlay.className = 'img-overlay'
    overlay.style.left = left + 'px'
    overlay.style.top = top + 'px'
    overlay.style.width = w + 'px'
    overlay.style.height = h + 'px'
    applyImageStyle(overlay, color, strokeWidth, opacity, blur, shadow)

    const imgEl = document.createElement('img')
    imgEl.src = img.src
    overlay.appendChild(imgEl)

    addResizeHandles(overlay)

    zoomLayer.insertBefore(overlay, canvas)

    canvas.width = Math.max(w, viewW)
    canvas.height = Math.max(h, viewH)
    syncCanvasBg()

    hasContent = true
    hint.classList.add('hidden')
    URL.revokeObjectURL(img.src)

    activateImg(overlay)
    wireOverlayDrag(overlay)
  }
  img.src = URL.createObjectURL(blob)
}

// Re-fits an already-placed image overlay using its natural (original) pixel size as the source —
// used by the Paste Mode picker to change how a selected image is sized after the fact
function fitImageOverlay(overlay, mode) {
  const imgEl = overlay.querySelector('img')
  if (!imgEl || !imgEl.naturalWidth) return
  pushHistory()

  const viewW = (wrapper.clientWidth || 1200) / zoom
  const viewH = (wrapper.clientHeight || 700) / zoom
  let w = imgEl.naturalWidth, h = imgEl.naturalHeight
  let left, top

  if (mode === 'fit-canvas') {
    const targetW = canvas.width || viewW
    const targetH = canvas.height || viewH
    const scale = Math.min(targetW / w, targetH / h)
    w = Math.round(w * scale)
    h = Math.round(h * scale)
    left = Math.max(0, (targetW - w) / 2)
    top = Math.max(0, (targetH - h) / 2)
  } else if (mode === 'actual') {
    left = Math.max(0, (viewW - w) / 2)
    top = Math.max(0, (viewH - h) / 2)
    canvas.width = Math.max(w, canvas.width, viewW)
    canvas.height = Math.max(h, canvas.height, viewH)
    syncCanvasBg()
  } else if (mode === 'resize-canvas') {
    left = 0
    top = 0
    canvas.width = w
    canvas.height = h
    syncCanvasBg()
  } else {
    // 'auto' — same 90%-of-viewport cap used for a fresh paste
    const maxW = viewW * 0.9
    const maxH = viewH * 0.9
    if (w > maxW || h > maxH) {
      const scale = Math.min(maxW / w, maxH / h)
      w = Math.round(w * scale)
      h = Math.round(h * scale)
    }
    left = Math.max(0, (viewW - w) / 2)
    top = Math.max(0, (viewH - h) / 2)
    canvas.width = Math.max(w, canvas.width, viewW)
    canvas.height = Math.max(h, canvas.height, viewH)
    syncCanvasBg()
  }

  overlay.style.left = left + 'px'
  overlay.style.top = top + 'px'
  overlay.style.width = w + 'px'
  overlay.style.height = h + 'px'
}

// Text overlay — kept as a movable/selectable element so it can be reselected with the Select tool
function createTextOverlay(text, left, top, fontSize, lineHeight, color, width = 240, align = 'left', opacity = 1, blur = 0, shadow = 0) {
  const overlay = document.createElement('div')
  overlay.className = 'img-overlay text-overlay'
  overlay.style.left = left + 'px'
  overlay.style.top = top + 'px'
  overlay.style.width = width + 'px'

  const textEl = document.createElement('div')
  textEl.className = 'text-overlay-content'
  textEl.textContent = text
  textEl.style.cssText = `
    font-size: ${fontSize}px;
    line-height: ${lineHeight}px;
    color: ${color};
    text-align: ${align};
    text-align-last: ${align};
    ${textStyleCss(opacity, blur, shadow)}
    font-family: system-ui, sans-serif;
    white-space: pre-wrap;
    word-wrap: break-word;
    pointer-events: none;
    user-select: none;
    padding: 0 2px;
  `
  overlay.appendChild(textEl)

  addResizeHandles(overlay, { textOnly: true })

  zoomLayer.insertBefore(overlay, canvas)

  hasContent = true
  hint.classList.add('hidden')

  wireOverlayDrag(overlay)
  overlay.addEventListener('dblclick', e => {
    if (tool !== 'select') return
    e.stopPropagation()
    editTextOverlay(overlay)
  })
  return overlay
}

// Undo / Redo — snapshot the full overlay state before each mutating action
const MAX_HISTORY = 30
let undoStack = []
let redoStack = []
let pendingDragSnapshot = null
const undoBtn = document.getElementById('undo-btn')
const redoBtn = document.getElementById('redo-btn')

function updateUndoRedoBtns() {
  undoBtn.disabled = undoStack.length === 0
  redoBtn.disabled = redoStack.length === 0
}

function overlayToDescriptor(o) {
  const left = parseInt(o.style.left) || 0
  const top = parseInt(o.style.top) || 0
  const width = parseInt(o.style.width) || o.offsetWidth
  const height = parseInt(o.style.height) || o.offsetHeight
  const imgEl = o.querySelector('img')
  if (imgEl) {
    // drawImage() throws if the <img> hasn't finished decoding yet (naturalWidth still 0) — falls
    // back to its current src rather than crashing snapshot capture in that narrow race
    let dataUrl = imgEl.src
    if (imgEl.naturalWidth) {
      const tmp = document.createElement('canvas')
      tmp.width = imgEl.naturalWidth
      tmp.height = imgEl.naturalHeight
      tmp.getContext('2d').drawImage(imgEl, 0, 0)
      dataUrl = tmp.toDataURL()
    }
    return { kind: 'image', left, top, width, height, dataUrl, ...readImageStyle(o) }
  }
  if (o.classList.contains('shape-overlay')) {
    return { kind: 'shape', left, top, width, height, shapeData: JSON.parse(JSON.stringify(o.shapeData)) }
  }
  const textEl = o.querySelector('.text-overlay-content')
  return {
    kind: 'text',
    left, top, width,
    text: textEl.textContent,
    fontSize: parseFloat(textEl.style.fontSize),
    lineHeight: parseFloat(textEl.style.lineHeight),
    color: textEl.style.color,
    align: textEl.style.textAlign || 'left',
    opacity: textEl.style.opacity ? parseFloat(textEl.style.opacity) : 1,
    blur: parseBlurPx(textEl.style.filter),
    shadow: parseTextShadowPx(textEl.style.textShadow)
  }
}

function captureSnapshot() {
  return { overlays: getOverlays().map(overlayToDescriptor), canvasWidth: canvas.width, canvasHeight: canvas.height }
}

function createImageOverlayFromDescriptor(d) {
  const overlay = document.createElement('div')
  overlay.className = 'img-overlay'
  overlay.style.left = d.left + 'px'
  overlay.style.top = d.top + 'px'
  overlay.style.width = d.width + 'px'
  overlay.style.height = d.height + 'px'
  applyImageStyle(overlay, d.color, d.strokeWidth, d.opacity, d.blur, d.shadow)

  const imgEl = document.createElement('img')
  imgEl.src = d.dataUrl
  overlay.appendChild(imgEl)

  addResizeHandles(overlay)

  zoomLayer.insertBefore(overlay, canvas)
  wireOverlayDrag(overlay)
}

function restoreSnapshot(snap) {
  deactivateImg()
  wrapper.querySelectorAll('.img-overlay').forEach(o => o.remove())
  canvas.width = snap.canvasWidth
  canvas.height = snap.canvasHeight
  syncCanvasBg()
  snap.overlays.forEach(d => {
    if (d.kind === 'image') {
      createImageOverlayFromDescriptor(d)
    } else if (d.kind === 'shape') {
      const sd = d.shapeData
      const overlay = sd.shapeType === 'freehand'
        ? createFreehandOverlay(sd.points, sd.color, sd.strokeWidth, sd.opacity, sd.blur, sd.shadow)
        : createShapeOverlay(sd.shapeType, sd.x1, sd.y1, sd.x2, sd.y2, sd.color, sd.strokeWidth, sd.opacity, sd.blur, sd.shadow)
      if (overlay) {
        overlay.style.left = d.left + 'px'
        overlay.style.top = d.top + 'px'
        overlay.style.width = d.width + 'px'
        overlay.style.height = d.height + 'px'
      }
    } else if (d.kind === 'text') {
      createTextOverlay(d.text, d.left, d.top, d.fontSize, d.lineHeight, d.color, d.width, d.align, d.opacity, d.blur, d.shadow)
    }
  })
  hasContent = snap.overlays.length > 0
  hint.classList.toggle('hidden', hasContent)
  updateUndoRedoBtns()
}

function commitHistoryEntry(entry) {
  undoStack.push(entry)
  if (undoStack.length > MAX_HISTORY) undoStack.shift()
  redoStack = []
  updateUndoRedoBtns()
}

function pushHistory() {
  commitHistoryEntry(captureSnapshot())
}

function undo() {
  if (!undoStack.length) return
  redoStack.push(captureSnapshot())
  restoreSnapshot(undoStack.pop())
}

function redo() {
  if (!redoStack.length) return
  undoStack.push(captureSnapshot())
  restoreSnapshot(redoStack.pop())
}

undoBtn.addEventListener('click', undo)
redoBtn.addEventListener('click', redo)

// Push a history checkpoint before adjusting a selected shape's or open text box's style
function pushHistoryIfStyling() {
  if ((activeOverlay && !activeOverlay.classList.contains('text-overlay')) || editingText) pushHistory()
}
;[colorPicker, strokeWidthInput, opacityInput, blurInput, shadowInput, ...alignBtns].forEach(el => {
  el.addEventListener('mousedown', pushHistoryIfStyling)
})

document.addEventListener('mousemove', e => {
  if (!imgAction || !activeOverlay) return
  const dx = (e.clientX - imgStartMouse.x) / zoom
  const dy = (e.clientY - imgStartMouse.y) / zoom
  if (imgAction === 'move') {
    if (groupStartRects) {
      groupStartRects.forEach((startRect, o) => {
        o.style.left = (startRect.left + dx) + 'px'
        o.style.top = (startRect.top + dy) + 'px'
      })
    } else {
      activeOverlay.style.left = (imgStartRect.left + dx) + 'px'
      activeOverlay.style.top = (imgStartRect.top + dy) + 'px'
    }
  } else {
    const isText = activeOverlay.classList.contains('text-overlay')
    const minSize = isText ? 60 : 50
    let { left, top, w, h } = imgStartRect
    if (resizeDirection.includes('e')) w = Math.max(minSize, imgStartRect.w + dx)
    if (resizeDirection.includes('w')) { w = Math.max(minSize, imgStartRect.w - dx); left = imgStartRect.left + (imgStartRect.w - w) }
    if (resizeDirection.includes('s')) h = Math.max(minSize, imgStartRect.h + dy)
    if (resizeDirection.includes('n')) { h = Math.max(minSize, imgStartRect.h - dy); top = imgStartRect.top + (imgStartRect.h - h) }
    activeOverlay.style.left = left + 'px'
    activeOverlay.style.width = w + 'px'
    if (!isText) {
      activeOverlay.style.top = top + 'px'
      activeOverlay.style.height = h + 'px'
    }
  }
})

document.addEventListener('mouseup', () => {
  if (imgAction && pendingDragSnapshot && activeOverlay) {
    const moved = (parseInt(activeOverlay.style.left) || 0) !== imgStartRect.left ||
      (parseInt(activeOverlay.style.top) || 0) !== imgStartRect.top ||
      (parseInt(activeOverlay.style.width) || activeOverlay.offsetWidth) !== imgStartRect.w ||
      (parseInt(activeOverlay.style.height) || activeOverlay.offsetHeight) !== imgStartRect.h
    if (moved) commitHistoryEntry(pendingDragSnapshot)
  }
  pendingDragSnapshot = null
  imgAction = null
  groupStartRects = null
})

document.addEventListener('paste', e => {
  const activeTab = document.querySelector('.tab-content.active')
  if (!activeTab || activeTab.id !== 'tab-flashpaint') return
  if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return
  // An in-app Ctrl+C (shape/text) wins over the system clipboard's image, but only until you
  // leave the window (e.g. to take a screenshot) — see the 'blur' listener below.
  if (copiedOverlayData) { pasteCopiedOverlay(); return }
  const items = e.clipboardData?.items || []
  for (const item of items) {
    if (item.type.startsWith('image/')) { applyImage(item.getAsFile()); return }
  }
})

// Leaving the window (e.g. to take a screenshot) means any pending in-app copy is stale —
// clear it so Ctrl+V goes back to pasting the system clipboard's image
window.addEventListener('blur', () => { copiedOverlayData = null })

// Copy / paste / delete a selected text or shape overlay
function pasteCopiedOverlay() {
  if (!copiedOverlayData) return
  pushHistory()
  const d = copiedOverlayData
  if (d.type === 'text') {
    createTextOverlay(d.text, d.left, d.top, d.fontSize, d.lineHeight, d.color, d.width, d.align, d.opacity, d.blur, d.shadow)
    d.left += 20
    d.top += 20
  } else if (d.type === 'shape' && d.shapeType === 'freehand') {
    createFreehandOverlay(d.points, d.color, d.strokeWidth, d.opacity, d.blur, d.shadow)
    d.points = d.points.map(p => ({ x: p.x + 20, y: p.y + 20 }))
  } else if (d.type === 'shape') {
    createShapeOverlay(d.shapeType, d.x1, d.y1, d.x2, d.y2, d.color, d.strokeWidth, d.opacity, d.blur, d.shadow)
    d.x1 += 20; d.y1 += 20; d.x2 += 20; d.y2 += 20
  } else if (d.type === 'image') {
    createImageOverlayFromDescriptor(d)
    d.left += 20
    d.top += 20
  }
}

// Copies the active image/shape/text overlay into copiedOverlayData — shared by Ctrl+C and the Copy button
function copyActiveOverlay() {
  if (!activeOverlay) return
  const isText = activeOverlay.classList.contains('text-overlay')
  const isShape = activeOverlay.classList.contains('shape-overlay')

  if (isText) {
    const textEl = activeOverlay.querySelector('.text-overlay-content')
    copiedOverlayData = {
      type: 'text',
      text: textEl.textContent,
      fontSize: parseFloat(textEl.style.fontSize),
      lineHeight: parseFloat(textEl.style.lineHeight),
      color: textEl.style.color,
      width: parseInt(activeOverlay.style.width) || activeOverlay.offsetWidth,
      align: textEl.style.textAlign || 'left',
      opacity: textEl.style.opacity ? parseFloat(textEl.style.opacity) : 1,
      blur: parseBlurPx(textEl.style.filter),
      shadow: parseTextShadowPx(textEl.style.textShadow),
      left: (parseInt(activeOverlay.style.left) || 0) + 20,
      top: (parseInt(activeOverlay.style.top) || 0) + 20
    }
  } else if (isShape && activeOverlay.shapeData.shapeType === 'freehand') {
    const { shapeType, points, color, strokeWidth, opacity, blur, shadow } = activeOverlay.shapeData
    copiedOverlayData = { type: 'shape', shapeType, color, strokeWidth, opacity, blur, shadow, points: points.map(p => ({ x: p.x + 20, y: p.y + 20 })) }
  } else if (isShape) {
    const { shapeType, x1, y1, x2, y2, color, strokeWidth, opacity, blur, shadow } = activeOverlay.shapeData
    copiedOverlayData = { type: 'shape', shapeType, color, strokeWidth, opacity, blur, shadow, x1: x1 + 20, y1: y1 + 20, x2: x2 + 20, y2: y2 + 20 }
  } else {
    const d = overlayToDescriptor(activeOverlay)
    copiedOverlayData = { type: 'image', dataUrl: d.dataUrl, width: d.width, height: d.height, color: d.color, strokeWidth: d.strokeWidth, opacity: d.opacity, blur: d.blur, shadow: d.shadow, left: d.left + 20, top: d.top + 20 }
  }
  showToast('Copied — press Ctrl+V to paste')
}

document.addEventListener('keydown', e => {
  const activeTab = document.querySelector('.tab-content.active')
  if (!activeTab || activeTab.id !== 'tab-flashpaint') return
  if (['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return

  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
    e.preventDefault()
    if (e.shiftKey) redo(); else undo()
    return
  }
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'y') {
    e.preventDefault()
    redo()
    return
  }

  if ((tool === 'selection' || tool === 'crop') && selectionIndicator) {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (tool === 'selection') applySelectionErase(); else applyCrop()
      return
    }
    if (e.key === 'Escape') {
      e.preventDefault()
      cancelSelectionTool()
      return
    }
  }

  if (!activeOverlay) return

  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'c') {
    copyActiveOverlay()
  } else if (e.key === 'Delete' || e.key === 'Backspace') {
    e.preventDefault()
    pushHistory()
    if (selectedOverlays.size > 1) selectedOverlays.forEach(o => o.remove())
    else activeOverlay.remove()
    deactivateImg()
  }
})

document.getElementById('paste-btn').addEventListener('click', async () => {
  try {
    const items = await navigator.clipboard.read()
    for (const item of items) {
      for (const type of item.types) {
        if (type.startsWith('image/')) { applyImage(await item.getType(type)); return }
      }
    }
    showToast('No image found on the clipboard — press Ctrl+V to paste a screenshot', 'error')
  } catch {
    showToast('No image found on the clipboard — press Ctrl+V to paste a screenshot', 'error')
  }
})

// Drag an image file in from the file system
let dragCounter = 0
wrapper.addEventListener('dragenter', e => {
  e.preventDefault()
  dragCounter++
  wrapper.classList.add('drag-over')
})
wrapper.addEventListener('dragover', e => e.preventDefault())
wrapper.addEventListener('dragleave', () => {
  dragCounter = Math.max(0, dragCounter - 1)
  if (dragCounter === 0) wrapper.classList.remove('drag-over')
})
wrapper.addEventListener('drop', e => {
  e.preventDefault()
  dragCounter = 0
  wrapper.classList.remove('drag-over')
  const files = [...(e.dataTransfer?.files || [])].filter(f => f.type.startsWith('image/'))
  files.forEach(f => applyImage(f))
})

document.getElementById('clear-btn').addEventListener('click', () => {
  if (getOverlays().length) pushHistory()
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  wrapper.querySelectorAll('.img-overlay').forEach(o => o.remove())
  deactivateImg()
  hasContent = false
  hint.classList.remove('hidden')
  localRemove([AUTOSAVE_KEY])
})

// Builds "prefix-yymmdd-index.ext"; index resets daily and increments per download of that kind
async function nextDatedFilename(prefix, ext, kind) {
  const now = new Date()
  const dateStr = String(now.getFullYear()).slice(-2) +
    String(now.getMonth() + 1).padStart(2, '0') +
    String(now.getDate()).padStart(2, '0')
  const dateKey = `flashpaint-${kind}-date`
  const indexKey = `flashpaint-${kind}-index`
  const data = await syncGet([dateKey, indexKey])
  const index = data[dateKey] === dateStr ? (data[indexKey] || 0) + 1 : 1
  syncSet({ [dateKey]: dateStr, [indexKey]: index })
  return `${prefix}-${dateStr}-${index}.${ext}`
}

document.getElementById('download-btn').addEventListener('click', async () => {
  const a = document.createElement('a')
  a.download = await nextDatedFilename('myTab', 'png', 'download')
  const overlays = wrapper.querySelectorAll('.img-overlay')
  if (overlays.length) {
    const tmp = document.createElement('canvas')
    tmp.width = canvas.width
    tmp.height = canvas.height
    const tctx = tmp.getContext('2d')
    tctx.fillStyle = 'white'
    tctx.fillRect(0, 0, tmp.width, tmp.height)
    overlays.forEach(o => {
      tctx.globalAlpha = 1
      tctx.filter = 'none'
      applyShadow(tctx, 0)
      const img = o.querySelector('img')
      if (img) {
        const left = parseInt(o.style.left) || 0
        const top = parseInt(o.style.top) || 0
        const width = parseInt(o.style.width) || o.offsetWidth
        const height = parseInt(o.style.height) || o.offsetHeight
        const imgStyle = readImageStyle(o)
        tctx.globalAlpha = imgStyle.opacity
        tctx.filter = imageFilterCss(imgStyle.blur, imgStyle.shadow)
        tctx.drawImage(img, left, top, width, height)
        tctx.filter = 'none'
        if (imgStyle.strokeWidth > 0) {
          tctx.strokeStyle = imgStyle.color
          tctx.lineWidth = imgStyle.strokeWidth
          tctx.strokeRect(left + imgStyle.strokeWidth / 2, top + imgStyle.strokeWidth / 2, width - imgStyle.strokeWidth, height - imgStyle.strokeWidth)
        }
        return
      }
      const shapeCanvas = o.querySelector('canvas')
      if (shapeCanvas) {
        tctx.drawImage(shapeCanvas,
          parseInt(o.style.left) || 0,
          parseInt(o.style.top) || 0,
          parseInt(o.style.width) || o.offsetWidth,
          parseInt(o.style.height) || o.offsetHeight
        )
        return
      }
      const textEl = o.querySelector('.text-overlay-content')
      if (textEl) {
        const fontSize = parseFloat(textEl.style.fontSize) || 16
        const lineHeight = parseFloat(textEl.style.lineHeight) || fontSize * 1.2
        const align = textEl.style.textAlign || 'left'
        const padX = 2
        const left = (parseInt(o.style.left) || 0) + padX
        const boxWidth = (parseInt(o.style.width) || o.offsetWidth) - padX * 2
        const top = parseInt(o.style.top) || 0
        const textBlur = parseBlurPx(textEl.style.filter)
        const textShadow = parseTextShadowPx(textEl.style.textShadow)
        tctx.font = `${fontSize}px system-ui, sans-serif`
        tctx.fillStyle = textEl.style.color
        tctx.textBaseline = 'top'
        tctx.globalAlpha = textEl.style.opacity ? parseFloat(textEl.style.opacity) : 1
        tctx.filter = textBlur > 0 ? `blur(${textBlur}px)` : 'none'
        applyShadow(tctx, textShadow)
        const lines = textEl.textContent.split('\n')
        lines.forEach((line, i) => {
          const y = top + i * lineHeight
          const words = line.split(' ').filter(w => w.length)
          if (align === 'justify' && words.length > 1) {
            const wordWidths = words.map(w => tctx.measureText(w).width)
            const gap = (boxWidth - wordWidths.reduce((a, b) => a + b, 0)) / (words.length - 1)
            tctx.textAlign = 'left'
            let x = left
            words.forEach((w, wi) => { tctx.fillText(w, x, y); x += wordWidths[wi] + gap })
          } else if (align === 'center') {
            tctx.textAlign = 'center'
            tctx.fillText(line, left + boxWidth / 2, y)
          } else if (align === 'right') {
            tctx.textAlign = 'right'
            tctx.fillText(line, left + boxWidth, y)
          } else {
            tctx.textAlign = 'left'
            tctx.fillText(line, left, y)
          }
        })
      }
    })
    tctx.drawImage(canvas, 0, 0)
    a.href = tmp.toDataURL()
  } else {
    a.href = canvas.toDataURL()
  }
  a.click()
  showToast(`Exported ${a.download}`, 'success')
})

// Save/Open project — keeps every image, shape, and text as a fully editable object
// (unlike the PNG export, which is a flat, non-editable picture)
document.getElementById('save-project-btn').addEventListener('click', async () => {
  const snap = captureSnapshot()
  const blob = new Blob([JSON.stringify(snap)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = await nextDatedFilename('myTab-project', 'json', 'project')
  a.click()
  URL.revokeObjectURL(url)
  showToast(`Saved ${a.download}`, 'success')
})

const openProjectInput = document.getElementById('open-project-input')
document.getElementById('open-project-btn').addEventListener('click', () => openProjectInput.click())
openProjectInput.addEventListener('change', async e => {
  const file = e.target.files[0]
  e.target.value = ''
  if (!file) return
  try {
    const snap = JSON.parse(await file.text())
    if (!snap || !Array.isArray(snap.overlays)) throw new Error('invalid project file')
    pushHistory()
    restoreSnapshot(snap)
    showToast('Project loaded', 'success')
  } catch {
    showToast('Could not open this file — it doesn\'t look like a myTab project file.', 'error')
  }
})

document.getElementById('layer-front').addEventListener('click', bringToFront)
document.getElementById('layer-fwd').addEventListener('click', bringForward)
document.getElementById('layer-bwd').addEventListener('click', sendBackward)
document.getElementById('layer-back').addEventListener('click', sendToBack)

// Layer order — single trigger button; click opens a picker of one-shot actions
;(function () {
  const picker = document.getElementById('layer-order-picker')
  const showPicker = v => { picker.style.display = v ? 'flex' : 'none' }

  layerOrderBtn.addEventListener('click', () => { showPicker(picker.style.display === 'none') })

  picker.querySelectorAll('.shape-opt').forEach(opt => {
    opt.addEventListener('click', () => showPicker(false))
  })

  document.addEventListener('click', e => {
    if (picker.style.display !== 'none' && !picker.contains(e.target) && !layerOrderBtn.contains(e.target)) showPicker(false)
  })
})()

// File actions — single trigger button; click opens a menu of one-shot actions
;(function () {
  const btn = document.getElementById('file-menu-btn')
  const picker = document.getElementById('file-menu-picker')
  const showPicker = v => { picker.style.display = v ? 'flex' : 'none' }

  btn.addEventListener('click', () => { showPicker(picker.style.display === 'none') })

  picker.querySelectorAll('.file-menu-opt').forEach(opt => {
    opt.addEventListener('click', () => showPicker(false))
  })

  document.addEventListener('click', e => {
    if (picker.style.display !== 'none' && !picker.contains(e.target) && !btn.contains(e.target)) showPicker(false)
  })
})()

resizeCanvas()
// Initial tool is 'select': canvas is click-through so image can be clicked
canvas.style.pointerEvents = 'none'
canvas.style.cursor = 'default'

// Auto-save — periodically persists the current canvas so a session survives an accidental tab
// close/reload; uses chrome.storage.local (not sync) since pasted images easily exceed sync's
// small per-item quota. Restored once on load; cleared whenever the user explicitly hits Clear.
function localGet(keys) {
  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    return new Promise(resolve => chrome.storage.local.get(keys, resolve))
  }
  const result = {}
  keys.forEach(k => {
    const raw = localStorage.getItem(k)
    if (raw !== null) try { result[k] = JSON.parse(raw) } catch { result[k] = raw }
  })
  return Promise.resolve(result)
}
function localSet(data) {
  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    chrome.storage.local.set(data, () => {
      if (chrome.runtime.lastError) console.warn('autosave failed:', chrome.runtime.lastError.message)
    })
    return
  }
  Object.entries(data).forEach(([k, v]) => localStorage.setItem(k, JSON.stringify(v)))
}
function localRemove(keys) {
  if (typeof chrome !== 'undefined' && chrome.storage?.local) { chrome.storage.local.remove(keys); return }
  keys.forEach(k => localStorage.removeItem(k))
}

const AUTOSAVE_KEY = 'flashpaint-autosave'
let autosaveRestoring = false

function autosaveSession() {
  if (autosaveRestoring) return
  localSet({ [AUTOSAVE_KEY]: captureSnapshot() })
}

setInterval(() => { if (hasContent) autosaveSession() }, 4000)

localGet([AUTOSAVE_KEY]).then(data => {
  const snap = data[AUTOSAVE_KEY]
  if (snap && Array.isArray(snap.overlays) && snap.overlays.length) {
    autosaveRestoring = true
    restoreSnapshot(snap)
    hasContent = true
    hint.classList.add('hidden')
    autosaveRestoring = false
    showToast('Restored your previous session')
  }
})
