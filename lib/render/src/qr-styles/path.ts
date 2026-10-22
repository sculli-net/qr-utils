import type { CornerRadii, PathCommand, Shape } from './contract.js'

/** Control point distance factor for approximating a quarter circle with one cubic Bézier. */
export const KAPPA = 0.5522847498307936

const EPSILON = 1e-9

/** A polygon vertex (in pixels) with the radius used to round it. */
export interface RoundedVertex {
  readonly x: number
  readonly y: number
  readonly r: number
}

/**
 * Appends one closed subpath for a polygon whose vertices are rounded with quarter-circle-like Béziers.
 *
 * Each vertex is replaced by a curve from `V - r·in` to `V + r·out` with control points toward `V`, where `in` and
 * `out` are the unit directions of the incoming and outgoing edges. For a right angle this is the standard circular
 * arc approximation. The same construction rounds convex corners (removing area) and concave corners (adding an
 * inverse fillet), so winding direction is preserved. Radii must already fit, i.e. `r_i + r_{i+1}` must not exceed
 * the edge between them.
 */
export function appendRoundedPolygon(out: PathCommand[], vertices: readonly RoundedVertex[]): void {
  const n = vertices.length
  if (n < 3) return
  const p0x = new Float64Array(n)
  const p0y = new Float64Array(n)
  const p3x = new Float64Array(n)
  const p3y = new Float64Array(n)
  const c1x = new Float64Array(n)
  const c1y = new Float64Array(n)
  const c2x = new Float64Array(n)
  const c2y = new Float64Array(n)
  for (let i = 0; i < n; i++) {
    const v = vertices[i]
    const prev = vertices[(i - 1 + n) % n]
    const next = vertices[(i + 1) % n]
    let ax = v.x - prev.x
    let ay = v.y - prev.y
    const al = Math.hypot(ax, ay) || 1
    ax /= al
    ay /= al
    let bx = next.x - v.x
    let by = next.y - v.y
    const bl = Math.hypot(bx, by) || 1
    bx /= bl
    by /= bl
    const r = v.r > 0 ? v.r : 0
    p0x[i] = v.x - ax * r
    p0y[i] = v.y - ay * r
    p3x[i] = v.x + bx * r
    p3y[i] = v.y + by * r
    c1x[i] = p0x[i] + ax * r * KAPPA
    c1y[i] = p0y[i] + ay * r * KAPPA
    c2x[i] = p3x[i] - bx * r * KAPPA
    c2y[i] = p3y[i] - by * r * KAPPA
  }
  out.push(['M', p0x[0], p0y[0]])
  for (let i = 0; i < n; i++) {
    if (vertices[i].r > 0) out.push(['C', c1x[i], c1y[i], c2x[i], c2y[i], p3x[i], p3y[i]])
    if (i < n - 1) {
      const nx = p0x[i + 1]
      const ny = p0y[i + 1]
      if (Math.abs(nx - p3x[i]) > EPSILON || Math.abs(ny - p3y[i]) > EPSILON) out.push(['L', nx, ny])
    }
  }
  out.push(['Z'])
}

/** Path commands (clockwise, starting at the top-left) for a rectangle with optional per-corner radii. */
export function roundedRectCommands(
  x: number,
  y: number,
  width: number,
  height: number,
  radii: CornerRadii = [0, 0, 0, 0],
): PathCommand[] {
  const out: PathCommand[] = []
  appendRoundedPolygon(out, [
    { x, y, r: radii[0] },
    { x: x + width, y, r: radii[1] },
    { x: x + width, y: y + height, r: radii[2] },
    { x, y: y + height, r: radii[3] },
  ])
  return out
}

/** Converts any {@link Shape} to path commands (useful for backends that only draw paths). */
export function shapeToPathCommands(shape: Shape): PathCommand[] {
  if (shape.kind === 'path') return [...shape.commands]
  return roundedRectCommands(shape.x, shape.y, shape.width, shape.height, shape.radii)
}

function fmt(value: number, precision: number): string {
  const rounded = Number(value.toFixed(precision))
  return Object.is(rounded, -0) ? '0' : String(rounded)
}

/**
 * Serialises path commands to an SVG path `d` string.
 * @param precision maximum number of decimals (default 3).
 */
export function pathCommandsToSvg(commands: readonly PathCommand[], precision = 3): string {
  const parts: string[] = []
  for (const command of commands) {
    if (command[0] === 'Z') {
      parts.push('Z')
      continue
    }
    const [op, ...nums] = command
    parts.push(op + nums.map((n) => fmt(n, precision)).join(' '))
  }
  return parts.join('')
}
