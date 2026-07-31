// ---- JSON Tool: pretty-print, minify, or validate JSON, with the parser's error message surfaced
// on failure. Pure and unit-tested; nothing above the wiring marker touches the DOM.

function jf_format(str, indent) {
  try {
    return { output: JSON.stringify(JSON.parse(str), null, indent === undefined ? 2 : indent) }
  } catch (e) {
    return { error: e.message }
  }
}

function jf_minify(str) {
  try {
    return { output: JSON.stringify(JSON.parse(str)) }
  } catch (e) {
    return { error: e.message }
  }
}

function jf_validate(str) {
  try {
    JSON.parse(str)
    return { valid: true }
  } catch (e) {
    return { valid: false, error: e.message }
  }
}

// ---- Wiring ----
;(function initJsonTool() {
  const inputEl = document.getElementById('jf-input')
  if (!inputEl) return

  const indentSeg = document.querySelector('.segmented[data-group="jf-indent"]')
  const formatBtn = document.getElementById('jf-format')
  const minifyBtn = document.getElementById('jf-minify')
  const errorEl = document.getElementById('jf-error')
  const outputEl = document.getElementById('jf-output')
  const copyBtn = document.getElementById('jf-copy')

  function setSegmented(seg, value) {
    seg.querySelectorAll('.seg-btn').forEach(b => b.classList.toggle('active', b.dataset.value === value))
  }
  function indentValue() {
    const v = indentSeg.querySelector('.seg-btn.active').dataset.value
    return v === 'tab' ? '\t' : Number(v)
  }

  function show(res) {
    if (res.error) {
      errorEl.textContent = res.error
      errorEl.hidden = false
      outputEl.value = ''
    } else {
      errorEl.hidden = true
      outputEl.value = res.output
    }
  }

  formatBtn.addEventListener('click', () => show(jf_format(inputEl.value, indentValue())))
  minifyBtn.addEventListener('click', () => show(jf_minify(inputEl.value)))
  indentSeg.addEventListener('click', e => {
    const btn = e.target.closest('.seg-btn')
    if (!btn) return
    setSegmented(indentSeg, btn.dataset.value)
    if (outputEl.value) show(jf_format(inputEl.value, indentValue()))
  })

  copyBtn.addEventListener('click', () => {
    if (!outputEl.value) return
    navigator.clipboard.writeText(outputEl.value).then(() => {
      copyBtn.classList.add('copied')
      setTimeout(() => copyBtn.classList.remove('copied'), 1200)
    })
  })

  document.getElementById('jf-reset-btn').addEventListener('click', () => {
    inputEl.value = ''
    outputEl.value = ''
    errorEl.hidden = true
    setSegmented(indentSeg, '2')
  })
})()
