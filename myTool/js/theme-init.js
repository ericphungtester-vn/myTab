// Applied synchronously (blocking, before the rest of <body> parses) so there's no flash of the
// wrong theme — kept as its own tiny file since extension pages block inline <script> via CSP
try {
  if (localStorage.getItem('theme') === 'dark') document.documentElement.setAttribute('data-theme', 'dark')
  // Fill the surface when running inside Chrome's side panel (loaded as popup.html?panel=1) instead
  // of the fixed 560×480 popup box — applied here in <head> so there's no flash of the wrong size.
  if (new URLSearchParams(location.search).has('panel')) document.documentElement.classList.add('as-panel')
} catch {}
