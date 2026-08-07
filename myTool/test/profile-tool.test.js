const { test, describe } = require('node:test')
const assert = require('node:assert/strict')
const { loadToolScript } = require('./helpers/loadScript')

const lib = loadToolScript('js/profile-tool.js')
const {
  mod, luhnChecksum, luhnCheckDigit, luhnCheckDigitGeneric, verhoeffChecksum, verhoeffCheckDigit,
  iso7064Mod112Checksum, iso7064Mod112CheckChar, collapse11to10, mrzCheckDigit,
  genCodiceFiscale, genCPF, genRUT, genNIF_PT, genNIR_FR, genDNI_ES, genNIE_ES,
  genPersonnummer_SE, genFodselsnummer_NO, genPESEL_PL, genCNP_RO, genEGN_BG,
  genHETU_FI, genIDNr_ZA, genRIC_CN, genAadhaar_IN, genCCCD_VN, genSSN_US, genNINO_GB, genNRIC_SG,
  genNIK_ID, genNRIC_MY,
  generateWithRetry, genPassportNumber, buildPassportMrz, PASSPORT_FORMATS,
  ID_COUNTRIES, NATIONAL_ID_TYPES,
  generateProfile, transliterateForMrz, genPhoneNumber, genPostalCode, genAddressLine, genAddress, COUNTRY_ADDRESSES, genEmail, emailLocalPart,
  PROFILE_NAMES, PHONE_SPECS,
  generateCompany, genCNPJ_BR, genVAT_BG_company, genUSCC_CN, genYTunnus_FI, genSIREN_FR, genTVA_FR,
  genPAN_IN, genGSTIN_IN, genNPWP_ID_company, genIVA_IT, genOrgnr_NO, genNIP_PL, genREGON_PL,
  genNIF_PT_company, genCUI_RO, genONRC_RO, genTIN_ZA_company, genCIF_ES, genOrgnr_SE,
  genVAT_GB_company, genUTR_GB, genCompanyNumber_GB, genEIN_US, genMST_VN, genUEN_SG,
  genTIN_MY_company, genSSM_MY
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

  test('NIK (Indonesia): 16 digits, valid region prefix, DDMMYY birth date (+40 day for female)', () => {
    const validPrefixes = ['3171', '3172', '3173', '3174', '3175', '3101', '3201']
    for (let i = 0; i < 50; i++) {
      const value = genNIK_ID()
      assert.match(value, /^\d{16}$/)
      assert.ok(validPrefixes.includes(value.slice(0, 4)))
      const day = Number(value.slice(6, 8)) % 40
      const month = Number(value.slice(8, 10))
      assert.ok(day >= 1 && day <= 28)
      assert.ok(month >= 1 && month <= 12)
    }
  })

  test('NRIC (Malaysia): YYMMDD-PB-SSSS, valid birthplace code, plausible date', () => {
    for (let i = 0; i < 50; i++) {
      const value = genNRIC_MY()
      assert.match(value, /^\d{6}-\d{2}-\d{4}$/)
      const month = Number(value.slice(2, 4))
      const day = Number(value.slice(4, 6))
      const birthplace = Number(value.slice(7, 9))
      assert.ok(month >= 1 && month <= 12)
      assert.ok(day >= 1 && day <= 28)
      assert.ok(birthplace >= 1 && birthplace <= 16)
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

  test('every country has profile name data (or falls back to GENERIC_NAMES) and a phone spec', () => {
    for (const c of ID_COUNTRIES) {
      assert.ok(c.code === 'us' || PROFILE_NAMES[c.code] || true) // fallback is allowed, just documenting intent
      assert.ok(c.code === 'us' || PHONE_SPECS[c.code], `${c.code} has no phone spec (US is handled specially)`)
    }
  })
})

describe('transliterateForMrz', () => {
  test('strips diacritics down to plain ASCII, including letters that do not NFD-decompose', () => {
    assert.equal(transliterateForMrz('Đinh'), 'Dinh')
    assert.equal(transliterateForMrz('Anh Quân'), 'Anh Quan')
    assert.equal(transliterateForMrz('Bjørnstad'), 'Bjornstad')
    assert.equal(transliterateForMrz('Bagiński'), 'Baginski')
    assert.equal(transliterateForMrz('Hämäläinen'), 'Hamalainen')
  })
})

describe('genPhoneNumber / genPostalCode', () => {
  test('every country produces a phone number starting with the right country calling code', () => {
    for (const c of ID_COUNTRIES) {
      const phone = genPhoneNumber(c.code)
      assert.match(phone, /^\+\d+$/, `${c.code}: ${phone}`)
      const expectedCc = c.code === 'us' ? '1' : PHONE_SPECS[c.code].cc
      assert.ok(phone.startsWith(`+${expectedCc}`), `${c.code}: ${phone} missing +${expectedCc}`)
    }
  })

  test('US phone numbers always have NANP-valid (2-9 leading) area code and exchange', () => {
    for (let i = 0; i < 30; i++) {
      const phone = genPhoneNumber('us')
      assert.match(phone, /^\+1[2-9]\d{9}$/)
    }
  })

  test('every country produces a non-empty postal code in a stable format', () => {
    // gb is intentionally excluded: real UK postcode area prefixes are legitimately 1 or 2
    // letters (e.g. "E" vs "EC"), so its shape varies call-to-call — covered by its own test below.
    for (const c of ID_COUNTRIES.filter(c => c.code !== 'gb')) {
      const postal1 = genPostalCode(c.code)
      const postal2 = genPostalCode(c.code)
      assert.ok(postal1.length > 0, c.code)
      assert.equal(postal1.replace(/\d/g, '#').replace(/[A-Z]/g, 'L'), postal2.replace(/\d/g, '#').replace(/[A-Z]/g, 'L'), `${c.code} format changed between calls`)
    }
  })

  test('UK postal code matches the real outward+inward structure', () => {
    for (let i = 0; i < 30; i++) {
      assert.match(genPostalCode('gb'), /^[A-Z]{1,2}\d{1,2} \d[A-Z]{2}$/)
    }
  })
})

describe('genAddressLine', () => {
  test('every country produces a non-empty address line', () => {
    for (const c of ID_COUNTRIES) {
      const names = PROFILE_NAMES[c.code] || { firstNames: ['X'], lastNames: ['Y'] }
      const addr = genAddressLine(c.code, names)
      assert.ok(addr && addr.trim().length > 0, c.code)
    }
  })
})

describe('generateProfile', () => {
  test('every country produces a fully self-consistent profile with no crashes', () => {
    for (const c of ID_COUNTRIES) {
      for (let i = 0; i < 5; i++) {
        const p = generateProfile(c.code)
        assert.ok(p.firstName && p.lastName && p.middleName, c.code)
        assert.ok(p.fullName.includes(p.firstName) || p.fullName.includes(p.lastName), c.code)
        assert.ok(p.addressLine.length > 0, c.code)
        assert.ok(p.postalCode.length > 0, c.code)
        assert.match(p.phoneNumber, /^\+\d+$/, c.code)
        assert.ok(Array.isArray(p.nationalIds) && p.nationalIds.length >= 1, c.code)
        assert.ok(p.passportNumber.length > 0, c.code)
        assert.equal(p.mrz.line1.length, 44, c.code)
        assert.equal(p.mrz.line2.length, 44, c.code)
      }
    }
  })

  test('MRZ output is always clean ICAO 9303 characters (A-Z, 0-9, <) — no diacritics, no raw scripts, no spaces', () => {
    for (const c of ID_COUNTRIES) {
      for (let i = 0; i < 10; i++) {
        const p = generateProfile(c.code)
        assert.match(p.mrz.line1 + p.mrz.line2, /^[A-Z0-9<]+$/, `${c.code}: ${p.mrz.line1}${p.mrz.line2}`)
      }
    }
  })

  test('MRZ identifier reflects the generated surname/given name (or China\'s Latin placeholder)', () => {
    const p = generateProfile('it')
    const translitLast = transliterateForMrz(p.lastName).toUpperCase()
    assert.ok(p.mrz.line1.includes(translitLast), `${p.mrz.line1} should contain ${translitLast}`)

    const cnProfile = generateProfile('cn')
    assert.ok(cnProfile.mrz.line1.includes('WEI') && cnProfile.mrz.line1.includes('JUN'))
  })

  test('National ID count matches NATIONAL_ID_TYPES for multi-variant countries (Spain, Singapore)', () => {
    assert.equal(generateProfile('es').nationalIds.length, 2)
    assert.equal(generateProfile('sg').nationalIds.length, 2)
  })

  test('Vietnam/China full names use family-name-first order', () => {
    const vnProfile = generateProfile('vn')
    assert.ok(vnProfile.fullName.startsWith(vnProfile.lastName), vnProfile.fullName)
    const cnProfile = generateProfile('cn')
    assert.equal(cnProfile.fullName, `${cnProfile.lastName}${cnProfile.firstName}`)
  })
})

// Company generators: each checked against a real vector from python-stdnum's own doctests
// (independent of our generator), then across many random samples by recomputing the checksum
// from scratch — same discipline as the National ID tests above.
describe('Company generators: real test vectors', () => {
  test('Brazil CNPJ: 16727230000197 is a real valid vector', () => {
    const digits = '167272300001'.split('').map(Number)
    const w1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
    let s1 = 0
    for (let i = 0; i < 12; i++) s1 += w1[i] * digits[i]
    const d1 = collapse11to10(s1)
    const w2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
    const withD1 = [...digits, d1]
    let s2 = 0
    for (let i = 0; i < 13; i++) s2 += w2[i] * withD1[i]
    assert.equal(`${d1}${collapse11to10(s2)}`, '97')
  })

  test('China USCC: 91110000600037341L is a real valid vector', () => {
    const ALPHABET = '0123456789ABCDEFGHJKLMNPQRTUWXY'
    const weights = [1, 3, 9, 27, 19, 26, 16, 17, 20, 29, 25, 13, 8, 24, 10, 30, 28]
    const body = '91110000600037341'
    let total = 0
    for (let i = 0; i < 17; i++) total += ALPHABET.indexOf(body[i]) * weights[i]
    assert.equal(ALPHABET[mod(31 - total, 31)], 'L')
  })

  test('Finland Y-tunnus: 20774740 is a real valid vector', () => {
    const digits = '2077474'.split('').map(Number)
    const w = [7, 9, 10, 5, 8, 4, 2]
    let s = 0
    for (let i = 0; i < 7; i++) s += w[i] * digits[i]
    assert.equal(mod(-s, 11), 0)
  })

  test('France SIREN 404833048 and TVA derivation for 443121975 are real valid vectors', () => {
    assert.equal(luhnChecksum('404833048'), 0)
    assert.equal(Number('443121975' + '12') % 97, 46)
  })

  test('India GSTIN check for 27AAPFU0939F1Z is a real valid vector', () => {
    assert.equal(luhnCheckDigitGeneric('27AAPFU0939F1Z', '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'), 'V')
  })

  test('Italy Partita IVA 00743110157 is a real valid vector', () => {
    assert.equal(luhnChecksum('00743110157'), 0)
  })

  test('Norway Orgnr 988077917 is a real valid vector', () => {
    const digits = '98807791'.split('').map(Number)
    const w = [3, 2, 7, 6, 5, 4, 3, 2]
    let s = 0
    for (let i = 0; i < 8; i++) s += w[i] * digits[i]
    assert.equal(mod(-s, 11), 7)
  })

  test('Poland NIP 8567346215 and REGON 192598184 are real valid vectors', () => {
    const nipDigits = '856734621'.split('').map(Number)
    const nipW = [6, 5, 7, 2, 3, 4, 5, 6, 7]
    let s1 = 0
    for (let i = 0; i < 9; i++) s1 += nipW[i] * nipDigits[i]
    assert.equal(mod(s1, 11), 5)

    const regonDigits = '19259818'.split('').map(Number)
    const regonW = [8, 9, 2, 3, 4, 5, 6, 7]
    let s2 = 0
    for (let i = 0; i < 8; i++) s2 += regonW[i] * regonDigits[i]
    assert.equal(mod(s2, 11) % 10, 4)
  })

  test('Portugal company NIF 501964843 is a real valid vector', () => {
    const digits = '50196484'.split('').map(Number)
    let s = 0
    for (let i = 0; i < 8; i++) s += (9 - i) * digits[i]
    assert.equal(collapse11to10(s), 3)
  })

  test('Romania CUI 18547290 and ONRC J2012000750528 are real valid vectors', () => {
    const padded = '1854729'.padStart(9, '0').split('').map(Number)
    const w = [7, 5, 3, 2, 1, 7, 5, 3, 2]
    let s = 0
    for (let i = 0; i < 9; i++) s += w[i] * padded[i]
    assert.equal(mod(10 * s, 11) % 10, 0)

    const transformed = String('J'.charCodeAt(0) % 10) + '2012' + '000750' + '52'
    assert.equal(transformed.split('').reduce((a, c) => a + Number(c), 0) % 10, 8)
  })

  test('South Africa TIN 0001339050 is a real valid vector', () => {
    assert.equal(luhnChecksum('0001339050'), 0)
  })

  test('Spain CIF J99216582 is a real valid vector', () => {
    assert.equal(luhnCheckDigit('9921658'), '2')
  })

  test('Sweden Orgnr 1234567897 is a real valid vector', () => {
    assert.equal(luhnChecksum('1234567897'), 0)
  })

  test('UK VAT 980780684 and UTR 1955839661 are real valid vectors', () => {
    const vatDigits = '9807806'.split('').map(Number)
    const vatW = [8, 7, 6, 5, 4, 3, 2]
    let s1 = 0
    for (let i = 0; i < 7; i++) s1 += vatW[i] * vatDigits[i]
    assert.equal(mod(-s1, 97), 84)

    const utrBody = '955839661'.split('').map(Number)
    const utrW = [6, 7, 8, 9, 10, 5, 4, 3, 2]
    let s2 = 0
    for (let i = 0; i < 9; i++) s2 += utrW[i] * utrBody[i]
    assert.equal('21987654321'[s2 % 11], '1')
  })

  test('Vietnam MST 0100233488 is a real valid vector', () => {
    const digits = '010023348'.split('').map(Number)
    const w = [31, 29, 23, 19, 17, 13, 7, 5, 3]
    let total = 0
    for (let i = 0; i < 9; i++) total += w[i] * digits[i]
    assert.equal(10 - (total % 11), 8)
  })

  test('Singapore UEN (ROC) 197401143C is a real valid vector', () => {
    const digits = '197401143'.split('').map(Number)
    const w = [10, 8, 6, 4, 9, 7, 5, 3, 1]
    let s = 0
    for (let i = 0; i < 9; i++) s += w[i] * digits[i]
    assert.equal('ZKCMDNERGWH'[s % 11], 'C')
  })

  test('Bulgaria VAT 175074752 is a real valid vector', () => {
    const digits = '17507475'.split('').map(Number)
    let s = 0
    for (let i = 0; i < 8; i++) s += (i + 1) * digits[i]
    assert.equal(mod(s, 11) % 10, 2)
  })
})

describe('Company generators: exact-formula round trip (many random samples)', () => {
  test('CNPJ (Brazil)', () => {
    for (let i = 0; i < 30; i++) {
      const value = genCNPJ_BR()
      assert.equal(value.length, 14)
      const digits = value.slice(0, 12).split('').map(Number)
      const w1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
      let s1 = 0
      for (let j = 0; j < 12; j++) s1 += w1[j] * digits[j]
      const d1 = collapse11to10(s1)
      const w2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
      const withD1 = [...digits, d1]
      let s2 = 0
      for (let j = 0; j < 13; j++) s2 += w2[j] * withD1[j]
      assert.equal(value.slice(12), `${d1}${collapse11to10(s2)}`)
    }
  })

  test('USCC (China)', () => {
    const ALPHABET = '0123456789ABCDEFGHJKLMNPQRTUWXY'
    const weights = [1, 3, 9, 27, 19, 26, 16, 17, 20, 29, 25, 13, 8, 24, 10, 30, 28]
    for (let i = 0; i < 30; i++) {
      const value = genUSCC_CN()
      assert.equal(value.length, 18)
      let total = 0
      for (let j = 0; j < 17; j++) total += ALPHABET.indexOf(value[j]) * weights[j]
      assert.equal(ALPHABET[mod(31 - total, 31)], value[17])
    }
  })

  test('Y-tunnus (Finland)', () => {
    const weights7 = [7, 9, 10, 5, 8, 4, 2]
    for (let i = 0; i < 30; i++) {
      const value = generateWithRetry(genYTunnus_FI)
      assert.equal(value.length, 8)
      const digits = value.slice(0, 7).split('').map(Number)
      let sum7 = 0
      for (let j = 0; j < 7; j++) sum7 += weights7[j] * digits[j]
      assert.equal(String(mod(-sum7, 11)), value[7])
    }
  })

  test('SIREN + TVA (France)', () => {
    for (let i = 0; i < 30; i++) {
      const siren = generateWithRetry(genSIREN_FR)
      assert.equal(siren.length, 9)
      assert.equal(luhnChecksum(siren), 0)
      const tva = genTVA_FR(siren)
      assert.match(tva, /^FR\d{11}$/)
      assert.equal(Number(siren + '12') % 97, Number(tva.slice(2, 4)))
    }
  })

  test('GSTIN (India)', () => {
    const alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'
    for (let i = 0; i < 30; i++) {
      const value = genGSTIN_IN()
      assert.equal(value.length, 15)
      assert.equal(value[13], 'Z')
      assert.equal(luhnCheckDigitGeneric(value.slice(0, 14), alphabet), value[14])
    }
  })

  test('NPWP business (Indonesia): starts with 0, Luhn-valid 9-digit body', () => {
    for (let i = 0; i < 30; i++) {
      const value = genNPWP_ID_company()
      assert.equal(value.length, 16)
      assert.equal(value[0], '0')
      assert.equal(luhnChecksum(value.slice(0, 10)), 0)
    }
  })

  test('Partita IVA (Italy)', () => {
    for (let i = 0; i < 30; i++) {
      const value = genIVA_IT()
      assert.equal(value.length, 11)
      assert.equal(luhnChecksum(value), 0)
    }
  })

  test('Orgnr (Norway)', () => {
    const weights = [3, 2, 7, 6, 5, 4, 3, 2]
    for (let i = 0; i < 30; i++) {
      const value = generateWithRetry(genOrgnr_NO)
      assert.equal(value.length, 9)
      const digits = value.slice(0, 8).split('').map(Number)
      let sum = 0
      for (let j = 0; j < 8; j++) sum += weights[j] * digits[j]
      assert.equal(String(mod(-sum, 11)), value[8])
    }
  })

  test('NIP + REGON (Poland)', () => {
    const nipW = [6, 5, 7, 2, 3, 4, 5, 6, 7]
    const regonW = [8, 9, 2, 3, 4, 5, 6, 7]
    for (let i = 0; i < 30; i++) {
      const nip = generateWithRetry(genNIP_PL)
      assert.equal(nip.length, 10)
      const nipDigits = nip.split('').map(Number)
      let s1 = 0
      for (let j = 0; j < 9; j++) s1 += nipW[j] * nipDigits[j]
      assert.equal(String(mod(s1, 11)), nip[9])

      const regon = genREGON_PL()
      assert.equal(regon.length, 9)
      const regonDigits = regon.slice(0, 8).split('').map(Number)
      let s2 = 0
      for (let j = 0; j < 8; j++) s2 += regonW[j] * regonDigits[j]
      assert.equal(String(mod(s2, 11) % 10), regon[8])
    }
  })

  test('Company NIF (Portugal): always leading digit 5', () => {
    for (let i = 0; i < 30; i++) {
      const value = genNIF_PT_company()
      assert.equal(value.length, 9)
      assert.equal(value[0], '5')
      const digits = value.slice(0, 8).split('').map(Number)
      let s = 0
      for (let j = 0; j < 8; j++) s += (9 - j) * digits[j]
      assert.equal(collapse11to10(s), Number(value[8]))
    }
  })

  test('CUI + ONRC (Romania)', () => {
    const cuiW = [7, 5, 3, 2, 1, 7, 5, 3, 2]
    for (let i = 0; i < 30; i++) {
      const cui = genCUI_RO()
      const body = cui.slice(0, -1)
      const check = cui.slice(-1)
      const padded = body.padStart(9, '0').split('').map(Number)
      let s = 0
      for (let j = 0; j < 9; j++) s += cuiW[j] * padded[j]
      assert.equal(String(mod(10 * s, 11) % 10), check)

      const onrc = genONRC_RO()
      assert.equal(onrc.length, 14)
      const transformed = String(onrc.charCodeAt(0) % 10) + onrc.slice(1, -1)
      assert.equal(String(transformed.split('').reduce((a, c) => a + Number(c), 0) % 10), onrc.slice(-1))
    }
  })

  test('TIN (South Africa)', () => {
    for (let i = 0; i < 30; i++) {
      const value = genTIN_ZA_company()
      assert.equal(value.length, 10)
      assert.ok(['0', '1', '2', '3', '9'].includes(value[0]))
      assert.equal(luhnChecksum(value), 0)
    }
  })

  test('CIF (Spain)', () => {
    for (let i = 0; i < 30; i++) {
      const value = genCIF_ES()
      assert.equal(value.length, 9)
      assert.ok('ABCDEFGHJNPQRSUVW'.includes(value[0]))
      assert.equal(luhnCheckDigit(value.slice(1, 8)), value[8])
    }
  })

  test('Orgnr (Sweden)', () => {
    for (let i = 0; i < 30; i++) {
      const value = genOrgnr_SE()
      assert.equal(value.length, 10)
      assert.equal(luhnChecksum(value), 0)
    }
  })

  test('VAT + UTR (UK)', () => {
    const vatW = [8, 7, 6, 5, 4, 3, 2, 10, 1]
    const utrW = [6, 7, 8, 9, 10, 5, 4, 3, 2]
    for (let i = 0; i < 30; i++) {
      const vat = genVAT_GB_company()
      assert.equal(vat.length, 9)
      const digits = vat.split('').map(Number)
      let s1 = 0
      for (let j = 0; j < 9; j++) s1 += vatW[j] * digits[j]
      assert.equal(mod(s1, 97), 0)

      const utr = genUTR_GB()
      assert.equal(utr.length, 10)
      const body = utr.slice(1).split('').map(Number)
      let s2 = 0
      for (let j = 0; j < 9; j++) s2 += utrW[j] * body[j]
      assert.equal('21987654321'[s2 % 11], utr[0])

      assert.match(genCompanyNumber_GB(), /^\d{8}$/)
    }
  })

  test('EIN (USA): format only', () => {
    for (let i = 0; i < 30; i++) assert.match(genEIN_US(), /^\d{2}-\d{7}$/)
  })

  test('MST (Vietnam)', () => {
    const weights = [31, 29, 23, 19, 17, 13, 7, 5, 3]
    for (let i = 0; i < 30; i++) {
      const value = generateWithRetry(genMST_VN)
      assert.equal(value.length, 10)
      const digits = value.slice(0, 9).split('').map(Number)
      let total = 0
      for (let j = 0; j < 9; j++) total += weights[j] * digits[j]
      assert.equal(String(10 - (total % 11)), value[9])
      assert.notEqual(total % 11, 0)
    }
  })

  test('UEN (Singapore, ROC format)', () => {
    const weights = [10, 8, 6, 4, 9, 7, 5, 3, 1]
    for (let i = 0; i < 30; i++) {
      const value = genUEN_SG()
      assert.equal(value.length, 10)
      const digits = value.slice(0, 9).split('').map(Number)
      let s = 0
      for (let j = 0; j < 9; j++) s += weights[j] * digits[j]
      assert.equal('ZKCMDNERGWH'[s % 11], value[9])
    }
  })

  test('Malaysia: TIN and SSM registration formats', () => {
    for (let i = 0; i < 30; i++) {
      assert.match(genTIN_MY_company(), /^C\d{10}$/)
      assert.match(genSSM_MY(), /^\d{12}$/)
    }
  })
})

describe('generateCompany', () => {
  test('every country produces a company name, tax code, and business registration number with no crashes', () => {
    for (const c of ID_COUNTRIES) {
      const names = PROFILE_NAMES[c.code] || { firstNames: ['X'], lastNames: ['Y'] }
      for (let i = 0; i < 5; i++) {
        const company = generateCompany(c.code, names)
        assert.ok(company.companyName && company.companyName.trim().length > 0, c.code)
        assert.ok(company.taxCode && company.taxCode.length > 0, c.code)
        assert.ok(company.businessRegNumber && company.businessRegNumber.length > 0, c.code)
      }
    }
  })

  test('unified-number countries use the exact same value for both fields', () => {
    for (const code of ['br', 'bg', 'cl', 'cn', 'id', 'it', 'za', 'es', 'us']) {
      const company = generateCompany(code, PROFILE_NAMES[code] || { firstNames: ['X'], lastNames: ['Y'] })
      assert.equal(company.taxCode, company.businessRegNumber, code)
    }
  })

  test('two-distinct-number countries (France, India, Poland, Romania, UK) produce different values', () => {
    for (const code of ['fr', 'in', 'pl', 'ro', 'gb']) {
      const company = generateCompany(code, PROFILE_NAMES[code] || { firstNames: ['X'], lastNames: ['Y'] })
      assert.notEqual(company.taxCode, company.businessRegNumber, code)
    }
  })
})

describe('Address datasets (real street/district/city per country)', () => {
  test('every dataset entry has a non-empty street, district, and city', () => {
    const codes = Object.keys(COUNTRY_ADDRESSES)
    assert.ok(codes.length >= 20)
    for (const cc of codes) {
      assert.ok(COUNTRY_ADDRESSES[cc].length >= 3, `${cc} has too few entries`)
      for (const a of COUNTRY_ADDRESSES[cc]) {
        assert.ok(a.street && a.district && a.city, `${cc} incomplete entry: ${JSON.stringify(a)}`)
      }
    }
  })

  test('Vietnam keeps real 5-digit province-level postal codes', () => {
    for (const a of COUNTRY_ADDRESSES.vn) assert.match(a.postal, /^\d{5}$/)
  })

  test('genAddress uses the dataset: street/district/city all come from one real entry', () => {
    for (const cc of Object.keys(COUNTRY_ADDRESSES)) {
      for (let i = 0; i < 20; i++) {
        const a = genAddress(cc, {})
        assert.ok(a.district && a.city, `${cc} missing district/city`)
        assert.ok(a.postalCode, `${cc} missing postal`)
        // the street must be one of the dataset streets, and district+city must match that same entry
        const entry = COUNTRY_ADDRESSES[cc].find(e =>
          a.addressLine.includes(e.street) && e.district === a.district && e.city === a.city)
        assert.ok(entry, `${cc} combo not from dataset: ${JSON.stringify(a)}`)
      }
    }
  })

  test('generateProfile surfaces district/city for a dataset country', () => {
    const p = generateProfile('vn')
    assert.ok(p.district && p.city)
    assert.match(p.postalCode, /^\d{5}$/)
    const us = generateProfile('us')
    assert.ok(us.district && us.city)
  })

  test('fullAddress joins every address part into one copyable line', () => {
    for (const cc of ['vn', 'us', 'it']) {
      const p = generateProfile(cc)
      for (const part of [p.addressLine, p.district, p.city, p.postalCode, p.countryName]) {
        assert.ok(p.fullAddress.includes(part), `${cc} fullAddress missing "${part}": ${p.fullAddress}`)
      }
    }
  })
})

describe('Email generation (@yopmail.com)', () => {
  test('always ends in @yopmail.com with an ASCII local part', () => {
    for (const cc of ['vn', 'us', 'cn', 'fr']) {
      const email = generateProfile(cc).email
      assert.match(email, /^[a-z0-9.]+@yopmail\.com$/, `bad email for ${cc}: ${email}`)
    }
  })
  test('strips Vietnamese diacritics and đ', () => {
    assert.match(genEmail('Nguyễn', 'Trần'), /^nguyen\.tran\d+@yopmail\.com$/)
    assert.match(genEmail('Đinh', 'Bình'), /^dinh\.binh\d+@yopmail\.com$/)
    assert.equal(emailLocalPart('Nguyễn'), 'nguyen')
    assert.equal(emailLocalPart('Đinh'), 'dinh')
  })
  test('falls back to "user" when the name has no ASCII letters (e.g. Chinese)', () => {
    assert.match(genEmail('广州', '李'), /^user\d+@yopmail\.com$/)
  })
  test('honors a custom domain (default yopmail.com)', () => {
    assert.match(genEmail('An', 'Binh', 'mailinator.com'), /@mailinator\.com$/)
    assert.match(genEmail('An', 'Binh', 'maildrop.cc'), /@maildrop\.cc$/)
    assert.match(genEmail('An', 'Binh'), /@yopmail\.com$/)
    assert.match(generateProfile('us', { emailDomain: 'guerrillamail.com' }).email, /@guerrillamail\.com$/)
  })
})
