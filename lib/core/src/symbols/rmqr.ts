import { bch18 } from './bch.js'
import { type CodeLayout, expandBlocks, type SymbolDefinition, sumData, type VersionInfo } from './definition.js'
import { alignmentDark, alignmentPart, finderDark, finderPart, PART_INNER, PART_OUTER, placeZigZag } from './grid.js'
import { MASKS } from './mask.js'
import { RMQR_ALIGNMENT, RMQR_BLOCKS } from './tables.js'

const SIZES: readonly (readonly [height: number, width: number])[] = [
  [7, 43], [7, 59], [7, 77], [7, 99], [7, 139],
  [9, 43], [9, 59], [9, 77], [9, 99], [9, 139],
  [11, 27], [11, 43], [11, 59], [11, 77], [11, 99], [11, 139],
  [13, 27], [13, 43], [13, 59], [13, 77], [13, 99], [13, 139],
  [15, 43], [15, 59], [15, 77], [15, 99], [15, 139],
  [17, 43], [17, 59], [17, 77], [17, 99], [17, 139],
]

const VERSIONS: VersionInfo[] = SIZES.map(([height, width], i) => ({
  id: `R${height}x${width}`,
  number: i + 1,
  width,
  height,
}))

/** Character count indicator lengths, ISO/IEC 23941 Table 3. */
const COUNT_BITS = {
  numeric: [4, 5, 6, 7, 7, 5, 6, 7, 7, 8, 4, 6, 7, 7, 8, 8, 5, 6, 7, 7, 8, 8, 7, 7, 8, 8, 9, 7, 8, 8, 8, 9],
  alphanumeric: [3, 5, 5, 6, 6, 5, 5, 6, 6, 7, 4, 5, 6, 6, 7, 7, 5, 6, 6, 7, 7, 8, 6, 7, 7, 7, 8, 6, 7, 7, 8, 8],
  byte: [3, 4, 5, 5, 6, 4, 5, 5, 6, 6, 3, 5, 5, 6, 6, 7, 4, 5, 6, 6, 7, 7, 6, 6, 7, 7, 7, 6, 6, 7, 7, 8],
  kanji: [2, 3, 4, 5, 5, 3, 4, 5, 5, 6, 2, 4, 5, 5, 6, 6, 3, 5, 5, 6, 6, 7, 5, 5, 6, 6, 7, 5, 6, 6, 6, 7],
} as const

const FORMAT_MASK_FINDER_SIDE = 0x1fab2
const FORMAT_MASK_SUB_FINDER_SIDE = 0x20a7b

/** rMQR uses a single, fixed data mask: ((y div 2) + (x div 3)) mod 2 = 0. */
const RMQR_MASK = MASKS[4]!

/** Rectangular Micro QR Code (ISO/IEC 23941). */
export const rmqr: SymbolDefinition = {
  type: 'rmqr',
  label: 'rMQR',
  versions: VERSIONS,
  defaultErrorCorrection: 'M',
  defaultQuietZone: 2,
  maskCount: 1,
  maskSelection: 'fixed',
  supportsEci: true,
  supportsFnc1: true,
  supportsStructuredAppend: false,
  indicators: {
    mode: { numeric: 0b001, alphanumeric: 0b010, byte: 0b011, kanji: 0b100 },
    fnc1First: 0b101,
    fnc1Second: 0b110,
    eci: 0b111,
  },
  streamPrefixBits: 0,
  errorCorrectionLevels: () => ['M', 'H'],
  layout(version, ecc): CodeLayout {
    const blocks = expandBlocks(RMQR_BLOCKS[version.number - 1]![ecc === 'H' ? 1 : 0])
    const dataCodewords = sumData(blocks)
    return { dataCodewords, dataBits: dataCodewords * 8, blocks, misdecodeProtection: 0, halfFinalCodeword: false }
  },
  segmentParameters(version) {
    const i = version.number - 1
    return {
      modeBits: 3,
      countBits: {
        numeric: COUNT_BITS.numeric[i]!,
        alphanumeric: COUNT_BITS.alphanumeric[i]!,
        byte: COUNT_BITS.byte[i]!,
        kanji: COUNT_BITS.kanji[i]!,
      },
    }
  },
  terminatorBits: () => 3,
  drawFunctionPatterns(version, grid) {
    const { width: w, height: h } = grid
    // Timing patterns along all four edges
    const top = grid.addLandmark({ type: 'timing', orientation: 'horizontal' })
    const bottom = grid.addLandmark({ type: 'timing', orientation: 'horizontal' })
    const left = grid.addLandmark({ type: 'timing', orientation: 'vertical' })
    const right = grid.addLandmark({ type: 'timing', orientation: 'vertical' })
    for (let x = 0; x < w; x++) {
      grid.setFunction(x, 0, x % 2 === 0, 'timing', top)
      grid.setFunction(x, h - 1, x % 2 === 0, 'timing', bottom)
    }
    for (let y = 1; y < h - 1; y++) {
      grid.setFunction(0, y, y % 2 === 0, 'timing', left)
      grid.setFunction(w - 1, y, y % 2 === 0, 'timing', right)
    }

    const finder = grid.addLandmark({ type: 'finder', corner: 'top-left' })
    grid.fillRect(0, 0, 7, 7, 'finder', finder, finderDark, finderPart)

    const subFinder = grid.addLandmark({ type: 'subFinder', corner: 'bottom-right' })
    grid.fillRect(w - 5, h - 5, 5, 5, 'subFinder', subFinder, alignmentDark, alignmentPart)

    // Corner finder patterns (L shapes). On R7 the bottom-left one coincides with the finder pattern.
    const topRight = grid.addLandmark({ type: 'cornerFinder', corner: 'top-right' })
    grid.setFunction(w - 2, 0, true, 'cornerFinder', topRight)
    grid.setFunction(w - 1, 0, true, 'cornerFinder', topRight)
    grid.setFunction(w - 2, 1, false, 'cornerFinder', topRight)
    grid.setFunction(w - 1, 1, true, 'cornerFinder', topRight)
    if (h > 7) {
      const bottomLeft = grid.addLandmark({ type: 'cornerFinder', corner: 'bottom-left' })
      grid.setFunction(0, h - 2, true, 'cornerFinder', bottomLeft)
      grid.setFunction(1, h - 2, false, 'cornerFinder', bottomLeft)
      grid.setFunction(0, h - 1, true, 'cornerFinder', bottomLeft)
      grid.setFunction(1, h - 1, true, 'cornerFinder', bottomLeft)
    }

    // Separator (on R9 it overrides the upper half of the bottom-left corner finder)
    const separator = grid.addLandmark({ type: 'separator', corner: 'top-left' })
    for (let y = 0; y < 7; y++) grid.setFunction(7, y, false, 'separator', separator)
    if (h > 7) for (let x = 0; x < 8; x++) grid.setFunction(x, 7, false, 'separator', separator)

    // Alignment patterns (top and bottom) joined by vertical timing patterns
    for (const cx of RMQR_ALIGNMENT[version.number - 1]!) {
      const timing = grid.addLandmark({ type: 'timing', orientation: 'vertical' })
      for (let y = 3; y < h - 3; y++) grid.setFunction(cx, y, y % 2 === 0, 'timing', timing)
      for (const y0 of [0, h - 3]) {
        const landmark = grid.addLandmark({ type: 'alignment' })
        grid.fillRect(
          cx - 1, y0, 3, 3, 'alignment', landmark,
          (dx, dy) => !(dx === 1 && dy === 1),
          (dx, dy) => (dx === 1 && dy === 1 ? PART_INNER : PART_OUTER),
        )
      }
    }

    // Format information areas
    const formatLeft = grid.addLandmark({ type: 'format', corner: 'top-left' })
    const formatRight = grid.addLandmark({ type: 'format', corner: 'bottom-right' })
    for (let i = 0; i < 5; i++) {
      for (let j = 0; j < 3; j++) {
        grid.setFunction(8 + j, 1 + i, false, 'format', formatLeft)
        grid.setFunction(w - 8 + j, h - 6 + i, false, 'format', formatRight)
      }
    }
    for (let i = 0; i < 3; i++) {
      grid.setFunction(11, 1 + i, false, 'format', formatLeft)
      grid.setFunction(w - 5 + i, h - 6, false, 'format', formatRight)
    }
  },
  placeCodewords(_version, grid, stream) {
    placeZigZag(grid, stream, grid.width - 2)
  },
  writeFormat(version, ecc, _mask, grid, dark) {
    const { width: w, height: h } = grid
    const data = ((ecc === 'H' ? 1 : 0) << 5) | (version.number - 1)
    const left = bch18(data) ^ FORMAT_MASK_FINDER_SIDE
    const right = bch18(data) ^ FORMAT_MASK_SUB_FINDER_SIDE
    const set = (x: number, y: number, value: number) => {
      dark[y * w + x] = value
    }
    for (let i = 0; i < 5; i++) {
      for (let j = 0; j < 3; j++) {
        set(8 + j, 1 + i, (left >>> (j * 5 + i)) & 1)
        set(w - 8 + j, h - 6 + i, (right >>> (j * 5 + i)) & 1)
      }
    }
    for (let i = 0; i < 3; i++) {
      set(11, 1 + i, (left >>> (15 + i)) & 1)
      set(w - 5 + i, h - 6, (right >>> (15 + i)) & 1)
    }
  },
  maskCondition: () => RMQR_MASK,
}
