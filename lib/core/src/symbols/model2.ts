import type { ErrorCorrectionLevel } from '../types.js'
import { bch18 } from './bch.js'
import { type CodeLayout, expandBlocks, type SymbolDefinition, sumData, type VersionInfo } from './definition.js'
import { alignmentDark, alignmentPart, type ModuleGrid, placeZigZag } from './grid.js'
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
import { MODEL2_ALIGNMENT, MODEL2_BLOCKS } from './tables.js'

const VERSIONS: VersionInfo[] = Array.from({ length: 40 }, (_, i) => ({
  id: i + 1,
  number: i + 1,
  width: 21 + 4 * i,
  height: 21 + 4 * i,
}))

function drawAlignmentPatterns(version: VersionInfo, grid: ModuleGrid): void {
  const centres = MODEL2_ALIGNMENT[version.number - 1]!
  const last = centres.length - 1
  centres.forEach((cy, row) => {
    centres.forEach((cx, col) => {
      // Skip the three positions that overlap finder patterns
      if ((row === 0 && col === 0) || (row === 0 && col === last) || (row === last && col === 0)) return
      const landmark = grid.addLandmark({ type: 'alignment' })
      grid.fillRect(cx - 2, cy - 2, 5, 5, 'alignment', landmark, alignmentDark, alignmentPart)
    })
  })
}

function drawVersionInformation(version: VersionInfo, grid: ModuleGrid): void {
  if (version.number < 7) return
  const size = grid.width
  const bits = bch18(version.number)
  const topRight = grid.addLandmark({ type: 'version', corner: 'top-right' })
  const bottomLeft = grid.addLandmark({ type: 'version', corner: 'bottom-left' })
  for (let i = 0; i < 18; i++) {
    const dark = ((bits >>> i) & 1) === 1
    const a = size - 11 + (i % 3)
    const b = Math.floor(i / 3)
    grid.setFunction(a, b, dark, 'version', topRight)
    grid.setFunction(b, a, dark, 'version', bottomLeft)
  }
}

/** QR Code Model 2 (ISO/IEC 18004). */
export const model2: SymbolDefinition = {
  type: 'model2',
  label: 'QR Code',
  versions: VERSIONS,
  defaultErrorCorrection: 'M',
  defaultQuietZone: 4,
  maskCount: 8,
  maskSelection: 'penalty',
  supportsEci: true,
  supportsFnc1: true,
  supportsStructuredAppend: true,
  indicators: {
    mode: { numeric: 0b0001, alphanumeric: 0b0010, byte: 0b0100, kanji: 0b1000 },
    eci: 0b0111,
    fnc1First: 0b0101,
    fnc1Second: 0b1001,
    structuredAppend: 0b0011,
  },
  streamPrefixBits: 0,
  errorCorrectionLevels: () => QR_ECC_LEVELS,
  layout(version: VersionInfo, ecc: ErrorCorrectionLevel): CodeLayout {
    const blocks = expandBlocks(MODEL2_BLOCKS[version.number - 1]![QR_ECC_INDEX[ecc]])
    const dataCodewords = sumData(blocks)
    return {
      dataCodewords,
      dataBits: dataCodewords * 8,
      blocks,
      misdecodeProtection: qrMisdecodeProtection(version.number, ecc),
      halfFinalCodeword: false,
    }
  },
  segmentParameters: (version) => ({ modeBits: 4, countBits: qrCountBits(version.number) }),
  terminatorBits: () => 4,
  drawFunctionPatterns(version, grid) {
    drawFindersAndSeparators(grid)
    drawTimingPatterns(grid)
    drawAlignmentPatterns(version, grid)
    reserveFormatAndDarkModule(grid)
    drawVersionInformation(version, grid)
  },
  placeCodewords(_version, grid, stream) {
    placeZigZag(grid, stream, grid.width - 1, 6)
  },
  writeFormat(_version, ecc, mask, grid, dark) {
    writeFormatBits(grid, dark, ecc, mask, 0x5412)
  },
  maskCondition: (mask) => MASKS[mask]!,
}
