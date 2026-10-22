/**
 * Outline tracing for sets of modules.
 *
 * A mask is a `Uint8Array` of `width * height` cells (1 = filled). Coordinates are in modules with the origin at
 * the top-left and y pointing down. Grid vertices run from (0, 0) to (width, height).
 */

/** Directions: 0 = +x (right), 1 = +y (down), 2 = -x (left), 3 = -y (up). Turning right (clockwise) is `d + 1`. */
export type Direction = 0 | 1 | 2 | 3
export const DX = [1, 0, -1, 0] as const
export const DY = [0, 1, 0, -1] as const

/** A 4-connected group of filled cells. */
export interface Component {
  readonly id: number
  /** Bounding box in modules. */
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
  /** First cell of the component in scan order. */
  readonly firstX: number
  readonly firstY: number
  readonly size: number
}

/** A corner of a traced outline: the grid vertex where the outline changes direction. */
export interface ContourVertex {
  readonly x: number
  readonly y: number
  readonly dirIn: Direction
  readonly dirOut: Direction
}

/**
 * A closed outline. It keeps the filled area on its **right**, so with y pointing down outer outlines run clockwise
 * and holes run anticlockwise, as non-zero filling needs.
 */
export interface Contour {
  readonly component: number
  readonly vertices: readonly ContourVertex[]
}

/** True when a vertex turns right (towards the filled side), which makes it a convex corner of the shape. */
export function isConvex(vertex: ContourVertex): boolean {
  return vertex.dirOut === ((vertex.dirIn + 1) & 3)
}

/** Labels the 4-connected components of a mask. `labels[i]` is the component id, or -1 for empty cells. */
export function labelComponents(
  mask: Uint8Array,
  width: number,
  height: number,
): { labels: Int32Array; components: Component[] } {
  const labels = new Int32Array(width * height).fill(-1)
  const components: Component[] = []
  const queue = new Int32Array(width * height)
  for (let start = 0; start < mask.length; start++) {
    if (!mask[start] || labels[start] !== -1) continue
    const id = components.length
    let head = 0
    let tail = 0
    queue[tail++] = start
    labels[start] = id
    let minX = width
    let minY = height
    let maxX = -1
    let maxY = -1
    while (head < tail) {
      const i = queue[head++]
      const x = i % width
      const y = (i - x) / width
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (y < minY) minY = y
      if (y > maxY) maxY = y
      if (x > 0 && mask[i - 1] && labels[i - 1] === -1) {
        labels[i - 1] = id
        queue[tail++] = i - 1
      }
      if (x < width - 1 && mask[i + 1] && labels[i + 1] === -1) {
        labels[i + 1] = id
        queue[tail++] = i + 1
      }
      if (y > 0 && mask[i - width] && labels[i - width] === -1) {
        labels[i - width] = id
        queue[tail++] = i - width
      }
      if (y < height - 1 && mask[i + width] && labels[i + width] === -1) {
        labels[i + width] = id
        queue[tail++] = i + width
      }
    }
    const firstX = start % width
    components.push({
      id,
      x: minX,
      y: minY,
      width: maxX - minX + 1,
      height: maxY - minY + 1,
      firstX,
      firstY: (start - firstX) / width,
      size: tail,
    })
  }
  return { labels, components }
}

/**
 * Traces every outline (outer boundaries and holes) of the filled cells.
 *
 * Boundary edges are directed so the filled cell is on their right. At a vertex where two filled cells touch
 * only diagonally (a saddle), the tracer always turns right, so diagonal neighbours stay separate outlines
 * (4-connectivity, matching {@link labelComponents}). Only vertices where the direction changes are returned.
 */
export function traceContours(mask: Uint8Array, width: number, height: number, labels: Int32Array): Contour[] {
  const vw = width + 1
  // 0 = no edge, 1 = edge, 2 = edge already traced. Index = vertexIndex * 4 + direction.
  const edges = new Uint8Array(vw * (height + 1) * 4)
  const filled = (x: number, y: number) => x >= 0 && y >= 0 && x < width && y < height && mask[y * width + x] === 1
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!mask[y * width + x]) continue
      if (!filled(x, y - 1)) edges[(y * vw + x) * 4 + 0] = 1
      if (!filled(x + 1, y)) edges[(y * vw + x + 1) * 4 + 1] = 1
      if (!filled(x, y + 1)) edges[((y + 1) * vw + x + 1) * 4 + 2] = 1
      if (!filled(x - 1, y)) edges[((y + 1) * vw + x) * 4 + 3] = 1
    }
  }

  const contours: Contour[] = []
  for (let startIndex = 0; startIndex < edges.length; startIndex++) {
    if (edges[startIndex] !== 1) continue
    const vertices: ContourVertex[] = []
    let vertex = startIndex >> 2
    let dir = (startIndex & 3) as Direction
    let index = startIndex
    for (let guard = 0; guard <= edges.length; guard++) {
      edges[index] = 2
      const nx = (vertex % vw) + DX[dir]
      const ny = Math.floor(vertex / vw) + DY[dir]
      const next = ny * vw + nx
      let nextDir = -1
      // Prefer right turn, then straight, then left turn.
      for (const turn of [1, 0, 3]) {
        const candidate = (dir + turn) & 3
        if (edges[next * 4 + candidate] !== 0) {
          nextDir = candidate
          break
        }
      }
      if (nextDir < 0) throw new Error('qr-styles: open contour while tracing outline (internal error)')
      if (nextDir !== dir) vertices.push({ x: nx, y: ny, dirIn: dir, dirOut: nextDir as Direction })
      const nextIndex = next * 4 + nextDir
      if (nextIndex === startIndex) break
      if (edges[nextIndex] === 2) throw new Error('qr-styles: contour revisited an edge (internal error)')
      index = nextIndex
      vertex = next
      dir = nextDir as Direction
    }
    // The filled cell on the right of the start edge identifies the component.
    const sx = (startIndex >> 2) % vw
    const sy = Math.floor((startIndex >> 2) / vw)
    const sd = startIndex & 3
    const cx = sd === 0 || sd === 3 ? sx : sx - 1
    const cy = sd === 0 || sd === 1 ? sy : sy - 1
    contours.push({ component: labels[cy * width + cx], vertices })
  }
  return contours
}

/** Signed area (in modules²) of a traced outline. Positive for clockwise (outer) outlines when y points down. */
export function contourArea(contour: Contour): number {
  const v = contour.vertices
  let area = 0
  for (let i = 0; i < v.length; i++) {
    const a = v[i]
    const b = v[(i + 1) % v.length]
    area += a.x * b.y - b.x * a.y
  }
  return area / 2
}
