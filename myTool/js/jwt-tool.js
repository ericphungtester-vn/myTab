// ---- JWT Tool: decodes a JSON Web Token's header and payload for inspection. It only DECODES —
// it does NOT verify the signature (that needs the secret/key), and it makes that explicit in the
// UI. The base64url decode + JSON parse is pure and unit-tested; nothing above the wiring marker
// touches the DOM.

const JWT_B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

function jwt_base64UrlToText(seg) {
  const b64 = seg.replace(/-/g, '+').replace(/_/g, '/')
  const lookup = {}
  for (let i = 0; i < JWT_B64.length; i++) lookup[JWT_B64[i]] = i
  const bytes = []
  for (let i = 0; i < b64.length; i += 4) {
    const c0 = lookup[b64[i]]
    const c1 = lookup[b64[i + 1]]
    if (c1 === undefined) break
    bytes.push((c0 << 2) | (c1 >> 4))
    const c2 = lookup[b64[i + 2]]
    if (c2 === undefined) break
    bytes.push(((c1 & 15) << 4) | (c2 >> 2))
    const c3 = lookup[b64[i + 3]]
    if (c3 === undefined) break
    bytes.push(((c2 & 3) << 6) | c3)
  }
  return new TextDecoder().decode(new Uint8Array(bytes))
}

// Decode a JWT into { header, payload, signature } or { error }. Signature is returned raw (base64url
// text) and is NOT verified.
function jwt_decode(token) {
  const parts = String(token).trim().split('.')
  if (parts.length < 2 || !parts[0] || !parts[1]) {
    return { error: 'Not a JWT — expected header.payload.signature.' }
  }
  let header, payload
  try { header = JSON.parse(jwt_base64UrlToText(parts[0])) } catch { return { error: 'Header is not valid base64url JSON.' } }
  try { payload = JSON.parse(jwt_base64UrlToText(parts[1])) } catch { return { error: 'Payload is not valid base64url JSON.' } }
  return { header, payload, signature: parts[2] || '' }
}

// Human-readable note for a unix-seconds claim (exp/iat/nbf), e.g. "1516239022 → 2018-01-18 01:30:22 UTC".
function jwt_formatClaimTime(seconds) {
  const d = new Date(seconds * 1000)
  const iso = d.toISOString().replace('T', ' ').replace(/\.\d+Z$/, ' UTC')
  return iso
}

// ---- Wiring ----
;(function initJwtTool() {
  const inputEl = document.getElementById('jw-input')
  if (!inputEl) return

  const decodeBtn = document.getElementById('jw-decode')
  const errorEl = document.getElementById('jw-error')
  const resultEl = document.getElementById('jw-result')
  const headerOut = document.getElementById('jw-header')
  const payloadOut = document.getElementById('jw-payload')
  const claimsEl = document.getElementById('jw-claims')

  function decode() {
    errorEl.hidden = true
    resultEl.hidden = true
    const token = inputEl.value.trim()
    if (!token) { errorEl.textContent = 'Paste a JWT to decode.'; errorEl.hidden = false; return }
    const res = jwt_decode(token)
    if (res.error) { errorEl.textContent = res.error; errorEl.hidden = false; return }

    headerOut.textContent = JSON.stringify(res.header, null, 2)
    payloadOut.textContent = JSON.stringify(res.payload, null, 2)

    const notes = []
    for (const claim of ['iat', 'nbf', 'exp']) {
      if (typeof res.payload[claim] === 'number') {
        const label = { iat: 'Issued', nbf: 'Not before', exp: 'Expires' }[claim]
        let line = `${label} (${claim}): ${jwt_formatClaimTime(res.payload[claim])}`
        if (claim === 'exp') line += res.payload.exp * 1000 < Date.now() ? ' — EXPIRED' : ' — valid'
        notes.push(line)
      }
    }
    claimsEl.textContent = notes.join('\n')
    claimsEl.hidden = notes.length === 0
    resultEl.hidden = false
  }

  decodeBtn.addEventListener('click', decode)

  document.getElementById('jw-reset-btn').addEventListener('click', () => {
    inputEl.value = ''
    resultEl.hidden = true
    errorEl.hidden = true
  })

  // Copy buttons for header / payload blocks
  resultEl.addEventListener('click', e => {
    const btn = e.target.closest('.jw-copy')
    if (!btn) return
    const target = document.getElementById(btn.dataset.target)
    navigator.clipboard.writeText(target.textContent).then(() => {
      btn.classList.add('copied')
      setTimeout(() => btn.classList.remove('copied'), 1200)
    })
  })
})()
