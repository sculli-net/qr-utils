import type { Corner, ErrorCorrectionLevel } from '../types.js'
import { ECC_FORMAT_BITS, formatBits } from './bch.js'
import { finderDark, finderPart, type ModuleGrid } from './grid.js'

/** Shared function patterns of QR Model 1 and Model 2 (square symbols with three finder patterns). */

const FINDERS: readonly (readonly [Corner, (size: number) => readonly [number, number]])[] = [
  ['top-left', () => [0, 0]],
  ['top-right', (size) => [size - 7, 0]],
  ['bottom-left', (size) => [0, size - 7]],
]

export function drawFindersAndSeparators(grid: ModuleGrid): void {
  const size = grid.width
  for (const [corner, origin] of FINDERS) {
    const [fx, fy] = origin(size)
    const separator = grid.addLandmark({ type: 'separator', corner })
    for (let dy = -1; dy <= 7; dy++) {
      for (let dx = -1; dx <= 7; dx++) {
        if (dx === -1 || dy === -1 || dx === 7 || dy === 7) grid.setFunction(fx + dx, fy + dy, false, 'separator', separator)
      }
    }
    const finder = grid.addLandmark({ type: 'finder', corner })
    grid.fillRect(fx, fy, 7, 7, 'finder', finder, finderDark, finderPart)
  }
}

export function drawTimingPatterns(grid: ModuleGrid): void {
  const size = grid.width
  const horizontal = grid.addLandmark({ type: 'timing', orientation: 'horizontal' })
  const vertical = grid.addLandmark({ type: 'timing', orientation: 'vertical' })
  for (let i = 8; i < size - 8; i++) {
    grid.setFunction(i, 6, i % 2 === 0, 'timing', horizontal)
    grid.setFunction(6, i, i % 2 === 0, 'timing', vertical)
  }
}

/** Reserves both copies of the 15-bit format information and sets the dark module. */
export function reserveFormatAndDarkModule(grid: ModuleGrid): void {
  const size = grid.width
  const topLeft = grid.addLandmark({ type: 'format', corner: 'top-left' })
  const topRight = grid.addLandmark({ type: 'format', corner: 'top-right' })
  const bottomLeft = grid.addLandmark({ type: 'format', corner: 'bottom-left' })
  for (let i = 0; i <= 8; i++) {
    if (i !== 6) {
      grid.setFunction(8, i, false, 'format', topLeft)
      grid.setFunction(i, 8, false, 'format', topLeft)
    }
  }
  for (let i = 0; i < 8; i++) grid.setFunction(size - 1 - i, 8, false, 'format', topRight)
  for (let i = 0; i < 7; i++) grid.setFunction(8, size - 1 - i, false, 'format', bottomLeft)
  const darkModule = grid.addLandmark({ type: 'darkModule', corner: 'bottom-left' })
  grid.setFunction(8, size - 8, true, 'darkModule', darkModule)
}

/** Writes the 15-bit format information (both copies) into `dark`. */
export function writeFormatBits(
  grid: ModuleGrid,
  dark: Uint8Array,
  ecc: ErrorCorrectionLevel,
  mask: number,
  xorMask: number,
): void {
  const size = grid.width
  const bits = formatBits((ECC_FORMAT_BITS[ecc] << 3) | mask, xorMask)
  const bit = (i: number) => (bits >>> i) & 1
  const set = (x: number, y: number, value: number) => {
    dark[y * size + x] = value
  }
  for (let i = 0; i <= 5; i++) set(8, i, bit(i))
  set(8, 7, bit(6))
  set(8, 8, bit(7))
  set(7, 8, bit(8))
  for (let i = 9; i < 15; i++) set(14 - i, 8, bit(i))
  for (let i = 0; i < 8; i++) set(size - 1 - i, 8, bit(i))
  for (let i = 8; i < 15; i++) set(8, size - 15 + i, bit(i))
}

/** Misdecode protection codewords for small QR Model 2 symbols (ISO/IEC 18004 Table 9, footnote b). */
export function qrMisdecodeProtection(version: number, ecc: ErrorCorrectionLevel): number {
  if (version === 1) return ecc === 'L' ? 3 : ecc === 'M' ? 2 : 1
  if (version === 2 && ecc === 'L') return 2
  if (version === 3 && ecc === 'L') return 1
  return 0
}

export const QR_ECC_LEVELS: readonly ErrorCorrectionLevel[] = ['L', 'M', 'Q', 'H']
export const QR_ECC_INDEX: Readonly<Record<ErrorCorrectionLevel, number>> = { L: 0, M: 1, Q: 2, H: 3 }

/** Character count indicator lengths for QR Model 1/2 by version group. */
export function qrCountBits(version: number) {
  const group = version <= 9 ? 0 : version <= 26 ? 1 : 2
  return {
    numeric: [10, 12, 14][group]!,
    alphanumeric: [9, 11, 13][group]!,
    byte: [8, 16, 16][group]!,
    kanji: [8, 10, 12][group]!,
  }
}
