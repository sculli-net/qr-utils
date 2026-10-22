import type { CornerRadii } from './contract.js'
import { parseCSSLength, resolveLength, type ParsedLength } from './css-length.js'
import type { BorderRadius, CSSRadiusAttribute } from './types.js'

/** Four values ordered [top-left, top-right, bottom-right, bottom-left]. */
export type Quad<T> = readonly [T, T, T, T]

/**
 * Expands the CSS `border-radius` shorthand (a single value, a space separated string or a 1-4 tuple) into
 * four values, `[top-left, top-right, bottom-right, bottom-left]`.
 *
 * The fill rules match CSS: top-right falls back to top-left, bottom-right to top-left and bottom-left to top-right.
 * So `[a, b]` gives `[a, b, a, b]` and `[a, b, c]` gives `[a, b, c, b]`.
 */
export function expandBorderRadius(input: BorderRadius): Quad<CSSRadiusAttribute> {
  let values: readonly (CSSRadiusAttribute | undefined)[]
  if (typeof input === 'number') {
    values = [input]
  } else if (typeof input === 'string') {
    if (input.includes('/')) {
      throw new TypeError(`Invalid border radius: "${input}". Elliptical radii ("a / b") are not supported.`)
    }
    values = input.trim().split(/\s+/).filter(Boolean)
    if (values.length === 0) throw new TypeError('Invalid border radius: empty string.')
  } else if (Array.isArray(input)) {
    values = input as readonly (CSSRadiusAttribute | undefined)[]
    if (values.length === 0) throw new TypeError('Invalid border radius: empty tuple.')
    for (const value of values) {
      if (typeof value === 'string' && /\S\s+\S/.test(value.trim())) {
        throw new TypeError(
          `Invalid border radius entry: "${value}". Tuple entries must be single lengths. Use either a space separated string or a tuple, not both.`,
        )
      }
    }
  } else {
    throw new TypeError(`Invalid border radius: ${String(input)}. Expected a number, string or tuple.`)
  }
  if (values.length > 4) {
    throw new TypeError(`Invalid border radius: ${JSON.stringify(input)}. At most 4 values are allowed.`)
  }
  const tl = values[0] ?? 0
  const tr = values[1] ?? tl
  const br = values[2] ?? tl
  const bl = values[3] ?? tr
  return [tl, tr, br, bl]
}

/** Expands and parses a border radius into four {@link ParsedLength}s. */
export function parseBorderRadius(input: BorderRadius): Quad<ParsedLength> {
  const [tl, tr, br, bl] = expandBorderRadius(input)
  return [parseCSSLength(tl), parseCSSLength(tr), parseCSSLength(br), parseCSSLength(bl)]
}

/** Resolves four parsed radii to pixels against a `%` reference size. */
export function resolveRadii(radii: Quad<ParsedLength>, reference: number): [number, number, number, number] {
  return [
    resolveLength(radii[0], reference),
    resolveLength(radii[1], reference),
    resolveLength(radii[2], reference),
    resolveLength(radii[3], reference),
  ]
}

/**
 * Clamps radii for a `width` x `height` box the way CSS does: if any two radii that share a side add up to more
 * than that side, every radius is scaled by the same factor (the smallest `side / sum` ratio).
 */
export function clampRadii(radii: Quad<number>, width: number, height: number): CornerRadii {
  const [tl, tr, br, bl] = radii
  let factor = 1
  const check = (side: number, sum: number) => {
    if (sum > side && sum > 0) factor = Math.min(factor, side / sum)
  }
  check(width, tl + tr)
  check(height, tr + br)
  check(width, br + bl)
  check(height, bl + tl)
  if (factor === 1) return [tl, tr, br, bl]
  return [tl * factor, tr * factor, br * factor, bl * factor]
}

/** True when every radius is zero. */
export function isZeroRadii(radii: readonly ParsedLength[]): boolean {
  return radii.every((r) => r.value === 0)
}
