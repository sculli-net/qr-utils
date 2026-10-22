import type { ErrorCorrectionLevel } from '../types.js'
import { formatBits } from './bch.js'
import { type CodeLayout, expandBlocks, type SymbolDefinition, sumData, type VersionInfo } from './definition.js'
import { finderDark, finderPart, placeZigZag } from './grid.js'
import { MASKS } from './mask.js'
import { MICRO_BLOCKS } from './tables.js'

const VERSIONS: VersionInfo[] = Array.from({ length: 4 }, (_, i) => ({
  id: `M${i + 1}`,
  number: i + 1,
  width: 11 + 2 * i,
  height: 11 + 2 * i,
}))

/** Error correction levels per version, in symbol number order. M1 only has error detection (reported as L). */
const LEVELS: readonly (readonly ErrorCorrectionLevel[])[] = [['L'], ['L', 'M'], ['L', 'M'], ['L', 'M', 'Q']]

/** Symbol number (format information) of the first level of each version. */
const SYMBOL_NUMBER_BASE = [0, 1, 3, 5]

/** Misdecode protection codewords, ISO/IEC 18004 Table 9 (M1 is detection only). */
const MISDECODE: readonly (readonly number[])[] = [[2], [3, 2], [2, 0], [2, 0, 0]]

const COUNT_BITS = {
  numeric: [3, 4, 5, 6],
  alphanumeric: [0, 3, 4, 5],
  byte: [0, 0, 4, 5],
  kanji: [0, 0, 3, 4],
} as const

/** Micro QR masks 00–11 correspond to QR masks 1, 4, 6 and 7. */
const MICRO_MASKS = [MASKS[1]!, MASKS[4]!, MASKS[6]!, MASKS[7]!]

function levelIndex(version: VersionInfo, ecc: ErrorCorrectionLevel): number {
  return LEVELS[version.number - 1]!.indexOf(ecc)
}

/** Micro QR Code (ISO/IEC 18004). */
export const micro: SymbolDefinition = {
  type: 'micro',
  label: 'Micro QR Code',
  versions: VERSIONS,
  defaultErrorCorrection: 'L',
  defaultQuietZone: 2,
  maskCount: 4,
  maskSelection: 'micro',
  supportsEci: false,
  supportsFnc1: false,
  supportsStructuredAppend: false,
  indicators: { mode: { numeric: 0, alphanumeric: 1, byte: 2, kanji: 3 } },
  streamPrefixBits: 0,
  errorCorrectionLevels: (version) => LEVELS[version.number - 1]!,
  layout(version, ecc): CodeLayout {
    const index = levelIndex(version, ecc)
    const blocks = expandBlocks(MICRO_BLOCKS[version.number - 1]![index] ?? null)
    const dataCodewords = sumData(blocks)
    const halfFinalCodeword = version.number === 1 || version.number === 3
    return {
      dataCodewords,
      dataBits: dataCodewords * 8 - (halfFinalCodeword ? 4 : 0),
      blocks,
      misdecodeProtection: MISDECODE[version.number - 1]![index] ?? 0,
      halfFinalCodeword,
    }
  },
  segmentParameters(version) {
    const i = version.number - 1
    return {
      modeBits: i,
      countBits: {
        numeric: COUNT_BITS.numeric[i]!,
        alphanumeric: COUNT_BITS.alphanumeric[i]!,
        byte: COUNT_BITS.byte[i]!,
        kanji: COUNT_BITS.kanji[i]!,
      },
    }
  },
  terminatorBits: (version) => version.number * 2 + 1,
  drawFunctionPatterns(_version, grid) {
    const size = grid.width
    const separator = grid.addLandmark({ type: 'separator', corner: 'top-left' })
    for (let i = 0; i <= 7; i++) {
      grid.setFunction(7, i, false, 'separator', separator)
      grid.setFunction(i, 7, false, 'separator', separator)
    }
    const finder = grid.addLandmark({ type: 'finder', corner: 'top-left' })
    grid.fillRect(0, 0, 7, 7, 'finder', finder, finderDark, finderPart)
    const horizontal = grid.addLandmark({ type: 'timing', orientation: 'horizontal' })
    const vertical = grid.addLandmark({ type: 'timing', orientation: 'vertical' })
    for (let i = 8; i < size; i++) {
      grid.setFunction(i, 0, i % 2 === 0, 'timing', horizontal)
      grid.setFunction(0, i, i % 2 === 0, 'timing', vertical)
    }
    const format = grid.addLandmark({ type: 'format', corner: 'top-left' })
    for (let i = 1; i <= 8; i++) {
      grid.setFunction(i, 8, false, 'format', format)
      grid.setFunction(8, i, false, 'format', format)
    }
  },
  placeCodewords(_version, grid, stream) {
    placeZigZag(grid, stream, grid.width - 1)
  },
  writeFormat(version, ecc, mask, grid, dark) {
    const symbolNumber = SYMBOL_NUMBER_BASE[version.number - 1]! + levelIndex(version, ecc)
    const bits = formatBits((symbolNumber << 2) | mask, 0x4445)
    const size = grid.width
    for (let i = 1; i <= 8; i++) dark[8 * size + i] = (bits >>> (15 - i)) & 1
    for (let i = 1; i <= 7; i++) dark[i * size + 8] = (bits >>> (i - 1)) & 1
  },
  maskCondition: (mask) => MICRO_MASKS[mask]!,
}
