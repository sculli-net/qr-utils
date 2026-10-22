import type { RectShape, StyleLayout } from './contract.js'

/**
 * Covers the filled cells of a mask with as few plain rectangles as a simple greedy pass allows. Horizontal runs
 * become rectangles, and identical runs on consecutive rows are merged vertically.
 *
 * The rectangles cover the cells exactly: `x = originX + col * moduleSize`, `width = runLength * moduleSize`, and
 * the same for y.
 */
export function mergedRects(mask: Uint8Array, width: number, height: number, layout: StyleLayout): RectShape[] {
  const { moduleSize, originX, originY } = layout
  type Open = { col: number; len: number; row: number; rows: number }
  const done: Open[] = []
  let open = new Map<number, Open>()
  for (let y = 0; y < height; y++) {
    const next = new Map<number, Open>()
    let x = 0
    while (x < width) {
      if (!mask[y * width + x]) {
        x++
        continue
      }
      const col = x
      while (x < width && mask[y * width + x]) x++
      const len = x - col
      const key = col * (width + 1) + len
      const existing = open.get(key)
      if (existing) {
        existing.rows++
        open.delete(key)
        next.set(key, existing)
      } else {
        next.set(key, { col, len, row: y, rows: 1 })
      }
    }
    for (const rect of open.values()) done.push(rect)
    open = next
  }
  for (const rect of open.values()) done.push(rect)
  done.sort((a, b) => a.row - b.row || a.col - b.col)
  return done.map((r) => ({
    kind: 'rect' as const,
    x: originX + r.col * moduleSize,
    y: originY + r.row * moduleSize,
    width: r.len * moduleSize,
    height: r.rows * moduleSize,
  }))
}
