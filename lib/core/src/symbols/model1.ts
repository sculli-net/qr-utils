import type { ErrorCorrectionLevel } from '../types.js'
import { type BlockLayout, type CodeLayout, expandBlocks, type SymbolDefinition, sumData, type VersionInfo } from './definition.js'
import type { ModuleGrid } from './grid.js'
import { MASKS } from './mask.js'
import {
  drawFindersAndSeparators,
  drawTimingPatterns,
  QR_ECC_INDEX,
  QR_ECC_LEVELS,
  qrCountBits,
  qrMisdecodeProtection,
  reserveFormatAndDarkModule,
  writeFormatBits,
} from './qr-common.js'
import { MODEL1_BLOCKS } from './tables.js'

/*
 * QR Code Model 1 (ISO/IEC 18004:2000 Annex M, AIM ITS/97-001).
 *
 * Model 1 has no alignment patterns. Codewords are placed as 2×4 (vertical) or 4×2 (horizontal) module blocks
 * rather than the Model 2 zig-zag, and "extension patterns" are inserted along the right and bottom edges of
 * larger versions. The geometry here follows the codeword reading order of the zxing-cpp Model 1 decoder.
 * The data stream starts with four 0 bits (the first codeword occupies the bottom-right corner block).
 */

const VERSIONS: VersionInfo[] = Array.from({ length: 14 }, (_, i) => ({
  id: i + 1,
  number: i + 1,
  width: 21 + 4 * i,
  height: 21 + 4 * i,
}))

type Cell = readonly [x: number, y: number]

interface Model1Geometry {
  /** Module cells per codeword, most significant bit first. */
  readonly codewords: readonly (readonly Cell[])[]
  /** Extension pattern blocks: origin and orientation. */
  readonly extensions: readonly { readonly x: number; readonly y: number; readonly vertical: boolean }[]
}

const geometryCache = new Map<number, Model1Geometry>()

function geometry(size: number): Model1Geometry {
  const cached = geometryCache.get(size)
  if (cached) return cached
  const codewords: Cell[][] = []
  const extensions: { x: number; y: number; vertical: boolean }[] = []
  const vertical = (x: number, y: number): Cell[] => Array.from({ length: 8 }, (_, b) => [x - (b % 2), y - Math.floor(b / 2)] as const)
  const horizontal = (x: number, y: number): Cell[] => Array.from({ length: 8 }, (_, b) => [x - (b % 4), y - Math.floor(b / 4)] as const)

  const columns = Math.floor(size / 4) + 3
  for (let j = 0; j < columns; j++) {
    if (j <= 1) {
      // Vertical blocks along the right edge
      const rows = Math.floor((size - 8) / 4)
      for (let i = 0; i < rows; i++) {
        const x = size - 1 - j * 2
        const y = size - 1 - i * 4
        if (j === 0 && i % 2 === 0 && i > 0 && i < rows - 1) extensions.push({ x: x - 1, y: y - 3, vertical: true })
        else codewords.push(vertical(x, y))
      }
    } else if (columns - j <= 4) {
      // Vertical blocks between the left finder patterns (skipping the timing column)
      const rows = Math.floor((size - 16) / 4)
      for (let i = 0; i < rows; i++) {
        const x = (columns - j - 1) * 2 + 1 + (columns - j === 4 ? 1 : 0)
        const y = size - 1 - 8 - i * 4
        codewords.push(vertical(x, y))
      }
    } else {
      // Horizontal blocks in the middle (skipping the timing row)
      const rows = Math.floor(size / 2)
      for (let i = 0; i < rows; i++) {
        if (j === 2 && i >= rows - 4) continue // top-right finder, separator and format information
        const x = size - 1 - 4 - (j - 2) * 4
        const y = size - 1 - i * 2 - (i >= rows - 3 ? 1 : 0)
        if (i === 0 && j % 2 === 1 && j + 1 !== columns - 4) extensions.push({ x: x - 3, y: y - 1, vertical: false })
        else codewords.push(horizontal(x, y))
      }
    }
  }
  const result = { codewords, extensions }
  geometryCache.set(size, result)
  return result
}

/** Total number of codewords that fit in a Model 1 symbol. */
export function model1Capacity(version: number): number {
  return geometry(17 + 4 * version).codewords.length
}

/**
 * Block structure for a Model 1 version/level. Where the tabulated blocks do not add up to the symbol's codeword
 * capacity, the difference is assigned to the data codewords of the last blocks (as Model 2 does for its
 * second block group).
 */
function blocksFor(version: number, ecc: ErrorCorrectionLevel): BlockLayout[] {
  const blocks = expandBlocks(MODEL1_BLOCKS[version - 1]![QR_ECC_INDEX[ecc]])
  const capacity = model1Capacity(version)
  let difference = capacity - blocks.reduce((sum, block) => sum + block.data + block.ecc, 0)
  for (let i = blocks.length - 1; difference !== 0; i = (i - 1 + blocks.length) % blocks.length) {
    const step = Math.sign(difference)
    blocks[i] = { data: blocks[i]!.data + step, ecc: blocks[i]!.ecc }
    difference -= step
  }
  return blocks
}

// Extension pattern module values (2×4 on the right edge, 4×2 on the bottom edge).
const RIGHT_EXTENSION = [
  [1, 1],
  [1, 0],
  [1, 0],
  [1, 1],
]
const BOTTOM_EXTENSION = [
  [1, 0, 0, 1],
  [1, 1, 1, 1],
]

/** QR Code Model 1 (legacy). */
export const model1: SymbolDefinition = {
  type: 'model1',
  label: 'QR Code Model 1',
  versions: VERSIONS,
  defaultErrorCorrection: 'M',
  defaultQuietZone: 4,
  maskCount: 8,
  maskSelection: 'penalty',
  supportsEci: false,
  supportsFnc1: false,
  supportsStructuredAppend: false,
  indicators: { mode: { numeric: 0b0001, alphanumeric: 0b0010, byte: 0b0100, kanji: 0b1000 } },
  streamPrefixBits: 4,
  errorCorrectionLevels: () => QR_ECC_LEVELS,
  layout(version: VersionInfo, ecc: ErrorCorrectionLevel): CodeLayout {
    const blocks = blocksFor(version.number, ecc)
    const dataCodewords = sumData(blocks)
    return {
      dataCodewords,
      dataBits: dataCodewords * 8,
      blocks,
      misdecodeProtection: version.number === 1 ? qrMisdecodeProtection(1, ecc) : 0,
      halfFinalCodeword: false,
      interleaved: false,
    }
  },
  segmentParameters: (version) => ({ modeBits: 4, countBits: qrCountBits(version.number) }),
  terminatorBits: () => 4,
  drawFunctionPatterns(version, grid) {
    drawFindersAndSeparators(grid)
    drawTimingPatterns(grid)
    reserveFormatAndDarkModule(grid)
    for (const extension of geometry(version.width).extensions) {
      const landmark = grid.addLandmark({
        type: 'extension',
        orientation: extension.vertical ? 'vertical' : 'horizontal',
      })
      const pattern = extension.vertical ? RIGHT_EXTENSION : BOTTOM_EXTENSION
      grid.fillRect(extension.x, extension.y, pattern[0]!.length, pattern.length, 'extension', landmark, (dx, dy) => pattern[dy]![dx] === 1)
    }
  },
  placeCodewords(version, grid: ModuleGrid, stream) {
    const { codewords } = geometry(version.width)
    codewords.forEach((cells, codeword) => {
      if (codeword >= stream.codewords.length) return
      cells.forEach(([x, y], b) => grid.setCodewordBit(x, y, stream, codeword, 7 - b))
    })
    grid.fillRemainder()
  },
  writeFormat(_version, ecc, mask, grid, dark) {
    writeFormatBits(grid, dark, ecc, mask, 0x2825)
  },
  maskCondition: (mask) => MASKS[mask]!,
}
