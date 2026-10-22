import { describe, expect, it } from 'vitest'
import type {
  PathCommand,
  PathShape,
  RectShape,
  RenderLayer,
  Shape,
  StyleCorner,
  StyleLandmark,
  StyleMatrix,
  StyleModule,
  StyleModuleType,
} from './contract.js'
import { buildRenderPlan, type ModulesOption, type QRShape } from './index.js'
import { shapeToPathCommands } from './path.js'

// ---------------------------------------------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------------------------------------------

interface MutableCell {
  dark: boolean
  type: StyleModuleType
  part?: 'inner' | 'outer'
  landmark?: number
}

class FakeMatrix implements StyleMatrix {
  readonly cells: MutableCell[]
  readonly marks: StyleLandmark[] = []
  constructor(
    readonly width: number,
    readonly height: number,
  ) {
    this.cells = Array.from({ length: width * height }, () => ({ dark: false, type: 'data' as StyleModuleType }))
  }
  cell(x: number, y: number) {
    return this.cells[y * this.width + x]
  }
  set(x: number, y: number, dark = true, type: StyleModuleType = 'data') {
    Object.assign(this.cell(x, y), { dark, type })
    return this
  }
  isDark(x: number, y: number) {
    return this.cell(x, y).dark
  }
  getModule(x: number, y: number): StyleModule {
    return { x, y, ...this.cell(x, y) }
  }
  landmarks() {
    return this.marks
  }
  addLandmark(landmark: StyleLandmark) {
    this.marks.push(landmark)
    return this.marks.length - 1
  }
  /** A finder-like pattern of `size` (7 for finders, 5 for the rMQR sub-finder): dark ring + dark centre. */
  addFinder(ox: number, oy: number, corner: StyleCorner, size = 7, type: StyleModuleType = 'finder') {
    const landmark = this.addLandmark({ type, x: ox, y: oy, width: size, height: size, corner })
    const eyeFrom = 2
    const eyeTo = size === 7 ? 4 : 2
    for (let dy = 0; dy < size; dy++) {
      for (let dx = 0; dx < size; dx++) {
        const ring = dx === 0 || dy === 0 || dx === size - 1 || dy === size - 1
        const eye = dx >= eyeFrom && dx <= eyeTo && dy >= eyeFrom && dy <= eyeTo
        Object.assign(this.cell(ox + dx, oy + dy), {
          dark: ring || eye,
          type,
          part: eye ? 'inner' : 'outer',
          landmark,
        })
      }
    }
    return landmark
  }
  addAlignment(ox: number, oy: number) {
    const landmark = this.addLandmark({ type: 'alignment', x: ox, y: oy, width: 5, height: 5 })
    for (let dy = 0; dy < 5; dy++) {
      for (let dx = 0; dx < 5; dx++) {
        const ring = dx === 0 || dy === 0 || dx === 4 || dy === 4
        const centre = dx === 2 && dy === 2
        Object.assign(this.cell(ox + dx, oy + dy), {
          dark: ring || centre,
          type: 'alignment',
          part: centre ? 'inner' : 'outer',
          landmark,
        })
      }
    }
  }
}

/** A 21x21 version-1-like symbol: 3 finders, timing lines, a fake alignment pattern and a few data modules. */
function qrFixture() {
  const m = new FakeMatrix(21, 21)
  m.addFinder(0, 0, 'top-left')
  m.addFinder(14, 0, 'top-right')
  m.addFinder(0, 14, 'bottom-left')
  const th = m.addLandmark({ type: 'timing', x: 8, y: 6, width: 5, height: 1 })
  const tv = m.addLandmark({ type: 'timing', x: 6, y: 8, width: 1, height: 5 })
  for (let i = 8; i <= 12; i++) {
    Object.assign(m.cell(i, 6), { dark: i % 2 === 0, type: 'timing', landmark: th })
    Object.assign(m.cell(6, i), { dark: i % 2 === 0, type: 'timing', landmark: tv })
  }
  m.addAlignment(12, 12)
  m.set(9, 9).set(10, 9).set(9, 10) // L shape
  m.set(18, 18) // isolated, bottom-right
  m.set(20, 10)
  return m
}

/** A 27x7 rMQR-like symbol: finder at the top-left and a 5x5 sub-finder at the bottom-right. */
function rmqrFixture() {
  const m = new FakeMatrix(27, 7)
  m.addFinder(0, 0, 'top-left')
  m.addFinder(22, 2, 'bottom-right', 5, 'subFinder')
  m.set(20, 1)
  m.set(10, 5)
  return m
}

const layout = (moduleSize = 10, origin = 0, w = 21, h = w) => ({
  moduleSize,
  originX: origin,
  originY: origin,
  outputWidth: w * moduleSize + origin * 2,
  outputHeight: h * moduleSize + origin * 2,
})

// ---------------------------------------------------------------------------------------------------------------
// Geometry helpers: non-zero winding number of a point for any set of shapes.
// ---------------------------------------------------------------------------------------------------------------

function flatten(commands: readonly PathCommand[]): [number, number][][] {
  const polys: [number, number][][] = []
  let current: [number, number][] = []
  let x = 0
  let y = 0
  for (const c of commands) {
    if (c[0] === 'M') {
      if (current.length) polys.push(current)
      current = [[c[1], c[2]]]
      ;[x, y] = [c[1], c[2]]
    } else if (c[0] === 'L') {
      current.push([c[1], c[2]])
      ;[x, y] = [c[1], c[2]]
    } else if (c[0] === 'C') {
      const [, x1, y1, x2, y2, x3, y3] = c
      for (let i = 1; i <= 32; i++) {
        const t = i / 32
        const u = 1 - t
        current.push([
          u * u * u * x + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * x3,
          u * u * u * y + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * y3,
        ])
      }
      ;[x, y] = [x3, y3]
    } else {
      if (current.length) polys.push(current)
      current = []
    }
  }
  if (current.length) polys.push(current)
  return polys
}

function winding(shapes: readonly Shape[], px: number, py: number): number {
  let total = 0
  for (const shape of shapes) {
    for (const poly of flatten(shapeToPathCommands(shape))) {
      for (let i = 0; i < poly.length; i++) {
        const [ax, ay] = poly[i]
        const [bx, by] = poly[(i + 1) % poly.length]
        const cross = (bx - ax) * (py - ay) - (px - ax) * (by - ay)
        if (ay <= py && by > py && cross > 0) total++
        else if (ay > py && by <= py && cross < 0) total--
      }
    }
  }
  return total
}

const inside = (shapes: readonly Shape[], x: number, y: number) => winding(shapes, x, y) !== 0

/** Grid of module centres covered by the shapes. */
function coverage(shapes: readonly Shape[], width: number, height: number, ms = 10, origin = 0) {
  const out: boolean[] = []
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) out.push(inside(shapes, origin + (x + 0.5) * ms, origin + (y + 0.5) * ms))
  return out
}

const darkGrid = (m: FakeMatrix, filter: (x: number, y: number) => boolean = () => true) =>
  m.cells.map((c, i) => c.dark && filter(i % m.width, Math.floor(i / m.width)))

const layer = (layers: readonly RenderLayer[], region: string, corner?: number) =>
  layers.find((l) => l.region === region && (corner === undefined || l.corner === corner))

const paths = (shapes: readonly Shape[]) => shapes.filter((s): s is PathShape => s.kind === 'path')
const subpaths = (shape: PathShape) => shape.commands.filter((c) => c[0] === 'M').length
const onlyAllowedCommands = (shapes: readonly Shape[]) =>
  paths(shapes).every((p) => p.commands.every((c) => ['M', 'L', 'C', 'Z'].includes(c[0])))

function small(width: number, height: number, cells: readonly (readonly [number, number])[]) {
  const m = new FakeMatrix(width, height)
  for (const [x, y] of cells) m.set(x, y)
  return m
}

// ---------------------------------------------------------------------------------------------------------------

describe('buildRenderPlan - default squares', () => {
  it('renders one base layer of merged, pixel-exact rectangles covering exactly the dark modules', () => {
    const m = qrFixture()
    const ms = 7.3
    const origin = 12.5
    const plan = buildRenderPlan({ matrix: m, layout: layout(ms, origin), color: '#111' })
    expect(plan.layers).toHaveLength(1)
    const [base] = plan.layers
    expect(base.region).toBe('base')
    expect(base.color).toBe('#111')
    const rects = base.shapes as RectShape[]
    expect(rects.every((r) => r.kind === 'rect' && r.radii === undefined)).toBe(true)

    const covered = new Array<number>(21 * 21).fill(0)
    for (const r of rects) {
      const col = Math.round((r.x - origin) / ms)
      const row = Math.round((r.y - origin) / ms)
      const cols = Math.round(r.width / ms)
      const rows = Math.round(r.height / ms)
      expect(r.x).toBe(origin + col * ms)
      expect(r.y).toBe(origin + row * ms)
      expect(r.width).toBe(cols * ms)
      expect(r.height).toBe(rows * ms)
      for (let y = row; y < row + rows; y++) for (let x = col; x < col + cols; x++) covered[y * 21 + x]++
    }
    expect(covered.map((c) => c === 1)).toEqual(darkGrid(m))
    expect(Math.max(...covered)).toBe(1)
    // merged: far fewer primitives than dark modules
    expect(rects.length).toBeLessThan(darkGrid(m).filter(Boolean).length / 2)
  })

  it('treats a shape with zero radii as plain squares', () => {
    const plan = buildRenderPlan({ matrix: qrFixture(), layout: layout(), color: 'black', shape: { borderRadius: 0 } })
    expect(plan.layers[0].shapes.every((s) => s.kind === 'rect')).toBe(true)
  })
})

describe('buildRenderPlan - hidden modules', () => {
  it('never paints hidden modules', () => {
    const m = qrFixture()
    const isHidden = (x: number, y: number) => x >= 8 && x <= 13 && y >= 8 && y <= 13
    for (const shape of [undefined, { borderRadius: 3 }, { individual: { borderRadius: '50%' } }] as QRShape[]) {
      const plan = buildRenderPlan({ matrix: m, layout: layout(), color: 'black', shape, isHidden })
      expect(coverage(plan.layers[0].shapes, 21, 21)).toEqual(darkGrid(m, (x, y) => !isHidden(x, y)))
    }
  })

  it('treats hidden modules as light when tracing outlines', () => {
    const m = small(5, 1, [
      [0, 0],
      [1, 0],
      [2, 0],
      [3, 0],
    ])
    const plan = buildRenderPlan({
      matrix: m,
      layout: layout(10, 0, 5, 1),
      color: 'black',
      shape: { borderRadius: 2 },
      isHidden: (x) => x === 2,
    })
    expect(paths(plan.layers[0].shapes)).toHaveLength(2)
  })
})

describe('buildRenderPlan - global contours', () => {
  const render = (m: FakeMatrix, shape: QRShape, isHidden?: (x: number, y: number) => boolean) =>
    buildRenderPlan({ matrix: m, layout: layout(10, 0, m.width, m.height), color: 'black', shape, isHidden }).layers[0]
      .shapes

  it('rounds a single module (shorthand targets global)', () => {
    const shapes = render(small(3, 3, [[1, 1]]), { borderRadius: 5 })
    expect(shapes).toHaveLength(1)
    const [p] = paths(shapes)
    expect(p.commands.filter((c) => c[0] === 'C')).toHaveLength(4)
    expect(onlyAllowedCommands(shapes)).toBe(true)
    expect(inside(shapes, 15, 15)).toBe(true)
    expect(inside(shapes, 10.5, 10.5)).toBe(false) // corner cut off
    expect(inside(shapes, 15, 10.5)).toBe(true) // middle of the top edge
  })

  it('clamps the radius to half of the edge', () => {
    const shapes = render(small(3, 3, [[1, 1]]), { borderRadius: 100 })
    const { commands } = paths(shapes)[0]
    // a circle of radius 5: starts in the middle of the top edge and has no straight segments
    expect(commands[0]).toEqual(['M', 15, 10])
    expect(commands.filter((c) => c[0] === 'L')).toHaveLength(0)
    expect(commands.filter((c) => c[0] === 'C')).toHaveLength(4)
  })

  it('rounds an L shape and fills the inner corner with an inverse fillet', () => {
    const cells = [
      [1, 1],
      [2, 1],
      [1, 2],
    ] as const
    const shapes = render(small(4, 4, cells), { borderRadius: 5 })
    expect(shapes).toHaveLength(1)
    expect(inside(shapes, 10.5, 10.5)).toBe(false) // convex corner rounded
    expect(inside(shapes, 20.3, 20.3)).toBe(true) // concave corner filled
    expect(inside(shapes, 24, 24)).toBe(false) // but only as a fillet
    expect(inside(shapes, 15, 15)).toBe(true)
    expect(inside(shapes, 25, 15)).toBe(true)
    expect(inside(shapes, 15, 25)).toBe(true)
  })

  it('does not paint inverse fillets into hidden modules', () => {
    const m = small(4, 4, [
      [1, 1],
      [2, 1],
      [1, 2],
    ])
    const shapes = render(m, { borderRadius: 5 }, (x, y) => x === 2 && y === 2)
    expect(inside(shapes, 20.3, 20.3)).toBe(false)
    expect(inside(shapes, 10.5, 10.5)).toBe(false)
  })

  it('renders a ring with a hole (non-zero, opposite winding)', () => {
    const ring: [number, number][] = []
    for (let y = 1; y <= 3; y++) for (let x = 1; x <= 3; x++) if (x !== 2 || y !== 2) ring.push([x, y])
    const shapes = render(small(5, 5, ring), { borderRadius: 3 })
    expect(shapes).toHaveLength(1)
    expect(subpaths(paths(shapes)[0])).toBe(2)
    expect(inside(shapes, 25, 25)).toBe(false) // hole
    expect(winding(shapes, 15, 15)).not.toBe(0)
    expect(inside(shapes, 25, 12)).toBe(true)
    expect(inside(shapes, 10.4, 10.4)).toBe(false) // outer corner rounded
    expect(inside(shapes, 20.4, 20.4)).toBe(true) // hole corner filled
  })

  it('emits one path per separate blob', () => {
    const shapes = render(
      small(6, 4, [
        [0, 0],
        [1, 0],
        [4, 2],
        [2, 3],
        [3, 2],
      ]),
      { borderRadius: 2 },
    )
    // (0,0)-(1,0) bar; (3,2)-(4,2) bar; (2,3) diagonal to (3,2) -> separate
    expect(paths(shapes)).toHaveLength(3)
  })

  it('applies global distanceWeight per outline corner', () => {
    const m = small(21, 21, [
      [10, 10],
      [0, 0],
    ])
    const shapes = render(m, { borderRadius: 5, distanceWeight: [0, 1] })
    // the centre dot is barely rounded: its corners sit at distance 0.05
    expect(inside(shapes, 100.5, 100.5)).toBe(true)
    // the corner dot is fully rounded
    expect(inside(shapes, 0.5, 0.5)).toBe(false)
  })

  it('combines individual and global: convex corners use the larger radius, concave corners the global one', () => {
    const m = small(4, 4, [
      [1, 1],
      [2, 1],
      [1, 2],
    ])
    const shapes = render(m, { individual: { borderRadius: '50%' }, global: { borderRadius: 2 } })
    expect(paths(shapes)).toHaveLength(1)
    // convex corner radius 5 (individual 50% of 10px)
    expect(inside(shapes, 11, 11)).toBe(false)
    expect(inside(shapes, 12.5, 12.5)).toBe(true)
    // concave corner radius 2
    expect(inside(shapes, 20.3, 20.3)).toBe(true)
    expect(inside(shapes, 21.5, 21.5)).toBe(false)
  })
})

describe('buildRenderPlan - individual dots', () => {
  const radiiAt = (shapes: readonly Shape[], x: number, y: number, ms = 10) =>
    (shapes.find((s) => s.kind === 'rect' && s.x === x * ms && s.y === y * ms && s.width === ms) as RectShape | undefined)
      ?.radii

  it('rounds every module on its own', () => {
    const m = qrFixture()
    const plan = buildRenderPlan({
      matrix: m,
      layout: layout(),
      color: 'black',
      shape: { individual: { borderRadius: '50%' } },
    })
    const shapes = plan.layers[0].shapes
    expect(shapes).toHaveLength(darkGrid(m).filter(Boolean).length)
    expect(radiiAt(shapes, 9, 9)).toEqual([5, 5, 5, 5])
    expect(coverage(shapes, 21, 21)).toEqual(darkGrid(m))
  })

  it('rotates tuples with alignmentOffset based on the closest corner', () => {
    const m = qrFixture()
    const shapes = buildRenderPlan({
      matrix: m,
      layout: layout(),
      color: 'black',
      shape: { individual: { borderRadius: [4, 2, 0, 0], alignmentOffset: true } },
    }).layers[0].shapes
    expect(radiiAt(shapes, 0, 0)).toEqual([4, 2, 0, 0]) // top-left: unchanged
    expect(radiiAt(shapes, 20, 0)).toEqual([0, 4, 2, 0]) // top-right: [tr, br, bl, tl]
    expect(radiiAt(shapes, 18, 18)).toEqual([0, 0, 4, 2]) // bottom-right: [br, bl, tl, tr]
    expect(radiiAt(shapes, 0, 20)).toEqual([2, 0, 0, 4]) // bottom-left: [bl, tl, tr, br]
  })

  it("mirrors tuples with alignmentOffset: 'mirror'", () => {
    const m = qrFixture()
    const shapes = buildRenderPlan({
      matrix: m,
      layout: layout(),
      color: 'black',
      shape: { individual: { borderRadius: [4, 2, 0, 0], alignmentOffset: 'mirror' } },
    }).layers[0].shapes
    expect(radiiAt(shapes, 0, 0)).toEqual([4, 2, 0, 0])
    expect(radiiAt(shapes, 20, 0)).toEqual([2, 4, 0, 0]) // [tr, tl, bl, br]
    expect(radiiAt(shapes, 18, 18)).toEqual([0, 2, 4, 0]) // [br, tr, tl, bl]
    expect(radiiAt(shapes, 0, 20)).toEqual([0, 0, 2, 4]) // [bl, br, tr, tl]
  })

  it('scales radii with distanceWeight from the centre of the symbol', () => {
    const m = small(21, 21, [
      [10, 10],
      [0, 10],
      [5, 10],
      [20, 20],
    ])
    const shapes = buildRenderPlan({
      matrix: m,
      layout: layout(),
      color: 'black',
      shape: { individual: { borderRadius: 4, distanceWeight: [0, 1] } },
    }).layers[0].shapes
    // centre module: radius 0 -> plain merged square
    expect(shapes.find((s) => s.kind === 'rect' && s.x === 100 && s.y === 100)).toMatchObject({ width: 10 })
    expect(radiiAt(shapes, 10, 10)).toBeUndefined()
    expect(radiiAt(shapes, 0, 10)).toEqual([4, 4, 4, 4])
    expect(radiiAt(shapes, 20, 20)).toEqual([4, 4, 4, 4])
    expect(radiiAt(shapes, 5, 10)).toEqual([2, 2, 2, 2])
  })

  it('uses the quadrant relative to the centre of non-square rMQR symbols', () => {
    const m = rmqrFixture()
    const shapes = buildRenderPlan({
      matrix: m,
      layout: layout(10, 0, 27, 7),
      color: 'black',
      shape: { individual: { borderRadius: [4, 0, 0, 0], alignmentOffset: true } },
    }).layers[0].shapes
    expect(radiiAt(shapes, 20, 1)).toEqual([0, 4, 0, 0]) // top-right
    expect(radiiAt(shapes, 10, 5)).toEqual([0, 0, 0, 4]) // bottom-left
  })
})

describe('buildRenderPlan - modules overrides', () => {
  it('splits finder inner/outer with per-corner tuples and null entries', () => {
    const m = qrFixture()
    const modules: ModulesOption = {
      finder: {
        outer: [{ color: 'red' }, null, undefined, { color: 'teal' }],
        inner: { color: 'green', shape: { borderRadius: '50%' } },
      },
    }
    const plan = buildRenderPlan({ matrix: m, layout: layout(), color: 'black', modules })
    expect(plan.layers.map((l) => [l.region, l.corner, l.color])).toEqual([
      ['base', undefined, 'black'],
      ['finder-outer', 0, 'red'],
      ['finder-inner', 0, 'green'],
      ['finder-inner', 1, 'green'],
      ['finder-outer', 3, 'teal'],
      ['finder-inner', 3, 'green'],
    ])
    const base = plan.layers[0].shapes
    const baseCover = coverage(base, 21, 21)
    expect(baseCover[0]).toBe(false) // top-left ring removed from base
    expect(baseCover[14]).toBe(true) // top-right ring stays in base
    expect(baseCover[2 * 21 + 16]).toBe(false) // top-right eye removed (inner applies to all corners)

    // top-left outer: plain squares covering exactly the ring
    const outer = layer(plan.layers, 'finder-outer', 0)!
    expect(coverage(outer.shapes, 21, 21)).toEqual(
      darkGrid(m, (x, y) => x < 7 && y < 7 && !(x >= 2 && x <= 4 && y >= 2 && y <= 4)),
    )

    // eye: 3x3 rounded with 50% of its bounding box -> a circle of radius 15px
    const eye = layer(plan.layers, 'finder-inner', 0)!.shapes
    expect(paths(eye)).toHaveLength(1)
    expect(inside(eye, 35, 35)).toBe(true)
    expect(inside(eye, 21, 21)).toBe(false)
    expect(inside(eye, 35, 20.5)).toBe(true)
  })

  it('renders a globally rounded finder as a ring with a hole plus a rounded eye', () => {
    const m = qrFixture()
    const plan = buildRenderPlan({
      matrix: m,
      layout: layout(),
      color: 'black',
      modules: { finder: { color: 'navy', shape: { borderRadius: '50%' } } },
    })
    expect(plan.layers.map((l) => [l.region, l.corner])).toEqual([
      ['base', undefined],
      ['finder', 0],
      ['finder', 1],
      ['finder', 3],
    ])
    const finder = layer(plan.layers, 'finder', 0)!
    expect(finder.color).toBe('navy')
    const ps = paths(finder.shapes)
    expect(ps).toHaveLength(2)
    expect(ps.map(subpaths).sort()).toEqual([1, 2])
    expect(onlyAllowedCommands(finder.shapes)).toBe(true)
    const s = finder.shapes
    expect(inside(s, 0.5, 0.5)).toBe(false) // outer corner rounded away (circle)
    expect(inside(s, 35, 5)).toBe(true) // ring
    expect(inside(s, 15, 35)).toBe(false) // light ring
    expect(inside(s, 35, 35)).toBe(true) // eye
    expect(inside(s, 12, 12)).toBe(true) // hole corner filled by the inverse fillet
    // base no longer contains any finder module
    expect(coverage(plan.layers[0].shapes, 21, 21)).toEqual(darkGrid(m, (x, y) => m.cell(x, y).type !== 'finder'))
  })

  it('applies a per-corner finder tuple only to the targeted corners', () => {
    const m = qrFixture()
    const plan = buildRenderPlan({
      matrix: m,
      layout: layout(),
      color: 'black',
      modules: { finder: [undefined, { color: 'red' }] },
    })
    expect(plan.layers.map((l) => [l.region, l.corner, l.color])).toEqual([
      ['base', undefined, 'black'],
      ['finder', 1, 'red'],
    ])
  })

  it('overrides timing and alignment patterns', () => {
    const m = qrFixture()
    const plan = buildRenderPlan({
      matrix: m,
      layout: layout(),
      color: 'black',
      modules: { timing: { color: 'orange' }, alignment: { color: 'purple', shape: { borderRadius: '50%' } } },
    })
    expect(plan.layers.map((l) => [l.region, l.color])).toEqual([
      ['base', 'black'],
      ['alignment', 'purple'],
      ['timing', 'orange'],
    ])
    const base = coverage(plan.layers[0].shapes, 21, 21)
    expect(base).toEqual(darkGrid(m, (x, y) => !['timing', 'alignment'].includes(m.cell(x, y).type)))
    const timing = layer(plan.layers, 'timing')!
    expect(coverage(timing.shapes, 21, 21)).toEqual(darkGrid(m, (x, y) => m.cell(x, y).type === 'timing'))
    const alignment = layer(plan.layers, 'alignment')!
    expect(paths(alignment.shapes)).toHaveLength(2) // ring + centre
    expect(inside(alignment.shapes, 145, 145)).toBe(true) // centre dot
    expect(inside(alignment.shapes, 120.5, 120.5)).toBe(false) // rounded ring corner
    expect(inside(alignment.shapes, 145, 125)).toBe(true) // ring
  })

  it('uses the finder style for the rMQR sub-finder via the bottom-right entry', () => {
    const m = rmqrFixture()
    const tuple = buildRenderPlan({
      matrix: m,
      layout: layout(10, 0, 27, 7),
      color: 'black',
      modules: { finder: [{ color: 'a' }, null, { color: 'b' }] },
    })
    expect(tuple.layers.map((l) => [l.region, l.corner, l.color])).toEqual([
      ['base', undefined, 'black'],
      ['finder', 0, 'a'],
      ['finder', 2, 'b'],
    ])
    expect(coverage(layer(tuple.layers, 'finder', 2)!.shapes, 27, 7)).toEqual(
      darkGrid(m, (x, y) => m.cell(x, y).type === 'subFinder'),
    )

    const single = buildRenderPlan({
      matrix: m,
      layout: layout(10, 0, 27, 7),
      color: 'black',
      modules: { finder: { color: 'c' } },
    })
    expect(single.layers.map((l) => [l.region, l.corner])).toEqual([
      ['base', undefined],
      ['finder', 0],
      ['finder', 2],
    ])
  })

  it('uses the pattern corner for alignmentOffset inside pattern layers', () => {
    // Micro-QR-like 11x11: the finder's right column sits in the right half, but still rotates as top-left
    const m = new FakeMatrix(11, 11)
    m.addFinder(0, 0, 'top-left')
    const plan = buildRenderPlan({
      matrix: m,
      layout: layout(10, 0, 11, 11),
      color: 'black',
      modules: { finder: { shape: { individual: { borderRadius: [4, 0, 0, 0], alignmentOffset: true } } } },
    })
    const rect = layer(plan.layers, 'finder', 0)!.shapes.find((s) => s.kind === 'rect' && s.x === 60 && s.y === 0)
    expect((rect as RectShape).radii).toEqual([4, 0, 0, 0])
  })

  it('uses the pattern as the object for distanceWeight in pattern layers', () => {
    const m = qrFixture()
    const plan = buildRenderPlan({
      matrix: m,
      layout: layout(),
      color: 'black',
      modules: { finder: { shape: { individual: { borderRadius: 4, distanceWeight: [0, 1] } } } },
    })
    const shapes = layer(plan.layers, 'finder', 1)!.shapes
    const at = (x: number, y: number) =>
      shapes.find((s) => s.kind === 'rect' && s.x === x * 10 && s.y === y * 10 && s.width === 10) as RectShape | undefined
    expect(at(14, 0)?.radii).toEqual([4, 4, 4, 4]) // ring: edge of the finder
    expect(at(17, 3)?.radii).toBeUndefined() // eye centre: distance 0 -> plain square
    expect(at(16, 2)?.radii?.[0]).toBeCloseTo(4 / 3) // eye corner: distance 1/3
  })

  it('falls back to the base colour and plain squares when a style is empty', () => {
    const plan = buildRenderPlan({ matrix: qrFixture(), layout: layout(), color: 'black', modules: { timing: {} } })
    const timing = layer(plan.layers, 'timing')!
    expect(timing.color).toBe('black')
    expect(timing.shapes.every((s) => s.kind === 'rect')).toBe(true)
  })
})

describe('buildRenderPlan - validation', () => {
  const base = { matrix: qrFixture(), layout: layout(), color: 'black' }

  it('throws clear errors for invalid options', () => {
    expect(() => buildRenderPlan({ ...base, shape: { borderRadius: 'big' } })).toThrow(/Invalid border radius/)
    expect(() =>
      buildRenderPlan({ ...base, shape: { borderRadius: 2, distanceWeight: [1] as never } }),
    ).toThrow(/distanceWeight/)
    expect(() =>
      buildRenderPlan({ ...base, shape: { global: {}, borderRadius: 2 } as never }),
    ).toThrow(/cannot be combined/)
    expect(() => buildRenderPlan({ ...base, modules: { finder: [1] as never } })).toThrow(/modules\.finder\[0\]/)
    expect(() => buildRenderPlan({ ...base, layout: { ...base.layout, moduleSize: 0 } })).toThrow(/moduleSize/)
  })
})
