import type { ModuleGrid } from './grid.js'

/** QR mask conditions (ISO/IEC 18004 Table 10), `x` = column, `y` = row. A module is inverted when it returns true. */
export const MASKS: readonly ((x: number, y: number) => boolean)[] = [
  (x, y) => (x + y) % 2 === 0,
  (_x, y) => y % 2 === 0,
  (x) => x % 3 === 0,
  (x, y) => (x + y) % 3 === 0,
  (x, y) => (Math.floor(y / 2) + Math.floor(x / 3)) % 2 === 0,
  (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
  (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0,
  (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0,
]

/** XORs mask `condition` onto the data region of `dark` (a copy of the grid's module values). */
export function applyMask(grid: ModuleGrid, dark: Uint8Array, condition: (x: number, y: number) => boolean): void {
  for (let y = 0; y < grid.height; y++) {
    for (let x = 0; x < grid.width; x++) {
      const i = y * grid.width + x
      if (grid.isMaskable(i) && condition(x, y)) dark[i] ^= 1
    }
  }
}

const N1 = 3
const N2 = 3
const N3 = 40
const N4 = 10

/** Penalty score of a masked symbol (ISO/IEC 18004 7.8.3). Lower is better. */
export function penaltyScore(dark: Uint8Array, width: number, height: number): number {
  let score = 0
  const line = (length: number, get: (i: number) => number) => {
    // N1: runs of 5+ same coloured modules
    let run = 1
    for (let i = 1; i <= length; i++) {
      if (i < length && get(i) === get(i - 1)) run++
      else {
        if (run >= 5) score += N1 + run - 5
        run = 1
      }
    }
    // N3: 1:1:3:1:1 finder-like pattern with 4 light modules on one side (outside the symbol counts as light)
    const at = (i: number) => (i < 0 || i >= length ? 0 : get(i))
    for (let i = -4; i < length; i++) {
      if (
        at(i) === 1 && at(i + 1) === 0 && at(i + 2) === 1 && at(i + 3) === 1 &&
        at(i + 4) === 1 && at(i + 5) === 0 && at(i + 6) === 1
      ) {
        if (!at(i - 1) && !at(i - 2) && !at(i - 3) && !at(i - 4)) score += N3
        if (!at(i + 7) && !at(i + 8) && !at(i + 9) && !at(i + 10)) score += N3
      }
    }
  }
  for (let y = 0; y < height; y++) line(width, (x) => dark[y * width + x]!)
  for (let x = 0; x < width; x++) line(height, (y) => dark[y * width + x]!)

  // N2: 2×2 blocks of one colour
  let darkCount = 0
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const value = dark[y * width + x]!
      darkCount += value
      if (
        x + 1 < width && y + 1 < height &&
        value === dark[y * width + x + 1] &&
        value === dark[(y + 1) * width + x] &&
        value === dark[(y + 1) * width + x + 1]
      ) {
        score += N2
      }
    }
  }

  // N4: deviation of the dark proportion from 50% in steps of 5%
  const total = width * height
  const k = Math.ceil(Math.abs(darkCount * 20 - total * 10) / total) - 1
  score += Math.max(0, k) * N4
  return score
}

/**
 * Micro QR mask evaluation (ISO/IEC 18004 7.8.3.2): count dark modules on the right and bottom edges
 * (excluding the timing patterns). Higher is better.
 */
export function microScore(dark: Uint8Array, size: number): number {
  let sum1 = 0
  let sum2 = 0
  for (let i = 1; i < size; i++) {
    sum1 += dark[i * size + size - 1]!
    sum2 += dark[(size - 1) * size + i]!
  }
  return sum1 <= sum2 ? sum1 * 16 + sum2 : sum2 * 16 + sum1
}
