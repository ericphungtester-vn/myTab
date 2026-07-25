// ---- File Tool: builds a real, valid file of each format, padded to hit the exact target byte
// count (given the format's own minimum structural size), then triggers a download. Everything
// runs client-side — no bundled libraries, since every format here is simple enough to hand-write.

function randomBytes(length) {
  const bytes = new Uint8Array(length)
  const CHUNK = 65536 // crypto.getRandomValues' own per-call limit
  for (let offset = 0; offset < length; offset += CHUNK) {
    bytes.set(crypto.getRandomValues(new Uint8Array(Math.min(CHUNK, length - offset))), offset)
  }
  return bytes
}

// ---- CRC32 / Adler32 (needed for valid ZIP and PNG chunk checksums) ----
let CRC_TABLE = null
function crc32(bytes) {
  if (!CRC_TABLE) {
    CRC_TABLE = new Uint32Array(256)
    for (let n = 0; n < 256; n++) {
      let c = n
      for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1)
      CRC_TABLE[n] = c >>> 0
    }
  }
  let crc = 0xFFFFFFFF
  for (let i = 0; i < bytes.length; i++) crc = CRC_TABLE[(crc ^ bytes[i]) & 0xFF] ^ (crc >>> 8)
  return (crc ^ 0xFFFFFFFF) >>> 0
}

function adler32(bytes) {
  let a = 1, b = 0
  const MOD = 65521
  for (let i = 0; i < bytes.length; i++) { a = (a + bytes[i]) % MOD; b = (b + a) % MOD }
  return ((b << 16) | a) >>> 0
}

function writeAscii(buf, offset, str) {
  for (let i = 0; i < str.length; i++) buf[offset + i] = str.charCodeAt(i)
}

function concatUint8Arrays(arrays) {
  const out = new Uint8Array(arrays.reduce((sum, a) => sum + a.length, 0))
  let o = 0
  for (const a of arrays) { out.set(a, o); o += a.length }
  return out
}

// Largest side (of a side x side image, or in the JPEG case a side x side grid of 8x8 blocks)
// whose real, computed byte size still fits within targetBytes — sizeForSide must be
// non-decreasing in side for this to find the right answer. Defaults to 1 (never 0) so every
// image format always has real, non-degenerate pixel content, even at its own minimum size.
function binarySearchLargestFit(maxSide, sizeForSide, targetBytes) {
  let lo = 1, hi = maxSide, best = 1
  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2)
    if (sizeForSide(mid) <= targetBytes) { best = mid; lo = mid + 1 } else hi = mid - 1
  }
  return best
}

const IMAGE_MAX_SIDE = 256 // caps real pixel content at a fast-to-generate, clearly visible size —
// requests bigger than this just get more trailing padding rather than an ever-larger canvas

// ---- PNG: real gradient image (no deflate library needed — a "stored" zlib block is a raw
// passthrough, so we get a valid compressed stream without implementing actual compression) ----
function pngChunk(type, data) {
  const typeBytes = new TextEncoder().encode(type)
  const buf = new Uint8Array(8 + data.length + 4)
  new DataView(buf.buffer).setUint32(0, data.length, false)
  buf.set(typeBytes, 4)
  buf.set(data, 8)
  const crcInput = new Uint8Array(4 + data.length)
  crcInput.set(typeBytes, 0)
  crcInput.set(data, 4)
  new DataView(buf.buffer).setUint32(8 + data.length, crc32(crcInput), false)
  return buf
}

// Wraps rawData in a zlib stream using one or more STORED (uncompressed) deflate blocks — each
// block's LEN field is 16-bit, so data over 65535 bytes just needs more chained blocks.
function deflateStoredSize(rawLen) {
  const numBlocks = Math.max(1, Math.ceil(rawLen / 65535))
  return 2 /* zlib header */ + numBlocks * 5 + rawLen + 4 /* adler32 */
}

function deflateStored(rawData) {
  const parts = [new Uint8Array([0x78, 0x01])]
  let offset = 0
  do {
    const chunkLen = Math.min(65535, rawData.length - offset)
    const header = new Uint8Array(5)
    header[0] = (offset + chunkLen >= rawData.length) ? 1 : 0 // BFINAL
    new DataView(header.buffer).setUint16(1, chunkLen, true)
    new DataView(header.buffer).setUint16(3, (~chunkLen) & 0xFFFF, true)
    parts.push(header, rawData.subarray(offset, offset + chunkLen))
    offset += chunkLen
  } while (offset < rawData.length)
  const adlerBytes = new Uint8Array(4)
  new DataView(adlerBytes.buffer).setUint32(0, adler32(rawData), false)
  parts.push(adlerBytes)
  return concatUint8Arrays(parts)
}

function pngRaw(width, height) {
  const rowBytes = 1 + width * 3
  const raw = new Uint8Array(rowBytes * height)
  for (let y = 0; y < height; y++) {
    const rowStart = y * rowBytes
    raw[rowStart] = 0 // filter: none
    for (let x = 0; x < width; x++) {
      const o = rowStart + 1 + x * 3
      raw[o] = Math.floor(255 * x / Math.max(1, width - 1))
      raw[o + 1] = Math.floor(255 * y / Math.max(1, height - 1))
      raw[o + 2] = Math.floor(255 * (x + y) / Math.max(1, width + height - 2))
    }
  }
  return raw
}

function buildPng(targetBytes) {
  const SIGNATURE = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])
  const PRIV_CHUNK_OVERHEAD = 12 // 4 length + 4 type + 4 crc, 0 data

  // side x side RGB gradient — sized so the real, compressed pixel data fits the target, with
  // any remainder taken up by the padding chunk below.
  const sizeForSide = side => {
    const rawLen = side * (1 + side * 3)
    return SIGNATURE.length + (13 + 12) /* IHDR */ + (deflateStoredSize(rawLen) + 12) /* IDAT */ + 12 /* IEND */ + PRIV_CHUNK_OVERHEAD
  }
  const side = binarySearchLargestFit(IMAGE_MAX_SIDE, sizeForSide, targetBytes)

  const ihdrData = new Uint8Array(13)
  const ihdrView = new DataView(ihdrData.buffer)
  ihdrView.setUint32(0, side, false) // width
  ihdrView.setUint32(4, side, false) // height
  ihdrData.set([8, 2, 0, 0, 0], 8) // bit depth 8, color type 2 (RGB), compression/filter/interlace 0
  const ihdrChunk = pngChunk('IHDR', ihdrData)

  const idatChunk = pngChunk('IDAT', deflateStored(pngRaw(side, side)))
  const iendChunk = pngChunk('IEND', new Uint8Array(0))

  const fixedOverhead = SIGNATURE.length + ihdrChunk.length + idatChunk.length + iendChunk.length
  // "prIv" — lowercase/lowercase/uppercase/lowercase — a private, ancillary, safe-to-copy chunk
  // type per the PNG spec's naming convention, so any conforming reader safely ignores it.
  const paddingLen = Math.max(0, targetBytes - fixedOverhead - PRIV_CHUNK_OVERHEAD)
  const privChunk = pngChunk('prIv', new Uint8Array(paddingLen).fill(65))

  const out = new Uint8Array(fixedOverhead + privChunk.length)
  let o = 0
  out.set(SIGNATURE, o); o += SIGNATURE.length
  out.set(ihdrChunk, o); o += ihdrChunk.length
  out.set(idatChunk, o); o += idatChunk.length
  out.set(privChunk, o); o += privChunk.length
  out.set(iendChunk, o)
  return out
}

// ---- ICO: a thin Windows-icon wrapper around a real embedded PNG (Vista+ supports PNG-format
// icon entries directly, so no raw DIB/AND-mask bit-packing is needed) — the icon's gradient
// image is exactly whatever buildPng produces. ----
function buildIco(targetBytes) {
  const HEADER_SIZE = 6 /* ICONDIR */ + 16 /* one ICONDIRENTRY */
  const png = buildPng(Math.max(0, targetBytes - HEADER_SIZE))
  const pngView = new DataView(png.buffer, png.byteOffset, png.byteLength)
  const width = pngView.getUint32(16, false) // PNG IHDR: signature(8) + chunk len(4) + "IHDR"(4) = 16
  const height = pngView.getUint32(20, false)

  const buf = new Uint8Array(HEADER_SIZE + png.length)
  const view = new DataView(buf.buffer)
  view.setUint16(2, 1, true) // type: icon
  view.setUint16(4, 1, true) // image count
  buf[6] = width >= 256 ? 0 : width   // ICO width/height are 1 byte; 0 conventionally means 256
  buf[7] = height >= 256 ? 0 : height
  view.setUint16(10, 1, true) // color planes
  view.setUint16(12, 32, true) // bits per pixel
  view.setUint32(14, png.length, true) // size of image data
  view.setUint32(18, HEADER_SIZE, true) // offset to image data
  buf.set(png, HEADER_SIZE)
  return buf
}

// ---- SVG: real vector image — a gradient-filled rectangle with filler text drawn on top (in an
// actual <text> element, not hidden in a comment), so both the graphic and the text are visible. ----
function buildSvg(targetBytes) {
  const prefix = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">' +
    '<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">' +
    '<stop offset="0%" stop-color="#101820"/><stop offset="50%" stop-color="#e0405a"/><stop offset="100%" stop-color="#3a7bd5"/>' +
    '</linearGradient></defs>' +
    '<rect width="256" height="256" fill="url(#g)"/>' +
    '<text x="4" y="16" font-family="monospace" font-size="10" fill="#ffffff">'
  const suffix = '</text></svg>'
  return new TextEncoder().encode(buildWrappedText(prefix, suffix, targetBytes))
}

// ---- ZIP: a generic archive of stored (uncompressed) entries — the foundation for both the
// plain ZIP file type below and the Office Open XML formats further down, which are themselves
// just ZIPs with a specific folder of XML parts inside. ----
function zipEntryOverhead(name) {
  const nameLen = new TextEncoder().encode(name).length
  return (30 + nameLen) + (46 + nameLen) // local file header + central directory header, no data
}

function buildZipArchive(entries) {
  const now = new Date()
  const dosTime = ((now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1)) & 0xFFFF
  const dosDate = (((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate()) & 0xFFFF

  const localParts = []
  const centralParts = []
  let offset = 0
  for (const { name, data } of entries) {
    const nameBytes = new TextEncoder().encode(name)
    const nameLen = nameBytes.length
    const crc = crc32(data)

    const local = new Uint8Array(30 + nameLen)
    const lv = new DataView(local.buffer)
    lv.setUint32(0, 0x04034b50, true)
    lv.setUint16(4, 20, true)
    lv.setUint16(6, 0, true)
    lv.setUint16(8, 0, true) // method: 0 = stored
    lv.setUint16(10, dosTime, true)
    lv.setUint16(12, dosDate, true)
    lv.setUint32(14, crc, true)
    lv.setUint32(18, data.length, true)
    lv.setUint32(22, data.length, true)
    lv.setUint16(26, nameLen, true)
    lv.setUint16(28, 0, true)
    local.set(nameBytes, 30)
    localParts.push(local, data)

    const central = new Uint8Array(46 + nameLen)
    const cv = new DataView(central.buffer)
    cv.setUint32(0, 0x02014b50, true)
    cv.setUint16(4, 20, true)
    cv.setUint16(6, 20, true)
    cv.setUint16(8, 0, true)
    cv.setUint16(10, 0, true)
    cv.setUint16(12, dosTime, true)
    cv.setUint16(14, dosDate, true)
    cv.setUint32(16, crc, true)
    cv.setUint32(20, data.length, true)
    cv.setUint32(24, data.length, true)
    cv.setUint16(28, nameLen, true)
    cv.setUint32(42, offset, true) // relative offset of local header
    central.set(nameBytes, 46)
    centralParts.push(central)

    offset += local.length + data.length
  }

  const centralDirStart = offset
  const centralDir = concatUint8Arrays(centralParts)
  const eocd = new Uint8Array(22)
  const ev = new DataView(eocd.buffer)
  ev.setUint32(0, 0x06054b50, true)
  ev.setUint16(8, entries.length, true)
  ev.setUint16(10, entries.length, true)
  ev.setUint32(12, centralDir.length, true)
  ev.setUint32(16, centralDirStart, true)

  return concatUint8Arrays([...localParts, centralDir, eocd])
}

// ---- ZIP: one stored (uncompressed) entry, padded to the target size ----
function buildZip(targetBytes) {
  const name = 'data.bin'
  const dataLen = Math.max(0, targetBytes - zipEntryOverhead(name) - 22)
  return buildZipArchive([{ name, data: new Uint8Array(dataLen).fill(65) }])
}

// Office Open XML formats (.xlsx/.docx/.pptx) are ZIP archives of small fixed XML parts plus one
// "filler" part whose padding — via buildWrappedText, so it's exact by construction — makes the
// whole archive land on targetBytes. All parts are ASCII, so string length == UTF-8 byte length.
function buildOfficeZip(targetBytes, fixedParts, fillerName, fillerPrefix, fillerSuffix) {
  const fixedOverhead = fixedParts.reduce((sum, p) => sum + p.data.length + zipEntryOverhead(p.name), 0)
    + zipEntryOverhead(fillerName) + 22 /* EOCD */
  const fillerLen = Math.max(0, targetBytes - fixedOverhead)
  const fillerData = new TextEncoder().encode(buildWrappedText(fillerPrefix, fillerSuffix, fillerLen))
  return buildZipArchive([...fixedParts, { name: fillerName, data: fillerData }])
}

function xmlPart(name, content) {
  return { name, data: new TextEncoder().encode(content) }
}

const OOXML_RELS_NS = 'http://schemas.openxmlformats.org/package/2006/relationships'
const OOXML_DOC_REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument'

function buildXlsx(targetBytes) {
  const fixedParts = [
    xmlPart('[Content_Types].xml',
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/>' +
      '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
      '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
      '</Types>'),
    xmlPart('_rels/.rels',
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="${OOXML_RELS_NS}">` +
      `<Relationship Id="rId1" Type="${OOXML_DOC_REL}" Target="xl/workbook.xml"/></Relationships>`),
    xmlPart('xl/workbook.xml',
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
      '<sheets><sheet name="Sheet1" sheetId="1" r:id="rId1"/></sheets></workbook>'),
    xmlPart('xl/_rels/workbook.xml.rels',
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="${OOXML_RELS_NS}">` +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>')
  ]
  const prefix = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    '<sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>'
  const suffix = '</t></is></c></row></sheetData></worksheet>'
  return buildOfficeZip(targetBytes, fixedParts, 'xl/worksheets/sheet1.xml', prefix, suffix)
}

function buildDocx(targetBytes) {
  const fixedParts = [
    xmlPart('[Content_Types].xml',
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/>' +
      '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
      '</Types>'),
    xmlPart('_rels/.rels',
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="${OOXML_RELS_NS}">` +
      `<Relationship Id="rId1" Type="${OOXML_DOC_REL}" Target="word/document.xml"/></Relationships>`)
  ]
  const prefix = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>'
  const suffix = '</w:t></w:r></w:p></w:body></w:document>'
  return buildOfficeZip(targetBytes, fixedParts, 'word/document.xml', prefix, suffix)
}

function buildPptx(targetBytes) {
  const A_NS = 'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"'
  const R_NS = 'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"'
  const P_NS = 'xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"'
  const EMPTY_GROUP = '<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/>'

  const fixedParts = [
    xmlPart('[Content_Types].xml',
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/>' +
      '<Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>' +
      '<Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/>' +
      '<Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/>' +
      '<Override PartName="/ppt/slides/slide1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>' +
      '</Types>'),
    xmlPart('_rels/.rels',
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="${OOXML_RELS_NS}">` +
      `<Relationship Id="rId1" Type="${OOXML_DOC_REL}" Target="ppt/presentation.xml"/></Relationships>`),
    xmlPart('ppt/presentation.xml',
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:presentation ${A_NS} ${R_NS} ${P_NS}>` +
      '<p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst>' +
      '<p:sldIdLst><p:sldId id="256" r:id="rId2"/></p:sldIdLst>' +
      '<p:sldSz cx="9144000" cy="6858000"/><p:notesSz cx="6858000" cy="9144000"/></p:presentation>'),
    xmlPart('ppt/_rels/presentation.xml.rels',
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="${OOXML_RELS_NS}">` +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="slideMasters/slideMaster1.xml"/>' +
      '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide1.xml"/></Relationships>'),
    xmlPart('ppt/slideMasters/slideMaster1.xml',
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:sldMaster ${A_NS} ${R_NS} ${P_NS}>` +
      `<p:cSld><p:spTree>${EMPTY_GROUP}</p:spTree></p:cSld>` +
      '<p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/>' +
      '<p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst></p:sldMaster>'),
    xmlPart('ppt/slideMasters/_rels/slideMaster1.xml.rels',
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="${OOXML_RELS_NS}">` +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/></Relationships>'),
    xmlPart('ppt/slideLayouts/slideLayout1.xml',
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:sldLayout ${A_NS} ${R_NS} ${P_NS} type="blank">` +
      `<p:cSld><p:spTree>${EMPTY_GROUP}</p:spTree></p:cSld></p:sldLayout>`),
    xmlPart('ppt/slides/_rels/slide1.xml.rels',
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="${OOXML_RELS_NS}">` +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/></Relationships>')
  ]
  const prefix = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:sld ${A_NS} ${R_NS} ${P_NS}>` +
    `<p:cSld><p:spTree>${EMPTY_GROUP}` +
    '<p:sp><p:nvSpPr><p:cNvPr id="2" name="TextBox"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr><p:spPr/>' +
    '<p:txBody><a:bodyPr/><a:p><a:r><a:t>'
  const suffix = '</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld></p:sld>'
  return buildOfficeZip(targetBytes, fixedParts, 'ppt/slides/slide1.xml', prefix, suffix)
}

// ---- EPUB: also a ZIP (same buildOfficeZip machinery as the Office formats above), but with one
// EPUB-specific rule: the "mimetype" entry must be first and stored with no extra field, which
// buildZipArchive already does for every entry (stored method, zero extra-field length). ----
function buildEpub(targetBytes) {
  const fixedParts = [
    xmlPart('mimetype', 'application/epub+zip'),
    xmlPart('META-INF/container.xml',
      '<?xml version="1.0" encoding="UTF-8"?>' +
      '<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">' +
      '<rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles>' +
      '</container>'),
    xmlPart('OEBPS/content.opf',
      '<?xml version="1.0" encoding="UTF-8"?>' +
      '<package xmlns="http://www.idpf.org/2007/opf" version="2.0" unique-identifier="BookId">' +
      '<metadata xmlns:dc="http://purl.org/dc/elements/1.1/">' +
      '<dc:title>Generated File</dc:title><dc:language>en</dc:language>' +
      '<dc:identifier id="BookId">urn:uuid:00000000-0000-0000-0000-000000000000</dc:identifier>' +
      '</metadata>' +
      '<manifest><item id="chapter1" href="chapter1.xhtml" media-type="application/xhtml+xml"/>' +
      '<item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/></manifest>' +
      '<spine toc="ncx"><itemref idref="chapter1"/></spine></package>'),
    xmlPart('OEBPS/toc.ncx',
      '<?xml version="1.0" encoding="UTF-8"?>' +
      '<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">' +
      '<head><meta name="dtb:uid" content="urn:uuid:00000000-0000-0000-0000-000000000000"/></head>' +
      '<docTitle><text>Generated File</text></docTitle>' +
      '<navMap><navPoint id="navpoint-1" playOrder="1"><navLabel><text>Chapter 1</text></navLabel>' +
      '<content src="chapter1.xhtml"/></navPoint></navMap></ncx>')
  ]
  const prefix = '<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE html>' +
    '<html xmlns="http://www.w3.org/1999/xhtml"><head><title>Chapter 1</title></head><body><p>'
  const suffix = '</p></body></html>'
  return buildOfficeZip(targetBytes, fixedParts, 'OEBPS/chapter1.xhtml', prefix, suffix)
}

// ---- PDF: minimal valid single blank-page document ----
// A single blank page would just be a valid-but-empty PDF (nothing to see when opened), so the
// padding here is real page content — filler text actually drawn via a content stream — rather
// than a file-level comment. Object 4 (the content stream) is the only variable-length part and
// is written last, so objects 1/2/3/5's byte offsets are fixed and computable up front, same
// trick as the xref/startxref fixed-width-offset approach below.
function buildPdf(targetBytes) {
  const header = '%PDF-1.4\n'
  const obj1 = '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n'
  const obj2 = '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n'
  const obj3 = '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] ' +
    '/Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>\nendobj\n'
  const obj5 = '5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n'

  const offset1 = header.length
  const offset2 = offset1 + obj1.length
  const offset3 = offset2 + obj2.length
  const offset5 = offset3 + obj3.length
  const offset4 = offset5 + obj5.length // object 4 (content stream) comes last, after everything fixed
  const bodyFixed = header + obj1 + obj2 + obj3 + obj5

  const pad10 = n => String(n).padStart(10, '0')
  // Text is drawn via a real content stream (BT/Tf/Td/Tj/ET), not a file-level comment, so the
  // page actually shows the filler when opened. Everything here but `text` is a fixed length —
  // and /Length + startxref are 10-digit fixed-width, same trick as the xref table's own offsets
  // below — so the wrapper's total overhead is a constant, computable without building anything.
  const STREAM_DATA_PREFIX = 'BT /F1 12 Tf 50 750 Td ('
  const STREAM_DATA_SUFFIX = ') Tj ET'
  const contentObj = streamDataLen => {
    const streamData = STREAM_DATA_PREFIX + 'A'.repeat(Math.max(0, streamDataLen)) + STREAM_DATA_SUFFIX
    return '4 0 obj\n<< /Length ' + pad10(streamData.length) + ' >>\nstream\n' + streamData + '\nendstream\nendobj\n'
  }
  const tail = xrefOffset => 'xref\n0 6\n' +
    '0000000000 65535 f \n' +
    pad10(offset1) + ' 00000 n \n' +
    pad10(offset2) + ' 00000 n \n' +
    pad10(offset3) + ' 00000 n \n' +
    pad10(offset4) + ' 00000 n \n' +
    pad10(offset5) + ' 00000 n \n' +
    'trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n' + pad10(xrefOffset) + '\n%%EOF'

  // Measure the fixed overhead (streamDataLen=0) once — contentObj(0) already includes the
  // prefix/suffix text, so from here every extra byte of streamDataLen is exactly one more byte
  // of total file size — then solve for exactly how much filler text closes the gap to targetBytes.
  const noPadTotal = offset4 + contentObj(0).length + tail(0).length
  const streamDataLen = Math.max(0, targetBytes - noPadTotal)
  const obj4 = contentObj(streamDataLen)
  const xrefOffset = offset4 + obj4.length

  return new TextEncoder().encode(bodyFixed + obj4 + tail(xrefOffset))
}

// ---- BMP: real gradient image, width fixed at a multiple of 4 (avoids row padding math),
// trailing filler bytes appended after the declared pixel data to hit the target exactly
// (BMP readers only read the declared width x height worth of data and ignore the rest). ----
function buildBmp(targetBytes) {
  const HEADER_SIZE = 54
  const widthForSide = side => Math.max(4, Math.round(side / 4) * 4)
  const sizeForSide = side => HEADER_SIZE + widthForSide(side) * 3 * side // height == side
  const side = binarySearchLargestFit(IMAGE_MAX_SIDE, sizeForSide, targetBytes)
  const width = widthForSide(side)
  const height = side
  const rowBytes = width * 3
  const imageDataLen = height * rowBytes

  const total = Math.max(HEADER_SIZE + imageDataLen, targetBytes)
  const buf = new Uint8Array(total)
  const view = new DataView(buf.buffer)
  buf[0] = 0x42; buf[1] = 0x4D // 'BM'
  view.setUint32(2, total, true)
  view.setUint32(10, HEADER_SIZE, true)
  view.setUint32(14, 40, true)
  view.setInt32(18, width, true)
  view.setInt32(22, height, true)
  view.setUint16(26, 1, true)
  view.setUint16(28, 24, true)
  view.setUint32(34, imageDataLen, true)
  view.setInt32(38, 2835, true)
  view.setInt32(42, 2835, true)

  for (let y = 0; y < height; y++) {
    const rowStart = HEADER_SIZE + y * rowBytes
    for (let x = 0; x < width; x++) {
      const o = rowStart + x * 3
      buf[o] = Math.floor(255 * x / Math.max(1, width - 1))       // B
      buf[o + 1] = Math.floor(255 * y / Math.max(1, height - 1))  // G
      buf[o + 2] = Math.floor(255 * (x + y) / Math.max(1, width + height - 2)) // R
    }
  }
  buf.fill(65, HEADER_SIZE + imageDataLen) // trailing filler beyond the declared pixel data
  return buf
}

// ---- GIF: real image over a 4-color palette, padded via trailing bytes appended after the
// trailer (0x3B) — conforming decoders stop reading at the trailer, so anything after it is
// ignored. Pixels are coded "literally" (each pixel's own palette index, never a back-reference),
// which is a valid but deliberately uncompressed use of LZW — GIF's decoder still grows its
// dictionary and code width exactly as if real compression were happening, purely as a function
// of how many codes have been emitted since the last Clear Code, regardless of their values. That
// makes the encoded byte length for N pixels fully deterministic (see estimateGifLzwBytes),
// letting us binary-search for a size that fits before doing the real encode.
const GIF_PALETTE = [[0, 0, 0], [230, 30, 30], [30, 170, 60], [40, 100, 230]] // black, red, green, blue

// A decoder never adds a dictionary entry for the first code read after a Clear Code (there's no
// previous string yet to extend) — only for every code after that. Both functions below must
// advance `nextCode` on exactly that same schedule, or the code-width growth (and therefore every
// bit position from that point on) desyncs from what a real decoder computes.
function estimateGifLzwBytes(pixelCount, minCodeSize) {
  const clearCode = 1 << minCodeSize
  const endCode = clearCode + 1
  let codeSize = minCodeSize + 1
  let nextCode = endCode + 1
  let firstAfterClear = true
  let totalBits = codeSize // initial Clear Code
  for (let i = 0; i < pixelCount; i++) {
    totalBits += codeSize
    if (firstAfterClear) { firstAfterClear = false; continue }
    nextCode++
    if (nextCode === 4096) {
      totalBits += codeSize // a Clear Code to reset the table before it overflows
      nextCode = endCode + 1
      codeSize = minCodeSize + 1
      firstAfterClear = true
    } else if (nextCode === (1 << codeSize) && codeSize < 12) {
      codeSize++ // "early change" — GIF's convention, vs. TIFF's LZW variant
    }
  }
  return Math.ceil((totalBits + codeSize) / 8) // + End Code
}

function encodeGifLzwLiteral(pixelValues, minCodeSize) {
  const clearCode = 1 << minCodeSize
  const endCode = clearCode + 1
  let codeSize = minCodeSize + 1
  let nextCode = endCode + 1
  let firstAfterClear = true
  let buffer = 0, bitCount = 0
  const out = []
  const emit = code => {
    buffer |= code << bitCount
    bitCount += codeSize
    while (bitCount >= 8) { out.push(buffer & 0xFF); buffer >>= 8; bitCount -= 8 }
  }
  emit(clearCode)
  for (let i = 0; i < pixelValues.length; i++) {
    emit(pixelValues[i])
    if (firstAfterClear) { firstAfterClear = false; continue }
    nextCode++
    if (nextCode === 4096) {
      emit(clearCode)
      nextCode = endCode + 1
      codeSize = minCodeSize + 1
      firstAfterClear = true
    } else if (nextCode === (1 << codeSize) && codeSize < 12) {
      codeSize++
    }
  }
  emit(endCode)
  if (bitCount > 0) out.push(buffer & 0xFF)
  return out
}

function buildGif(targetBytes) {
  const minCodeSize = 2 // GIF's LZW minimum code size is always at least 2, even for our 4-color table
  const STRUCTURAL_OVERHEAD = 6 /* header */ + 7 /* logical screen descriptor */ +
    GIF_PALETTE.length * 3 /* global color table */ + 10 /* image descriptor */ +
    1 /* min-code-size byte */ + 1 /* block terminator */ + 1 /* trailer */

  const sizeForSide = side => {
    const lzwBytes = estimateGifLzwBytes(side * side, minCodeSize)
    return STRUCTURAL_OVERHEAD + Math.max(1, Math.ceil(lzwBytes / 255)) + lzwBytes
  }
  const side = binarySearchLargestFit(IMAGE_MAX_SIDE, sizeForSide, targetBytes)
  const width = side, height = side

  const pixelValues = new Array(width * height)
  for (let y = 0; y < height; y++) {
    // horizontal bands cycling through the palette
    const band = Math.floor(y / Math.max(1, height / GIF_PALETTE.length)) % GIF_PALETTE.length
    for (let x = 0; x < width; x++) pixelValues[y * width + x] = band
  }
  const lzwBytes = encodeGifLzwLiteral(pixelValues, minCodeSize)

  const bytes = [0x47, 0x49, 0x46, 0x38, 0x39, 0x61] // "GIF89a"
  bytes.push(width & 0xFF, (width >> 8) & 0xFF, height & 0xFF, (height >> 8) & 0xFF)
  bytes.push(0b10000001) // global color table present, size field 1 -> 4 entries
  bytes.push(0, 0) // background color index, pixel aspect ratio
  for (const [r, g, b] of GIF_PALETTE) bytes.push(r, g, b)
  bytes.push(0x2C, 0, 0, 0, 0, width & 0xFF, (width >> 8) & 0xFF, height & 0xFF, (height >> 8) & 0xFF, 0x00)
  bytes.push(minCodeSize)
  for (let offset = 0; offset < lzwBytes.length; ) {
    const chunkLen = Math.min(255, lzwBytes.length - offset)
    bytes.push(chunkLen, ...lzwBytes.slice(offset, offset + chunkLen))
    offset += chunkLen
  }
  bytes.push(0x00, 0x3B) // block terminator, trailer

  const fixed = new Uint8Array(bytes)
  const total = Math.max(fixed.length, targetBytes)
  const out = new Uint8Array(total)
  out.set(fixed, 0)
  out.fill(65, fixed.length)
  return out
}

// ---- JPEG: real baseline grayscale JPEG, built from 8x8 blocks (the smallest unit a JPEG can
// encode) tiled into a grid, padded via trailing bytes appended after EOI (0xFFD9) — same
// "ignored past the terminal marker" trick as GIF/BMP above. Each block is internally solid
// (uniform gray), so every AC coefficient is always 0 — only end-of-block is ever needed there —
// but the shade varies block-to-block as a gradient, so DC *differences* between blocks vary too
// and need a real multi-category Huffman table (unlike AC, which stays a degenerate single-symbol
// table exactly as before).
function packBitsMSBFirst(bits) {
  let buffer = 0, bitCount = 0
  const out = []
  for (const bit of bits) {
    buffer = (buffer << 1) | bit
    bitCount++
    if (bitCount === 8) { out.push(buffer); buffer = 0; bitCount = 0 }
  }
  if (bitCount > 0) out.push(((buffer << (8 - bitCount)) | (0xFF >> bitCount)) & 0xFF)
  return out
}

const JPEG_ZIGZAG = [
  0, 1, 8, 16, 9, 2, 3, 10, 17, 24, 32, 25, 18, 11, 4, 5,
  12, 19, 26, 33, 40, 48, 41, 34, 27, 20, 13, 6, 7, 14, 21, 28,
  35, 42, 49, 56, 57, 50, 43, 36, 29, 22, 15, 23, 30, 37, 44, 51,
  58, 59, 52, 45, 38, 31, 39, 46, 53, 60, 61, 54, 47, 55, 62, 63
]
const JPEG_STD_LUMA_QUANT_NATURAL_ORDER = [
  16, 11, 10, 16, 24, 40, 51, 61, 12, 12, 14, 19, 26, 58, 60, 55,
  14, 13, 16, 24, 40, 57, 69, 56, 14, 17, 22, 29, 51, 87, 80, 62,
  18, 22, 37, 56, 68, 109, 103, 77, 24, 35, 55, 64, 81, 104, 113, 92,
  49, 64, 78, 87, 103, 121, 120, 101, 72, 92, 95, 98, 112, 100, 103, 99
]

function jpegCategoryOf(value) {
  if (value === 0) return 0
  let v = Math.abs(value), cat = 0
  while (v > 0) { cat++; v >>= 1 }
  return cat
}

function jpegExtendBits(value, category) {
  if (category === 0) return 0
  return value >= 0 ? value : value + (1 << category) - 1
}

// Standard JPEG Annex C canonical-Huffman construction: assign codes in order of increasing
// length, then increasing symbol index within each length.
function buildCanonicalHuffman(bits16, huffval) {
  const table = {}
  let code = 0, k = 0
  for (let len = 1; len <= 16; len++) {
    for (let i = 0; i < bits16[len - 1]; i++) { table[huffval[k]] = { code, len }; code++; k++ }
    code <<= 1
  }
  return table
}

// DC categories 0-11, each given a unique, increasing code length (a valid "comb" canonical
// table — every prefix code is used exactly once, so it's spec-legal, just not the standard
// 162-entry table real encoders use for actual compression). Fine here since our DC differences
// come from a smooth, predictable per-block gradient, not arbitrary real image statistics.
const JPEG_DC_BITS = [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0]
const JPEG_DC_HUFFVAL = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
const JPEG_DC_TABLE = buildCanonicalHuffman(JPEG_DC_BITS, JPEG_DC_HUFFVAL)
// AC only ever needs end-of-block, since every block is internally solid (all AC coefficients 0)
const JPEG_AC_BITS = [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
const JPEG_AC_HUFFVAL = [0x00]
const JPEG_AC_EOB = buildCanonicalHuffman(JPEG_AC_BITS, JPEG_AC_HUFFVAL)[0x00]

function jpegBlockShade(blockCol, blockRow, blocksWide, blocksHigh) {
  const t = (blockCol + blockRow) / Math.max(1, blocksWide + blocksHigh - 2)
  return Math.round(64 + t * 128) // mid-range gray band
}

function encodeJpegScan(blocksWide, blocksHigh, quantDc) {
  const bits = []
  const pushCode = ({ code, len }) => { for (let i = len - 1; i >= 0; i--) bits.push((code >> i) & 1) }
  let prevDc = 0
  for (let by = 0; by < blocksHigh; by++) {
    for (let bx = 0; bx < blocksWide; bx++) {
      const shade = jpegBlockShade(bx, by, blocksWide, blocksHigh)
      const dc = Math.round((8 * (shade - 128)) / quantDc) // DCT DC term of a constant block, quantized
      const diff = dc - prevDc
      prevDc = dc
      const category = jpegCategoryOf(diff)
      pushCode(JPEG_DC_TABLE[category])
      const extra = jpegExtendBits(diff, category)
      for (let i = category - 1; i >= 0; i--) bits.push((extra >> i) & 1)
      pushCode(JPEG_AC_EOB)
    }
  }
  return bits
}

function buildJpeg(targetBytes) {
  const QUANT_DC = JPEG_STD_LUMA_QUANT_NATURAL_ORDER[0] // 16 — natural-order index 0 is the DC term
  // Fixed segment bytes: SOI(2) + APP0(18) + DQT(69) + SOF0(13) + DHT-DC(33, 12-symbol table) +
  // DHT-AC(22, 1-symbol table) + SOS(10) + EOI(2)
  const FIXED_NON_SCAN = 2 + 18 + 69 + 13 + 33 + 22 + 10 + 2

  const sizeForBlocksPerSide = n => FIXED_NON_SCAN + Math.ceil(encodeJpegScan(n, n, QUANT_DC).length / 8)
  const MAX_BLOCKS_PER_SIDE = IMAGE_MAX_SIDE / 8
  const blocksPerSide = binarySearchLargestFit(MAX_BLOCKS_PER_SIDE, sizeForBlocksPerSide, targetBytes)
  const width = blocksPerSide * 8, height = blocksPerSide * 8

  const bytes = []
  const push = arr => bytes.push(...arr)

  push([0xFF, 0xD8]) // SOI

  push([0xFF, 0xE0, 0x00, 0x10]) // APP0 (JFIF)
  push([0x4A, 0x46, 0x49, 0x46, 0x00]) // "JFIF\0"
  push([0x01, 0x02, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00])

  const quantZigzag = new Array(64)
  JPEG_ZIGZAG.forEach((naturalIndex, zigzagIndex) => { quantZigzag[zigzagIndex] = JPEG_STD_LUMA_QUANT_NATURAL_ORDER[naturalIndex] })
  push([0xFF, 0xDB, 0x00, 0x43, 0x00])
  push(quantZigzag)

  push([0xFF, 0xC0, 0x00, 0x0B, 0x08, (height >> 8) & 0xFF, height & 0xFF, (width >> 8) & 0xFF, width & 0xFF, 0x01, 0x01, 0x11, 0x00]) // SOF0: baseline, 1 component

  push([0xFF, 0xC4, 0x00, 0x1F, 0x00]) // DHT DC — 12-symbol table (categories 0-11)
  push(JPEG_DC_BITS)
  push(JPEG_DC_HUFFVAL)

  push([0xFF, 0xC4, 0x00, 0x14, 0x10]) // DHT AC — single symbol: end-of-block
  push(JPEG_AC_BITS)
  push(JPEG_AC_HUFFVAL)

  push([0xFF, 0xDA, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3F, 0x00]) // SOS

  for (const b of packBitsMSBFirst(encodeJpegScan(blocksPerSide, blocksPerSide, QUANT_DC))) {
    push([b])
    if (b === 0xFF) push([0x00]) // byte-stuffing: a literal 0xFF in scan data must be escaped
  }

  push([0xFF, 0xD9]) // EOI

  const fixed = new Uint8Array(bytes)
  const total = Math.max(fixed.length, targetBytes)
  const out = new Uint8Array(total)
  out.set(fixed, 0)
  out.fill(65, fixed.length)
  return out
}

// ---- TIFF: real gradient image, one uncompressed RGB strip (no row alignment/padding needed,
// unlike BMP), trailing filler bytes appended after the declared strip data to hit the target
// exactly (readers only read StripByteCounts worth of data from StripOffsets). ----
function buildTiff(targetBytes) {
  const STRUCT_SIZE = 180 // header(8) + IFD(2 + 12*12 + 4 = 150) + external tag data(6+8+8 = 22)
  const sizeForSide = side => STRUCT_SIZE + side * side * 3
  const side = binarySearchLargestFit(IMAGE_MAX_SIDE, sizeForSide, targetBytes)
  const width = side, height = side
  const pixelDataLen = width * height * 3

  const total = Math.max(STRUCT_SIZE + pixelDataLen, targetBytes)
  const buf = new Uint8Array(total)
  const view = new DataView(buf.buffer)

  writeAscii(buf, 0, 'II') // little-endian byte order
  view.setUint16(2, 42, true) // TIFF magic number
  view.setUint32(4, 8, true) // offset to the (only) IFD

  const IFD_OFFSET = 8
  const NUM_ENTRIES = 12
  const bitsOffset = IFD_OFFSET + 2 + NUM_ENTRIES * 12 + 4 // after count + entries + next-IFD pointer
  const xresOffset = bitsOffset + 6
  const yresOffset = xresOffset + 8
  const pixelDataOffset = yresOffset + 8

  view.setUint16(IFD_OFFSET, NUM_ENTRIES, true)
  let o = IFD_OFFSET + 2
  const entry = (tag, type, count, value) => {
    view.setUint16(o, tag, true)
    view.setUint16(o + 2, type, true) // 3 = SHORT, 4 = LONG, 5 = RATIONAL
    view.setUint32(o + 4, count, true)
    view.setUint32(o + 8, value, true) // short/single values are left-justified — same as writing them as a plain LE uint32
    o += 12
  }
  entry(256, 4, 1, width)            // ImageWidth
  entry(257, 4, 1, height)           // ImageLength
  entry(258, 3, 3, bitsOffset)       // BitsPerSample [8,8,8]
  entry(259, 3, 1, 1)                // Compression: none
  entry(262, 3, 1, 2)                // PhotometricInterpretation: RGB
  entry(273, 4, 1, pixelDataOffset)  // StripOffsets
  entry(277, 3, 1, 3)                // SamplesPerPixel
  entry(278, 4, 1, height)           // RowsPerStrip
  entry(279, 4, 1, pixelDataLen)     // StripByteCounts
  entry(282, 5, 1, xresOffset)       // XResolution
  entry(283, 5, 1, yresOffset)       // YResolution
  entry(296, 3, 1, 2)                // ResolutionUnit: inch
  view.setUint32(o, 0, true) // next IFD offset — none

  view.setUint16(bitsOffset, 8, true)
  view.setUint16(bitsOffset + 2, 8, true)
  view.setUint16(bitsOffset + 4, 8, true)
  view.setUint32(xresOffset, 72, true); view.setUint32(xresOffset + 4, 1, true) // 72/1
  view.setUint32(yresOffset, 72, true); view.setUint32(yresOffset + 4, 1, true)

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const p = pixelDataOffset + (y * width + x) * 3
      buf[p] = Math.floor(255 * x / Math.max(1, width - 1))
      buf[p + 1] = Math.floor(255 * y / Math.max(1, height - 1))
      buf[p + 2] = Math.floor(255 * (x + y) / Math.max(1, width + height - 2))
    }
  }
  buf.fill(65, pixelDataOffset + pixelDataLen) // trailing filler beyond the declared strip
  return buf
}

// ---- WAV: silent PCM audio, sized by data-chunk length ----
function buildWav(targetBytes) {
  const HEADER_SIZE = 44
  const total = Math.max(HEADER_SIZE, targetBytes)
  const dataLen = total - HEADER_SIZE
  const sampleRate = 8000

  const buf = new Uint8Array(total)
  const view = new DataView(buf.buffer)
  writeAscii(buf, 0, 'RIFF')
  view.setUint32(4, 36 + dataLen, true)
  writeAscii(buf, 8, 'WAVE')
  writeAscii(buf, 12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate, true)
  view.setUint16(32, 1, true)
  view.setUint16(34, 8, true)
  writeAscii(buf, 36, 'data')
  view.setUint32(40, dataLen, true)
  // A real, audible 440 Hz tone (A4) rather than silence — 8-bit unsigned PCM centers on 128.
  const FREQ = 440
  const step = 2 * Math.PI * FREQ / sampleRate
  for (let i = 0; i < dataLen; i++) buf[HEADER_SIZE + i] = 128 + Math.round(100 * Math.sin(step * i))
  return buf
}

// ---- Plain text formats: exact byte count via ASCII filler, optionally wrapped in valid syntax ----
function buildWrappedText(prefix, suffix, targetBytes, fillChar = 'A') {
  const overhead = prefix.length + suffix.length
  if (targetBytes <= overhead) return fillChar.repeat(Math.max(0, targetBytes))
  return prefix + fillChar.repeat(targetBytes - overhead) + suffix
}

function buildFile(type, targetBytes) {
  switch (type) {
    case 'txt': return new TextEncoder().encode(buildWrappedText('', '', targetBytes))
    case 'csv': return new TextEncoder().encode(buildWrappedText('id,value\n', '', targetBytes))
    case 'json': return new TextEncoder().encode(buildWrappedText('{"data":"', '"}', targetBytes))
    case 'html': return new TextEncoder().encode(buildWrappedText('<!DOCTYPE html><html><body><p>', '</p></body></html>', targetBytes))
    case 'xml': return new TextEncoder().encode(buildWrappedText('<?xml version="1.0"?><root><data>', '</data></root>', targetBytes))
    case 'md': return new TextEncoder().encode(buildWrappedText('# Generated File\n\n', '', targetBytes))
    case 'bin': return randomBytes(targetBytes)
    case 'zip': return buildZip(targetBytes)
    case 'pdf': return buildPdf(targetBytes)
    case 'png': return buildPng(targetBytes)
    case 'bmp': return buildBmp(targetBytes)
    case 'gif': return buildGif(targetBytes)
    case 'jpg': return buildJpeg(targetBytes)
    case 'tiff': return buildTiff(targetBytes)
    case 'svg': return buildSvg(targetBytes)
    case 'ico': return buildIco(targetBytes)
    case 'wav': return buildWav(targetBytes)
    case 'xlsx': return buildXlsx(targetBytes)
    case 'docx': return buildDocx(targetBytes)
    case 'pptx': return buildPptx(targetBytes)
    case 'rtf': return new TextEncoder().encode(buildWrappedText('{\\rtf1\\ansi\\deff0{\\fonttbl{\\f0 Arial;}}\\f0\\fs24 ', '}', targetBytes))
    case 'epub': return buildEpub(targetBytes)
  }
}

const FILE_TYPES = {
  txt: { label: 'Plain Text', ext: 'txt', mime: 'text/plain' },
  csv: { label: 'CSV', ext: 'csv', mime: 'text/csv' },
  json: { label: 'JSON', ext: 'json', mime: 'application/json' },
  html: { label: 'HTML', ext: 'html', mime: 'text/html' },
  xml: { label: 'XML', ext: 'xml', mime: 'application/xml' },
  md: { label: 'Markdown', ext: 'md', mime: 'text/markdown' },
  bin: { label: 'Random Binary', ext: 'bin', mime: 'application/octet-stream' },
  zip: { label: 'ZIP Archive', ext: 'zip', mime: 'application/zip' },
  pdf: { label: 'PDF', ext: 'pdf', mime: 'application/pdf' },
  png: { label: 'PNG Image', ext: 'png', mime: 'image/png' },
  bmp: { label: 'BMP Image', ext: 'bmp', mime: 'image/bmp' },
  gif: { label: 'GIF Image', ext: 'gif', mime: 'image/gif' },
  jpg: { label: 'JPEG Image', ext: 'jpg', mime: 'image/jpeg' },
  tiff: { label: 'TIFF Image', ext: 'tiff', mime: 'image/tiff' },
  svg: { label: 'SVG Image', ext: 'svg', mime: 'image/svg+xml' },
  ico: { label: 'Icon (ICO)', ext: 'ico', mime: 'image/x-icon' },
  wav: { label: 'WAV Audio', ext: 'wav', mime: 'audio/wav' },
  xlsx: { label: 'Excel Workbook', ext: 'xlsx', mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
  docx: { label: 'Word Document', ext: 'docx', mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
  pptx: { label: 'PowerPoint Presentation', ext: 'pptx', mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' },
  rtf: { label: 'Rich Text (RTF)', ext: 'rtf', mime: 'application/rtf' },
  epub: { label: 'EPUB eBook', ext: 'epub', mime: 'application/epub+zip' }
}

// Each format's real minimum viable size, derived by building it with a 0-byte target rather
// than hand-maintaining separate constants that could drift out of sync with the builders above.
const MIN_BYTES = {
  zip: buildZip(0).length,
  pdf: buildPdf(0).length,
  png: buildPng(0).length,
  bmp: buildBmp(0).length,
  gif: buildGif(0).length,
  jpg: buildJpeg(0).length,
  tiff: buildTiff(0).length,
  ico: buildIco(0).length,
  wav: 44,
  xlsx: buildXlsx(0).length,
  docx: buildDocx(0).length,
  pptx: buildPptx(0).length,
  epub: buildEpub(0).length
}

const MAX_BYTES = 50 * 1024 * 1024 // popup process safety cap

// macOS Finder and Windows Explorer disagree on what "KB"/"MB" means: Finder divides by 1000
// (the actual SI definition), Explorer divides by 1024 despite using the same labels. There's no
// single number that reads as a clean round value on both, so the unit style is a user choice
// (see the "KB/MB means" control) rather than a fixed constant.
const UNIT_STYLE_DIVISORS = { mac: 1000, win: 1024 }

function formatBytes(n, unitStyle = 'mac') {
  const k = UNIT_STYLE_DIVISORS[unitStyle]
  if (n >= k * k) return (n / (k * k)).toFixed(2) + ' MB'
  if (n >= k) return (n / k).toFixed(2) + ' KB'
  return n + ' B'
}

function validateFileSettings(type, targetBytes, unitStyle) {
  if (!targetBytes || targetBytes <= 0) return 'Enter a size greater than 0.'
  if (targetBytes > MAX_BYTES) return `Max size is ${formatBytes(MAX_BYTES, unitStyle)}.`
  const min = MIN_BYTES[type]
  if (min && targetBytes < min) return `Minimum size for ${FILE_TYPES[type].label} is ${min.toLocaleString()} bytes.`
  return null
}

function downloadBytes(bytes, filename, mime) {
  const blob = new Blob([bytes], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

// ---- Wiring ----
;(function initFileTool() {
  const typeTrigger = document.getElementById('ft-type-trigger')
  const typeTriggerLabel = document.getElementById('ft-type-trigger-label')
  const typePanel = document.getElementById('ft-type-panel')
  let currentType = 'txt'
  const sizeInput = document.getElementById('ft-size')
  const unitSeg = document.querySelector('.segmented[data-group="ft-unit"]')
  const unitStyleSeg = document.querySelector('.segmented[data-group="ft-unit-style"]')
  const filenameInput = document.getElementById('ft-filename')
  const generateBtn = document.getElementById('ft-generate')
  const errorEl = document.getElementById('ft-error')
  const resultEl = document.getElementById('ft-result')
  const resetBtn = document.getElementById('ft-reset-btn')

  const DEFAULT_SETTINGS = { type: 'txt', amount: 10, unit: 'KB', unitStyle: 'mac', filename: 'generated-file' }

  function setSegmented(seg, value) {
    seg.querySelectorAll('.seg-btn').forEach(b => b.classList.toggle('active', b.dataset.value === value))
  }

  function setType(value) {
    const opt = typePanel.querySelector(`.ft-select-option[data-value="${value}"]`)
    if (!opt) return
    currentType = value
    typeTriggerLabel.textContent = opt.textContent
    typePanel.querySelectorAll('.ft-select-option').forEach(o => o.classList.toggle('active', o === opt))
  }

  function openTypePanel() {
    typePanel.hidden = false
    const rect = typeTrigger.getBoundingClientRect()
    typePanel.style.left = rect.left + 'px'
    typePanel.style.width = rect.width + 'px'
    typePanel.style.top = (rect.bottom + 4) + 'px'
    // Clamped to the popup's own viewport (never taller than the space actually below the
    // trigger) — this is exactly what a native <select> does NOT do inside a small popup.
    typePanel.style.maxHeight = Math.max(120, window.innerHeight - rect.bottom - 12) + 'px'
  }

  function closeTypePanel() {
    typePanel.hidden = true
  }

  typeTrigger.addEventListener('click', () => {
    if (typePanel.hidden) openTypePanel()
    else closeTypePanel()
  })

  typePanel.addEventListener('click', e => {
    const opt = e.target.closest('.ft-select-option')
    if (!opt) return
    setType(opt.dataset.value)
    closeTypePanel()
    saveSettings()
  })

  document.addEventListener('click', e => {
    if (!typePanel.hidden && !typePanel.contains(e.target) && !typeTrigger.contains(e.target)) closeTypePanel()
  })

  function applySettings(settings) {
    setType(settings.type)
    sizeInput.value = settings.amount
    setSegmented(unitSeg, settings.unit)
    setSegmented(unitStyleSeg, settings.unitStyle)
    filenameInput.value = settings.filename
    errorEl.hidden = true
    resultEl.hidden = true
  }

  function currentSettings() {
    return {
      type: currentType,
      amount: sizeInput.value,
      unit: unitSeg.querySelector('.seg-btn.active').dataset.value,
      unitStyle: unitStyleSeg.querySelector('.seg-btn.active').dataset.value,
      filename: filenameInput.value.trim() || DEFAULT_SETTINGS.filename
    }
  }

  function saveSettings() {
    syncSet({ 'file-tool-settings': currentSettings() })
  }

  function targetBytesFor(settings) {
    const amount = Math.max(0, parseFloat(settings.amount) || 0)
    const k = UNIT_STYLE_DIVISORS[settings.unitStyle]
    const multiplier = { B: 1, KB: k, MB: k * k }[settings.unit]
    return Math.round(amount * multiplier)
  }

  unitSeg.addEventListener('click', e => {
    const btn = e.target.closest('.seg-btn')
    if (!btn) return
    setSegmented(unitSeg, btn.dataset.value)
    saveSettings()
  })

  unitStyleSeg.addEventListener('click', e => {
    const btn = e.target.closest('.seg-btn')
    if (!btn) return
    setSegmented(unitStyleSeg, btn.dataset.value)
    saveSettings()
  })

  sizeInput.addEventListener('change', saveSettings)
  filenameInput.addEventListener('change', saveSettings)

  generateBtn.addEventListener('click', () => {
    const settings = currentSettings()
    const targetBytes = targetBytesFor(settings)
    const error = validateFileSettings(settings.type, targetBytes, settings.unitStyle)
    if (error) {
      errorEl.textContent = error
      errorEl.hidden = false
      resultEl.hidden = true
      return
    }
    errorEl.hidden = true
    const bytes = buildFile(settings.type, targetBytes)
    const meta = FILE_TYPES[settings.type]
    const safeName = settings.filename.replace(/[\\/:*?"<>|]/g, '_')
    downloadBytes(bytes, `${safeName}.${meta.ext}`, meta.mime)
    resultEl.textContent = `Downloaded ${formatBytes(bytes.length, settings.unitStyle)} (${bytes.length.toLocaleString()} bytes)`
    resultEl.hidden = false
    saveSettings()
  })

  resetBtn.addEventListener('click', () => {
    applySettings(DEFAULT_SETTINGS)
    saveSettings()
  })

  syncGet(['file-tool-settings']).then(({ 'file-tool-settings': saved }) => {
    applySettings(saved ? { ...DEFAULT_SETTINGS, ...saved } : DEFAULT_SETTINGS)
  })
})()
