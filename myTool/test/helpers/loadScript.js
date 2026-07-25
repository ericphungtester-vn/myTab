// myTool's tool scripts (js/file-tool.js, js/text-tool.js) are plain scripts meant to be loaded
// via <script> tags — everything above their "// ---- Wiring ----" marker is pure logic with no
// DOM dependency, and everything below it wires that logic up to `document`. This loads just the
// pure-logic portion into a sandboxed context so it can be unit-tested outside a browser.
const fs = require('fs')
const path = require('path')
const vm = require('vm')

function loadToolScript(relativePath) {
  const fullPath = path.join(__dirname, '..', '..', relativePath)
  let src = fs.readFileSync(fullPath, 'utf8')
  src = src.split('// ---- Wiring ----')[0]
  // Top-level const/let in a vm context create bindings in a separate lexical environment, not
  // as properties on the sandbox object the way var/function declarations do — rewrite so every
  // top-level binding is reachable as sandbox.<name> after the script runs.
  src = src.replace(/^const /gm, 'var ')

  const sandbox = {
    crypto: require('crypto').webcrypto,
    TextEncoder,
    TextDecoder,
    DataView,
    Uint8Array,
    Uint32Array,
    Array,
    Math,
    String,
    Date,
    console
  }
  vm.createContext(sandbox)
  vm.runInContext(src, sandbox, { filename: fullPath })
  return sandbox
}

module.exports = { loadToolScript }
