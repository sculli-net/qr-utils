import type { CornerRadii, PathCommand, Shape, StyleLayout } from './contract.js'
import { clampRadii, isZeroRadii, parseBorderRadius, resolveRadii, type Quad } from './border-radius.js'
import { alignTuple, quadrantOf, toAlignmentMode, type AlignmentMode } from './corners.js'
import { labelComponents, traceContours, isConvex, DX, DY, type Component, type ContourVertex } from './contour.js'
import type { ParsedLength } from './css-length.js'
import { moduleDistance, toDistanceWeight, vertexDistance, weightFactor, type Box } from './distance.js'
import { mergedRects } from './merge.js'
import { appendRoundedPolygon, type RoundedVertex } from './path.js'
import type { BaseQRShape, QRShape } from './types.js'

/** Concave (inverse) fillets are capped at this many modules so they never reach past the cells bordering the corner. */
export const MAX_CONCAVE_RADIUS_MODULES = 3

/** The object a module belongs to, used for `distanceWeight` and `alignmentOffset`. */
export interface Scope {
  readonly box: Box
  /** Fixed quadrant / corner index for `alignmentOffset`. If missing, it is worked out from the element's position. */
  readonly corner?: number
}

/** Everything needed to render one region (one layer) of the symbol. */
export interface RegionContext {
  readonly width: number
  readonly height: number
  readonly layout: StyleLayout
  /** Cells painted by this region (1 = paint). */
  readonly mask: Uint8Array
  /** Cells outside the mask that concave fillets must not paint into (hidden cells, dark cells of other layers). */
  readonly blocked: (x: number, y: number) => boolean
  /** Scope of a cell in the mask. */
  readonly scopeAt: (x: number, y: number) => Scope
}

/** A validated, pre-parsed {@link BaseQRShape}. */
export interface CompiledShape {
  readonly radii: Quad<ParsedLength>
  readonly align: AlignmentMode
  readonly weight: readonly [number, number] | undefined
  /** True when the shape can never produce a non-zero radius. */
  readonly zero: boolean
}

export function compileShape(shape: BaseQRShape): CompiledShape {
  if (typeof shape !== 'object' || shape === null) {
    throw new TypeError(`Invalid shape: ${JSON.stringify(shape)}. Expected an object such as { borderRadius: 4 }.`)
  }
  const radii = parseBorderRadius(shape.borderRadius ?? 0)
  const align = toAlignmentMode(shape.alignmentOffset)
  const weight = toDistanceWeight(shape.distanceWeight)
  const zero = isZeroRadii(radii) || (weight !== undefined && weight[0] === 0 && weight[1] === 0)
  return { radii, align, weight, zero }
}

/** Splits a {@link QRShape} into its individual and global parts. Without `individual` / `global` it is global. */
export function normalizeShape(shape: QRShape | undefined): { individual?: BaseQRShape; global?: BaseQRShape } {
  if (shape === undefined || shape === null) return {}
  if (typeof shape !== 'object') {
    throw new TypeError(`Invalid shape: ${JSON.stringify(shape)}. Expected an object such as { borderRadius: 4 }.`)
  }
  if ('individual' in shape || 'global' in shape) {
    const split = shape as { individual?: BaseQRShape; global?: BaseQRShape; borderRadius?: unknown }
    if ('borderRadius' in split && split.borderRadius !== undefined) {
      throw new TypeError(
        'Invalid shape: `borderRadius` cannot be combined with `individual` / `global`. Move it into `global` (or `individual`).',
      )
    }
    return { individual: split.individual ?? undefined, global: split.global ?? undefined }
  }
  return { global: shape as BaseQRShape }
}

/** Renders the shapes of one region. */
export function renderRegion(ctx: RegionContext, shape: QRShape | undefined): Shape[] {
  const targets = normalizeShape(shape)
  const individual = targets.individual ? compileShape(targets.individual) : undefined
  const global = targets.global ? compileShape(targets.global) : undefined
  const individualActive = individual && !individual.zero ? individual : undefined
  const globalActive = global && !global.zero ? global : undefined
  if (!individualActive && !globalActive) return mergedRects(ctx.mask, ctx.width, ctx.height, ctx.layout)
  if (!globalActive) return renderIndividual(ctx, individualActive!)
  return renderGlobal(ctx, globalActive, individualActive)
}

/** Resolved, clamped radii (in px) of module (x, y) for an individual shape. */
export function individualRadii(ctx: RegionContext, shape: CompiledShape, x: number, y: number): CornerRadii {
  const size = ctx.layout.moduleSize
  const scope = ctx.scopeAt(x, y)
  const resolved = resolveRadii(shape.radii, size)
  const quadrant = shape.align ? (scope.corner ?? quadrantOf(x + 0.5, y + 0.5, ctx.width, ctx.height)) : 0
  const aligned = alignTuple(resolved, quadrant, shape.align)
  const factor = weightFactor(shape.weight, shape.weight ? moduleDistance(x, y, scope.box) : 0)
  return clampRadii(
    [aligned[0] * factor, aligned[1] * factor, aligned[2] * factor, aligned[3] * factor],
    size,
    size,
  )
}

function renderIndividual(ctx: RegionContext, shape: CompiledShape): Shape[] {
  const { width, height, mask, layout } = ctx
  const { moduleSize, originX, originY } = layout
  const square = new Uint8Array(width * height)
  const rounded: Shape[] = []
  let anySquare = false
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!mask[y * width + x]) continue
      const radii = individualRadii(ctx, shape, x, y)
      if (radii[0] === 0 && radii[1] === 0 && radii[2] === 0 && radii[3] === 0) {
        square[y * width + x] = 1
        anySquare = true
        continue
      }
      rounded.push({
        kind: 'rect',
        x: originX + x * moduleSize,
        y: originY + y * moduleSize,
        width: moduleSize,
        height: moduleSize,
        radii,
      })
    }
  }
  return anySquare ? [...mergedRects(square, width, height, layout), ...rounded] : rounded
}

/**
 * Index of the radius that applies to an outline vertex, in `[tl, tr, br, bl]` order.
 *
 * - Convex vertices use the corner of the shape they form. Coming in heading right and turning down gives top-right.
 * - Concave vertices use the corner of the *empty* area they border. A hole's top-left corner uses the top-left
 *   radius, so a ring's hole is rounded like the ring.
 */
export function vertexCorner(vertex: ContourVertex): number {
  return isConvex(vertex) ? (vertex.dirIn + 1) & 3 : (vertex.dirIn + 2) & 3
}

/** The module that owns a convex outline vertex. */
function convexOwner(vertex: ContourVertex): [number, number] {
  switch (vertexCorner(vertex)) {
    case 0:
      return [vertex.x, vertex.y]
    case 1:
      return [vertex.x - 1, vertex.y]
    case 2:
      return [vertex.x - 1, vertex.y - 1]
    default:
      return [vertex.x, vertex.y - 1]
  }
}

/**
 * Largest concave fillet radius (in modules) at `vertex` that keeps the fillet out of blocked cells. The fillet
 * stays inside the row and column of empty cells that border the two edges meeting at the vertex.
 */
function concaveLimit(ctx: RegionContext, vertex: ContourVertex, radiusModules: number): number {
  const ax = DX[vertex.dirIn]
  const ay = DY[vertex.dirIn]
  const bx = DX[vertex.dirOut]
  const by = DY[vertex.dirOut]
  const steps = Math.ceil(radiusModules - 1e-9)
  let limit = radiusModules
  const isBlocked = (cx: number, cy: number) => {
    const x = Math.floor(cx)
    const y = Math.floor(cy)
    return x >= 0 && y >= 0 && x < ctx.width && y < ctx.height && ctx.blocked(x, y)
  }
  for (let i = 0; i < steps && i < limit; i++) {
    // Cells running back along the incoming edge, and forwards along the outgoing edge, on the empty side.
    const backX = vertex.x - ax * (i + 0.5) + bx * 0.5
    const backY = vertex.y - ay * (i + 0.5) + by * 0.5
    const fwdX = vertex.x + bx * (i + 0.5) - ax * 0.5
    const fwdY = vertex.y + by * (i + 0.5) - ay * 0.5
    if (isBlocked(backX, backY) || isBlocked(fwdX, fwdY)) {
      limit = i
      break
    }
  }
  return limit
}

function renderGlobal(ctx: RegionContext, shape: CompiledShape, individual: CompiledShape | undefined): Shape[] {
  const { width, height, mask, layout } = ctx
  const { moduleSize, originX, originY } = layout
  const { labels, components } = labelComponents(mask, width, height)
  const contours = traceContours(mask, width, height, labels)

  const componentRadii = new Map<number, { radii: [number, number, number, number]; scope: Scope }>()
  const radiiFor = (component: Component) => {
    let entry = componentRadii.get(component.id)
    if (!entry) {
      const scope = ctx.scopeAt(component.firstX, component.firstY)
      const reference = Math.min(component.width, component.height) * moduleSize
      const quadrant = shape.align
        ? (scope.corner ??
          quadrantOf(component.x + component.width / 2, component.y + component.height / 2, width, height))
        : 0
      entry = { radii: alignTuple(resolveRadii(shape.radii, reference), quadrant, shape.align), scope }
      componentRadii.set(component.id, entry)
    }
    return entry
  }

  const individualCache = new Map<number, CornerRadii>()
  const individualFor = (x: number, y: number): CornerRadii => {
    const key = y * width + x
    let radii = individualCache.get(key)
    if (!radii) {
      radii = individualRadii(ctx, individual!, x, y)
      individualCache.set(key, radii)
    }
    return radii
  }

  const commandsByComponent = new Map<number, PathCommand[]>()
  for (const contour of contours) {
    const component = components[contour.component]
    const { radii, scope } = radiiFor(component)
    const vertices = contour.vertices
    const n = vertices.length
    const rounded: RoundedVertex[] = new Array(n)
    for (let i = 0; i < n; i++) {
      const v = vertices[i]
      const prev = vertices[(i - 1 + n) % n]
      const next = vertices[(i + 1) % n]
      const edgeIn = (Math.abs(v.x - prev.x) + Math.abs(v.y - prev.y)) * moduleSize
      const edgeOut = (Math.abs(next.x - v.x) + Math.abs(next.y - v.y)) * moduleSize
      const convex = isConvex(v)
      const corner = vertexCorner(v)
      let r = radii[corner] * weightFactor(shape.weight, shape.weight ? vertexDistance(v.x, v.y, scope.box) : 0)
      if (convex && individual) {
        const [mx, my] = convexOwner(v)
        r = Math.max(r, individualFor(mx, my)[corner])
      }
      r = Math.min(r, edgeIn / 2, edgeOut / 2)
      if (!convex && r > 0) {
        const capped = Math.min(r / moduleSize, MAX_CONCAVE_RADIUS_MODULES)
        r = concaveLimit(ctx, v, capped) * moduleSize
      }
      rounded[i] = { x: originX + v.x * moduleSize, y: originY + v.y * moduleSize, r: r > 0 ? r : 0 }
    }
    let commands = commandsByComponent.get(contour.component)
    if (!commands) {
      commands = []
      commandsByComponent.set(contour.component, commands)
    }
    appendRoundedPolygon(commands, rounded)
  }

  const shapes: Shape[] = []
  for (const component of components) {
    const commands = commandsByComponent.get(component.id)
    if (commands && commands.length) shapes.push({ kind: 'path', commands })
  }
  return shapes
}
