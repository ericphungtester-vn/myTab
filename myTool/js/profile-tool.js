// ---- Profile Tool: generates a SYNTHETIC test profile (name, address, postal code, phone,
// National ID, Passport) per country for form/validation testing. Nobody real is represented —
// names/addresses are drawn from real public name/format data (verified against Faker.js's own
// locale data, itself a well-established reference for this kind of test-data generation) purely
// for realistic-looking variety, then randomly recombined, so no output is tied to an actual
// person. Every National ID/Passport checksum was verified against the country's actual public
// algorithm (see git history / research notes) — see NATIONAL_ID_TYPES below.

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

function pick(arr) {
  return arr[randInt(0, arr.length - 1)]
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

// Generalized Luhn over an arbitrary alphabet (e.g. India's GSTIN uses base 36: 0-9A-Z) — same
// doubling rule, generalized from "subtract 9 if over 9" to "add quotient+remainder of base n".
function luhnChecksumGeneric(str, alphabet) {
  const n = alphabet.length
  const values = str.split('').reverse().map(ch => alphabet.indexOf(ch))
  let sum = 0
  for (let i = 0; i < values.length; i++) {
    if (i % 2 === 0) sum += values[i]
    else { const doubled = values[i] * 2; sum += Math.floor(doubled / n) + (doubled % n) }
  }
  return sum % n
}

function luhnCheckDigitGeneric(bodyStr, alphabet) {
  const ck = luhnChecksumGeneric(bodyStr + alphabet[0], alphabet)
  return alphabet[mod(-ck, alphabet.length)]
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
  { code: 'id', name: 'Indonesia', alpha3: 'IDN' },
  { code: 'it', name: 'Italy', alpha3: 'ITA' },
  { code: 'my', name: 'Malaysia', alpha3: 'MYS' },
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

// A handful of real, confirmed-valid province+regency prefixes (per python-stdnum's own reference
// data) — the district sub-code after them isn't independently validated, so any 2 digits work.
const ID_REGION_PREFIXES = ['3171', '3172', '3173', '3174', '3175', '3101', '3201']

function genNIK_ID() { // Indonesia (NIK) — structure only, no public checksum
  const region = ID_REGION_PREFIXES[randInt(0, ID_REGION_PREFIXES.length - 1)] + pad(randInt(0, 99), 2)
  const isFemale = Math.random() < 0.5
  const day = pad(randInt(1, 28) + (isFemale ? 40 : 0), 2)
  const month = pad(randInt(1, 12), 2)
  const year = pad(randInt(0, 99), 2)
  const serial = pad(randInt(0, 9999), 4)
  return `${region}${day}${month}${year}${serial}`
}

// Codes 01-16 are Malaysia's 13 states + 3 federal territories — real, confirmed-valid birthplace
// codes (per python-stdnum's own reference data); higher codes exist too but aren't needed here.
function genNRIC_MY() { // Malaysia — structure only, no public checksum
  const year = pad(randInt(0, 99), 2)
  const month = pad(randInt(1, 12), 2)
  const day = pad(randInt(1, 28), 2)
  const birthplace = pad(randInt(1, 16), 2)
  const serial = pad(randInt(0, 9999), 4)
  return `${year}${month}${day}-${birthplace}-${serial}`
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
  { key: 'sg_fin', country: 'sg', label: 'FIN (foreigners)', generate: () => genNRIC_SG(['F', 'G', 'M']) },
  { key: 'id', country: 'id', label: 'NIK (structure only)', generate: genNIK_ID },
  { key: 'my', country: 'my', label: 'NRIC (structure only)', generate: genNRIC_MY }
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
  us: { letters: 0, digits: 9 }, gb: { letters: 0, digits: 9 }, sg: { letters: 1, digits: 8, letterPool: 'K' },
  id: { letters: 1, digits: 7, letterPool: 'C' }, my: { letters: 1, digits: 8, letterPool: 'A' }
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
// MRZ fields are restricted to A-Z0-9< (ICAO 9303) — real passports transliterate accented Latin
// names down to plain ASCII, so this strips diacritics the same way (NFD-decomposes and drops the
// combining marks; a few letters like Vietnamese Đ or Norwegian Ø don't decompose and need an
// explicit mapping first).
const MRZ_DIACRITIC_MAP = { Đ: 'D', đ: 'd', Ø: 'O', ø: 'o', Ł: 'L', ł: 'l', Æ: 'AE', æ: 'ae' }

function transliterateForMrz(str) {
  let out = ''
  for (const ch of str) out += MRZ_DIACRITIC_MAP[ch] || ch
  return out.normalize('NFD').replace(/[̀-ͯ]/g, '')
}

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

// Fallback identity when no name is supplied (e.g. from a unit test calling this directly) —
// deliberately generic, never a realistic-looking real name on its own.
const MRZ_PLACEHOLDER_SURNAME = 'TESTPERSON'
const MRZ_PLACEHOLDER_GIVEN = 'SAMPLE'

function buildPassportMrz(alpha3, documentNumber, surname = MRZ_PLACEHOLDER_SURNAME, givenNames = MRZ_PLACEHOLDER_GIVEN) {
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

  // ICAO 9303: spaces within/between name components are represented by '<', never a literal
  // space — a multi-word given name (e.g. "Ana Júlia") would otherwise leak a raw space in.
  const identifier = mrzField(`${surname}<<${givenNames}`.replace(/ /g, '<'), 39)
  const line1 = `P<${alpha3}${identifier}`

  const finalString = docNumberField + docNumberCheck + birthDate + birthDateCheck +
    expiryDate + expiryDateCheck + optionalData + optionalDataCheck
  const finalCheck = mrzCheckDigit(finalString)

  const line2 = docNumberField + docNumberCheck + alpha3 + birthDate + birthDateCheck +
    sex + expiryDate + expiryDateCheck + optionalData + optionalDataCheck + finalCheck

  return { line1, line2 }
}

// ---- Profile data: names, phone, postal code, and address, per country ----
// Name/address data below is a trimmed sample (15-25 entries, same scale as the Text tool's word
// banks) drawn from Faker.js's real per-locale data (verified against its source, see git history
// / research notes) — real names/streets, randomly recombined, never tied to an actual person.
// Four countries (Bulgaria, Chile, Malaysia, Singapore) have no dedicated Faker.js locale: Chile
// falls back to Spain's Spanish-language name data (a reasonable same-language approximation,
// noted inline); Bulgaria/Malaysia/Singapore have no good single-locale fallback (Cyrillic/Slavic,
// or multi-ethnic with no dominant name set), so they use GENERIC_NAMES/GENERIC_STREET_WORDS
// instead of fabricating country-specific names.

const GENERIC_NAMES = {
  firstNames: ['Aaliyah', 'Abagail', 'Abbey', 'Abbie', 'Abby', 'Abdiel', 'Abdullah', 'Abe',
    'Abelardo', 'Abigail', 'Abner', 'Adah', 'Adalberto', 'Adaline', 'Adan', 'Addie'],
  lastNames: ['Abbott', 'Abernathy', 'Abshire', 'Adams', 'Altenwerth', 'Anderson', 'Ankunding',
    'Armstrong', 'Auer', 'Aufderhar', 'Bahringer', 'Bailey', 'Balistreri', 'Barrows', 'Bartell', 'Barton']
}
const GENERIC_STREET_WORDS = ['Main', 'Park', 'Oak', 'Market', 'River', 'Church', 'Mill', 'School', 'Garden', 'Hill']

const ES_NAMES = {
  firstNames: ['Adela', 'Adriana', 'Alejandra', 'Alicia', 'Amalia', 'Ana', 'Andrea', 'Antonia',
    'Ariadna', 'Barbara', 'Beatriz', 'Berta', 'Blanca', 'Caridad', 'Carla', 'Carlota'],
  lastNames: ['Abeyta', 'Abrego', 'Abreu', 'Acevedo', 'Acosta', 'Acuña', 'Adame', 'Adorno',
    'Agosto', 'Aguayo', 'Aguilar', 'Aguilera', 'Aguirre', 'Alanis', 'Alarcón', 'Alba']
}

// Phone number: `${'+'}${cc}${lead}${randDigits(count)}` — lead is the fixed/likely-realistic
// leading digit(s) of a mobile number (or an array to pick one from), verified per country.
const PHONE_SPECS = {
  br: { cc: '55', lead: '', count: 11 },
  bg: { cc: '359', lead: '8', count: 8 },
  cl: { cc: '56', lead: '9', count: 8 },
  cn: { cc: '86', lead: '1', count: 10 },
  fi: { cc: '358', lead: '4', count: 8 },
  fr: { cc: '33', lead: '6', count: 8 },
  in: { cc: '91', lead: '9', count: 9 },
  id: { cc: '62', lead: '8', count: 9 },
  it: { cc: '39', lead: '3', count: 8 },
  my: { cc: '60', lead: '1', count: 9 },
  no: { cc: '47', lead: '9', count: 7 },
  pl: { cc: '48', lead: '6', count: 8 },
  pt: { cc: '351', lead: '9', count: 8 },
  ro: { cc: '40', lead: '7', count: 8 },
  za: { cc: '27', lead: '6', count: 8 },
  sg: { cc: '65', lead: ['8', '9'], count: 7 },
  es: { cc: '34', lead: ['6', '7'], count: 8 },
  se: { cc: '46', lead: '70', count: 7 },
  gb: { cc: '44', lead: '7', count: 9 },
  vn: { cc: '84', lead: '9', count: 8 }
}

function genPhoneNumber(countryCode) {
  if (countryCode === 'us') { // NANP: area code and exchange code can't start with 0 or 1
    const area = String(randInt(2, 9)) + randDigits(2)
    const exchange = String(randInt(2, 9)) + randDigits(2)
    return `+1${area}${exchange}${randDigits(4)}`
  }
  const spec = PHONE_SPECS[countryCode]
  const lead = Array.isArray(spec.lead) ? pick(spec.lead) : spec.lead
  return `+${spec.cc}${lead}${randDigits(spec.count)}`
}

const GB_POSTCODE_AREAS = ['SW', 'E', 'N', 'W', 'NW', 'SE', 'EC', 'WC', 'B', 'M', 'L', 'G', 'LS', 'CF', 'BS', 'NG']

function genPostalCode(countryCode) {
  switch (countryCode) {
    case 'br': return `${randDigits(5)}-${randDigits(3)}`
    case 'bg': return randDigits(4)
    case 'cl': return randDigits(7)
    case 'cn': return randDigits(6)
    case 'fi': return randDigits(5)
    case 'fr': return randDigits(5)
    case 'in': return `${randDigits(3)} ${randDigits(3)}`
    case 'id': return randDigits(5)
    case 'it': return randDigits(5)
    case 'my': return randDigits(5)
    case 'no': return randDigits(4)
    case 'pl': return `${randDigits(2)}-${randDigits(3)}`
    case 'pt': return `${randDigits(4)}-${randDigits(3)}`
    case 'ro': return randDigits(6)
    case 'za': return randDigits(4)
    case 'sg': return randDigits(6)
    case 'es': return randDigits(5)
    case 'se': return randDigits(5)
    case 'gb': return `${pick(GB_POSTCODE_AREAS)}${randInt(1, 20)} ${randInt(0, 9)}${randLetter()}${randLetter()}`
    case 'us': return randDigits(5)
    case 'vn': return randDigits(6)
    default: return randDigits(5)
  }
}

const CN_STREETS = ['长安街', '北京路', '南京路', '复兴路', '中山路', '人民路', '文化路', '东风路',
  '光明路', '解放路', '团结路', '天安门路', '市场街', '南门街', '北大街', '南湖路']
const FR_STREET_PREFIXES = ['Allée', 'Rue', 'Avenue', 'Boulevard', 'Quai', 'Impasse', 'Place']
const FR_STREET_NAMES = ["de l'Abbaye", 'Adolphe Mille', "d'Alésia", "d'Argenteuil", "d'Assas",
  'du Bac', 'de Paris', 'La Boétie', 'Bonaparte', 'de Caumartin', 'Charlemagne']
const EN_STREET_SUFFIXES = ['Alley', 'Avenue', 'Branch', 'Bridge', 'Brook', 'Burg', 'Circle', 'Court', 'Crossing', 'Drive']
const RO_STREET_PREFIXES = ['Aleea', 'Bulevardul', 'Strada']
const RO_STREET_NAMES = ['Capalna', 'Gheorghe Duca', 'Acvila', 'Lisabona', 'Campulung',
  'Ilie Gurita', 'Succesului', 'Siret', 'Mihai Viteazul', 'Complexului']
const GB_STREET_NAMES = ['Abbey Road', 'Albany Road', 'Albert Road', 'Albion Street', 'Alexandra Road',
  'Alfred Street', 'Alma Street', 'Ash Close', 'Ash Grove', 'Ash Road', 'Aspen Close', 'Avenue Road']
const US_STREET_NAMES = ['10th Street', '11th Street', '1st Avenue', 'A Street', 'Adams Avenue',
  'Adams Street', 'Airport Road', 'Ash Street', 'Atlantic Avenue', 'Bay Street', 'Bridge Road', 'Broadway']
// Vietnam: real street + district + province-level city, drawn from well-known (often tourist)
// areas. The house number is randomized and the postal code is province-level; the components are
// real, but a given combination is synthetic — a plausible address, not a verified deliverable one.
const VN_ADDRESSES = [
  { street: 'Nguyễn Huệ', district: 'Quận 1', city: 'Hồ Chí Minh', postal: '70000' },
  { street: 'Đồng Khởi', district: 'Quận 1', city: 'Hồ Chí Minh', postal: '70000' },
  { street: 'Lê Lợi', district: 'Quận 1', city: 'Hồ Chí Minh', postal: '70000' },
  { street: 'Bùi Viện', district: 'Quận 1', city: 'Hồ Chí Minh', postal: '70000' },
  { street: 'Hai Bà Trưng', district: 'Quận 3', city: 'Hồ Chí Minh', postal: '70000' },
  { street: 'Tràng Tiền', district: 'Hoàn Kiếm', city: 'Hà Nội', postal: '11000' },
  { street: 'Hàng Bài', district: 'Hoàn Kiếm', city: 'Hà Nội', postal: '11000' },
  { street: 'Đinh Tiên Hoàng', district: 'Hoàn Kiếm', city: 'Hà Nội', postal: '11000' },
  { street: 'Tạ Hiện', district: 'Hoàn Kiếm', city: 'Hà Nội', postal: '11000' },
  { street: 'Bạch Đằng', district: 'Hải Châu', city: 'Đà Nẵng', postal: '55000' },
  { street: 'Võ Nguyên Giáp', district: 'Sơn Trà', city: 'Đà Nẵng', postal: '55000' },
  { street: 'Trần Phú', district: 'Hội An', city: 'Quảng Nam', postal: '56000' },
  { street: 'Nguyễn Thái Học', district: 'Hội An', city: 'Quảng Nam', postal: '56000' },
  { street: 'Trần Phú', district: 'Nha Trang', city: 'Khánh Hòa', postal: '65000' },
  { street: 'Nguyễn Chí Thanh', district: 'Đà Lạt', city: 'Lâm Đồng', postal: '66000' },
  { street: 'Lê Lợi', district: 'Huế', city: 'Thừa Thiên Huế', postal: '53000' }
]

function genAddressLine(countryCode, names) {
  switch (countryCode) {
    case 'br': return `${pick(['Rua', 'Avenida', 'Travessa', 'Alameda'])} ${pick(names.lastNames)}, ${randInt(1, 2000)}`
    case 'bg': return `${randInt(1, 999)} ${pick(GENERIC_STREET_WORDS)} St.`
    case 'cl': return `${pick(['Calle', 'Avenida', 'Pasaje'])} ${pick(names.firstNames)} ${randInt(1, 9999)}`
    case 'cn': return `${pick(CN_STREETS)}${randInt(1, 999)}号`
    case 'fi': return `${pick(names.lastNames)}${pick(['katu', 'tie', 'kuja', 'polku'])} ${randInt(1, 50)}`
    case 'fr': return `${randInt(1, 200)} ${pick(FR_STREET_PREFIXES)} ${pick(FR_STREET_NAMES)}`
    case 'in': return `${randInt(1, 999)} ${pick(names.lastNames)} ${pick(EN_STREET_SUFFIXES)}`
    case 'id': return `${pick(['Jln.', 'Gg.', 'Jr.'])} ${pick(names.lastNames)} no ${randInt(1, 99)}`
    case 'it': return `${pick(['Via', 'Piazza', 'Strada', 'Corso'])} ${pick(names.lastNames)}, ${randInt(1, 300)}`
    case 'my': return `${randInt(1, 999)} ${pick(GENERIC_STREET_WORDS)} Street`
    case 'no': return `${pick(names.lastNames)}${pick(['veien', 'gata', 'bakken'])} ${randInt(1, 99)}`
    case 'pl': return `ul. ${pick(names.lastNames)} ${randInt(1, 200)}`
    case 'pt': return `${pick(['Rua', 'Avenida', 'Travessa', 'Praça'])} ${pick(names.lastNames)}, ${randInt(1, 500)}`
    case 'ro': return `${pick(RO_STREET_PREFIXES)} ${pick(RO_STREET_NAMES)}, Bloc ${randInt(1, 99)}`
    case 'za': return `${randInt(1, 999)} ${pick(names.lastNames)} ${pick(EN_STREET_SUFFIXES)}`
    case 'es': return `${pick(['Calle', 'Avenida', 'Paseo'])} ${pick(names.firstNames)}, ${randInt(1, 200)}`
    case 'se': return `${pick(names.lastNames)}${pick(['vägen', 'gatan', 'gränden'])} ${randInt(1, 99)}`
    case 'sg': return `${randInt(1, 999)} ${pick(GENERIC_STREET_WORDS)} Street`
    case 'gb': return `${randInt(1, 200)} ${pick(GB_STREET_NAMES)}`
    case 'us': return `${randInt(1, 9999)} ${pick(US_STREET_NAMES)}`
    default: return `${randInt(1, 999)} ${pick(GENERIC_STREET_WORDS)} Street`
  }
}

// Full address as { addressLine, district, city, postalCode }. Countries with a curated dataset
// (Vietnam) return real street/district/city components; all others fall back to the generated
// street line + postal code with no district/city.
function genAddress(countryCode, names) {
  if (countryCode === 'vn') {
    const a = pick(VN_ADDRESSES)
    return { addressLine: `${randInt(1, 300)} ${a.street}`, district: a.district, city: a.city, postalCode: a.postal }
  }
  return { addressLine: genAddressLine(countryCode, names), district: '', city: '', postalCode: genPostalCode(countryCode) }
}

// nameOrder: 'western' -> First Middle Last; 'eastern-nospace' -> LastFirst (China, no middle
// name concept); 'eastern-spaced' -> Last First (Vietnam — faker's own template has this
// backwards as First Last, corrected here to match real Vietnamese family-name-first convention;
// "middle name" is still generated as its own field, just not part of Vietnamese Full Name, since
// a synthesized second given name doesn't map onto a real Vietnamese đệm/middle name).
const PROFILE_NAMES = {
  br: {
    nameOrder: 'western',
    firstNames: ['Alessandra', 'Alice', 'Aline', 'Ana Clara', 'Ana Júlia', 'Antonella', 'Beatriz', 'Bruna',
      'Alexandre', 'Anthony', 'Antônio', 'Arthur', 'Benjamin', 'Bernardo', 'Caio', 'Carlos', 'Daniel', 'Davi'],
    lastNames: ['Albuquerque', 'Barros', 'Batista', 'Braga', 'Carvalho', 'Costa', 'Franco', 'Macedo',
      'Martins', 'Melo', 'Moraes', 'Moreira', 'Nogueira', 'Oliveira', 'Pereira', 'Reis', 'Santos', 'Silva', 'Souza']
  },
  bg: { nameOrder: 'western', firstNames: GENERIC_NAMES.firstNames, lastNames: GENERIC_NAMES.lastNames },
  cl: { nameOrder: 'western', firstNames: ES_NAMES.firstNames, lastNames: ES_NAMES.lastNames },
  cn: {
    nameOrder: 'eastern-nospace',
    firstNames: ['乐驹', '伟宸', '伟泽', '伟祺', '伟诚', '俊驰', '修杰', '修洁', '健柏', '健雄',
      '凯瑞', '博文', '博涛', '博超', '君浩', '哲瀚', '嘉懿', '嘉熙'],
    lastNames: ['丁', '万', '万俟', '上官', '不', '丑', '世', '丘', '丙', '业', '丛', '东', '东方', '严', '中', '丰', '丹', '乌', '乐', '乔']
  },
  fi: {
    nameOrder: 'western',
    firstNames: ['Aino', 'Anja', 'Anna', 'Anne', 'Anneli', 'Eeva', 'Elina', 'Emilia', 'Hanna',
      'Aleksi', 'Antero', 'Antti', 'Ari', 'Eero', 'Erik', 'Erkki', 'Hannu', 'Heikki', 'Henrik'],
    lastNames: ['Aaltonen', 'Ahonen', 'Anttila', 'Hakala', 'Heikkilä', 'Heikkinen', 'Heinonen', 'Hiltunen',
      'Hirvonen', 'Hämäläinen', 'Jokinen', 'Järvinen', 'Kallio', 'Karjalainen', 'Kinnunen', 'Koivisto', 'Korhonen']
  },
  fr: {
    nameOrder: 'western',
    firstNames: ['Alix', 'Anne', 'Camille', 'Claude', 'Constance', 'Dominique', 'Maxime', 'Adeline',
      'Agathe', 'Adélaïde', 'Abigaïl', 'Acanthe', 'Cassandre', 'Isabeau', 'Philothée', 'Hippolyte'],
    lastNames: ['Adam', 'Andre', 'Arnaud', 'Aubert', 'Aubry', 'Barbier', 'Baron', 'Barre', 'Benoit',
      'Berger', 'Bernard', 'Bertrand', 'Blanc', 'Blanchard', 'Bonnet', 'Bourgeois', 'Boyer', 'Breton']
  },
  in: {
    nameOrder: 'western',
    firstNames: ['Aadrika', 'Aanandinii', 'Aaratrika', 'Aarya', 'Aasa', 'Aasha', 'Aashritha', 'Aatmaja',
      'Abani', 'Abhaya', 'Adwitiya', 'Agrata', 'Ahalya', 'Ahilya', 'Aishani', 'Akshainie', 'Akshata', 'Ambar'],
    lastNames: ['Abbott', 'Achari', 'Acharya', 'Adiga', 'Agarwal', 'Ahluwalia', 'Ahuja', 'Arora', 'Asan',
      'Bandopadhyay', 'Banerjee', 'Bhadresha', 'Bharadwaj', 'Bhat', 'Bhattacharya', 'Chaturvedi', 'Chopra']
  },
  id: {
    nameOrder: 'western',
    firstNames: ['Ade', 'Dwi', 'Eka', 'Tri', 'Agnes', 'Aisyah', 'Ajeng', 'Alika', 'Almira', 'Amelia',
      'Aditya', 'Agus', 'Airlangga', 'Alamsyah', 'Ardianto', 'Abimanyu', 'Adhitama', 'Adriansyah'],
    lastNames: ['Purnama', 'Afifah', 'Agustina', 'Amanta', 'Ananda', 'Andini', 'Aqila', 'Ardiyanti',
      'Abiputra', 'Adhitama', 'Adriansyah', 'Ahmad', 'Airlangga', 'Alamsyah', 'Anggriawan', 'Antoni']
  },
  it: {
    nameOrder: 'western',
    firstNames: ['Abbondanza', 'Acilia', 'Ada', 'Adalberta', 'Adalgisa', 'Addolorata', 'Adelaide', 'Adelasia',
      'Adele', 'Adelina', 'Adina', 'Adria', 'Adriana', 'Agape', 'Agata', 'Agnese', 'Agostina', 'Alberta'],
    lastNames: ['Abate', 'Abbate', 'Abbondanza', 'Abbrescia', 'Accardi', 'Accardo', 'Accurso', 'Aceto',
      'Acquadro', 'Acquaviva', 'Adami', 'Adamo', 'Addari', 'Addis', 'Adragna', 'Affinito', 'Agnello', 'Agostinelli']
  },
  my: { nameOrder: 'western', firstNames: GENERIC_NAMES.firstNames, lastNames: GENERIC_NAMES.lastNames },
  no: {
    nameOrder: 'western',
    firstNames: ['Amalie', 'Andrea', 'Anna', 'Aurora', 'Camilla', 'Celine', 'Eline', 'Elise', 'Emilie',
      'Emma', 'Frida', 'Hanna', 'Hedda', 'Helene', 'Ida', 'Ingrid', 'Jenny', 'Julie'],
    lastNames: ['Aalerud', 'Aas', 'Aasen', 'Amundsen', 'Andersen', 'Andreassen', 'Andresen', 'Arnesen',
      'Bakke', 'Bakken', 'Berg', 'Berge', 'Berntsen', 'Bjerke', 'Bjørnstad', 'Borge', 'Carlsen', 'Dahl']
  },
  pl: {
    nameOrder: 'western',
    firstNames: ['Ada', 'Adelajda', 'Agata', 'Agnieszka', 'Agrypina', 'Aida', 'Aleksandra', 'Alicja',
      'Alina', 'Amanda', 'Anastazja', 'Andżelika', 'Angela', 'Angelina', 'Anna', 'Antonina', 'Ariadna', 'Barbara'],
    lastNames: ['Adamczak', 'Adamczyk', 'Adamek', 'Adamiak', 'Adamiec', 'Adamowicz', 'Adamski', 'Adamus',
      'Aleksandrowicz', 'Andrzejczak', 'Andrzejewski', 'Antczak', 'Augustyn', 'Augustyniak', 'Bagiński', 'Balcerzak']
  },
  pt: {
    nameOrder: 'western',
    firstNames: ['Adriana', 'Alexandra', 'Alice', 'Amélia', 'Ana', 'Ariana', 'Aurora', 'Beatriz', 'Benedita',
      'Bruna', 'Bárbara', 'Caetana', 'Camila', 'Carla', 'Carlota', 'Carminho', 'Carmo', 'Carolina'],
    lastNames: ['Abreu', 'Albuquerque', 'Almeida', 'Alves', 'Amado', 'Amaral', 'Amorim', 'Andrade', 'Anjos',
      'Antunes', 'Araújo', 'Assunção', 'Azevedo', 'Baptista', 'Barbosa', 'Barros', 'Batista', 'Borges']
  },
  ro: {
    nameOrder: 'western',
    firstNames: ['Ada', 'Adela', 'Adelaida', 'Adelina', 'Adina', 'Adriana', 'Agata', 'Aglaia', 'Agripina',
      'Aida', 'Alberta', 'Albertina', 'Alexandra', 'Alexandrina', 'Alice', 'Alida', 'Alina', 'Alis'],
    lastNames: ['Achim', 'Adam', 'Albu', 'Aldea', 'Alexa', 'Alexandrescu', 'Alexandru', 'Alexe', 'Andrei',
      'Anghel', 'Antal', 'Anton', 'Apostol', 'Ardelean', 'Ardeleanu', 'Avram', 'Baciu', 'Badea']
  },
  za: {
    nameOrder: 'western',
    firstNames: ['Jan', 'Jessie', 'Kim', 'Kopano', 'Lungelo', 'Monde', 'Mpho', 'Nqobile', 'Nthabiseng',
      'Rapulane', 'Ziyanda', 'Alexandra', 'Alexis', 'Alice', 'Alicia', 'Alison', 'Amanda', 'Amber'],
    lastNames: ['Abbott', 'Adams', 'Adcock', 'Albertyn', 'Amla', 'Anderson', 'Ashley', 'Bacher', 'Bailey',
      'Baloyi', 'Barrows', 'Barton', 'Benjamin', 'Berge', 'Bernhard', 'Bester', 'Bhana', 'Bhengu']
  },
  es: { nameOrder: 'western', firstNames: ES_NAMES.firstNames, lastNames: ES_NAMES.lastNames },
  se: {
    nameOrder: 'western',
    firstNames: ['Agnes', 'Agneta', 'Alexandra', 'Alice', 'Alva', 'Amanda', 'Anette', 'Anita', 'Ann',
      'Anna', 'Anneli', 'Annika', 'Astrid', 'Barbro', 'Berit', 'Birgitta', 'Britt', 'Camilla'],
    lastNames: ['Abrahamsson', 'Ahmed', 'Ali', 'Andersson', 'Andreasson', 'Arvidsson', 'Axelsson', 'Bengtsson',
      'Berg', 'Berggren', 'Berglund', 'Bergman', 'Bergqvist', 'Bergström', 'Björk', 'Björklund', 'Blom', 'Dahl']
  },
  sg: { nameOrder: 'western', firstNames: GENERIC_NAMES.firstNames, lastNames: GENERIC_NAMES.lastNames },
  gb: { // person names inherited from base `en` locale in Faker.js (en_GB defines no own name files)
    nameOrder: 'western',
    firstNames: ['Aaliyah', 'Abagail', 'Abbey', 'Abbie', 'Abby', 'Abdiel', 'Abdullah', 'Abe', 'Abelardo',
      'Abigail', 'Abigale', 'Abigayle', 'Abner', 'Adah', 'Adalberto', 'Adaline', 'Adan', 'Addie'],
    lastNames: ['Abbott', 'Abernathy', 'Abshire', 'Adams', 'Altenwerth', 'Anderson', 'Ankunding', 'Armstrong',
      'Auer', 'Aufderhar', 'Bahringer', 'Bailey', 'Balistreri', 'Barrows', 'Bartell', 'Bartoletti', 'Barton']
  },
  us: { nameOrder: 'western', firstNames: GENERIC_NAMES.firstNames, lastNames: GENERIC_NAMES.lastNames },
  vn: {
    nameOrder: 'eastern-spaced',
    firstNames: ['Anh Vũ', 'Bình Minh', 'Bình Yên', 'Cát Tường', 'Hiểu Lam', 'Hoài Vỹ', 'Hoàng Xuân',
      'An Bình', 'An Nhiên', 'Anh Thư', 'An Khang', 'Anh Dũng', 'Anh Minh', 'Anh Quân', 'Anh Khoa'],
    lastNames: ['Bùi', 'Dương', 'Hoàng', 'Hà', 'Hồ', 'Lâm', 'Lê', 'Lý', 'Mai', 'Nguyễn', 'Ngô', 'Phan',
      'Phùng', 'Phạm', 'Trương', 'Trần', 'Trịnh', 'Vũ', 'Vương', 'Đinh']
  }
}

// Middle name has no equivalent in most of these naming systems (Faker.js itself only defines a
// real "middle name" concept for its base `en` locale) — synthesized everywhere as a second,
// distinct first name from the same country's pool rather than fabricating foreign data.
function genMiddleName(names) {
  if (names.firstNames.length < 2) return pick(names.firstNames)
  let middle
  do { middle = pick(names.firstNames) } while (middle === names._lastFirstNamePick)
  return middle
}

function buildFullName(nameOrder, firstName, middleName, lastName) {
  if (nameOrder === 'eastern-nospace') return `${lastName}${firstName}`
  if (nameOrder === 'eastern-spaced') return `${lastName} ${firstName}`
  return `${firstName} ${middleName} ${lastName}`
}

// China's names are Chinese characters, which can't be mechanically transliterated to Latin
// letters without a real Hanzi-to-Pinyin dictionary (not something this tool has) — real Chinese
// passports use Pinyin in the MRZ, so a generic already-Latin placeholder stands in there instead
// of emitting raw Chinese characters into a field ICAO 9303 restricts to A-Z0-9<.
const MRZ_NON_LATIN_NAME = {
  cn: { surname: 'WEI', given: 'JUN' }
}

// The single entry point the UI uses: builds one full, self-consistent synthetic profile for a
// country — every National ID/Passport variant available for that country, plus name/address/
// phone/postal fields, all as plain text (never a rendered/visual document).
function generateProfile(countryCode) {
  const country = ID_COUNTRIES.find(c => c.code === countryCode)
  const names = PROFILE_NAMES[countryCode] || { nameOrder: 'western', firstNames: GENERIC_NAMES.firstNames, lastNames: GENERIC_NAMES.lastNames }
  const firstName = pick(names.firstNames)
  const middleName = genMiddleName({ ...names, _lastFirstNamePick: firstName })
  const lastName = pick(names.lastNames)
  const fullName = buildFullName(names.nameOrder, firstName, middleName, lastName)

  const nationalIds = NATIONAL_ID_TYPES.filter(t => t.country === countryCode)
    .map(t => ({ label: t.label, value: t.generate() }))

  const passportNumber = genPassportNumber(countryCode)
  const mrzName = MRZ_NON_LATIN_NAME[countryCode] ||
    { surname: transliterateForMrz(lastName), given: transliterateForMrz(firstName) }
  const mrz = buildPassportMrz(country.alpha3, passportNumber, mrzName.surname, mrzName.given)

  const address = genAddress(countryCode, names)

  return {
    firstName, middleName, lastName, fullName,
    addressLine: address.addressLine,
    district: address.district,
    city: address.city,
    postalCode: address.postalCode,
    phoneNumber: genPhoneNumber(countryCode),
    nationalIds,
    passportNumber,
    mrz
  }
}

// ---- Company data: company name, tax code, business registration number, per country ----
// Every checksummed generator below was verified against python-stdnum's actual source (see git
// history / research notes) with a real test vector. Several countries use ONE unified number for
// both roles (noted per-country below) — that's not a simplification, it reflects how e.g. Brazil's
// CNPJ or the USA's EIN really work. A few (UK, USA, Malaysia) have no real checksum for one or
// both fields — noted inline, matching the same "structure only" honesty used elsewhere.

const COMPANY_SUFFIXES = {
  br: ['Ltda.', 'S.A.'], bg: ['EOOD', 'OOD'], cl: ['Ltda.', 'SpA'], cn: ['有限公司'],
  fi: ['Oy'], fr: ['SARL', 'SAS'], in: ['Pvt. Ltd.'], id: ['PT'], it: ['S.r.l.', 'S.p.A.'],
  my: ['Sdn Bhd'], no: ['AS'], pl: ['Sp. z o.o.'], pt: ['Lda.', 'S.A.'], ro: ['SRL'],
  za: ['(Pty) Ltd'], es: ['S.L.', 'S.A.'], se: ['AB'], gb: ['Ltd'], us: ['LLC', 'Inc.'],
  vn: ['Công ty TNHH', 'Công ty Cổ phần'], sg: ['Pte Ltd']
}

function genCompanyName(countryCode, names) {
  const suffix = pick(COMPANY_SUFFIXES[countryCode] || ['Ltd'])
  const base = pick(names.lastNames)
  if (countryCode === 'cn') return `${base}${suffix}` // no space, matches Chinese convention
  if (countryCode === 'id' || countryCode === 'vn') return `${suffix} ${base}` // entity type precedes the name
  return `${base} ${suffix}`
}

function genCNPJ_BR() { // Brazil — checksum verified; unified tax code + registration number
  const digits = randDigits(12).split('').map(Number)
  const w1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
  let s1 = 0
  for (let i = 0; i < 12; i++) s1 += w1[i] * digits[i]
  const d1 = collapse11to10(s1)
  const w2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
  const withD1 = [...digits, d1]
  let s2 = 0
  for (let i = 0; i < 13; i++) s2 += w2[i] * withD1[i]
  const d2 = collapse11to10(s2)
  return `${digits.join('')}${d1}${d2}`
}

function genVAT_BG_company() { // Bulgaria — checksum verified (9-digit legal-entity form)
  const digits = randDigits(8).split('').map(Number)
  let sum = 0
  for (let i = 0; i < 8; i++) sum += (i + 1) * digits[i]
  let check = mod(sum, 11)
  if (check === 10) {
    let sum2 = 0
    for (let i = 0; i < 8; i++) sum2 += (i + 3) * digits[i]
    check = mod(sum2, 11)
  }
  return `${digits.join('')}${check % 10}`
}

const USCC_ALPHABET = '0123456789ABCDEFGHJKLMNPQRTUWXY'

function genUSCC_CN() { // China — checksum verified (Unified Social Credit Code)
  const weights = [1, 3, 9, 27, 19, 26, 16, 17, 20, 29, 25, 13, 8, 24, 10, 30, 28]
  const orgCode = Array.from({ length: 9 }, () => USCC_ALPHABET[randInt(0, USCC_ALPHABET.length - 1)]).join('')
  const body = `9${pick(['1', '2', '3'])}${randDigits(6)}${orgCode}`
  let total = 0
  for (let i = 0; i < 17; i++) total += USCC_ALPHABET.indexOf(body[i]) * weights[i]
  return `${body}${USCC_ALPHABET[mod(31 - total, 31)]}`
}

function genYTunnus_FI() { // Finland — checksum verified; unified (VAT = "FI" + this number)
  const weights7 = [7, 9, 10, 5, 8, 4, 2]
  for (let attempt = 0; attempt < 50; attempt++) {
    const digits = randDigits(7).split('').map(Number)
    let sum7 = 0
    for (let i = 0; i < 7; i++) sum7 += weights7[i] * digits[i]
    const check = mod(-sum7, 11)
    if (check === 10) continue // that residue has no valid single check digit
    return `${digits.join('')}${check}`
  }
  return null
}

function genSIREN_FR() { // France — checksum verified (standard Luhn)
  const body = randDigits(8)
  return body + luhnCheckDigit(body)
}

function genTVA_FR(siren) { // France VAT is derived FROM the SIREN, not independently assigned
  const check = Number(siren + '12') % 97
  return `FR${pad(check, 2)}${siren}`
}

function genPAN_IN(holderType) { // India — final check letter is unchecked (stdnum's own docstring
  // flags PAN's real algorithm as undocumented) — any letter passes real-world validation here.
  const first3 = Array.from({ length: 3 }, () => randLetter()).join('')
  return `${first3}${holderType}${randLetter()}${pad(randInt(1, 9999), 4)}${randLetter()}`
}

const GSTIN_ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'
const IN_STATE_CODES = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '19', '20',
  '21', '22', '23', '24', '27', '29', '32', '33', '36', '37']

function genGSTIN_IN() { // India — checksum verified (Luhn-mod-36); embeds a PAN
  const body14 = `${pick(IN_STATE_CODES)}${genPAN_IN('C')}${randInt(1, 9)}Z`
  return `${body14}${luhnCheckDigitGeneric(body14, GSTIN_ALPHABET)}`
}

function genNPWP_ID_company() { // Indonesia — checksum verified; business NPWP always starts with 0
  const entityType = pad(randInt(0, 99), 2)
  const taxpayerId = randDigits(6)
  const body9 = `0${entityType}${taxpayerId}`
  const check = luhnCheckDigit(body9)
  return `${body9}${check}${randDigits(3)}${randDigits(3)}`
}

const IT_PROVINCE_CODES = ['001', '002', '003', '010', '015', '050', '100']

function genIVA_IT() { // Italy — checksum verified (standard Luhn)
  const companyId = pad(randInt(1, 9999999), 7)
  const body10 = `${companyId}${pick(IT_PROVINCE_CODES)}`
  return body10 + luhnCheckDigit(body10)
}

function genOrgnr_NO() { // Norway — checksum verified
  const weights = [3, 2, 7, 6, 5, 4, 3, 2]
  for (let attempt = 0; attempt < 50; attempt++) {
    const digits = randDigits(8).split('').map(Number)
    let sum = 0
    for (let i = 0; i < 8; i++) sum += weights[i] * digits[i]
    const check = mod(-sum, 11)
    if (check === 10) continue
    return `${digits.join('')}${check}`
  }
  return null
}

function genNIP_PL() { // Poland Tax Code — checksum verified
  const weights = [6, 5, 7, 2, 3, 4, 5, 6, 7]
  for (let attempt = 0; attempt < 50; attempt++) {
    const digits = randDigits(9).split('').map(Number)
    let sum = 0
    for (let i = 0; i < 9; i++) sum += weights[i] * digits[i]
    const check = mod(sum, 11)
    if (check === 10) continue
    return `${digits.join('')}${check}`
  }
  return null
}

function genREGON_PL() { // Poland Business Registration Number — checksum verified (9-digit form)
  const weights = [8, 9, 2, 3, 4, 5, 6, 7]
  const digits = randDigits(8).split('').map(Number)
  let sum = 0
  for (let i = 0; i < 8; i++) sum += weights[i] * digits[i]
  return `${digits.join('')}${mod(sum, 11) % 10}`
}

function genNIF_PT_company() { // Portugal — checksum verified; leading digit 5 is real-world
  // convention for companies, not something stdnum's validator itself enforces
  const digits = (`5${randDigits(7)}`).split('').map(Number)
  let s = 0
  for (let i = 0; i < 8; i++) s += (9 - i) * digits[i]
  return `${digits.join('')}${collapse11to10(s)}`
}

function genCUI_RO() { // Romania Tax Code — checksum verified
  const bodyLen = randInt(6, 8)
  const body = String(randInt(Math.pow(10, bodyLen - 1), Math.pow(10, bodyLen) - 1))
  const padded = body.padStart(9, '0').split('').map(Number)
  const weights = [7, 5, 3, 2, 1, 7, 5, 3, 2]
  let sum = 0
  for (let i = 0; i < 9; i++) sum += weights[i] * padded[i]
  const check = mod(10 * sum, 11) % 10
  return `${body}${check}`
}

function genONRC_RO() { // Romania Business Registration Number — checksum verified (new,
  // post-2024 format: letter + year + serial + county + check digit)
  const letter = pick(['J', 'F', 'C'])
  const year = String(randInt(2024, 2026))
  const serial = pad(randInt(0, 999999), 6)
  const county = '00'
  const transformed = String(letter.charCodeAt(0) % 10) + year + serial + county
  const check = transformed.split('').reduce((s, c) => s + Number(c), 0) % 10
  return `${letter}${year}${serial}${county}${check}`
}

function genTIN_ZA_company() { // South Africa — checksum verified (standard Luhn)
  const body = `${pick(['0', '1', '2', '3', '9'])}${randDigits(8)}`
  return body + luhnCheckDigit(body)
}

const ES_CIF_LETTERS = 'ABCDEFGHJNPQRSUVW'

function genCIF_ES() { // Spain — checksum verified (Luhn over the middle 7 digits)
  const middle7 = randDigits(7)
  return `${pick(ES_CIF_LETTERS.split(''))}${middle7}${luhnCheckDigit(middle7)}`
}

function genOrgnr_SE() { // Sweden — checksum verified (standard Luhn); VAT = "SE" + this + "01"
  const body = randDigits(9)
  return body + luhnCheckDigit(body)
}

function genVAT_GB_company() { // UK VAT — checksum verified (weighted mod 97)
  const weights = [8, 7, 6, 5, 4, 3, 2]
  const base = randDigits(7).split('').map(Number)
  let sumBase = 0
  for (let i = 0; i < 7; i++) sumBase += weights[i] * base[i]
  const suffix = mod(-sumBase, 97) // always 0-96, always fits 2 digits
  return `${base.join('')}${pad(suffix, 2)}`
}

function genUTR_GB() { // UK UTR — checksum verified (check digit is the FIRST character)
  const weights = [6, 7, 8, 9, 10, 5, 4, 3, 2]
  const body = randDigits(9).split('').map(Number)
  let sum = 0
  for (let i = 0; i < 9; i++) sum += weights[i] * body[i]
  return `${'21987654321'[sum % 11]}${body.join('')}`
}

function genCompanyNumber_GB() { // UK Companies House number — structure only, no checksum
  return pad(randInt(0, 99999999), 8)
}

function genEIN_US() { // USA — structure only; real validity depends on an IRS campus-prefix
  // lookup table this tool doesn't have (per stdnum's own source, no digit-weighted checksum exists)
  return `${pad(randInt(10, 99), 2)}-${randDigits(7)}`
}

function genMST_VN() { // Vietnam — checksum verified
  const weights = [31, 29, 23, 19, 17, 13, 7, 5, 3]
  for (let attempt = 0; attempt < 50; attempt++) {
    const digits = randDigits(9).split('').map(Number)
    let total = 0
    for (let i = 0; i < 9; i++) total += weights[i] * digits[i]
    const r = total % 11
    if (r === 0) continue // formula gives '10' here, not a valid single digit
    return `${digits.join('')}${10 - r}`
  }
  return null
}

const UEN_ROC_LETTERS = 'ZKCMDNERGWH'

function genUEN_SG() { // Singapore — checksum verified (Local Company / ROC format)
  const weights = [10, 8, 6, 4, 9, 7, 5, 3, 1]
  const year = randInt(1968, 2026)
  const digits = `${year}${pad(randInt(0, 99999), 5)}`.split('').map(Number)
  let sum = 0
  for (let i = 0; i < 9; i++) sum += weights[i] * digits[i]
  return `${digits.join('')}${UEN_ROC_LETTERS[sum % 11]}`
}

function genTIN_MY_company() { // Malaysia Tax Code — structure only (verified format, no checksum)
  return `C${randDigits(10)}`
}

function genSSM_MY() { // Malaysia Business Registration Number — structure only (verified format,
  // no checksum): year + 2-digit entity type + 6-digit sequence, per the 2019 SSM format change
  return `${randInt(2000, 2026)}${pad(randInt(0, 99), 2)}${pad(randInt(0, 999999), 6)}`
}

// The single entry point the UI uses for the Company section. Each generator that can return null
// (a rare reroll-exhausted path) is retried via generateWithRetry.
function generateCompany(countryCode, names) {
  const companyName = genCompanyName(countryCode, names)
  let taxCode, businessRegNumber

  switch (countryCode) {
    case 'br': taxCode = businessRegNumber = genCNPJ_BR(); break
    case 'bg': taxCode = businessRegNumber = genVAT_BG_company(); break
    case 'cl': taxCode = businessRegNumber = genRUT(); break // Chile: RUT covers both individuals and companies
    case 'cn': taxCode = businessRegNumber = genUSCC_CN(); break
    case 'fi': { const v = generateWithRetry(genYTunnus_FI); taxCode = `FI${v}`; businessRegNumber = v; break }
    case 'fr': { const siren = generateWithRetry(genSIREN_FR); businessRegNumber = siren; taxCode = genTVA_FR(siren); break }
    case 'in': taxCode = genPAN_IN('C'); businessRegNumber = genGSTIN_IN(); break
    case 'id': taxCode = businessRegNumber = genNPWP_ID_company(); break
    case 'it': taxCode = businessRegNumber = genIVA_IT(); break
    case 'no': taxCode = businessRegNumber = generateWithRetry(genOrgnr_NO); break
    case 'pl': taxCode = generateWithRetry(genNIP_PL); businessRegNumber = genREGON_PL(); break
    case 'pt': taxCode = businessRegNumber = genNIF_PT_company(); break
    case 'ro': taxCode = genCUI_RO(); businessRegNumber = genONRC_RO(); break
    case 'za': taxCode = businessRegNumber = genTIN_ZA_company(); break
    case 'es': taxCode = businessRegNumber = genCIF_ES(); break
    case 'se': { const v = genOrgnr_SE(); taxCode = `SE${v}01`; businessRegNumber = v; break }
    case 'gb': taxCode = genUTR_GB(); businessRegNumber = genCompanyNumber_GB(); break
    case 'us': taxCode = businessRegNumber = genEIN_US(); break
    case 'vn': taxCode = businessRegNumber = generateWithRetry(genMST_VN); break
    case 'sg': taxCode = businessRegNumber = genUEN_SG(); break
    case 'my': taxCode = genTIN_MY_company(); businessRegNumber = genSSM_MY(); break
    default: taxCode = businessRegNumber = randDigits(9)
  }

  return { companyName, taxCode, businessRegNumber }
}

// ---- Wiring ----
;(function initProfileTool() {
  const countryTrigger = document.getElementById('pf-country-trigger')
  const countryTriggerLabel = document.getElementById('pf-country-trigger-label')
  const countryPanel = document.getElementById('pf-country-panel')
  const generateBtn = document.getElementById('pf-generate')
  const fieldsEl = document.getElementById('pf-fields')
  const errorEl = document.getElementById('pf-error')

  if (!countryTrigger) return // Profile tab not present in this build

  let currentCountry = 'br'

  const COPY_ICON = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>'
  const CHECK_ICON = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>'

  function renderCountryOptions() {
    countryPanel.innerHTML = ID_COUNTRIES.map(c =>
      `<button type="button" class="ft-select-option${c.code === currentCountry ? ' active' : ''}" data-value="${c.code}">${c.name}</button>`
    ).join('')
  }

  function setCountry(code) {
    currentCountry = code
    const c = ID_COUNTRIES.find(x => x.code === code)
    countryTriggerLabel.textContent = c ? c.name : code
    renderCountryOptions()
  }

  function openPanel() {
    countryPanel.hidden = false
    const rect = countryTrigger.getBoundingClientRect()
    countryPanel.style.left = rect.left + 'px'
    countryPanel.style.width = rect.width + 'px'
    countryPanel.style.top = (rect.bottom + 4) + 'px'
    countryPanel.style.maxHeight = Math.max(120, window.innerHeight - rect.bottom - 12) + 'px'
  }

  function closePanel() {
    countryPanel.hidden = true
  }

  countryTrigger.addEventListener('click', () => {
    const wasHidden = countryPanel.hidden
    closePanel()
    if (wasHidden) openPanel()
  })
  countryPanel.addEventListener('click', e => {
    const opt = e.target.closest('.ft-select-option')
    if (!opt) return
    setCountry(opt.dataset.value)
    saveSettings()
    closePanel()
    generate()
  })
  document.addEventListener('click', e => {
    if (!countryPanel.contains(e.target) && !countryTrigger.contains(e.target)) closePanel()
  })

  function escapeHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
  }

  function fieldRow(label, value) {
    const escaped = escapeHtml(value)
    return `<div class="pf-field">
      <div class="pf-field-label">${label}</div>
      <div class="pf-field-value-wrap">
        <input type="text" class="pf-field-value" readonly value="${escaped}">
        <button type="button" class="tt-copy-icon-btn pf-copy-btn" data-copy="${escaped}" aria-label="Copy" title="Copy to clipboard">${COPY_ICON}</button>
      </div>
    </div>`
  }

  function mrzRow(mrzText) {
    const escaped = escapeHtml(mrzText)
    return `<div class="pf-field">
      <div class="pf-field-label">Passport MRZ</div>
      <div class="pf-field-value-wrap">
        <pre class="pf-mrz-box">${escaped}</pre>
        <button type="button" class="tt-copy-icon-btn pf-copy-btn" data-copy="${escaped}" aria-label="Copy" title="Copy to clipboard">${COPY_ICON}</button>
      </div>
    </div>`
  }

  function sectionHeader(title) {
    return `<h3 class="pf-section-header">${title}</h3>`
  }

  function renderProfile(profile, company) {
    const rows = [
      sectionHeader('Personal'),
      fieldRow('First Name', profile.firstName),
      fieldRow('Middle Name', profile.middleName),
      fieldRow('Last Name', profile.lastName),
      fieldRow('Full Name', profile.fullName),
      fieldRow('Address Line', profile.addressLine),
      ...(profile.district ? [fieldRow('District', profile.district)] : []),
      ...(profile.city ? [fieldRow('City / Province', profile.city)] : []),
      fieldRow('Postal Code', profile.postalCode),
      fieldRow('Phone Number', profile.phoneNumber),
      ...profile.nationalIds.map(id => fieldRow(id.label, id.value)),
      fieldRow('Passport Number', profile.passportNumber),
      mrzRow(`${profile.mrz.line1}\n${profile.mrz.line2}`),
      sectionHeader('Company'),
      fieldRow('Company Name', company.companyName),
      fieldRow('Tax Code', company.taxCode),
      fieldRow('Business Registration Number', company.businessRegNumber)
    ]
    fieldsEl.innerHTML = rows.join('')
  }

  fieldsEl.addEventListener('click', e => {
    const btn = e.target.closest('.pf-copy-btn')
    if (!btn) return
    navigator.clipboard.writeText(btn.dataset.copy).then(() => {
      btn.innerHTML = CHECK_ICON
      btn.classList.add('copied')
      setTimeout(() => {
        btn.innerHTML = COPY_ICON
        btn.classList.remove('copied')
      }, 1400)
    })
  })

  function generate() {
    errorEl.hidden = true
    try {
      const names = PROFILE_NAMES[currentCountry] || GENERIC_NAMES
      renderProfile(generateProfile(currentCountry), generateCompany(currentCountry, names))
    } catch (err) {
      errorEl.textContent = err.message
      errorEl.hidden = false
      fieldsEl.innerHTML = ''
    }
  }

  generateBtn.addEventListener('click', generate)

  const resetBtn = document.getElementById('pf-reset-btn')
  const SETTINGS_KEY = 'profile-tool-country'
  const DEFAULT_COUNTRY = 'br'
  function saveSettings() { syncSet({ [SETTINGS_KEY]: currentCountry }) }
  resetBtn.addEventListener('click', () => { setCountry(DEFAULT_COUNTRY); saveSettings(); generate() })

  syncGet([SETTINGS_KEY]).then(d => { setCountry(d[SETTINGS_KEY] || DEFAULT_COUNTRY); generate() })
})()
