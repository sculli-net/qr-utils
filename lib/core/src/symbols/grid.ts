import type { Corner, ModuleType } from '../types.js'

/** Module type codes stored in {@link ModuleGrid.type}. */
export const MODULE_TYPES: readonly ModuleType[] = [
  'finder',
  'separator',
  'timing',
  'alignment',
  'format',
  'version',
  'darkModule',
  'subFinder',
  'cornerFinder',
  'extension',
  'data',
  'ecc',
  'remainder',
]

export const TYPE: Readonly<Record<ModuleType, number>> = Object.fromEntries(
  MODULE_TYPES.map((type, index) => [type, index]),
) as Record<ModuleType, number>

/** Marker for modules that have not been assigned yet (the free data region). */
export const FREE = 255

export const PART_NONE = 0
export const PART_INNER = 1
export const PART_OUTER = 2

export interface LandmarkDraft {
  readonly type: ModuleType
  readonly corner?: Corner
  readonly orientation?: 'horizontal' | 'vertical'
}

/** Codeword sequence ready for placement. */
export interface CodewordStream {
  /** Final (interleaved) codewords. */
  readonly codewords: Uint8Array
  /** Bits used by each codeword: 8, or 4 for the short final data codeword of Micro QR M1/M3. */
  readonly lengths: Uint8Array
  readonly kinds: readonly ('data' | 'ecc')[]
  readonly blocks: Uint16Array
  readonly indexInBlock: Uint16Array
}

/** Mutable module grid with per-module classification, used while building a symbol. */
export class ModuleGrid {
  readonly dark: Uint8Array
  readonly type: Uint8Array
  readonly part: Uint8Array
  readonly landmark: Int16Array
  /** Codeword index for data/ecc modules, otherwise -1. */
  readonly codeword: Int32Array
  /** Bit of the codeword (7 = MSB), otherwise -1. */
  readonly bit: Int8Array
  readonly landmarks: LandmarkDraft[] = []

  constructor(
    readonly width: number,
    readonly height: number,
  ) {
    const size = width * height
    this.dark = new Uint8Array(size)
    this.type = new Uint8Array(size).fill(FREE)
    this.part = new Uint8Array(size)
    this.landmark = new Int16Array(size).fill(-1)
    this.codeword = new Int32Array(size).fill(-1)
    this.bit = new Int8Array(size).fill(-1)
  }

  index(x: number, y: number): number {
    return y * this.width + x
  }

  inBounds(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.width && y < this.height
  }

  isFree(x: number, y: number): boolean {
    return this.type[this.index(x, y)] === FREE
  }

  addLandmark(draft: LandmarkDraft): number {
    this.landmarks.push(draft)
    return this.landmarks.length - 1
  }

  /** Paints a function module. Later calls override earlier ones. */
  setFunction(x: number, y: number, dark: boolean, type: ModuleType, landmark = -1, part = PART_NONE): void {
    if (!this.inBounds(x, y)) return
    const i = this.index(x, y)
    this.dark[i] = dark ? 1 : 0
    this.type[i] = TYPE[type]
    this.landmark[i] = landmark
    this.part[i] = part
  }

  /** Paints a rectangle of function modules using `isDark(dx, dy)` relative to the rectangle origin. */
  fillRect(
    x0: number,
    y0: number,
    width: number,
    height: number,
    type: ModuleType,
    landmark: number,
    isDark: (dx: number, dy: number) => boolean,
    partOf: (dx: number, dy: number) => number = () => PART_NONE,
  ): void {
    for (let dy = 0; dy < height; dy++) {
      for (let dx = 0; dx < width; dx++) {
        this.setFunction(x0 + dx, y0 + dy, isDark(dx, dy), type, landmark, partOf(dx, dy))
      }
    }
  }

  /** Places one codeword bit into a free module. */
  setCodewordBit(x: number, y: number, stream: CodewordStream, codeword: number, bit: number): void {
    const i = this.index(x, y)
    this.dark[i] = (stream.codewords[codeword]! >>> bit) & 1
    this.type[i] = TYPE[stream.kinds[codeword]!]
    this.codeword[i] = codeword
    this.bit[i] = bit
  }

  /** Marks every still-free module as remainder (light before masking). */
  fillRemainder(): void {
    for (let i = 0; i < this.type.length; i++) {
      if (this.type[i] === FREE) {
        this.type[i] = TYPE.remainder
        this.dark[i] = 0
      }
    }
  }

  /** Whether a module is part of the masked data region. */
  isMaskable(i: number): boolean {
    const type = this.type[i]
    return type === TYPE.data || type === TYPE.ecc || type === TYPE.remainder
  }
}

/** Standard 7×7 finder pattern: dark ring, light ring, 3×3 dark centre. */
export function finderDark(dx: number, dy: number): boolean {
  const d = Math.max(Math.abs(dx - 3), Math.abs(dy - 3))
  return d !== 2
}

export function finderPart(dx: number, dy: number): number {
  return Math.max(Math.abs(dx - 3), Math.abs(dy - 3)) <= 1 ? PART_INNER : PART_OUTER
}

/** 5×5 alignment pattern (also the rMQR finder sub-pattern): dark ring, light ring, dark centre. */
export function alignmentDark(dx: number, dy: number): boolean {
  return Math.max(Math.abs(dx - 2), Math.abs(dy - 2)) !== 1
}

export function alignmentPart(dx: number, dy: number): number {
  return dx === 2 && dy === 2 ? PART_INNER : PART_OUTER
}

/**
 * Places codeword bits in the standard two-column zig-zag, starting at the bottom right and moving upwards.
 * Used by QR Model 2, Micro QR and rMQR.
 */
export function placeZigZag(grid: ModuleGrid, stream: CodewordStream, startX: number, skipColumn?: number): void {
  const totalBits = stream.lengths.reduce((sum, length) => sum + length, 0)
  let codeword = 0
  let bitInCodeword = 0
  let placed = 0
  let upward = true
  for (let right = startX; right >= 1; right -= 2) {
    if (right === skipColumn) right--
    for (let v = 0; v < grid.height; v++) {
      const y = upward ? grid.height - 1 - v : v
      for (let j = 0; j < 2; j++) {
        const x = right - j
        if (x < 0 || !grid.isFree(x, y) || placed >= totalBits) continue
        const length = stream.lengths[codeword]!
        grid.setCodewordBit(x, y, stream, codeword, 7 - bitInCodeword)
        placed++
        if (++bitInCodeword === length) {
          bitInCodeword = 0
          codeword++
        }
      }
    }
    upward = !upward
  }
  grid.fillRemainder()
}
