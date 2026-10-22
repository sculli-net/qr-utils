import { zlibSync } from 'fflate'
import type { RGBAImage } from './types.js'

const CRC_TABLE = new Uint32Array(256)
for (let n = 0; n < 256; n++) {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  CRC_TABLE[n] = c >>> 0
}

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff
  for (const byte of bytes) crc = CRC_TABLE[(crc ^ byte) & 0xff]! ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

function chunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length)
  const view = new DataView(out.buffer)
  view.setUint32(0, data.length)
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i)
  out.set(data, 8)
  view.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)))
  return out
}

/** Picks the PNG filter per row with the minimum-sum-of-absolute-differences heuristic. */
function filterRows(raw: Uint8Array, rowBytes: number, height: number, bpp: number): Uint8Array {
  const out = new Uint8Array((rowBytes + 1) * height)
  const candidate = new Uint8Array(rowBytes)
  const best = new Uint8Array(rowBytes)
  for (let y = 0; y < height; y++) {
    const row = raw.subarray(y * rowBytes, (y + 1) * rowBytes)
    const prev = y > 0 ? raw.subarray((y - 1) * rowBytes, y * rowBytes) : undefined
    let bestFilter = 0
    let bestScore = Infinity
    for (let filter = 0; filter < 5; filter++) {
      let score = 0
      for (let i = 0; i < rowBytes; i++) {
        const left = i >= bpp ? row[i - bpp]! : 0
        const up = prev ? prev[i]! : 0
        const upLeft = prev && i >= bpp ? prev[i - bpp]! : 0
        let predictor = 0
        if (filter === 1) predictor = left
        else if (filter === 2) predictor = up
        else if (filter === 3) predictor = (left + up) >>> 1
        else if (filter === 4) {
          const p = left + up - upLeft
          const pa = Math.abs(p - left)
          const pb = Math.abs(p - up)
          const pc = Math.abs(p - upLeft)
          predictor = pa <= pb && pa <= pc ? left : pb <= pc ? up : upLeft
        }
        const value = (row[i]! - predictor) & 0xff
        candidate[i] = value
        score += value < 128 ? value : 256 - value
      }
      if (score < bestScore) {
        bestScore = score
        bestFilter = filter
        best.set(candidate)
      }
    }
    out[y * (rowBytes + 1)] = bestFilter
    out.set(best, y * (rowBytes + 1) + 1)
  }
  return out
}

/**
 * Encodes RGBA pixels as a PNG. Opaque images are stored as RGB, grey opaque images as greyscale.
 * @param compression DEFLATE level 0–9.
 */
export function encodePNG(image: RGBAImage, compression = 6): Uint8Array {
  const { width, height, data } = image
  let opaque = true
  let grey = true
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] !== 255) opaque = false
    if (data[i] !== data[i + 1] || data[i] !== data[i + 2]) grey = false
  }
  const colorType = !opaque ? 6 : grey ? 0 : 2
  const bpp = colorType === 6 ? 4 : colorType === 2 ? 3 : 1
  const raw = new Uint8Array(width * height * bpp)
  for (let p = 0, o = 0; p < data.length; p += 4) {
    if (bpp === 1) raw[o++] = data[p]!
    else {
      raw[o++] = data[p]!
      raw[o++] = data[p + 1]!
      raw[o++] = data[p + 2]!
      if (bpp === 4) raw[o++] = data[p + 3]!
    }
  }

  const header = new Uint8Array(13)
  const view = new DataView(header.buffer)
  view.setUint32(0, width)
  view.setUint32(4, height)
  header[8] = 8 // bit depth
  header[9] = colorType
  const level = Math.round(Math.min(9, Math.max(0, compression))) as 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9
  const idat = zlibSync(filterRows(raw, width * bpp, height, bpp), { level })

  const signature = Uint8Array.of(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)
  const parts = [signature, chunk('IHDR', header), chunk('IDAT', idat), chunk('IEND', new Uint8Array())]
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0))
  let offset = 0
  for (const part of parts) {
    out.set(part, offset)
    offset += part.length
  }
  return out
}
