/** An axis-aligned box in module coordinates. */
export interface Box {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

/** Validates the user's `distanceWeight` option and returns it as a `[near, far]` pair. */
export function toDistanceWeight(value: unknown): readonly [number, number] | undefined {
  if (value === undefined || value === null) return undefined
  if (
    !Array.isArray(value) ||
    value.length !== 2 ||
    !value.every((v) => typeof v === 'number' && Number.isFinite(v) && v >= 0)
  ) {
    throw new TypeError(
      `Invalid distanceWeight: ${JSON.stringify(value)}. Expected a tuple of two non-negative numbers, e.g. [0, 1].`,
    )
  }
  return [value[0], value[1]]
}

function chebyshev(px: number, py: number, box: Box, halfW: number, halfH: number): number {
  const cx = box.x + box.width / 2
  const cy = box.y + box.height / 2
  const dx = halfW > 0 ? Math.abs(px - cx) / halfW : 0
  const dy = halfH > 0 ? Math.abs(py - cy) / halfH : 0
  return Math.min(1, Math.max(dx, dy))
}

/**
 * Normalised Chebyshev distance (0 at the centre, 1 at the edge) of module (x, y), measured from the module's
 * centre. Modules in the outer row or column of the box are at distance 1.
 */
export function moduleDistance(x: number, y: number, box: Box): number {
  return chebyshev(x + 0.5, y + 0.5, box, (box.width - 1) / 2, (box.height - 1) / 2)
}

/** Normalised Chebyshev distance (0 at the centre, 1 on the border) of a grid vertex (vx, vy). */
export function vertexDistance(vx: number, vy: number, box: Box): number {
  return chebyshev(vx, vy, box, box.width / 2, box.height / 2)
}

/** Linear interpolation from `near` (distance 0) to `far` (distance 1). */
export function weightFactor(weight: readonly [number, number] | undefined, distance: number): number {
  if (!weight) return 1
  return weight[0] + (weight[1] - weight[0]) * distance
}
