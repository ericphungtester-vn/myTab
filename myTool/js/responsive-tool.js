// ---- Responsive Tool: a cheat-sheet for testing responsive layouts with Chrome's built-in Device
// Mode — no physical devices, no extra permissions. The step-by-step guide lives in popup.html; this
// file renders the device-viewport and breakpoint reference tables (with copy buttons). The data
// tables above the wiring marker are unit-tested.

// Common device viewports in CSS pixels (width x height, portrait) — the sizes you'd type into
// DevTools' Responsive mode. Values match Chrome DevTools' own device presets.
var RP_DEVICES = [
  { name: 'iPhone SE', type: 'Phone', w: 375, h: 667 },
  { name: 'iPhone 12/13/14', type: 'Phone', w: 390, h: 844 },
  { name: 'iPhone 14 Pro Max', type: 'Phone', w: 430, h: 932 },
  { name: 'Pixel 7', type: 'Phone', w: 412, h: 915 },
  { name: 'Galaxy S20', type: 'Phone', w: 360, h: 800 },
  { name: 'Galaxy S8+', type: 'Phone', w: 360, h: 740 },
  { name: 'iPad Mini', type: 'Tablet', w: 768, h: 1024 },
  { name: 'iPad Air', type: 'Tablet', w: 820, h: 1180 },
  { name: 'iPad Pro 11"', type: 'Tablet', w: 834, h: 1194 },
  { name: 'iPad Pro 12.9"', type: 'Tablet', w: 1024, h: 1366 },
  { name: 'Surface Pro 7', type: 'Tablet', w: 912, h: 1368 },
  { name: 'Laptop', type: 'Desktop', w: 1280, h: 800 },
  { name: 'Laptop L', type: 'Desktop', w: 1440, h: 900 },
  { name: 'Desktop 1080p', type: 'Desktop', w: 1920, h: 1080 }
]

// Default breakpoints of the two most common CSS frameworks (min-width, px).
var RP_BREAKPOINTS = [
  { framework: 'Tailwind CSS', items: [['sm', 640], ['md', 768], ['lg', 1024], ['xl', 1280], ['2xl', 1536]] },
  { framework: 'Bootstrap 5', items: [['sm', 576], ['md', 768], ['lg', 992], ['xl', 1200], ['xxl', 1400]] }
]

function rp_dims(d) { return d.w + ' × ' + d.h }

// ---- Wiring ----
;(function initResponsiveTool() {
  const devicesEl = document.getElementById('rp-devices')
  if (!devicesEl) return // Responsive tab not present in this build

  const bpEl = document.getElementById('rp-breakpoints')

  const COPY_ICON = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>'
  const CHECK_ICON = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>'

  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;') }

  const rows = RP_DEVICES.map(d =>
    '<tr><td>' + esc(d.name) + '</td><td>' + esc(d.type) + '</td><td class="rp-dim">' + esc(rp_dims(d)) + '</td>' +
    '<td><button type="button" class="rp-copy" data-copy="' + d.w + 'x' + d.h + '" title="Copy ' + d.w + 'x' + d.h + '" aria-label="Copy size">' + COPY_ICON + '</button></td></tr>'
  ).join('')
  devicesEl.innerHTML = '<table class="rp-table"><thead><tr><th>Device</th><th>Type</th><th>Viewport</th><th></th></tr></thead><tbody>' + rows + '</tbody></table>'

  bpEl.innerHTML = RP_BREAKPOINTS.map(f =>
    '<div class="rp-bp-row"><span class="rp-bp-fw">' + esc(f.framework) + '</span>' +
    f.items.map(it => '<button type="button" class="rp-bp-chip" data-copy="' + it[1] + '" title="Copy ' + it[1] + '">' + esc(it[0]) + ' <b>' + it[1] + '</b></button>').join('') +
    '</div>'
  ).join('')

  // One delegated copy handler for both tables.
  function onCopy(e) {
    const btn = e.target.closest('[data-copy]')
    if (!btn) return
    navigator.clipboard.writeText(btn.dataset.copy).then(() => {
      if (btn.classList.contains('rp-copy')) {
        btn.innerHTML = CHECK_ICON
        setTimeout(() => { btn.innerHTML = COPY_ICON }, 1200)
      } else {
        btn.classList.add('copied')
        setTimeout(() => btn.classList.remove('copied'), 1000)
      }
    })
  }
  devicesEl.addEventListener('click', onCopy)
  bpEl.addEventListener('click', onCopy)
})()
