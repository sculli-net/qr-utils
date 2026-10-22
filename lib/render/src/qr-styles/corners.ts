import type { StyleCorner } from './contract.js'
import type { Quad } from './border-radius.js'

/** Corner names in tuple order. Index 0 = top-left, 1 = top-right, 2 = bottom-right, 3 = bottom-left. */
export const CORNERS: readonly StyleCorner[] = ['top-left', 'top-right', 'bottom-right', 'bottom-left']

/** Tuple index of a corner name. */
export function cornerIndex(corner: StyleCorner): number {
  const index = CORNERS.indexOf(corner)
  if (index < 0) throw new TypeError(`Unknown corner: ${String(corner)}`)
  return index
}

/**
 * Index (0-3) of the symbol quadrant that contains the point (`px`, `py`), given in modules, for a
 * `width` x `height` symbol. The quadrant is relative to the symbol's centre, so it also works for rectangular rMQR
 * symbols. A point exactly on a centre line counts as top / left.
 */
export function quadrantOf(px: number, py: number, width: number, height: number): number {
  const left = px <= width / 2
  const top = py <= height / 2
  if (top) return left ? 0 : 1
  return left ? 3 : 2
}

/** `alignmentOffset` mode after normalisation. */
export type AlignmentMode = false | 'rotate' | 'mirror'

/** Normalises and validates the user's `alignmentOffset` value. */
export function toAlignmentMode(value: unknown): AlignmentMode {
  if (value === undefined || value === false || value === null) return false
  if (value === true) return 'rotate'
  if (value === 'mirror') return 'mirror'
  throw new TypeError(`Invalid alignmentOffset: ${JSON.stringify(value)}. Expected true, false or 'mirror'.`)
}

/**
 * The corner each tuple value applies to, for an element in quadrant `quadrant` (0-3).
 * `mapping[i]` is the screen corner that `values[i]` applies to.
 *
 * `'rotate'` rotates the mapping clockwise once per quadrant. `'mirror'` also swaps entries 1 and 3, except in
 * the top-left quadrant.
 */
export function cornerMapping(quadrant: number, mode: AlignmentMode): Quad<number> {
  if (!mode || quadrant === 0) return [0, 1, 2, 3]
  const m: [number, number, number, number] = [quadrant % 4, (1 + quadrant) % 4, (2 + quadrant) % 4, (3 + quadrant) % 4]
  if (mode === 'mirror') {
    const tmp = m[1]
    m[1] = m[3]
    m[3] = tmp
  }
  return m
}

/**
 * Reorders a corner-relative tuple into screen order `[tl, tr, br, bl]` for an element in `quadrant`.
 *
 * @example alignTuple(['a', 'b', 'c', 'd'], 1, 'rotate') // => ['d', 'a', 'b', 'c'] ('a' now applies to top-right)
 */
export function alignTuple<T>(values: Quad<T>, quadrant: number, mode: AlignmentMode): [T, T, T, T] {
  const mapping = cornerMapping(quadrant, mode)
  const out = new Array<T>(4) as [T, T, T, T]
  for (let i = 0; i < 4; i++) out[mapping[i]] = values[i]
  return out
}
