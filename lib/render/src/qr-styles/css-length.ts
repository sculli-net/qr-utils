import type { CSSRadiusAttribute } from './types.js'

/** Pixel size of `1rem` / `1em`. There is no DOM, so the CSS default root font size is used. */
export const ROOT_FONT_SIZE_PX = 16

/** A parsed length. `rem` / `em` are converted to `px` while parsing. */
export interface ParsedLength {
  readonly value: number
  readonly unit: 'px' | '%'
}

const LENGTH_RE = /^([+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)(px|%|rem|em)?$/i

/**
 * Parses a single CSS length (`8`, `"8px"`, `"50%"`, `"1rem"`, `"1em"`, `"8"`).
 * @throws TypeError for unparsable values, RangeError for negative values.
 */
export function parseCSSLength(input: CSSRadiusAttribute): ParsedLength {
  if (typeof input === 'number') {
    if (!Number.isFinite(input)) {
      throw new TypeError(`Invalid border radius: ${input}. Expected a finite number of pixels.`)
    }
    if (input < 0) throw new RangeError(`Invalid border radius: ${input}. Radii cannot be negative.`)
    return { value: input, unit: 'px' }
  }
  if (typeof input !== 'string') {
    throw new TypeError(`Invalid border radius: ${String(input)}. Expected a number or a CSS length string.`)
  }
  const match = LENGTH_RE.exec(input.trim())
  if (!match) {
    throw new TypeError(
      `Invalid border radius: "${input}". Supported formats: a number of pixels or a length with a px, %, rem or em unit (e.g. 8, "8px", "50%", "0.5rem").`,
    )
  }
  const value = Number(match[1])
  if (value < 0) throw new RangeError(`Invalid border radius: "${input}". Radii cannot be negative.`)
  const unit = (match[2] ?? 'px').toLowerCase()
  if (unit === '%') return { value, unit: '%' }
  if (unit === 'rem' || unit === 'em') return { value: value * ROOT_FONT_SIZE_PX, unit: 'px' }
  return { value, unit: 'px' }
}

/** Resolves a parsed length to pixels. `%` values are relative to `reference` (in pixels). */
export function resolveLength(length: ParsedLength, reference: number): number {
  return length.unit === '%' ? (length.value / 100) * reference : length.value
}
