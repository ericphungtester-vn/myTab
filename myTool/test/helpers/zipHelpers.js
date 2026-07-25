// Minimal ZIP reader for tests only — walks local file headers sequentially (valid here since
// every entry buildZipArchive produces is stored, in order, with no data descriptors), just
// enough to assert on entry names/order without pulling in a real ZIP library.
function listZipEntries(bytes) {
  const entries = []
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  let offset = 0
  while (offset + 4 <= bytes.length && view.getUint32(offset, true) === 0x04034b50) {
    const compSize = view.getUint32(offset + 18, true)
    const nameLen = view.getUint16(offset + 26, true)
    const extraLen = view.getUint16(offset + 28, true)
    const nameBytes = bytes.subarray(offset + 30, offset + 30 + nameLen)
    entries.push({ name: Buffer.from(nameBytes).toString('utf8'), offset, compSize })
    offset += 30 + nameLen + extraLen + compSize
  }
  return entries
}

module.exports = { listZipEntries }
