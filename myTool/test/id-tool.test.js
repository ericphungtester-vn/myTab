const { test, describe } = require('node:test')
const assert = require('node:assert/strict')
const { loadToolScript } = require('./helpers/loadScript')

const lib = loadToolScript('js/id-tool.js')
const {
  mod, luhnChecksum, luhnCheckDigit, verhoeffChecksum, verhoeffCheckDigit,
  iso7064Mod112Checksum, iso7064Mod112CheckChar, collapse11to10, mrzCheckDigit,
  genCodiceFiscale, genCPF, genRUT, genNIF_PT, genNIR_FR, genDNI_ES, genNIE_ES,
  genPersonnummer_SE, genFodselsnummer_NO, genPESEL_PL, genCNP_RO, genEGN_BG,
  genHETU_FI, genIDNr_ZA, genRIC_CN, genAadhaar_IN, genCCCD_VN, genSSN_US, genNINO_GB, genNRIC_SG,
  generateWithRetry, genPassportNumber, buildPassportMrz, PASSPORT_FORMATS,
  ID_COUNTRIES, NATIONAL_ID_TYPES
} = lib

// ---- Shared low-level checksum algorithms, verified against python-stdnum's own doctests ----
describe('shared checksum primitives', () => {
  test('luhn: known vector from python-stdnum (checksum(7894)==6, check digit 9)', () => {
    assert.equal(luhnChecksum('7894'), 6)
    assert.equal(luhnCheckDigit('7894'), '9')
    assert.equal(luhnChecksum('78949'), 0) // a valid full number always checksums to 0
  })

  test('verhoeff: known vector from python-stdnum (checksum(1234)==1, check digit 0)', () => {
    assert.equal(verhoeffChecksum('1234'), 1)
    assert.equal(verhoeffCheckDigit('1234'), '0')
    assert.equal(verhoeffChecksum('12340'), 0)
  })

  test('iso7064 mod 11-2: known vectors from python-stdnum (calc_check_digit)', () => {
    assert.equal(iso7064Mod112CheckChar('0794'), '0')
    assert.equal(iso7064Mod112CheckChar('079'), 'X')
    assert.equal(iso7064Mod112Checksum('079X'), 1) // a valid full number (with its own check char) checksums to 1
  })

  test('mrz check digit: ICAO 9303 weights 7/3/1, "<" treated as 0', () => {
    // These match the reference `mrz` Python package's own doctests for hash_string().
    assert.equal(mrzCheckDigit('ABCDEFGHIJKLMNOPQRSTUVWXYZ'), '7')
    assert.equal(mrzCheckDigit('0123456789'), '7')
    assert.equal(mrzCheckDigit('0123456789ABCDEF'), '0')
    assert.equal(mrzCheckDigit('0'), '0')
  })
})

// Each generator below is checked two ways: (1) against a real published test vector, verified
// independently from python-stdnum's source (not derived from our own generator), and (2) across
// many random generations, by recomputing the checksum from scratch rather than trusting the
// generator's own internal math — the same discipline used for the file-format tests.
describe('National ID generators: real test vectors', () => {
  test('Brazil CPF: 390.533.447-05 is a real valid vector', () => {
    const digits = '390533447'.split('').map(Number)
    let s1 = 0
    for (let i = 0; i < 9; i++) s1 += (10 - i) * digits[i]
    const d1 = collapse11to10(s1)
    let s2 = 2 * d1
    for (let i = 0; i < 9; i++) s2 += (11 - i) * digits[i]
    const d2 = collapse11to10(s2)
    assert.equal(`${d1}${d2}`, '05')
  })

  test('Chile RUT: body 12531909 -> check char 2 is a real valid vector', () => {
    const rev = '12531909'.split('').reverse().map(Number)
    let sum = 0
    for (let i = 0; i < rev.length; i++) sum += rev[i] * (4 + mod(5 - i, 6))
    assert.equal('0123456789K'[sum % 11], '2')
  })

  test('Portugal NIF: 501964843 is a real valid vector', () => {
    const digits = '50196484'.split('').map(Number)
    let s = 0
    for (let i = 0; i < 8; i++) s += (9 - i) * digits[i]
    assert.equal(collapse11to10(s), 3)
  })

  test('Spain DNI: 54362315 -> K is a real valid vector', () => {
    assert.equal('TRWAGMYFPDXBNJZSQVHLCKE'[54362315 % 23], 'K')
  })

  test('Spain NIE: X2482300 -> W is a real valid vector', () => {
    const combined = '0' + '2482300'
    assert.equal('TRWAGMYFPDXBNJZSQVHLCKE'[Number(combined) % 23], 'W')
  })

  test('Singapore NRIC: S9470855I and T7123769E are real valid vectors', () => {
    const CHECK_ST = ['J', 'Z', 'I', 'H', 'G', 'F', 'E', 'D', 'C', 'B', 'A']
    const weights = [2, 7, 6, 5, 4, 3, 2]
    function checkLetter(prefix, digitsStr) {
      const digits = digitsStr.split('').map(Number)
      let sum = 0
      for (let i = 0; i < 7; i++) sum += digits[i] * weights[i]
      const offset = prefix === 'T' ? 4 : 0
      return CHECK_ST[mod(sum + offset, 11)]
    }
    assert.equal(checkLetter('S', '9470855'), 'I')
    assert.equal(checkLetter('T', '7123769'), 'E')
  })
})

describe('National ID generators: exact-formula round trip (many random samples)', () => {
  test('Codice Fiscale (Italy): CIN always matches independent recomputation', () => {
    const CIN = {
      0: [1, 0], 1: [0, 1], 2: [5, 2], 3: [7, 3], 4: [9, 4], 5: [13, 5], 6: [15, 6], 7: [17, 7], 8: [19, 8], 9: [21, 9],
      A: [1, 0], B: [0, 1], C: [5, 2], D: [7, 3], E: [9, 4], F: [13, 5], G: [15, 6], H: [17, 7], I: [19, 8], J: [21, 9],
      K: [2, 10], L: [4, 11], M: [18, 12], N: [20, 13], O: [11, 14], P: [3, 15], Q: [6, 16], R: [8, 17], S: [12, 18],
      T: [14, 19], U: [16, 20], V: [10, 21], W: [22, 22], X: [25, 23], Y: [24, 24], Z: [23, 25]
    }
    for (let i = 0; i < 50; i++) {
      const code = genCodiceFiscale()
      assert.equal(code.length, 16)
      assert.match(code, /^[A-Z]{6}[0-9]{2}[ABCDEHLMPRST][0-9]{2}[A-Z][0-9]{3}[A-Z]$/)
      let total = 0
      for (let pos = 0; pos < 15; pos++) total += CIN[code[pos]][(pos + 1) % 2 === 1 ? 1 : 0]
      assert.equal('ABCDEFGHIJKLMNOPQRSTUVWXYZ'[total % 26], code[15])
    }
  })

  test('CPF (Brazil): every generated number recomputes to the same two check digits', () => {
    for (let i = 0; i < 50; i++) {
      const value = genCPF()
      const digits = value.replace(/\D/g, '')
      assert.equal(digits.length, 11)
      const d = digits.split('').map(Number)
      let s1 = 0
      for (let i2 = 0; i2 < 9; i2++) s1 += (10 - i2) * d[i2]
      const d1 = collapse11to10(s1)
      let s2 = 2 * d1
      for (let i2 = 0; i2 < 9; i2++) s2 += (11 - i2) * d[i2]
      const d2 = collapse11to10(s2)
      assert.equal(d[9], d1)
      assert.equal(d[10], d2)
    }
  })

  test('RUT (Chile): check char matches independent recomputation', () => {
    for (let i = 0; i < 50; i++) {
      const value = genRUT()
      const compact = value.replace(/[.\-]/g, '')
      const body = compact.slice(0, 8)
      const checkChar = compact.slice(8)
      const rev = body.split('').reverse().map(Number)
      let sum = 0
      for (let j = 0; j < rev.length; j++) sum += rev[j] * (4 + mod(5 - j, 6))
      assert.equal('0123456789K'[sum % 11], checkChar)
    }
  })

  test('NIF (Portugal): check digit matches independent recomputation', () => {
    for (let i = 0; i < 50; i++) {
      const value = genNIF_PT()
      assert.equal(value.length, 9)
      const d = value.split('').map(Number)
      let s = 0
      for (let j = 0; j < 8; j++) s += (9 - j) * d[j]
      assert.equal(collapse11to10(s), d[8])
      assert.notEqual(value[0], '0')
    }
  })

  test('NIR (France): mod-97 check digits match independent recomputation', () => {
    for (let i = 0; i < 50; i++) {
      const value = genNIR_FR()
      assert.equal(value.length, 15)
      const first13 = value.slice(0, 13)
      const check = value.slice(13)
      assert.equal(pad2(97 - (Number(first13) % 97)), check)
    }
    function pad2(n) { return String(n).padStart(2, '0') }
  })

  test('DNI (Spain): mod-23 letter matches independent recomputation', () => {
    for (let i = 0; i < 50; i++) {
      const value = genDNI_ES()
      const body = value.slice(0, 8)
      const letter = value.slice(8)
      assert.equal('TRWAGMYFPDXBNJZSQVHLCKE'[Number(body) % 23], letter)
    }
  })

  test('NIE (Spain): leading X/Y/Z + mod-23 letter matches independent recomputation', () => {
    for (let i = 0; i < 50; i++) {
      const value = genNIE_ES()
      const prefix = value[0]
      const digits7 = value.slice(1, 8)
      const letter = value.slice(8)
      assert.ok('XYZ'.includes(prefix))
      const combined = String('XYZ'.indexOf(prefix)) + digits7
      assert.equal('TRWAGMYFPDXBNJZSQVHLCKE'[Number(combined) % 23], letter)
    }
  })

  test('Personnummer (Sweden): Luhn check digit over the 10-digit form', () => {
    for (let i = 0; i < 50; i++) {
      const value = genPersonnummer_SE()
      const compact = value.replace('-', '')
      assert.equal(compact.length, 10)
      assert.equal(luhnChecksum(compact), 0)
    }
  })

  test('Fødselsnummer (Norway): both mod-11 check digits match, never 10', () => {
    for (let i = 0; i < 50; i++) {
      const value = generateWithRetry(genFodselsnummer_NO)
      assert.equal(value.length, 11)
      const nine = value.slice(0, 9).split('').map(Number)
      const w1 = [3, 7, 6, 1, 8, 9, 4, 5, 2]
      let s1 = 0
      for (let j = 0; j < 9; j++) s1 += w1[j] * nine[j]
      const c1 = mod(11 - mod(s1, 11), 11)
      assert.equal(String(c1), value[9])
      const ten = value.slice(0, 10).split('').map(Number)
      const w2 = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2]
      let s2 = 0
      for (let j = 0; j < 10; j++) s2 += w2[j] * ten[j]
      const c2 = mod(11 - mod(s2, 11), 11)
      assert.equal(String(c2), value[10])
    }
  })

  test('PESEL (Poland): mod-10 check digit matches independent recomputation', () => {
    for (let i = 0; i < 50; i++) {
      const value = genPESEL_PL()
      assert.equal(value.length, 11)
      const ten = value.slice(0, 10).split('').map(Number)
      const weights = [1, 3, 7, 9, 1, 3, 7, 9, 1, 3]
      let s = 0
      for (let j = 0; j < 10; j++) s += weights[j] * ten[j]
      assert.equal(String(mod(10 - mod(s, 10), 10)), value[10])
    }
  })

  test('CNP (Romania): mod-11 check digit matches independent recomputation (unverified-by-source algorithm)', () => {
    for (let i = 0; i < 50; i++) {
      const value = genCNP_RO()
      assert.equal(value.length, 13)
      const twelve = value.slice(0, 12).split('').map(Number)
      const weights = [2, 7, 9, 1, 4, 6, 3, 5, 8, 2, 7, 9]
      let s = 0
      for (let j = 0; j < 12; j++) s += weights[j] * twelve[j]
      const r = s % 11
      assert.equal(r === 10 ? '1' : String(r), value[12])
    }
  })

  test('EGN (Bulgaria): mod-11-mod-10 check digit matches independent recomputation', () => {
    for (let i = 0; i < 50; i++) {
      const value = genEGN_BG()
      assert.equal(value.length, 10)
      const nine = value.slice(0, 9).split('').map(Number)
      const weights = [2, 4, 8, 5, 10, 9, 7, 3, 6]
      let s = 0
      for (let j = 0; j < 9; j++) s += weights[j] * nine[j]
      assert.equal(String(mod(s, 11) % 10), value[9])
    }
  })

  test('HETU (Finland): mod-31 control character matches independent recomputation', () => {
    for (let i = 0; i < 50; i++) {
      const value = genHETU_FI()
      const checkable = value.slice(0, 6) + value.slice(7, 10) // DDMMYY + individual number (skips the century-sign separator)
      const control = value.slice(-1)
      assert.equal('0123456789ABCDEFHJKLMNPRSTUVWXY'[Number(checkable) % 31], control)
    }
  })

  test('ID Number (South Africa): Luhn check digit over the full 13 digits', () => {
    for (let i = 0; i < 50; i++) {
      const value = genIDNr_ZA()
      assert.equal(value.length, 13)
      assert.equal(luhnChecksum(value), 0)
    }
  })

  test('Resident ID Card No. (China): ISO 7064 Mod 11-2 check character', () => {
    for (let i = 0; i < 50; i++) {
      const value = genRIC_CN()
      assert.equal(value.length, 18)
      assert.equal(iso7064Mod112CheckChar(value.slice(0, 17)), value[17])
    }
  })

  test('Aadhaar (India): Verhoeff check digit, first digit 2-9, never a palindrome', () => {
    for (let i = 0; i < 50; i++) {
      const value = generateWithRetry(genAadhaar_IN)
      assert.equal(value.length, 12)
      assert.ok(Number(value[0]) >= 2 && Number(value[0]) <= 9)
      assert.equal(verhoeffChecksum(value), 0)
      assert.notEqual(value, value.split('').reverse().join(''))
    }
  })

  test('NRIC/FIN (Singapore): check letter matches independent recomputation for every prefix', () => {
    const weights = [2, 7, 6, 5, 4, 3, 2]
    const CHECK_ST = ['J', 'Z', 'I', 'H', 'G', 'F', 'E', 'D', 'C', 'B', 'A']
    const CHECK_FG = ['X', 'W', 'U', 'T', 'R', 'Q', 'P', 'N', 'M', 'L', 'K']
    const CHECK_M = ['X', 'W', 'U', 'T', 'R', 'Q', 'P', 'N', 'J', 'L', 'K']
    for (let i = 0; i < 50; i++) {
      for (const prefixPool of [['S', 'T'], ['F', 'G', 'M']]) {
        const value = genNRIC_SG(prefixPool)
        assert.equal(value.length, 9)
        const prefix = value[0]
        const digits = value.slice(1, 8).split('').map(Number)
        const check = value[8]
        let sum = 0
        for (let j = 0; j < 7; j++) sum += digits[j] * weights[j]
        const offset = prefix === 'T' || prefix === 'G' ? 4 : prefix === 'M' ? 3 : 0
        const table = (prefix === 'S' || prefix === 'T') ? CHECK_ST : prefix === 'M' ? CHECK_M : CHECK_FG
        assert.equal(table[mod(sum + offset, 11)], check)
      }
    }
  })
})

describe('Structure-only generators (no public checksum)', () => {
  test('CCCD (Vietnam): 12 digits', () => {
    for (let i = 0; i < 20; i++) assert.match(genCCCD_VN(), /^\d{12}$/)
  })

  test('SSN (USA): AAA-GG-SSSS, avoids reserved area codes', () => {
    for (let i = 0; i < 50; i++) {
      const value = genSSN_US()
      assert.match(value, /^\d{3}-\d{2}-\d{4}$/)
      const area = value.slice(0, 3)
      assert.notEqual(area, '000')
      assert.notEqual(area, '666')
      assert.ok(Number(area) < 900)
    }
  })

  test('NINO (UK): 2 letters + 6 digits + suffix letter, excludes reserved prefixes/letters', () => {
    const excluded = ['BG', 'GB', 'NK', 'KN', 'TN', 'NT', 'ZZ']
    for (let i = 0; i < 50; i++) {
      const value = genNINO_GB()
      assert.match(value, /^[A-Z]{2} \d{2} \d{2} \d{2} [ABCD]$/)
      const prefix = value.slice(0, 2)
      assert.ok(!excluded.includes(prefix))
      assert.ok(!'DFIQUV'.includes(prefix[0]))
      assert.ok(!'DFIQUVO'.includes(prefix[1]))
    }
  })
})

describe('Passport numbers and MRZ', () => {
  test('every country produces a passport number matching its declared format', () => {
    for (const country of ID_COUNTRIES) {
      const spec = PASSPORT_FORMATS[country.code]
      const value = genPassportNumber(country.code)
      assert.equal(value.length, spec.letters + spec.digits, `${country.code}: ${value}`)
      assert.match(value.slice(0, spec.letters), /^[A-Z]*$/)
      assert.match(value.slice(spec.letters), /^\d*$/)
    }
  })

  test('MRZ TD3: both lines are exactly 44 characters for every country', () => {
    for (const country of ID_COUNTRIES) {
      const { line1, line2 } = buildPassportMrz(country.alpha3, genPassportNumber(country.code))
      assert.equal(line1.length, 44, country.code)
      assert.equal(line2.length, 44, country.code)
      assert.equal(line1.slice(0, 2), 'P<')
      assert.equal(line1.slice(2, 5), country.alpha3)
    }
  })

  test('MRZ TD3: composite check digit matches independent recomputation', () => {
    for (let i = 0; i < 20; i++) {
      const { line1, line2 } = buildPassportMrz('ITA', genPassportNumber('it'))
      const docNumberField = line2.slice(0, 9)
      const docNumberCheck = line2[9]
      const birthDate = line2.slice(13, 19)
      const birthDateCheck = line2[19]
      const expiryDate = line2.slice(21, 27)
      const expiryDateCheck = line2[27]
      const optionalData = line2.slice(28, 42)
      const optionalDataCheck = line2[42]
      const finalCheck = line2[43]
      assert.equal(mrzCheckDigit(docNumberField), docNumberCheck)
      assert.equal(mrzCheckDigit(birthDate), birthDateCheck)
      assert.equal(mrzCheckDigit(expiryDate), expiryDateCheck)
      assert.equal(mrzCheckDigit(optionalData), optionalDataCheck)
      const finalString = docNumberField + docNumberCheck + birthDate + birthDateCheck +
        expiryDate + expiryDateCheck + optionalData + optionalDataCheck
      assert.equal(mrzCheckDigit(finalString), finalCheck)
      assert.ok(line1.includes('TESTPERSON') && line1.includes('SAMPLE'))
    }
  })
})

describe('data consistency', () => {
  test('every NATIONAL_ID_TYPES entry references a real country code', () => {
    const codes = new Set(ID_COUNTRIES.map(c => c.code))
    for (const t of NATIONAL_ID_TYPES) assert.ok(codes.has(t.country), t.key)
  })

  test('every country has a passport format', () => {
    for (const c of ID_COUNTRIES) assert.ok(PASSPORT_FORMATS[c.code], c.code)
  })
})
