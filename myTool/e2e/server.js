// Tiny static file server for the myTool popup, so Playwright can drive the real popup.html + tool
// scripts over http://localhost (no Chrome-extension-ID plumbing needed). chrome.storage.sync is
// absent here, so main.js's localStorage fallback kicks in — which the persistence tests rely on.
const http = require('http')
const fs = require('fs')
const path = require('path')

const ROOT = path.join(__dirname, '..')
const PORT = process.env.PORT || 5178
const TYPES = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.ico': 'image/x-icon'
}

http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0])
  if (p === '/') p = '/popup.html'
  const fp = path.join(ROOT, p)
  if (!fp.startsWith(ROOT)) { res.writeHead(403); res.end('forbidden'); return }
  fs.readFile(fp, (err, data) => {
    if (err) { res.writeHead(404); res.end('not found'); return }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(fp)] || 'application/octet-stream' })
    res.end(data)
  })
}).listen(PORT, () => console.log('myTool static server on http://localhost:' + PORT))
