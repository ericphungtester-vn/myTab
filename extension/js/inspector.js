const TAB_LETTERS = { bookmarks: 'B', flashpaint: 'F', about: 'O' }
const SKIP = new Set(['HTML', 'BODY', 'HEAD', 'SCRIPT', 'STYLE', 'LINK', 'META', 'NOSCRIPT'])

window.inspectorActive = false

function getActiveTab() {
  return document.querySelector('.tab-btn.active')?.dataset.tab || 'bookmarks'
}

window.computeInspector = function () {
  const overlay = document.getElementById('inspector-overlay')
  overlay.innerHTML = ''
  if (!window.inspectorActive) return

  const header = document.getElementById('app-header')
  const pageLetter = TAB_LETTERS[getActiveTab()] || 'X'

  const els = Array.from(document.querySelectorAll('*')).filter(el => {
    if (SKIP.has(el.tagName)) return false
    if (el.closest('svg')) return false
    if (el === overlay || overlay.contains(el)) return false
    const r = el.getBoundingClientRect()
    return r.width >= 8 && r.height >= 8
  })

  let headerCount = 0
  let pageCount = 0
  const frag = document.createDocumentFragment()

  els.forEach(el => {
    const inHeader = header.contains(el)
    const r = el.getBoundingClientRect()
    const label = inHeader
      ? String.fromCharCode(64 + (++headerCount))
      : pageLetter + (++pageCount)

    const badge = document.createElement('span')
    badge.className = 'inspector-badge ' + (inHeader ? 'header-badge' : 'content-badge')
    badge.style.top = (r.top + window.scrollY) + 'px'
    badge.style.left = (r.left + window.scrollX) + 'px'
    badge.textContent = label
    frag.appendChild(badge)
  })

  overlay.appendChild(frag)
}

const btn = document.getElementById('inspector-btn')
btn.addEventListener('click', () => {
  window.inspectorActive = !window.inspectorActive
  btn.classList.toggle('active', window.inspectorActive)
  btn.innerHTML = '<span>#</span> ' + (window.inspectorActive ? 'Hide inspector' : 'Show inspector')
  window.computeInspector()
})

window.addEventListener('resize', () => { if (window.inspectorActive) window.computeInspector() })
window.addEventListener('scroll', () => { if (window.inspectorActive) window.computeInspector() }, true)
