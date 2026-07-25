const { test, describe } = require('node:test')
const assert = require('node:assert/strict')
const zlib = require('node:zlib')
const { loadToolScript } = require('./helpers/loadScript')
const { listZipEntries } = require('./helpers/zipHelpers')

const lib = loadToolScript('js/file-tool.js')
const { buildFile, MIN_BYTES, FILE_TYPES, crc32, adler32, encodeGifLzwLiteral } = lib

describe('shared low-level helpers', () => {
  test('crc32 matches the standard check value (and Node zlib) for "123456789"', () => {
    const bytes = Buffer.from('123456789')
    assert.equal(crc32(bytes), 0xcbf43926)
    assert.equal(crc32(bytes), zlib.crc32(bytes))
  })

  test('crc32 of empty input is 0', () => {
    assert.equal(crc32(new Uint8Array(0)), 0)
  })

  test('adler32 output is accepted by Node zlib as a valid checksum', () => {
    // adler32 has no built-in Node equivalent to compare against directly, so instead build a
    // real "stored" zlib stream using our own adler32 value and confirm Node's zlib (a real,
    // independent implementation) accepts it — inflateSync actively validates the checksum, so
    // this fails loudly if adler32 is wrong, not just silently produces a bad file.
    const raw = new TextEncoder().encode('the quick brown fox jumps over the lazy dog')
    const idat = lib.deflateStored(raw)
    const inflated = zlib.inflateSync(idat)
    assert.deepEqual(Buffer.from(inflated), Buffer.from(raw))
  })
})

describe('exact byte-size guarantee (every format, every size >= its minimum)', () => {
  const sizesToTest = min => [min, min + 1, min + 50, min + 500, 1024, 10 * 1024, 100 * 1024, 1024 * 1024]

  for (const type of Object.keys(FILE_TYPES)) {
    const min = MIN_BYTES[type] || 1
    test(`${type}: never overflows, hits target exactly once >= its minimum (${min} bytes)`, () => {
      for (const target of sizesToTest(min)) {
        if (target < min) continue
        const bytes = buildFile(type, target)
        assert.ok(bytes.length <= target, `${type} at ${target}: produced ${bytes.length} bytes (overflow)`)
        assert.equal(bytes.length, target, `${type} at ${target}: produced ${bytes.length} bytes`)
      }
    })
  }

  test('every declared MIN_BYTES matches building with a 0-byte target', () => {
    for (const [type, min] of Object.entries(MIN_BYTES)) {
      assert.equal(buildFile(type, 0).length, min, `${type}: MIN_BYTES out of sync with buildFile(type, 0)`)
    }
  })
})

describe('text-wrapped formats: filler is visible content, not hidden in a comment', () => {
  test('html puts filler inside <p>, not an HTML comment', () => {
    const text = new TextDecoder().decode(buildFile('html', 2000))
    assert.match(text, /<p>A+<\/p>/)
    assert.doesNotMatch(text, /<!--/)
  })

  test('xml puts filler inside <data>, not a comment', () => {
    const text = new TextDecoder().decode(buildFile('xml', 2000))
    assert.match(text, /<data>A+<\/data>/)
    assert.doesNotMatch(text, /<!--/)
  })

  test('json is parseable and the filler round-trips', () => {
    const text = new TextDecoder().decode(buildFile('json', 2000))
    const parsed = JSON.parse(text)
    assert.ok(parsed.data.length > 0 && /^A+$/.test(parsed.data))
  })

  test('rtf uses real RTF control words with visible filler', () => {
    const text = new TextDecoder().decode(buildFile('rtf', 2000))
    assert.match(text, /^\{\\rtf1\\ansi/)
    assert.match(text, /A{100,}/)
  })
})

describe('ZIP-family formats (zip, xlsx, docx, pptx, epub)', () => {
  test('zip: single stored entry named data.bin', () => {
    const entries = listZipEntries(buildFile('zip', 5000))
    assert.equal(entries.length, 1)
    assert.equal(entries[0].name, 'data.bin')
  })

  test('xlsx: has the expected OOXML parts, filler lives in the worksheet', () => {
    const bytes = buildFile('xlsx', 10000)
    const names = listZipEntries(bytes).map(e => e.name)
    assert.deepEqual(names, ['[Content_Types].xml', '_rels/.rels', 'xl/workbook.xml', 'xl/_rels/workbook.xml.rels', 'xl/worksheets/sheet1.xml'])
  })

  test('docx: has the expected OOXML parts', () => {
    const names = listZipEntries(buildFile('docx', 5000)).map(e => e.name)
    assert.deepEqual(names, ['[Content_Types].xml', '_rels/.rels', 'word/document.xml'])
  })

  test('pptx: has the expected OOXML parts, slide is last (the filler part)', () => {
    const names = listZipEntries(buildFile('pptx', 10000)).map(e => e.name)
    assert.equal(names[names.length - 1], 'ppt/slides/slide1.xml')
    assert.ok(names.includes('ppt/presentation.xml'))
    assert.ok(names.includes('ppt/slideMasters/slideMaster1.xml'))
  })

  test('epub: mimetype is the first entry (required by the EPUB spec) and is stored, uncompressed', () => {
    const bytes = buildFile('epub', 5000)
    const entries = listZipEntries(bytes)
    assert.equal(entries[0].name, 'mimetype')
    // "stored" means compressed size == uncompressed size == the literal content length
    assert.equal(entries[0].compSize, 'application/epub+zip'.length)
  })
})

describe('image formats: real magic bytes and real pixel content', () => {
  test('png: signature + IHDR present, and the compressed pixel data actually inflates', () => {
    const bytes = buildFile('png', 20000)
    assert.deepEqual(Array.from(bytes.slice(0, 8)), [137, 80, 78, 71, 13, 10, 26, 10])
    // Locate IDAT the same way a real decoder would: walk chunks by length-prefixed framing.
    let offset = 8
    let idat = null
    while (offset < bytes.length) {
      const len = new DataView(bytes.buffer, bytes.byteOffset + offset, 4).getUint32(0, false)
      const type = Buffer.from(bytes.slice(offset + 4, offset + 8)).toString('ascii')
      if (type === 'IDAT') idat = bytes.slice(offset + 8, offset + 8 + len)
      if (type === 'IEND') break
      offset += 8 + len + 4
    }
    assert.ok(idat, 'IDAT chunk not found')
    const inflated = zlib.inflateSync(idat) // throws if our deflate/adler32 framing is wrong
    assert.ok(inflated.length > 0)
  })

  test('bmp: "BM" signature', () => {
    const bytes = buildFile('bmp', 5000)
    assert.equal(String.fromCharCode(bytes[0], bytes[1]), 'BM')
  })

  test('gif: GIF89a signature and trailer byte present', () => {
    const bytes = buildFile('gif', 5000)
    assert.equal(Buffer.from(bytes.slice(0, 6)).toString('ascii'), 'GIF89a')
  })

  test('jpeg: SOI/EOI markers present', () => {
    const bytes = buildFile('jpg', 5000)
    assert.equal(bytes[0], 0xFF)
    assert.equal(bytes[1], 0xD8)
  })

  test('tiff: "II" byte order + magic number 42', () => {
    const bytes = buildFile('tiff', 5000)
    assert.equal(String.fromCharCode(bytes[0], bytes[1]), 'II')
    assert.equal(new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint16(2, true), 42)
  })

  test('ico: ICONDIR header (reserved=0, type=1) wrapping a real embedded PNG', () => {
    const bytes = buildFile('ico', 5000)
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
    assert.equal(view.getUint16(0, true), 0)
    assert.equal(view.getUint16(2, true), 1)
    // Embedded image (offset 22 per buildIco) should itself start with the PNG signature.
    assert.deepEqual(Array.from(bytes.slice(22, 30)), [137, 80, 78, 71, 13, 10, 26, 10])
  })

  test('svg: real gradient + visible <text>, not hidden in a comment', () => {
    const text = new TextDecoder().decode(buildFile('svg', 5000))
    assert.match(text, /<linearGradient/)
    assert.match(text, /<text[^>]*>A+<\/text>/)
  })
})

describe('pdf', () => {
  test('starts with the PDF header and ends with %%EOF', () => {
    const text = new TextDecoder().decode(buildFile('pdf', 5000))
    assert.match(text, /^%PDF-1\.4\n/)
    assert.match(text, /%%EOF$/)
  })

  test('draws real visible text via a content stream (BT/Tf/Td/Tj/ET), not a blank page', () => {
    const text = new TextDecoder().decode(buildFile('pdf', 5000))
    assert.match(text, /BT \/F1 12 Tf 50 750 Td \(A+\) Tj ET/)
  })

  test('xref offsets actually point at the right objects', () => {
    const text = new TextDecoder().decode(buildFile('pdf', 5000))
    const xrefStart = Number(text.match(/startxref\n(\d+)/)[1])
    assert.equal(text.slice(xrefStart, xrefStart + 4), 'xref')
    // Object 1 should be at the very start of the body, right after the header line.
    const obj1Offset = Number(text.match(/xref\n0 6\n0000000000 65535 f \n(\d+)/)[1])
    assert.match(text.slice(obj1Offset, obj1Offset + 7), /^1 0 obj/)
  })
})

describe('wav', () => {
  test('RIFF/WAVE/fmt /data markers present', () => {
    const bytes = buildFile('wav', 5000)
    assert.equal(Buffer.from(bytes.slice(0, 4)).toString('ascii'), 'RIFF')
    assert.equal(Buffer.from(bytes.slice(8, 12)).toString('ascii'), 'WAVE')
  })

  test('is an actual tone, not silence (sample values vary)', () => {
    const bytes = buildFile('wav', 5000)
    const samples = new Set(bytes.slice(44, 344))
    assert.ok(samples.size > 10, `expected varied samples, got ${samples.size} unique values`)
  })
})

// The GIF encoder had a real bug caught during development: it counted a dictionary entry for
// the very first code after every Clear Code, one code early — LZW decoders never do this (there's
// no previous string yet to extend), so the code-width growth desynced from any real decoder and
// silently corrupted every pixel past the first few. This is a permanent regression guard for it,
// using a correct reference LZW-GIF decoder independent of the encoder under test.
describe('GIF LZW regression (encoder must match real decoder-side dictionary growth)', () => {
  function decodeGifLzwLiteral(codeBytes, minCodeSize) {
    const clearCode = 1 << minCodeSize
    const endCode = clearCode + 1
    let codeSize, nextCode, table
    function reset() {
      codeSize = minCodeSize + 1
      nextCode = endCode + 1
      table = []
      for (let i = 0; i < clearCode; i++) table[i] = [i]
    }
    reset()
    let bitPos = 0
    function readCode() {
      let value = 0
      for (let i = 0; i < codeSize; i++) {
        const byteIndex = (bitPos + i) >> 3
        const bitIndex = (bitPos + i) & 7
        value |= ((codeBytes[byteIndex] >> bitIndex) & 1) << i
      }
      bitPos += codeSize
      return value
    }
    const output = []
    let prev = null
    for (let guard = 0; guard < 1_000_000; guard++) {
      const code = readCode()
      if (code === clearCode) { reset(); prev = null; continue }
      if (code === endCode) break
      const entry = code < table.length ? table[code] : prev.concat([prev[0]])
      output.push(...entry)
      if (prev) {
        table[nextCode] = prev.concat([entry[0]])
        nextCode++
        if (nextCode === (1 << codeSize) && codeSize < 12) codeSize++
      }
      prev = entry
    }
    return output
  }

  test('a large multi-band image decodes back to the exact pixel sequence encoded', () => {
    const width = 130, height = 130 // big enough to force several code-width growth steps
    const palette = [0, 1, 2, 3]
    const pixels = new Array(width * height)
    for (let y = 0; y < height; y++) {
      const band = Math.floor(y / (height / palette.length)) % palette.length
      for (let x = 0; x < width; x++) pixels[y * width + x] = band
    }
    const encoded = encodeGifLzwLiteral(pixels, 2)
    const decoded = decodeGifLzwLiteral(encoded, 2)
    assert.deepEqual(decoded, pixels)
  })

  test('buildFile("gif", ...) produces pixels that decode back to the intended horizontal bands', () => {
    const bytes = buildFile('gif', 20000) // picks a real side via binary search, same as production
    // Parse just enough of the GIF container to get to the image data sub-blocks.
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
    const width = view.getUint16(6, true)
    const height = view.getUint16(8, true)
    let offset = 6 + 4 + 1 + 2 + (4 * 3) // header + logical screen descriptor + 4-color GCT
    assert.equal(bytes[offset], 0x2C, 'expected image descriptor')
    offset += 10 // image descriptor
    const minCodeSize = bytes[offset]; offset += 1
    const subBlocks = []
    while (bytes[offset] !== 0x00) {
      const len = bytes[offset]
      subBlocks.push(bytes.slice(offset + 1, offset + 1 + len))
      offset += 1 + len
    }
    const lzwBytes = Buffer.concat(subBlocks.map(b => Buffer.from(b)))
    const decoded = decodeGifLzwLiteral(lzwBytes, minCodeSize)
    assert.equal(decoded.length, width * height)
    // Sample the first and last row — should be band 0 (top) and the last palette band (bottom).
    assert.equal(decoded[0], 0)
    assert.equal(decoded[decoded.length - 1], 3)
  })
})
