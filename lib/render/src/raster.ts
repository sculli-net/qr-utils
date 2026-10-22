import type { RGBA } from './color.js'
import type { PathCommand } from './qr-styles/index.js'

/**
 * Anti-aliased scanline rasteriser using signed-area accumulation (the approach of font-rs).
 * Paths are flattened to line segments; coverage is exact for straight edges, so pixel aligned squares stay crisp.
 * Overlapping shapes with the same winding are unioned (coverage is clamped to 1).
 */
export class CoverageRaster {
  /** Accumulation buffer; each row has two spare cells for contributions at the right edge. */
  private readonly accumulation: Float32Array
  private readonly stride: number

  constructor(
    readonly width: number,
    readonly height: number,
  ) {
    this.stride = width + 2
    this.accumulation = new Float32Array(this.stride * height)
  }

  private line(x0: number, y0: number, x1: number, y1: number): void {
    if (Math.abs(y0 - y1) <= 1e-9) return
    const w = this.width
    const a = this.accumulation
    let direction = 1
    if (y0 > y1) {
      direction = -1
      ;[x0, y0, x1, y1] = [x1, y1, x0, y0]
    }
    // Clamp horizontally: anything left of the image covers the whole row from x = 0
    x0 = Math.min(w, Math.max(0, x0))
    x1 = Math.min(w, Math.max(0, x1))
    const dxdy = (x1 - x0) / (y1 - y0)
    let x = x0
    if (y0 < 0) x -= y0 * dxdy
    const yStart = Math.max(0, Math.floor(y0))
    const yEnd = Math.min(this.height, Math.ceil(y1))
    for (let y = yStart; y < yEnd; y++) {
      const row = y * this.stride
      const dy = Math.min(y + 1, y1) - Math.max(y, y0)
      const xNext = x + dxdy * dy
      const d = dy * direction
      const left = Math.min(x, xNext)
      const right = Math.max(x, xNext)
      const leftFloor = Math.floor(left)
      const leftIndex = leftFloor
      const rightCeil = Math.ceil(right)
      const rightIndex = rightCeil
      if (rightIndex <= leftIndex + 1) {
        const xmf = 0.5 * (x + xNext) - leftFloor
        a[row + leftIndex] += d - d * xmf
        a[row + leftIndex + 1] += d * xmf
      } else {
        const s = 1 / (right - left)
        const x0f = left - leftFloor
        const a0 = 0.5 * s * (1 - x0f) * (1 - x0f)
        const x1f = right - rightCeil + 1
        const am = 0.5 * s * x1f * x1f
        a[row + leftIndex] += d * a0
        if (rightIndex === leftIndex + 2) {
          a[row + leftIndex + 1] += d * (1 - a0 - am)
        } else {
          const a1 = s * (1.5 - x0f)
          a[row + leftIndex + 1] += d * (a1 - a0)
          for (let xi = leftIndex + 2; xi < rightIndex - 1; xi++) a[row + xi] += d * s
          const a2 = a1 + (rightIndex - leftIndex - 3) * s
          a[row + rightIndex - 1] += d * (1 - a2 - am)
        }
        a[row + rightIndex] += d * am
      }
      x = xNext
    }
  }

  /** Adds a path (absolute M/L/C/Z commands, non-zero fill). */
  addPath(commands: readonly PathCommand[]): void {
    let startX = 0
    let startY = 0
    let x = 0
    let y = 0
    for (const command of commands) {
      switch (command[0]) {
        case 'M':
          if (x !== startX || y !== startY) this.line(x, y, startX, startY)
          ;[, x, y] = command
          startX = x
          startY = y
          break
        case 'L':
          this.line(x, y, command[1], command[2])
          ;[, x, y] = command
          break
        case 'C': {
          const [, c1x, c1y, c2x, c2y, ex, ey] = command
          const length = Math.hypot(c1x - x, c1y - y) + Math.hypot(c2x - c1x, c2y - c1y) + Math.hypot(ex - c2x, ey - c2y)
          const steps = Math.max(2, Math.min(64, Math.ceil(length / 1.5)))
          let px = x
          let py = y
          for (let i = 1; i <= steps; i++) {
            const t = i / steps
            const mt = 1 - t
            const qx = mt * mt * mt * x + 3 * mt * mt * t * c1x + 3 * mt * t * t * c2x + t * t * t * ex
            const qy = mt * mt * mt * y + 3 * mt * mt * t * c1y + 3 * mt * t * t * c2y + t * t * t * ey
            this.line(px, py, qx, qy)
            px = qx
            py = qy
          }
          x = ex
          y = ey
          break
        }
        case 'Z':
          this.line(x, y, startX, startY)
          x = startX
          y = startY
          break
      }
    }
    if (x !== startX || y !== startY) this.line(x, y, startX, startY)
  }

  /** Coverage (0–1) per pixel, row major. */
  coverage(): Float32Array {
    const result = new Float32Array(this.width * this.height)
    for (let y = 0; y < this.height; y++) {
      let sum = 0
      const row = y * this.stride
      for (let x = 0; x < this.width; x++) {
        sum += this.accumulation[row + x]!
        result[y * this.width + x] = Math.min(1, Math.abs(sum))
      }
    }
    return result
  }
}

/** Composites `color` with per-pixel `coverage` over an RGBA float image (straight alpha, source-over). */
export function compositeOver(image: Float32Array, coverage: Float32Array, color: RGBA): void {
  for (let i = 0; i < coverage.length; i++) {
    const alpha = coverage[i]! * color.a
    if (alpha <= 0) continue
    const p = i * 4
    const dstAlpha = image[p + 3]!
    const outAlpha = alpha + dstAlpha * (1 - alpha)
    const keep = (dstAlpha * (1 - alpha)) / outAlpha
    const add = alpha / outAlpha
    image[p] = color.r * add + image[p]! * keep
    image[p + 1] = color.g * add + image[p + 1]! * keep
    image[p + 2] = color.b * add + image[p + 2]! * keep
    image[p + 3] = outAlpha
  }
}
