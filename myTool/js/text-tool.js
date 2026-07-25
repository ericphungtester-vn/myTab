// ---- Word banks ----
// Classic lorem ipsum, split into its own words so it can be sampled to any length.
const LATIN_WORDS = ('lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor '
  + 'incididunt ut labore et dolore magna aliqua ut enim ad minim veniam quis nostrud exercitation '
  + 'ullamco laboris nisi ut aliquip ex ea commodo consequat duis aute irure dolor in reprehenderit '
  + 'voluptate velit esse cillum dolore eu fugiat nulla pariatur excepteur sint occaecat cupidatat '
  + 'non proident sunt in culpa qui officia deserunt mollit anim id est laborum').split(' ')

// Themeless bag of common Vietnamese words — filler text only, not meant to read as real prose.
const VI_WORDS = ('là một những và của trong có được này cho với không người để khi đã sẽ rất cũng '
  + 'như về đến từ nhiều các hay nên vì nếu mà còn sau trước trên dưới giữa ngoài bên mỗi tất cả chỉ '
  + 'chính thêm lại nữa hơn nhất cùng theo qua ra vào lên xuống đi làm việc thời gian cuộc sống con '
  + 'người xã hội phát triển thế giới hôm nay ngày mai câu chuyện vấn đề giải pháp ý tưởng chương '
  + 'trình kế hoạch công việc gia đình bạn bè trường học công ty sản phẩm dịch vụ khách hàng thị '
  + 'trường').split(' ')

// Themeless common-word banks for each language — filler text only, not real sentences.
const EN_WORDS = ('the a of and to in is that it for on with as was at by an be this have from or '
  + 'one had not but what all were when we there can your which their said if do will each about '
  + 'how up out them then she many some so these would other into has more her two like him see '
  + 'time could no make than first been its who now people my made over did down only way find '
  + 'use may water long little very after words called just where most know').split(' ')

const ES_WORDS = ('el la de que y a en un ser se no haber por con su para como estar tener le lo '
  + 'todo pero más hacer o poder decir este ir otro ese si me ya ver dar cuando él muy sin vez '
  + 'mucho saber qué manera tiempo así vida años días trabajo mundo casa persona parte').split(' ')

const FR_WORDS = ('le de un être et à il avoir ne je son que se qui ce dans en du elle au pour pas '
  + 'vous par sur faire plus dire nous comme mais on y avec tout aller voir bien où sans si quand '
  + 'cette lui temps très savoir vie an jour monde').split(' ')

const DE_WORDS = ('der die und in den von zu das mit sich des auf für ist im dem nicht ein eine als '
  + 'auch es an werden aus er hat dass sie nach wird bei einer war noch wenn nur oder aber mehr '
  + 'durch man sein wurde sehr zeit jahr tag mensch').split(' ')

const IT_WORDS = ('il di che e la in un a per non con è sono da come si le più al ma se lo suo o qui '
  + 'questo anche loro molto anni tempo casa vita mondo persona giorno lavoro cosa').split(' ')

const PT_WORDS = ('o de que e a em um para é com não uma os no se na por mais as dos como mas foi ao '
  + 'ele das tem à seu sua ou ser quando muito há nos já está eu também só pelo pela até isso vida '
  + 'ano dia mundo trabalho').split(' ')

// Chinese/Japanese are written without spaces between words — sampled words get concatenated
// directly (see LANG_CONFIG's `spaced: false`), same as normal running text in these languages.
const ZH_WORDS = ('一 二 三 人 大 小 是 的 了 在 有 我 你 他 她 们 这 那 也 就 都 和 但 因为 所以 时候 '
  + '地方 东西 什么 现在 以后 之前 世界 生活 工作 学习 朋友 家人 公司 产品 服务 客户 市场 问题 方法 '
  + '想法 计划 时间 今天 明天 昨天 一起 非常 可能 需要 知道 觉得').split(' ')

const JA_WORDS = ('の は が を に で と も こと もの これ それ あの その 私 あなた 彼 彼女 今日 明日 '
  + '昨日 時間 場所 仕事 生活 世界 会社 学校 友達 家族 問題 方法 計画 必要 可能 知る 思う 見る 行く '
  + '来る 大きい 小さい 新しい 古い とても 一緒に').split(' ')

// Korean is written with spaces between word units (어절), so it joins like the Latin-script
// languages above — it just has no letter case (see LANG_CONFIG's `hasCase: false`).
const KO_WORDS = ('이 그 저 것 수 등 년 때 일 그리고 하지만 그러나 사람 우리 나라 시간 문제 생각 사회 '
  + '자기 오늘 내일 어제 회사 학교 친구 가족 방법 계획 세계 생활 필요 가능 상황 정보 결과 이유 목적').split(' ')

// Non-Latin scripts, scoped to ones with enough native vocabulary I'm confident is accurate and
// genuinely common (not fabricated) — Cyrillic, Arabic, Greek, Hebrew, Devanagari, Thai. Other
// non-Latin scripts (Georgian, Armenian, Khmer, Lao, Sinhala, Tibetan, Mongolian, Amharic, Burmese,
// among others) are deliberately left out rather than risk a low-quality/incorrect word bank.
const RU_WORDS = ('и в не на я что быть с как а то все она так его но да ты к у же вы за бы по '
  + 'только мне было вот от меня еще нет о из теперь когда если или время жизнь мир люди работа '
  + 'день год город страна вопрос дело способ идея план').split(' ')

const AR_WORDS = ('في من على أن إلى عن هذا هذه ذلك التي الذي كان يكون هو هي نحن أنت أنا هم كل بعض '
  + 'شيء وقت مكان عمل حياة عالم بلد مشكلة فكرة خطة يوم شخص أشياء جديد كبير صغير').split(' ')

const EL_WORDS = ('και το της του να με για από τον την ένα είναι ότι στο στη πως όπως αυτό αυτή '
  + 'εγώ εσύ εμείς πολύ χρόνος κόσμος ζωή δουλειά ιδέα σχέδιο ημέρα άνθρωπος πράγμα καιρός').split(' ')

const HE_WORDS = ('את של על עם זה זאת הוא היא אני אתה אנחנו הם לא כן מה כל יש אין זמן חיים עולם '
  + 'עבודה יום דבר רעיון תוכנית מקום אדם').split(' ')

const HI_WORDS = ('और है का की को एक यह वह हम तुम मैं वे नहीं भी तो कि जो इस उस लोग समय काम जीवन '
  + 'दुनिया विचार योजना दिन बात जगह आदमी').split(' ')

// Thai is written without spaces between words within a sentence (like zh/ja), and casual text
// doesn't end sentences with punctuation the way Latin scripts do — see its empty `punctuation`.
const TH_WORDS = ('และ ที่ ใน เป็น มี ไม่ ได้ จะ ให้ กับ ของ นี้ นั้น คน เรา คุณ เขา เวลา งาน ชีวิต '
  + 'โลก ความคิด แผนการ วัน สถานที่ เรื่อง').split(' ')

// spaced: words join with a space (or none, for languages written without inter-word spaces).
// hasCase: whether capitalizing the first letter of a paragraph makes sense for this script.
// punctuation: sentence-final mark appended in word-count mode (word-count mode only — see
// generateParagraphs, character-count mode stays unpunctuated so the exact requested length holds).
const LANG_CONFIG = {
  en: { pool: EN_WORDS, spaced: true, hasCase: true, punctuation: '.' },
  vi: { pool: VI_WORDS, spaced: true, hasCase: true, punctuation: '.' },
  es: { pool: ES_WORDS, spaced: true, hasCase: true, punctuation: '.' },
  fr: { pool: FR_WORDS, spaced: true, hasCase: true, punctuation: '.' },
  de: { pool: DE_WORDS, spaced: true, hasCase: true, punctuation: '.' },
  it: { pool: IT_WORDS, spaced: true, hasCase: true, punctuation: '.' },
  pt: { pool: PT_WORDS, spaced: true, hasCase: true, punctuation: '.' },
  latin: { pool: LATIN_WORDS, spaced: true, hasCase: true, punctuation: '.' },
  zh: { pool: ZH_WORDS, spaced: false, hasCase: false, punctuation: '。' },
  ja: { pool: JA_WORDS, spaced: false, hasCase: false, punctuation: '。' },
  ko: { pool: KO_WORDS, spaced: true, hasCase: false, punctuation: '.' },
  ru: { pool: RU_WORDS, spaced: true, hasCase: true, punctuation: '.' },
  ar: { pool: AR_WORDS, spaced: true, hasCase: false, punctuation: '.' },
  el: { pool: EL_WORDS, spaced: true, hasCase: true, punctuation: '.' },
  he: { pool: HE_WORDS, spaced: true, hasCase: false, punctuation: '.' },
  hi: { pool: HI_WORDS, spaced: true, hasCase: false, punctuation: '।' },
  th: { pool: TH_WORDS, spaced: false, hasCase: false, punctuation: '' }
}

function sampleWord(pool) {
  return pool[Math.floor(Math.random() * pool.length)]
}

function buildWords(pool, count) {
  const arr = []
  for (let i = 0; i < count; i++) arr.push(sampleWord(pool))
  return arr
}

function joinWords(words, spaced) {
  return words.join(spaced ? ' ' : '')
}

// Builds a single string of whole words whose length is at least targetChars, then hard-truncates
// to exactly targetChars — no added punctuation that would push past the requested count.
function buildWordsToLength(pool, targetChars, spaced) {
  let text = ''
  while (text.length < targetChars) {
    const w = sampleWord(pool)
    text += (spaced && text) ? ' ' + w : w
  }
  return text.slice(0, targetChars)
}

function capitalize(str, hasCase) {
  if (!hasCase || !str) return str
  return str.charAt(0).toUpperCase() + str.slice(1)
}

// The trailing punctuation counts toward charCount too, so the paragraph (word text + mark)
// totals exactly charCount instead of charCount + punctuation.length.
function buildOneParagraph(cfg, charCount) {
  const textLen = Math.max(0, charCount - cfg.punctuation.length)
  const text = buildWordsToLength(cfg.pool, textLen, cfg.spaced)
  return capitalize(text, cfg.hasCase) + cfg.punctuation
}

const SENTENCE_MIN_WORDS = 6
const SENTENCE_MAX_WORDS = 14

function buildOneSentence(cfg) {
  const wordCount = SENTENCE_MIN_WORDS + Math.floor(Math.random() * (SENTENCE_MAX_WORDS - SENTENCE_MIN_WORDS + 1))
  const words = buildWords(cfg.pool, wordCount)
  return capitalize(joinWords(words, cfg.spaced), cfg.hasCase) + cfg.punctuation
}

// Unit is a single exclusive choice — Characters/Words produce one continuous piece measured
// exactly in that unit. Sentences produces `amount` sentences (each a random 6-14 words, with
// capitalization/punctuation) joined into one flowing piece — not one-per-paragraph. Paragraphs
// produces `amount` paragraphs, each independently built to `paraLength` characters.
function generateParagraphs({ lang, unit, amount, paraLength }) {
  const cfg = LANG_CONFIG[lang] || LANG_CONFIG.en
  amount = Math.max(1, parseInt(amount, 10) || 1)

  if (unit === 'paragraphs') {
    const length = Math.max(1, parseInt(paraLength, 10) || 25)
    const paras = []
    for (let i = 0; i < amount; i++) paras.push(buildOneParagraph(cfg, length))
    return paras
  }
  if (unit === 'sentences') {
    const sentences = []
    for (let i = 0; i < amount; i++) sentences.push(buildOneSentence(cfg))
    return [sentences.join(cfg.spaced ? ' ' : '')]
  }
  if (unit === 'words') {
    // Raw, like Characters mode — exactly the requested word count, no added capitalization or
    // trailing punctuation (that's only for Sentences/Paragraphs mode, where it reads as prose).
    return [joinWords(buildWords(cfg.pool, amount), cfg.spaced)]
  }
  return [buildWordsToLength(cfg.pool, amount, cfg.spaced)]
}

function joinParagraphs(paras, lineBreak) {
  return paras.join('\n'.repeat(lineBreak))
}

// Strings is unrelated to Language/LANG_CONFIG — a plain random-character generator (like a
// password tool), not lorem-style word text. Every character a standard keyboard can type
// directly: 26 upper, 26 lower, 10 digits, 32 symbols, plus space — 95 in total. `charEnabled`
// lets the user narrow each class down to a subset of its own characters (see the popover opened
// by clicking a class's text label); space has only one character, so it has no such subset.
const FULL_CHAR_CLASSES = {
  upper: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split(''),
  lower: 'abcdefghijklmnopqrstuvwxyz'.split(''),
  digits: '0123456789'.split(''),
  symbols: ['`', '~', '!', '@', '#', '$', '%', '^', '&', '*', '(', ')', '-', '_', '=', '+',
    '[', ']', '{', '}', '\\', '|', ';', ':', '\'', '"', ',', '.', '<', '>', '/', '?']
}

function activeStringClasses(classes, charEnabled) {
  return classes.filter(c => c === 'space' || (charEnabled[c] && charEnabled[c].length))
}

function poolForStringClass(cls, charEnabled) {
  if (cls === 'space') return [' ']
  return (charEnabled[cls] && charEnabled[cls].length) ? charEnabled[cls] : FULL_CHAR_CLASSES.lower
}

// Password-generator style: at least one class checked, and Amount must be able to fit one
// guaranteed character from every checked class. Returns an error string, or null if valid.
function validateStringSettings(amount, classes, charEnabled) {
  const active = activeStringClasses(classes, charEnabled)
  if (!active.length) return 'Select at least one character class.'
  amount = Math.max(1, parseInt(amount, 10) || 1)
  if (amount < active.length) {
    return `Amount must be at least ${active.length} to include one of each of the ${active.length} checked classes.`
  }
  return null
}

// Guarantees one character from every checked class first, fills the rest by picking a class per
// character (not a flattened pool — that would weight each class by its character count, so a
// 1-character class like Space would appear far more rarely than a 26-letter class even though
// both are "checked"), then shuffles so the guaranteed picks aren't stuck in a fixed order.
function generateRandomString(amount, classes, charEnabled) {
  amount = Math.max(1, parseInt(amount, 10) || 1)
  const active = activeStringClasses(classes, charEnabled)
  const activeClasses = active.length ? active : ['lower'] // safety net if called despite failing validation

  const chars = activeClasses.map(cls => {
    const pool = poolForStringClass(cls, charEnabled)
    return pool[Math.floor(Math.random() * pool.length)]
  })
  for (let i = chars.length; i < amount; i++) {
    const cls = activeClasses[Math.floor(Math.random() * activeClasses.length)]
    const pool = poolForStringClass(cls, charEnabled)
    chars.push(pool[Math.floor(Math.random() * pool.length)])
  }
  for (let i = chars.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[chars[i], chars[j]] = [chars[j], chars[i]]
  }
  return chars.slice(0, amount).join('')
}

// ---- Wiring ----
;(function initTextTool() {
  const langRow = document.getElementById('tt-lang-row')
  const langTrigger = document.getElementById('tt-lang-trigger')
  const langTriggerLabel = document.getElementById('tt-lang-trigger-label')
  const langPanel = document.getElementById('tt-lang-panel')
  let currentLang = 'en'
  const unitSeg = document.querySelector('.segmented[data-group="unit"]')
  const amountInput = document.getElementById('tt-amount')
  const paraLengthRow = document.getElementById('tt-para-length-row')
  const paraLengthInput = document.getElementById('tt-para-length')
  const linebreakRow = document.getElementById('tt-linebreak-row')
  const linebreakRadios = document.querySelectorAll('input[name="tt-linebreak"]')
  const charclassRow = document.getElementById('tt-charclass-row')
  const CHAR_CLASS_CHECKBOXES = {
    upper: document.getElementById('tt-class-upper'),
    lower: document.getElementById('tt-class-lower'),
    digits: document.getElementById('tt-class-digits'),
    symbols: document.getElementById('tt-class-symbols'),
    space: document.getElementById('tt-class-space')
  }
  const charlistPopover = document.getElementById('tt-charlist-popover')
  const charlistGrid = document.getElementById('tt-charlist-grid')
  let charEnabled = null // { upper: [...], lower: [...], digits: [...], symbols: [...] } — set by applySettings
  let openCharlistClass = null
  const generateBtn = document.getElementById('tt-generate')
  const output = document.getElementById('tt-output')
  const charCountEl = document.getElementById('tt-char-count')
  const wordCountEl = document.getElementById('tt-word-count')
  const sentenceCountEl = document.getElementById('tt-sentence-count')
  const paragraphCountEl = document.getElementById('tt-paragraph-count')
  const lineCountEl = document.getElementById('tt-line-count')
  const spaceCountEl = document.getElementById('tt-space-count')
  const countSpacesCheckbox = document.getElementById('tt-count-spaces')
  const copyBtn = document.getElementById('tt-copy')
  const resetBtn = document.getElementById('tt-reset-btn')
  const errorEl = document.getElementById('tt-error')

  const UNIT_DEFAULT_AMOUNT = { chars: 1, words: 1, sentences: 1, paragraphs: 2, strings: 16 }
  const DEFAULT_SETTINGS = {
    lang: 'en', unit: 'chars', amount: UNIT_DEFAULT_AMOUNT.chars, paraLength: 25, lineBreak: '2',
    charClasses: ['upper', 'lower', 'digits', 'symbols'], countSpaces: true
  }

  function setLang(value) {
    const opt = langPanel.querySelector(`.ft-select-option[data-value="${value}"]`)
    if (!opt) return
    currentLang = value
    langTriggerLabel.textContent = opt.textContent
    langPanel.querySelectorAll('.ft-select-option').forEach(o => o.classList.toggle('active', o === opt))
  }

  function openLangPanel() {
    langPanel.hidden = false
    const rect = langTrigger.getBoundingClientRect()
    langPanel.style.left = rect.left + 'px'
    langPanel.style.width = rect.width + 'px'
    langPanel.style.top = (rect.bottom + 4) + 'px'
    langPanel.style.maxHeight = Math.max(120, window.innerHeight - rect.bottom - 12) + 'px'
  }

  function closeLangPanel() {
    langPanel.hidden = true
  }

  langTrigger.addEventListener('click', () => {
    if (langPanel.hidden) openLangPanel()
    else closeLangPanel()
  })

  langPanel.addEventListener('click', e => {
    const opt = e.target.closest('.ft-select-option')
    if (!opt) return
    setLang(opt.dataset.value)
    closeLangPanel()
    saveSettings()
  })

  document.addEventListener('click', e => {
    if (!langPanel.hidden && !langPanel.contains(e.target) && !langTrigger.contains(e.target)) closeLangPanel()
  })

  function applySettings(settings) {
    setLang(settings.lang)
    setSegmented(unitSeg, settings.unit)
    amountInput.value = settings.amount
    paraLengthInput.value = settings.paraLength
    linebreakRadios.forEach(r => { r.checked = r.value === settings.lineBreak })
    Object.keys(CHAR_CLASS_CHECKBOXES).forEach(key => {
      CHAR_CLASS_CHECKBOXES[key].checked = settings.charClasses.includes(key)
    })
    countSpacesCheckbox.checked = settings.countSpaces
    // Cloned per class (never aliased to FULL_CHAR_CLASSES or a saved settings object) so toggling
    // a character in the popover can never mutate a shared/default array out from under a reset.
    const saved = settings.charEnabled || {}
    charEnabled = {
      upper: [...(saved.upper || FULL_CHAR_CLASSES.upper)],
      lower: [...(saved.lower || FULL_CHAR_CLASSES.lower)],
      digits: [...(saved.digits || FULL_CHAR_CLASSES.digits)],
      symbols: [...(saved.symbols || FULL_CHAR_CLASSES.symbols)]
    }
    updateUnitControlsVisibility()
  }

  function currentSettings() {
    return {
      lang: currentLang,
      unit: unitSeg.querySelector('.seg-btn.active').dataset.value,
      amount: amountInput.value,
      paraLength: paraLengthInput.value,
      lineBreak: document.querySelector('input[name="tt-linebreak"]:checked').value,
      charClasses: Object.keys(CHAR_CLASS_CHECKBOXES).filter(key => CHAR_CLASS_CHECKBOXES[key].checked),
      charEnabled,
      countSpaces: countSpacesCheckbox.checked
    }
  }

  function saveSettings() {
    syncSet({ 'text-tool-settings': currentSettings() })
  }

  function updateUnitControlsVisibility() {
    const unit = unitSeg.querySelector('.seg-btn.active').dataset.value
    const isParagraphs = unit === 'paragraphs'
    const isStrings = unit === 'strings'
    paraLengthRow.hidden = !isParagraphs
    linebreakRow.hidden = !isParagraphs
    charclassRow.hidden = !isStrings
    langRow.hidden = isStrings
  }

  // Sentence-ending marks include the ones our own generator uses (full-width 。！？ for zh/ja,
  // Hindi's ।) alongside the standard Latin ones, so counts stay meaningful for every language.
  function countSentences(text) {
    if (!text.trim()) return 0
    return text.split(/[.!?。！？।]+/).map(s => s.trim()).filter(Boolean).length
  }

  // Paragraphs are blocks separated by a blank line — matches the "Line break with blank line"
  // option; under "no blank line" every paragraph runs together and counts as one, same as a
  // reader skimming the raw text would see it.
  function countParagraphs(text) {
    if (!text.trim()) return 0
    const blankLineBlocks = text.split(/\n\s*\n/).map(s => s.trim()).filter(Boolean)
    if (blankLineBlocks.length > 1) return blankLineBlocks.length
    // No blank-line separators found — e.g. the "no blank line" Paragraphs option puts each
    // paragraph on its own line instead — so fall back to counting non-empty lines.
    return text.split('\n').map(s => s.trim()).filter(Boolean).length || 1
  }

  function countLines(text) {
    if (!text) return 0
    const newlines = (text.match(/\n/g) || []).length
    return text.endsWith('\n') ? newlines : newlines + 1
  }

  function updateCounts() {
    const text = output.value
    charCountEl.textContent = countSpacesCheckbox.checked ? text.length : text.replace(/\s/g, '').length
    const words = text.trim().split(/\s+/).filter(Boolean)
    wordCountEl.textContent = text.trim() ? words.length : 0
    sentenceCountEl.textContent = countSentences(text)
    paragraphCountEl.textContent = countParagraphs(text)
    lineCountEl.textContent = countLines(text)
    spaceCountEl.textContent = (text.match(/\s/g) || []).length
  }

  function generate() {
    const settings = currentSettings()
    if (settings.unit === 'strings') {
      const error = validateStringSettings(settings.amount, settings.charClasses, settings.charEnabled)
      if (error) {
        errorEl.textContent = error
        errorEl.hidden = false
        return
      }
      output.value = generateRandomString(settings.amount, settings.charClasses, settings.charEnabled)
    } else {
      const paras = generateParagraphs(settings)
      output.value = joinParagraphs(paras, parseInt(settings.lineBreak, 10) || 1)
    }
    errorEl.hidden = true
    updateCounts()
    saveSettings()
  }

  function setSegmented(seg, value) {
    seg.querySelectorAll('.seg-btn').forEach(b => b.classList.toggle('active', b.dataset.value === value))
  }

  unitSeg.addEventListener('click', e => {
    const btn = e.target.closest('.seg-btn')
    if (!btn) return
    setSegmented(unitSeg, btn.dataset.value)
    amountInput.value = UNIT_DEFAULT_AMOUNT[btn.dataset.value]
    updateUnitControlsVisibility()
    // Regenerate immediately — otherwise the box keeps showing output from the previous unit
    // (e.g. a random string left over after switching to Words), which reads as a stale mismatch.
    generate()
  })

  linebreakRadios.forEach(r => r.addEventListener('change', saveSettings))
  Object.values(CHAR_CLASS_CHECKBOXES).forEach(cb => cb.addEventListener('change', saveSettings))

  function renderCharlistGrid(cls) {
    charlistGrid.innerHTML = ''
    FULL_CHAR_CLASSES[cls].forEach(ch => {
      const item = document.createElement('div')
      item.className = 'tt-charlist-item' + (charEnabled[cls].includes(ch) ? ' checked' : '')
      item.textContent = ch
      item.dataset.char = ch
      charlistGrid.appendChild(item)
    })
  }

  function openCharlistPopover(trigger, cls) {
    openCharlistClass = cls
    renderCharlistGrid(cls)
    charlistPopover.hidden = false
    const rect = trigger.getBoundingClientRect()
    const left = Math.min(rect.left, window.innerWidth - charlistPopover.offsetWidth - 8)
    charlistPopover.style.left = Math.max(8, left) + 'px'
    charlistPopover.style.top = (rect.bottom + 6) + 'px'
  }

  function closeCharlistPopover() {
    charlistPopover.hidden = true
    openCharlistClass = null
  }

  document.querySelectorAll('.tt-charlist-trigger').forEach(trigger => {
    trigger.addEventListener('click', e => {
      e.preventDefault() // stops the parent <label> from also toggling its checkbox
      e.stopPropagation()
      const cls = trigger.dataset.class
      if (openCharlistClass === cls && !charlistPopover.hidden) closeCharlistPopover()
      else openCharlistPopover(trigger, cls)
    })
  })

  charlistGrid.addEventListener('click', e => {
    const item = e.target.closest('.tt-charlist-item')
    if (!item || !openCharlistClass) return
    const ch = item.dataset.char
    const list = charEnabled[openCharlistClass]
    const idx = list.indexOf(ch)
    if (idx >= 0) list.splice(idx, 1)
    else list.push(ch)
    item.classList.toggle('checked')
    saveSettings()
  })

  document.addEventListener('click', e => {
    if (!charlistPopover.hidden && !charlistPopover.contains(e.target) && !e.target.closest('.tt-charlist-trigger')) {
      closeCharlistPopover()
    }
  })

  amountInput.addEventListener('change', saveSettings)
  paraLengthInput.addEventListener('change', saveSettings)

  generateBtn.addEventListener('click', generate)
  output.addEventListener('input', updateCounts)
  countSpacesCheckbox.addEventListener('change', () => {
    updateCounts()
    saveSettings()
  })

  const COPY_ICON = copyBtn.innerHTML
  const CHECK_ICON = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>'

  copyBtn.addEventListener('click', () => {
    if (!output.value) return
    navigator.clipboard.writeText(output.value).then(() => {
      copyBtn.innerHTML = CHECK_ICON
      copyBtn.classList.add('copied')
      copyBtn.title = 'Copied!'
      setTimeout(() => {
        copyBtn.innerHTML = COPY_ICON
        copyBtn.classList.remove('copied')
        copyBtn.title = 'Copy to clipboard'
      }, 1400)
    })
  })

  resetBtn.addEventListener('click', () => {
    applySettings(DEFAULT_SETTINGS)
    generate()
  })

  // Restore last-used settings, then generate an initial sample
  syncGet(['text-tool-settings']).then(({ 'text-tool-settings': saved }) => {
    applySettings(saved ? { ...DEFAULT_SETTINGS, ...saved } : DEFAULT_SETTINGS)
    generate()
  })
})()
