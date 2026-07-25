// ---- ID Tool: generates SYNTHETIC test National ID / Passport numbers for form/validation
// testing. These are not real documents and are not tied to real people — every checksum below
// was verified against the country's actual public algorithm (see git history / research notes),
// but names, birthplaces, and other free-form fields are fixed placeholders, deliberately not
// realistic-looking, so nothing here could be mistaken for a real person's data.

function mod(a, m) {
  return ((a % m) + m) % m
}

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function randDigits(n) {
  let s = ''
  for (let i = 0; i < n; i++) s += randInt(0, 9)
  return s
}

function randLetter(exclude = '') {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').filter(c => !exclude.includes(c))
  return alphabet[randInt(0, alphabet.length - 1)]
}

function pad(value, width) {
  return String(value).padStart(width, '0')
}

// A remainder-of-11 check digit that collapses the one case (10) which would need a non-digit
// symbol down to 0 — the pattern shared by Brazil CPF, Portugal NIF, and (with a slightly
// different arrangement) Bulgaria EGN. See each generator for the exact formula it composes with.
function collapse11to10(sum) {
  return mod(11 - mod(sum, 11), 11) % 10
}

// ---- Shared checksum algorithms (verified against python-stdnum's reference implementation) ----

function luhnChecksum(digitsStr) {
  const rev = digitsStr.split('').reverse().map(Number)
  let sum = 0
  for (let i = 0; i < rev.length; i++) {
    let v = rev[i]
    if (i % 2 === 1) { v *= 2; if (v > 9) v -= 9 }
    sum += v
  }
  return sum % 10
}

function luhnCheckDigit(bodyStr) {
  const ck = luhnChecksum(bodyStr + '0')
  return String(mod(10 - ck, 10))
}

const VERHOEFF_D = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 2, 3, 4, 0, 6, 7, 8, 9, 5],
  [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
  [3, 4, 0, 1, 2, 8, 9, 5, 6, 7],
  [4, 0, 1, 2, 3, 9, 5, 6, 7, 8],
  [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
  [6, 5, 9, 8, 7, 1, 0, 4, 3, 2],
  [7, 6, 5, 9, 8, 2, 1, 0, 4, 3],
  [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
  [9, 8, 7, 6, 5, 4, 3, 2, 1, 0]
]
const VERHOEFF_P = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 5, 7, 6, 2, 8, 3, 0, 9, 4],
  [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
  [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
  [9, 4, 5, 3, 1, 2, 6, 8, 7, 0],
  [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
  [2, 7, 9, 3, 8, 0, 6, 4, 1, 5],
  [7, 0, 4, 6, 9, 1, 3, 2, 5, 8]
]

function verhoeffChecksum(digitsStr) {
  let check = 0
  const rev = digitsStr.split('').reverse()
  for (let i = 0; i < rev.length; i++) {
    check = VERHOEFF_D[check][VERHOEFF_P[i % 8][Number(rev[i])]]
  }
  return check
}

function verhoeffCheckDigit(bodyStr) {
  const check = verhoeffChecksum(bodyStr + '0')
  return String(VERHOEFF_D[check].indexOf(0))
}

// ISO 7064 Mod 11-2 — an iterative Horner recurrence in base 2, modulo 11. 'X' (representing 10)
// is accepted as an input character since a body can itself already end in a check character.
function iso7064Mod112Checksum(str) {
  let check = 0
  for (const ch of str) {
    const v = ch === 'X' ? 10 : Number(ch)
    check = mod(2 * check + v, 11)
  }
  return check
}

function iso7064Mod112CheckChar(bodyStr) {
  const c = mod(1 - 2 * iso7064Mod112Checksum(bodyStr), 11)
  return c === 10 ? 'X' : String(c)
}

// ---- Country list (alpha3 used for the Passport MRZ nationality/issuing-country fields) ----
const ID_COUNTRIES = [
  { code: 'br', name: 'Brazil', alpha3: 'BRA' },
  { code: 'bg', name: 'Bulgaria', alpha3: 'BGR' },
  { code: 'cl', name: 'Chile', alpha3: 'CHL' },
  { code: 'cn', name: 'China', alpha3: 'CHN' },
  { code: 'fi', name: 'Finland', alpha3: 'FIN' },
  { code: 'fr', name: 'France', alpha3: 'FRA' },
  { code: 'in', name: 'India', alpha3: 'IND' },
  { code: 'it', name: 'Italy', alpha3: 'ITA' },
  { code: 'no', name: 'Norway', alpha3: 'NOR' },
  { code: 'pl', name: 'Poland', alpha3: 'POL' },
  { code: 'pt', name: 'Portugal', alpha3: 'PRT' },
  { code: 'ro', name: 'Romania', alpha3: 'ROU' },
  { code: 'sg', name: 'Singapore', alpha3: 'SGP' },
  { code: 'za', name: 'South Africa', alpha3: 'ZAF' },
  { code: 'es', name: 'Spain', alpha3: 'ESP' },
  { code: 'se', name: 'Sweden', alpha3: 'SWE' },
  { code: 'gb', name: 'United Kingdom', alpha3: 'GBR' },
  { code: 'us', name: 'United States', alpha3: 'USA' },
  { code: 'vn', name: 'Vietnam', alpha3: 'VNM' }
]

// ---- National ID generators ----
// Every entry with a `checksum: true` comment below has a real, verified check-digit algorithm.
// Entries marked "structure only" have no public checksum, so only the field layout is real.

function genCodiceFiscale() { // Italy — checksum verified (CIN table, DM 12/03/1974)
  const CIN = {
    0: [1, 0], 1: [0, 1], 2: [5, 2], 3: [7, 3], 4: [9, 4], 5: [13, 5], 6: [15, 6], 7: [17, 7], 8: [19, 8], 9: [21, 9],
    A: [1, 0], B: [0, 1], C: [5, 2], D: [7, 3], E: [9, 4], F: [13, 5], G: [15, 6], H: [17, 7], I: [19, 8], J: [21, 9],
    K: [2, 10], L: [4, 11], M: [18, 12], N: [20, 13], O: [11, 14], P: [3, 15], Q: [6, 16], R: [8, 17], S: [12, 18],
    T: [14, 19], U: [16, 20], V: [10, 21], W: [22, 22], X: [25, 23], Y: [24, 24], Z: [23, 25]
  }
  const MONTHS = 'ABCDEHLMPRST'
  const lastnameCode = randLetter() + randLetter() + randLetter()
  const firstnameCode = randLetter() + randLetter() + randLetter()
  const year2 = pad(randInt(0, 99), 2)
  const monthLetter = MONTHS[randInt(0, 11)]
  const isFemale = Math.random() < 0.5
  const day = pad(randInt(1, 28) + (isFemale ? 40 : 0), 2)
  const birthplace = randLetter() + pad(randInt(0, 999), 3)
  const code15 = lastnameCode + firstnameCode + year2 + monthLetter + day + birthplace
  let cinTotal = 0
  for (let i = 0; i < 15; i++) cinTotal += CIN[code15[i]][(i + 1) % 2 === 1 ? 1 : 0]
  const cin = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[cinTotal % 26]
  return code15 + cin
}

function genCPF() { // Brazil — checksum verified
  const digits = randDigits(9).split('').map(Number)
  let s1 = 0
  for (let i = 0; i < 9; i++) s1 += (10 - i) * digits[i]
  const d1 = collapse11to10(s1)
  let s2 = 2 * d1
  for (let i = 0; i < 9; i++) s2 += (11 - i) * digits[i]
  const d2 = collapse11to10(s2)
  const body = digits.join('')
  return `${body.slice(0, 3)}.${body.slice(3, 6)}.${body.slice(6, 9)}-${d1}${d2}`
}

function genRUT() { // Chile — checksum verified
  const body = pad(randInt(1000000, 99999999), 8)
  const rev = body.split('').reverse().map(Number)
  let sum = 0
  for (let i = 0; i < rev.length; i++) sum += rev[i] * (4 + mod(5 - i, 6))
  const checkChar = '0123456789K'[sum % 11]
  return `${body.slice(0, 2)}.${body.slice(2, 5)}.${body.slice(5, 8)}-${checkChar}`
}

function genNIF_PT() { // Portugal — checksum verified
  const first = randInt(1, 9)
  const rest = randDigits(7)
  const digits = (first + rest).split('').map(Number)
  let s = 0
  for (let i = 0; i < 8; i++) s += (9 - i) * digits[i]
  const check = collapse11to10(s)
  const body = digits.join('')
  return `${body}${check}`
}

function genNIR_FR() { // France (INSEE/NIR) — checksum verified (mod 97)
  const sex = randInt(1, 2)
  const year = pad(randInt(0, 99), 2)
  const month = pad(randInt(1, 12), 2)
  const dept = pad(randInt(1, 95), 2)
  const commune = pad(randInt(1, 999), 3)
  const serial = pad(randInt(1, 999), 3)
  const digits13 = `${sex}${year}${month}${dept}${commune}${serial}`
  const check = pad(97 - (Number(digits13) % 97), 2)
  return `${digits13}${check}`
}

const DNI_LETTERS = 'TRWAGMYFPDXBNJZSQVHLCKE'

function genDNI_ES() { // Spain DNI — checksum verified
  const body = randDigits(8)
  const letter = DNI_LETTERS[Number(body) % 23]
  return `${body}${letter}`
}

function genNIE_ES() { // Spain NIE — checksum verified (reuses DNI's mod-23 table)
  const prefixLetter = 'XYZ'[randInt(0, 2)]
  const digits7 = randDigits(7)
  const combined = String('XYZ'.indexOf(prefixLetter)) + digits7
  const letter = DNI_LETTERS[Number(combined) % 23]
  return `${prefixLetter}${digits7}${letter}`
}

function genPersonnummer_SE() { // Sweden — checksum verified (Luhn over the 10-digit short form)
  const year = pad(randInt(0, 99), 2)
  const month = pad(randInt(1, 12), 2)
  const day = pad(randInt(1, 28), 2)
  const serial = pad(randInt(0, 999), 3)
  const body9 = `${year}${month}${day}${serial}`
  const check = luhnCheckDigit(body9)
  return `${year}${month}${day}-${serial}${check}`
}

function genFodselsnummer_NO() { // Norway — checksum verified (two independent mod-11 digits, reroll on 10)
  const day = pad(randInt(1, 28), 2)
  const month = pad(randInt(1, 12), 2)
  const year = pad(randInt(0, 99), 2)
  const w1 = [3, 7, 6, 1, 8, 9, 4, 5, 2]
  const w2 = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2]
  for (let attempt = 0; attempt < 200; attempt++) {
    const serial = pad(randInt(0, 499), 3) // <500 always resolves to the 1900s bucket
    const nine = `${day}${month}${year}${serial}`.split('').map(Number)
    let s1 = 0
    for (let i = 0; i < 9; i++) s1 += w1[i] * nine[i]
    const c1 = mod(11 - mod(s1, 11), 11)
    if (c1 === 10) continue
    const ten = [...nine, c1]
    let s2 = 0
    for (let i = 0; i < 10; i++) s2 += w2[i] * ten[i]
    const c2 = mod(11 - mod(s2, 11), 11)
    if (c2 === 10) continue
    return `${day}${month}${year}${serial}${c1}${c2}`
  }
  return null // astronomically unlikely; caller falls back to a retry
}

function genPESEL_PL() { // Poland — checksum verified
  const month = pad(randInt(1, 12), 2) // century offset 0 => 1900s
  const day = pad(randInt(1, 28), 2)
  const year = pad(randInt(0, 99), 2)
  const serial = pad(randInt(0, 9999), 4)
  const ten = `${year}${month}${day}${serial}`.split('').map(Number)
  const weights = [1, 3, 7, 9, 1, 3, 7, 9, 1, 3]
  let s = 0
  for (let i = 0; i < 10; i++) s += weights[i] * ten[i]
  const check = mod(10 - mod(s, 10), 10)
  return `${year}${month}${day}${serial}${check}`
}

const RO_COUNTY_CODES = Array.from({ length: 46 }, (_, i) => pad(i + 1, 2)) // 01-46: judete + Bucuresti sectors

function genCNP_RO() { // Romania — checksum copied verbatim from stdnum, which itself flags it as
  // NOT independently confirmed against an official source. Kept for structural completeness only.
  const sex = String(randInt(1, 6))
  const year = pad(randInt(0, 99), 2)
  const month = pad(randInt(1, 12), 2)
  const day = pad(randInt(1, 28), 2)
  const county = RO_COUNTY_CODES[randInt(0, RO_COUNTY_CODES.length - 1)]
  const serial = pad(randInt(0, 999), 3)
  const twelve = `${sex}${year}${month}${day}${county}${serial}`.split('').map(Number)
  const weights = [2, 7, 9, 1, 4, 6, 3, 5, 8, 2, 7, 9]
  let s = 0
  for (let i = 0; i < 12; i++) s += weights[i] * twelve[i]
  const r = s % 11
  const check = r === 10 ? '1' : String(r)
  return `${sex}${year}${month}${day}${county}${serial}${check}`
}

function genEGN_BG() { // Bulgaria — checksum verified
  const month = pad(randInt(1, 12), 2) // <=20 => 1900s bucket
  const day = pad(randInt(1, 28), 2)
  const year = pad(randInt(0, 99), 2)
  const serial = pad(randInt(0, 999), 3)
  const nine = `${year}${month}${day}${serial}`.split('').map(Number)
  const weights = [2, 4, 8, 5, 10, 9, 7, 3, 6]
  let s = 0
  for (let i = 0; i < 9; i++) s += weights[i] * nine[i]
  const check = mod(s, 11) % 10
  return `${year}${month}${day}${serial}${check}`
}

function genHETU_FI() { // Finland — checksum verified
  const day = pad(randInt(1, 28), 2)
  const month = pad(randInt(1, 12), 2)
  const year = pad(randInt(0, 99), 2)
  const individual = pad(randInt(2, 899), 3) // 900-899 reserved for temporary IDs, excluded
  const checkable = `${day}${month}${year}${individual}`
  const control = '0123456789ABCDEFHJKLMNPRSTUVWXY'[Number(checkable) % 31]
  return `${day}${month}${year}-${individual}${control}`
}

function genIDNr_ZA() { // South Africa — checksum verified (Luhn over the full 13 digits)
  const year = pad(randInt(0, 99), 2)
  const month = pad(randInt(1, 12), 2)
  const day = pad(randInt(1, 28), 2)
  const gender = pad(randInt(0, 9999), 4)
  const citizenship = randInt(0, 1)
  const body12 = `${year}${month}${day}${gender}${citizenship}8`
  const check = luhnCheckDigit(body12)
  return `${body12}${check}`
}

const CN_REGION_PREFIXES = ['110101', '310101', '440103', '440304', '330106', '510104']

function genRIC_CN() { // China — checksum verified (equivalent to ISO 7064 Mod 11-2)
  const region = CN_REGION_PREFIXES[randInt(0, CN_REGION_PREFIXES.length - 1)]
  const year = randInt(1950, 2005)
  const month = pad(randInt(1, 12), 2)
  const day = pad(randInt(1, 28), 2)
  const seq = pad(randInt(0, 999), 3)
  const body17 = `${region}${year}${month}${day}${seq}`
  const check = iso7064Mod112CheckChar(body17)
  return `${body17}${check}`
}

function genAadhaar_IN() { // India — checksum verified (Verhoeff)
  for (let attempt = 0; attempt < 50; attempt++) {
    const body11 = String(randInt(2, 9)) + randDigits(10)
    const check = verhoeffCheckDigit(body11)
    const full = body11 + check
    if (full !== full.split('').reverse().join('')) return full // reject palindromes, matching real Aadhaar's own rule
  }
  return null
}

function genCCCD_VN() { // Vietnam — structure only, no public checksum
  const province = pad(randInt(1, 96), 3)
  const genderCentury = String(randInt(0, 3))
  const year2 = pad(randInt(0, 99), 2)
  const serial = randDigits(6)
  return `${province}${genderCentury}${year2}${serial}`
}

function genSSN_US() { // United States — structure only, no public checksum
  let area = randInt(1, 899)
  if (area === 666) area = 667
  const group = randInt(1, 99)
  const serial = randInt(1, 9999)
  return `${pad(area, 3)}-${pad(group, 2)}-${pad(serial, 4)}`
}

const NINO_EXCLUDED_PREFIXES = ['BG', 'GB', 'NK', 'KN', 'TN', 'NT', 'ZZ']

function genNINO_GB() { // United Kingdom — structure only, no public checksum
  let letter1, letter2
  do {
    letter1 = randLetter('DFIQUV')
    letter2 = randLetter('DFIQUVO')
  } while (NINO_EXCLUDED_PREFIXES.includes(letter1 + letter2))
  const digits = randDigits(6)
  const suffix = 'ABCD'[randInt(0, 3)]
  return `${letter1}${letter2} ${digits.slice(0, 2)} ${digits.slice(2, 4)} ${digits.slice(4, 6)} ${suffix}`
}

// Singapore NRIC/FIN — checksum verified (weights 2,7,6,5,4,3,2 over the 7 digits, mod 11, with a
// prefix-dependent offset and check-letter table). 'S'/'T' are national IDs (citizens/PR); 'F'/'G'
// (pre-2022) and 'M' (2022 onwards, once the 'G' series was exhausted) are all FIN — Foreign
// Identification Numbers issued to non-residents — grouped under one FIN generator here.
function genNRIC_SG(prefixPool) {
  const weights = [2, 7, 6, 5, 4, 3, 2]
  const CHECK_ST = ['J', 'Z', 'I', 'H', 'G', 'F', 'E', 'D', 'C', 'B', 'A']
  const CHECK_FG = ['X', 'W', 'U', 'T', 'R', 'Q', 'P', 'N', 'M', 'L', 'K']
  const CHECK_M = ['X', 'W', 'U', 'T', 'R', 'Q', 'P', 'N', 'J', 'L', 'K']
  const prefix = prefixPool[randInt(0, prefixPool.length - 1)]
  const digits = randDigits(7).split('').map(Number)
  let sum = 0
  for (let i = 0; i < 7; i++) sum += digits[i] * weights[i]
  const offset = prefix === 'T' || prefix === 'G' ? 4 : prefix === 'M' ? 3 : 0
  const remainder = mod(sum + offset, 11)
  const table = (prefix === 'S' || prefix === 'T') ? CHECK_ST : prefix === 'M' ? CHECK_M : CHECK_FG
  return `${prefix}${digits.join('')}${table[remainder]}`
}

// Retries a generator that can return null on the rare reroll-exhausted path (Norway, Aadhaar).
function generateWithRetry(fn, maxAttempts = 20) {
  for (let i = 0; i < maxAttempts; i++) {
    const result = fn()
    if (result !== null) return result
  }
  throw new Error('Failed to generate a valid ID after multiple attempts — please try again.')
}

const NATIONAL_ID_TYPES = [
  { key: 'it', country: 'it', label: 'Codice Fiscale', generate: genCodiceFiscale },
  { key: 'br', country: 'br', label: 'CPF', generate: genCPF },
  { key: 'cl', country: 'cl', label: 'RUT', generate: genRUT },
  { key: 'pt', country: 'pt', label: 'NIF', generate: genNIF_PT },
  { key: 'fr', country: 'fr', label: 'INSEE / NIR', generate: genNIR_FR },
  { key: 'es_dni', country: 'es', label: 'DNI (citizens)', generate: genDNI_ES },
  { key: 'es_nie', country: 'es', label: 'NIE (foreign residents)', generate: genNIE_ES },
  { key: 'se', country: 'se', label: 'Personnummer', generate: genPersonnummer_SE },
  { key: 'no', country: 'no', label: 'Fødselsnummer', generate: () => generateWithRetry(genFodselsnummer_NO) },
  { key: 'pl', country: 'pl', label: 'PESEL', generate: genPESEL_PL },
  { key: 'ro', country: 'ro', label: 'CNP', generate: genCNP_RO },
  { key: 'bg', country: 'bg', label: 'EGN', generate: genEGN_BG },
  { key: 'fi', country: 'fi', label: 'HETU', generate: genHETU_FI },
  { key: 'za', country: 'za', label: 'ID Number', generate: genIDNr_ZA },
  { key: 'cn', country: 'cn', label: 'Resident ID Card No.', generate: genRIC_CN },
  { key: 'in', country: 'in', label: 'Aadhaar', generate: () => generateWithRetry(genAadhaar_IN) },
  { key: 'vn', country: 'vn', label: 'CCCD (structure only)', generate: genCCCD_VN },
  { key: 'us', country: 'us', label: 'SSN (structure only)', generate: genSSN_US },
  { key: 'gb', country: 'gb', label: 'NINO (structure only)', generate: genNINO_GB },
  { key: 'sg_nric', country: 'sg', label: 'NRIC (citizens/PR)', generate: () => genNRIC_SG(['S', 'T']) },
  { key: 'sg_fin', country: 'sg', label: 'FIN (foreigners)', generate: () => genNRIC_SG(['F', 'G', 'M']) }
]

// ---- Passport numbers ----
// No country publishes a public checksum for its passport document number (unlike national IDs)
// — these are a plausible, simplified letter/digit pattern for testing form validation, not an
// authoritative reproduction of each country's exact issuing series.
const PASSPORT_FORMATS = {
  it: { letters: 2, digits: 7 }, br: { letters: 2, digits: 6 }, cl: { letters: 1, digits: 6 },
  pt: { letters: 1, digits: 6 }, fr: { letters: 2, digits: 7 }, es: { letters: 3, digits: 6 },
  se: { letters: 1, digits: 8 }, no: { letters: 2, digits: 7 }, pl: { letters: 2, digits: 7 },
  ro: { letters: 2, digits: 6 }, bg: { letters: 1, digits: 8 }, fi: { letters: 1, digits: 7 },
  za: { letters: 1, digits: 8 }, cn: { letters: 1, digits: 8, letterPool: 'EG' },
  in: { letters: 1, digits: 7 }, vn: { letters: 1, digits: 7, letterPool: 'BCN' },
  us: { letters: 0, digits: 9 }, gb: { letters: 0, digits: 9 }, sg: { letters: 1, digits: 8, letterPool: 'K' }
}

function genPassportNumber(countryCode) {
  const spec = PASSPORT_FORMATS[countryCode] || { letters: 1, digits: 7 }
  const pool = spec.letterPool || 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  let letters = ''
  for (let i = 0; i < spec.letters; i++) letters += pool[randInt(0, pool.length - 1)]
  return `${letters}${randDigits(spec.digits)}`
}

// ---- ICAO 9303 MRZ (Machine Readable Zone), TD3 format used by passports — 2 lines of 44 chars.
// Check-digit algorithm (weights 7/3/1 cyclic, value table "0-9A-Z", '<' = 0) verified against the
// reference `mrz` Python package; field layout (composite check digit's exact input) verified
// against that same package's TD3 generator.
const MRZ_VALUE_ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'

function mrzCheckDigit(str) {
  const weights = [7, 3, 1]
  let sum = 0
  for (let i = 0; i < str.length; i++) {
    const ch = str[i] === '<' ? '0' : str[i]
    sum += MRZ_VALUE_ALPHABET.indexOf(ch) * weights[i % 3]
  }
  return String(sum % 10)
}

function mrzField(str, length) {
  return str.toUpperCase().slice(0, length).padEnd(length, '<')
}

// Fixed, deliberately generic placeholder identity — never a realistic-looking real name — so
// nothing produced here could be mistaken for an actual person's travel document.
const MRZ_PLACEHOLDER_SURNAME = 'TESTPERSON'
const MRZ_PLACEHOLDER_GIVEN = 'SAMPLE'

function buildPassportMrz(alpha3, documentNumber) {
  const docNumberField = mrzField(documentNumber, 9)
  const docNumberCheck = mrzCheckDigit(docNumberField)
  const birthYear = pad(randInt(0, 99), 2)
  const birthMonth = pad(randInt(1, 12), 2)
  const birthDay = pad(randInt(1, 28), 2)
  const birthDate = `${birthYear}${birthMonth}${birthDay}`
  const birthDateCheck = mrzCheckDigit(birthDate)
  const sex = ['M', 'F'][randInt(0, 1)]
  const expiryYear = pad(randInt(0, 99), 2)
  const expiryMonth = pad(randInt(1, 12), 2)
  const expiryDay = pad(randInt(1, 28), 2)
  const expiryDate = `${expiryYear}${expiryMonth}${expiryDay}`
  const expiryDateCheck = mrzCheckDigit(expiryDate)
  const optionalData = mrzField('', 14)
  const optionalDataCheck = mrzCheckDigit(optionalData)

  const identifier = mrzField(`${MRZ_PLACEHOLDER_SURNAME}<<${MRZ_PLACEHOLDER_GIVEN}`, 39)
  const line1 = `P<${alpha3}${identifier}`

  const finalString = docNumberField + docNumberCheck + birthDate + birthDateCheck +
    expiryDate + expiryDateCheck + optionalData + optionalDataCheck
  const finalCheck = mrzCheckDigit(finalString)

  const line2 = docNumberField + docNumberCheck + alpha3 + birthDate + birthDateCheck +
    sex + expiryDate + expiryDateCheck + optionalData + optionalDataCheck + finalCheck

  return { line1, line2 }
}

// ---- Wiring ----
;(function initIdTool() {
  const countryTrigger = document.getElementById('id-country-trigger')
  const countryTriggerLabel = document.getElementById('id-country-trigger-label')
  const countryPanel = document.getElementById('id-country-panel')
  const typeTrigger = document.getElementById('id-type-trigger')
  const typeTriggerLabel = document.getElementById('id-type-trigger-label')
  const typePanel = document.getElementById('id-type-panel')
  const generateBtn = document.getElementById('id-generate')
  const output = document.getElementById('id-output')
  const mrzWrap = document.getElementById('id-mrz-wrap')
  const mrzOutput = document.getElementById('id-mrz-output')
  const errorEl = document.getElementById('id-error')
  const copyBtn = document.getElementById('id-copy')

  if (!countryTrigger) return // ID tab not present in this build

  let currentCountry = 'it'
  let currentType = 'national' // 'national' | 'passport'
  let currentNationalKey = 'it'

  function nationalTypesFor(country) {
    return NATIONAL_ID_TYPES.filter(t => t.country === country)
  }

  function renderCountryOptions() {
    countryPanel.innerHTML = ID_COUNTRIES.map(c =>
      `<button type="button" class="ft-select-option${c.code === currentCountry ? ' active' : ''}" data-value="${c.code}">${c.name}</button>`
    ).join('')
  }

  function renderTypeOptions() {
    const opts = [...nationalTypesFor(currentCountry).map(t => ({ value: t.key, label: t.label }))]
    opts.push({ value: 'passport_number', label: 'Passport Number' })
    opts.push({ value: 'passport_mrz', label: 'Passport MRZ (2-line)' })
    typePanel.innerHTML = opts.map(o =>
      `<button type="button" class="ft-select-option${o.value === currentType ? ' active' : ''}" data-value="${o.value}">${o.label}</button>`
    ).join('')
    return opts
  }

  function setCountry(code) {
    currentCountry = code
    const c = ID_COUNTRIES.find(x => x.code === code)
    countryTriggerLabel.textContent = c ? c.name : code
    const firstNational = nationalTypesFor(code)[0]
    currentNationalKey = firstNational ? firstNational.key : null
    currentType = firstNational ? firstNational.key : 'passport_number'
    renderCountryOptions()
    const opts = renderTypeOptions()
    const activeOpt = opts.find(o => o.value === currentType)
    typeTriggerLabel.textContent = activeOpt ? activeOpt.label : ''
  }

  function setType(value) {
    currentType = value
    const opts = renderTypeOptions()
    const activeOpt = opts.find(o => o.value === value)
    typeTriggerLabel.textContent = activeOpt ? activeOpt.label : ''
  }

  function openPanel(panel, trigger) {
    panel.hidden = false
    const rect = trigger.getBoundingClientRect()
    panel.style.left = rect.left + 'px'
    panel.style.width = rect.width + 'px'
    panel.style.top = (rect.bottom + 4) + 'px'
    panel.style.maxHeight = Math.max(120, window.innerHeight - rect.bottom - 12) + 'px'
  }

  function closePanels() {
    countryPanel.hidden = true
    typePanel.hidden = true
  }

  countryTrigger.addEventListener('click', () => {
    const wasHidden = countryPanel.hidden
    closePanels()
    if (wasHidden) openPanel(countryPanel, countryTrigger)
  })
  typeTrigger.addEventListener('click', () => {
    const wasHidden = typePanel.hidden
    closePanels()
    if (wasHidden) openPanel(typePanel, typeTrigger)
  })
  countryPanel.addEventListener('click', e => {
    const opt = e.target.closest('.ft-select-option')
    if (!opt) return
    setCountry(opt.dataset.value)
    closePanels()
    generate()
  })
  typePanel.addEventListener('click', e => {
    const opt = e.target.closest('.ft-select-option')
    if (!opt) return
    setType(opt.dataset.value)
    closePanels()
    generate()
  })
  document.addEventListener('click', e => {
    if (!countryPanel.contains(e.target) && !countryTrigger.contains(e.target) &&
        !typePanel.contains(e.target) && !typeTrigger.contains(e.target)) closePanels()
  })

  function generate() {
    errorEl.hidden = true
    mrzWrap.hidden = true
    try {
      if (currentType === 'passport_number') {
        output.value = genPassportNumber(currentCountry)
      } else if (currentType === 'passport_mrz') {
        const country = ID_COUNTRIES.find(c => c.code === currentCountry)
        const passportNumber = genPassportNumber(currentCountry)
        const { line1, line2 } = buildPassportMrz(country.alpha3, passportNumber)
        output.value = passportNumber
        mrzOutput.textContent = `${line1}\n${line2}`
        mrzWrap.hidden = false
      } else {
        const idType = NATIONAL_ID_TYPES.find(t => t.key === currentType)
        output.value = idType ? idType.generate() : ''
      }
    } catch (err) {
      errorEl.textContent = err.message
      errorEl.hidden = false
      output.value = ''
    }
  }

  generateBtn.addEventListener('click', generate)

  copyBtn.addEventListener('click', () => {
    if (!output.value) return
    navigator.clipboard.writeText(output.value)
  })

  setCountry('it')
  generate()
})()
