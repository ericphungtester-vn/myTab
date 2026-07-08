// Applied synchronously (blocking, before the rest of <body> parses) so there's no flash of the
// wrong theme — kept as its own tiny file since extension pages block inline <script> via CSP
try {
  if (localStorage.getItem('theme') === 'dark') document.documentElement.setAttribute('data-theme', 'dark')
} catch {}
