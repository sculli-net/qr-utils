import { describe, expect, it } from 'vitest'
import { clampRadii, expandBorderRadius, parseBorderRadius } from './border-radius.js'
import { alignTuple, cornerMapping, quadrantOf, toAlignmentMode } from './corners.js'
import { parseCSSLength, resolveLength } from './css-length.js'
import { contourArea, isConvex, labelComponents, traceContours } from './contour.js'
import { moduleDistance, toDistanceWeight, vertexDistance, weightFactor } from './distance.js'
import { mergedRects } from './merge.js'
import { pathCommandsToSvg, roundedRectCommands, shapeToPathCommands, KAPPA } from './path.js'

describe('parseCSSLength', () => {
  it('parses numbers and unit strings', () => {
    expect(parseCSSLength(12)).toEqual({ value: 12, unit: 'px' })
    expect(parseCSSLength('12px')).toEqual({ value: 12, unit: 'px' })
    expect(parseCSSLength(' 8 ')).toEqual({ value: 8, unit: 'px' })
    expect(parseCSSLength('.5px')).toEqual({ value: 0.5, unit: 'px' })
    expect(parseCSSLength('50%')).toEqual({ value: 50, unit: '%' })
    expect(parseCSSLength('1rem')).toEqual({ value: 16, unit: 'px' })
    expect(parseCSSLength('2em')).toEqual({ value: 32, unit: 'px' })
    expect(parseCSSLength('1.5REM')).toEqual({ value: 24, unit: 'px' })
    expect(parseCSSLength(0)).toEqual({ value: 0, unit: 'px' })
  })

  it('rejects invalid values with clear errors', () => {
    expect(() => parseCSSLength('abc')).toThrow(/Invalid border radius: "abc"/)
    expect(() => parseCSSLength('12pt')).toThrow(TypeError)
    expect(() => parseCSSLength('')).toThrow(TypeError)
    expect(() => parseCSSLength(-1)).toThrow(RangeError)
    expect(() => parseCSSLength('-4px')).toThrow(RangeError)
    expect(() => parseCSSLength(Number.NaN)).toThrow(TypeError)
    expect(() => parseCSSLength(Number.POSITIVE_INFINITY)).toThrow(TypeError)
  })

  it('resolves percentages against a reference', () => {
    expect(resolveLength({ value: 50, unit: '%' }, 10)).toBe(5)
    expect(resolveLength({ value: 7, unit: 'px' }, 10)).toBe(7)
  })
})

describe('expandBorderRadius', () => {
  it('follows the CSS 1-4 value shorthand for strings', () => {
    expect(expandBorderRadius('5')).toEqual(['5', '5', '5', '5'])
    expect(expandBorderRadius('1 2')).toEqual(['1', '2', '1', '2'])
    expect(expandBorderRadius('1 2 3')).toEqual(['1', '2', '3', '2'])
    expect(expandBorderRadius('0 20 0 20')).toEqual(['0', '20', '0', '20'])
    expect(expandBorderRadius('  1px   2%  ')).toEqual(['1px', '2%', '1px', '2%'])
  })

  it('follows the same rules for numbers and tuples', () => {
    expect(expandBorderRadius(4)).toEqual([4, 4, 4, 4])
    expect(expandBorderRadius([1])).toEqual([1, 1, 1, 1])
    expect(expandBorderRadius(['20px', '5%'])).toEqual(['20px', '5%', '20px', '5%'])
    expect(expandBorderRadius([1, 2, 3])).toEqual([1, 2, 3, 2])
    expect(expandBorderRadius([1, 2, 3, 4])).toEqual([1, 2, 3, 4])
    expect(expandBorderRadius([1, undefined, 3])).toEqual([1, 1, 3, 1])
  })

  it('rejects unsupported forms', () => {
    expect(() => expandBorderRadius('10px / 5px')).toThrow(/Elliptical/)
    expect(() => expandBorderRadius('1 2 3 4 5')).toThrow(/At most 4/)
    expect(() => expandBorderRadius([1, 2, 3, 4, 5] as never)).toThrow(/At most 4/)
    expect(() => expandBorderRadius(['1 2'])).toThrow(/single lengths/)
    expect(() => expandBorderRadius([] as never)).toThrow(/empty/)
    expect(() => expandBorderRadius('   ')).toThrow(/empty/)
  })

  it('parses to lengths', () => {
    expect(parseBorderRadius('1rem 50%')).toEqual([
      { value: 16, unit: 'px' },
      { value: 50, unit: '%' },
      { value: 16, unit: 'px' },
      { value: 50, unit: '%' },
    ])
  })
})

describe('clampRadii', () => {
  it('leaves radii that fit untouched', () => {
    expect(clampRadii([5, 5, 5, 5], 10, 10)).toEqual([5, 5, 5, 5])
    expect(clampRadii([8, 2, 0, 0], 10, 10)).toEqual([8, 2, 0, 0])
  })

  it('scales all radii uniformly like CSS', () => {
    expect(clampRadii([10, 10, 10, 10], 10, 10)).toEqual([5, 5, 5, 5])
    expect(clampRadii([20, 0, 0, 0], 10, 10)).toEqual([10, 0, 0, 0])
    // top side: 15 + 5 = 20 > 10 -> factor 0.5, which applies to every corner
    expect(clampRadii([15, 5, 2, 0], 10, 40)).toEqual([7.5, 2.5, 1, 0])
    // non-square box: limited by the short side
    expect(clampRadii([10, 10, 10, 10], 40, 10)).toEqual([5, 5, 5, 5])
  })
})

describe('alignmentOffset corner mapping', () => {
  const v = ['a', 'b', 'c', 'd'] as const

  it('keeps top-left unchanged', () => {
    expect(alignTuple(v, 0, 'rotate')).toEqual(['a', 'b', 'c', 'd'])
    expect(alignTuple(v, 0, 'mirror')).toEqual(['a', 'b', 'c', 'd'])
  })

  it('rotates once per quadrant clockwise', () => {
    // top-right: values map to [tr, br, bl, tl]
    expect(cornerMapping(1, 'rotate')).toEqual([1, 2, 3, 0])
    expect(alignTuple(v, 1, 'rotate')).toEqual(['d', 'a', 'b', 'c'])
    // bottom-right: values map to [br, bl, tl, tr]
    expect(cornerMapping(2, 'rotate')).toEqual([2, 3, 0, 1])
    expect(alignTuple(v, 2, 'rotate')).toEqual(['c', 'd', 'a', 'b'])
    // bottom-left: values map to [bl, tl, tr, br]
    expect(cornerMapping(3, 'rotate')).toEqual([3, 0, 1, 2])
    expect(alignTuple(v, 3, 'rotate')).toEqual(['b', 'c', 'd', 'a'])
  })

  it('mirror swaps indices 1 and 3 after rotating', () => {
    // spec example, top-right: [tr, tl, bl, br]
    expect(cornerMapping(1, 'mirror')).toEqual([1, 0, 3, 2])
    expect(alignTuple(v, 1, 'mirror')).toEqual(['b', 'a', 'd', 'c'])
    expect(cornerMapping(2, 'mirror')).toEqual([2, 1, 0, 3])
    expect(cornerMapping(3, 'mirror')).toEqual([3, 2, 1, 0])
    // the bottom-left mirror is a vertical reflection of the top-left tuple
    expect(alignTuple(v, 3, 'mirror')).toEqual(['d', 'c', 'b', 'a'])
  })

  it('does nothing when disabled', () => {
    expect(alignTuple(v, 2, false)).toEqual(['a', 'b', 'c', 'd'])
  })

  it('validates the option', () => {
    expect(toAlignmentMode(true)).toBe('rotate')
    expect(toAlignmentMode(undefined)).toBe(false)
    expect(toAlignmentMode('mirror')).toBe('mirror')
    expect(() => toAlignmentMode('flip')).toThrow(/alignmentOffset/)
  })

  it('finds quadrants relative to the centre, including for rectangles', () => {
    expect(quadrantOf(1, 1, 21, 21)).toBe(0)
    expect(quadrantOf(20, 1, 21, 21)).toBe(1)
    expect(quadrantOf(20, 20, 21, 21)).toBe(2)
    expect(quadrantOf(1, 20, 21, 21)).toBe(3)
    expect(quadrantOf(20.5, 1.5, 27, 7)).toBe(1)
    expect(quadrantOf(20.5, 5.5, 27, 7)).toBe(2)
  })
})

describe('distanceWeight', () => {
  const box = { x: 0, y: 0, width: 21, height: 21 }

  it('uses normalised Chebyshev distance from the centre', () => {
    expect(moduleDistance(10, 10, box)).toBe(0)
    expect(moduleDistance(0, 10, box)).toBe(1)
    expect(moduleDistance(20, 20, box)).toBe(1)
    expect(moduleDistance(5, 10, box)).toBe(0.5)
    expect(moduleDistance(5, 15, box)).toBe(0.5)
    expect(vertexDistance(0, 0, box)).toBe(1)
    expect(vertexDistance(10.5, 10.5, box)).toBe(0)
  })

  it('interpolates linearly', () => {
    expect(weightFactor([0, 1], 0)).toBe(0)
    expect(weightFactor([0, 1], 1)).toBe(1)
    expect(weightFactor([1, 0.5], 0.5)).toBe(0.75)
    expect(weightFactor(undefined, 0.3)).toBe(1)
  })

  it('validates the option', () => {
    expect(toDistanceWeight([0, 1])).toEqual([0, 1])
    expect(() => toDistanceWeight([1])).toThrow(/distanceWeight/)
    expect(() => toDistanceWeight([0, -1])).toThrow(/distanceWeight/)
    expect(() => toDistanceWeight('0 1')).toThrow(/distanceWeight/)
  })
})

function maskOf(width: number, height: number, cells: readonly (readonly [number, number])[]): Uint8Array {
  const mask = new Uint8Array(width * height)
  for (const [x, y] of cells) mask[y * width + x] = 1
  return mask
}

function trace(width: number, height: number, cells: readonly (readonly [number, number])[]) {
  const mask = maskOf(width, height, cells)
  const { labels, components } = labelComponents(mask, width, height)
  return { components, contours: traceContours(mask, width, height, labels) }
}

describe('contour tracing', () => {
  it('traces a single module as a clockwise square', () => {
    const { contours, components } = trace(3, 3, [[1, 1]])
    expect(components).toHaveLength(1)
    expect(contours).toHaveLength(1)
    const [c] = contours
    expect(c.vertices.map((v) => [v.x, v.y])).toEqual([
      [2, 1],
      [2, 2],
      [1, 2],
      [1, 1],
    ])
    expect(c.vertices.every(isConvex)).toBe(true)
    expect(contourArea(c)).toBe(1)
  })

  it('traces an L shape with one concave corner', () => {
    const { contours } = trace(4, 4, [
      [1, 1],
      [2, 1],
      [1, 2],
    ])
    expect(contours).toHaveLength(1)
    const vertices = contours[0].vertices
    expect(vertices).toHaveLength(6)
    const concave = vertices.filter((v) => !isConvex(v))
    expect(concave.map((v) => [v.x, v.y])).toEqual([[2, 2]])
    expect(contourArea(contours[0])).toBe(3)
  })

  it('traces a ring as an outer outline plus an oppositely wound hole', () => {
    const ring: [number, number][] = []
    for (let y = 0; y < 3; y++) for (let x = 0; x < 3; x++) if (x !== 1 || y !== 1) ring.push([x + 1, y + 1])
    const { contours, components } = trace(5, 5, ring)
    expect(components).toHaveLength(1)
    expect(contours).toHaveLength(2)
    const areas = contours.map(contourArea).sort((a, b) => a - b)
    expect(areas).toEqual([-1, 9])
    expect(contours.every((c) => c.component === 0)).toBe(true)
    const hole = contours.find((c) => contourArea(c) < 0)!
    expect(hole.vertices.every((v) => !isConvex(v))).toBe(true)
  })

  it('keeps separate blobs and diagonal neighbours apart (4-connectivity)', () => {
    const separate = trace(6, 3, [
      [0, 0],
      [1, 0],
      [4, 1],
    ])
    expect(separate.components).toHaveLength(2)
    expect(separate.contours).toHaveLength(2)
    expect(new Set(separate.contours.map((c) => c.component))).toEqual(new Set([0, 1]))

    const diagonal = trace(3, 3, [
      [0, 0],
      [1, 1],
    ])
    expect(diagonal.components).toHaveLength(2)
    expect(diagonal.contours).toHaveLength(2)
    expect(diagonal.contours.every((c) => c.vertices.length === 4 && contourArea(c) === 1)).toBe(true)
  })
})

describe('mergedRects', () => {
  const layout = { moduleSize: 10, originX: 5, originY: 7, outputWidth: 100, outputHeight: 100 }

  it('merges horizontal runs and identical runs on consecutive rows', () => {
    const rects = mergedRects(
      maskOf(4, 3, [
        [0, 0],
        [1, 0],
        [0, 1],
        [1, 1],
        [3, 1],
        [2, 2],
      ]),
      4,
      3,
      layout,
    )
    expect(rects).toEqual([
      { kind: 'rect', x: 5, y: 7, width: 20, height: 20 },
      { kind: 'rect', x: 35, y: 17, width: 10, height: 10 },
      { kind: 'rect', x: 25, y: 27, width: 10, height: 10 },
    ])
  })
})

describe('path helpers', () => {
  it('builds a rounded rect with cubic corners', () => {
    const cmds = roundedRectCommands(0, 0, 10, 10, [5, 0, 0, 0])
    expect(cmds[0]).toEqual(['M', 0, 5])
    expect(cmds[1]).toEqual(['C', 0, 5 - 5 * KAPPA, 5 - 5 * KAPPA, 0, 5, 0])
    expect(cmds.filter((c) => c[0] === 'C')).toHaveLength(1)
    expect(cmds.at(-1)).toEqual(['Z'])
    expect(cmds.every((c) => ['M', 'L', 'C', 'Z'].includes(c[0]))).toBe(true)
  })

  it('converts shapes and serialises to SVG', () => {
    expect(pathCommandsToSvg(shapeToPathCommands({ kind: 'rect', x: 0, y: 0, width: 2, height: 3 }))).toBe(
      'M0 0L2 0L2 3L0 3Z',
    )
    expect(pathCommandsToSvg([['M', 1 / 3, -0.00001], ['Z']], 2)).toBe('M0.33 0Z')
  })
})
