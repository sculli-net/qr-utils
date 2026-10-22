import type {
  BuildRenderPlan,
  LayerRegion,
  RenderLayer,
  RenderPlan,
  StyleInput,
  StyleLandmark,
  StyleMatrix,
} from './contract.js'
import { cornerIndex, quadrantOf } from './corners.js'
import type { Box } from './distance.js'
import { renderRegion, type Scope } from './region.js'
import type { FinderPartsStyle, ModulesOption, QRCornerStyleTuple, QRShape, QRStyleProps } from './types.js'

type FinderLookup = (corner: number, part: 'inner' | 'outer') => { style: QRStyleProps; region: LayerRegion } | undefined

function assertStyle(value: unknown, where: string): asserts value is QRStyleProps {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new TypeError(`Invalid modules.${where}: expected an object such as { color: "red" }, got ${JSON.stringify(value)}.`)
  }
}

function cornerLookup(value: QRCornerStyleTuple | undefined, where: string): (corner: number) => QRStyleProps | undefined {
  if (value === undefined || value === null) return () => undefined
  if (Array.isArray(value)) {
    if (value.length > 4) {
      throw new TypeError(`Invalid modules.${where}: a corner tuple has at most 4 entries (top-left, top-right, bottom-right, bottom-left).`)
    }
    value.forEach((entry, i) => {
      if (entry !== null && entry !== undefined) assertStyle(entry, `${where}[${i}]`)
    })
    return (corner) => (value[corner] ?? undefined) as QRStyleProps | undefined
  }
  assertStyle(value, where)
  const style = value as QRStyleProps
  return () => style
}

function isFinderParts(value: unknown): value is FinderPartsStyle {
  return typeof value === 'object' && value !== null && !Array.isArray(value) && ('inner' in value || 'outer' in value)
}

function compileFinder(option: ModulesOption['finder']): FinderLookup | undefined {
  if (option === undefined || option === null) return undefined
  if (isFinderParts(option)) {
    const inner = cornerLookup(option.inner, 'finder.inner')
    const outer = cornerLookup(option.outer, 'finder.outer')
    return (corner, part) => {
      const style = part === 'inner' ? inner(corner) : outer(corner)
      return style ? { style, region: part === 'inner' ? 'finder-inner' : 'finder-outer' } : undefined
    }
  }
  const all = cornerLookup(option, 'finder')
  return (corner) => {
    const style = all(corner)
    return style ? { style, region: 'finder' } : undefined
  }
}

interface LayerSpec {
  readonly region: LayerRegion
  readonly corner?: number
  readonly style: QRStyleProps
  readonly order: number
  readonly mask: Uint8Array
  /** Bounding box of cells that have no landmark (fallback scope). */
  minX: number
  minY: number
  maxX: number
  maxY: number
}

const REGION_RANK: Record<string, number> = { finder: 0, 'finder-outer': 1, 'finder-inner': 2 }

function landmarkCorner(landmark: StyleLandmark | undefined, matrix: StyleMatrix): number | undefined {
  if (!landmark) return undefined
  if (landmark.corner) return cornerIndex(landmark.corner)
  return quadrantOf(landmark.x + landmark.width / 2, landmark.y + landmark.height / 2, matrix.width, matrix.height)
}

/**
 * Builds the {@link RenderPlan} for a symbol: the base layer (every dark, visible module not claimed by `modules`)
 * followed by one layer per styled pattern. The order is finders (by corner; whole finder or ring before eye),
 * then alignment, then timing.
 */
export const buildRenderPlan: BuildRenderPlan<QRShape, ModulesOption> = (
  input: StyleInput<QRShape, ModulesOption>,
): RenderPlan => {
  const { matrix, layout } = input
  const width = matrix.width
  const height = matrix.height
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) {
    throw new RangeError(`Invalid matrix size ${width}x${height}.`)
  }
  if (!(layout.moduleSize > 0) || !Number.isFinite(layout.moduleSize)) {
    throw new RangeError(`Invalid moduleSize ${layout.moduleSize}. Expected a positive finite number.`)
  }
  const isHidden = input.isHidden
  const count = width * height
  const dark = new Uint8Array(count)
  const hidden = new Uint8Array(count)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x
      if (isHidden && isHidden(x, y)) hidden[i] = 1
      else if (matrix.isDark(x, y)) dark[i] = 1
    }
  }

  const modules = input.modules
  if (modules !== undefined && modules !== null && (typeof modules !== 'object' || Array.isArray(modules))) {
    throw new TypeError(`Invalid modules option: expected an object, got ${JSON.stringify(modules)}.`)
  }
  const finder = compileFinder(modules?.finder)
  if (modules?.alignment) assertStyle(modules.alignment, 'alignment')
  if (modules?.timing) assertStyle(modules.timing, 'timing')
  const alignment = modules?.alignment ?? undefined
  const timing = modules?.timing ?? undefined

  const layerOf = new Int32Array(count).fill(-1)
  const landmarkOf = new Int32Array(count).fill(-1)
  const specs: LayerSpec[] = []
  const keys = new Map<string, number>()
  let patternScope: ((layer: number, x: number, y: number) => Scope) | undefined

  if (finder || alignment || timing) {
    const landmarks = matrix.landmarks()
    const claim = (key: string, make: () => Omit<LayerSpec, 'mask' | 'minX' | 'minY' | 'maxX' | 'maxY'>) => {
      let index = keys.get(key)
      if (index === undefined) {
        index = specs.length
        specs.push({ ...make(), mask: new Uint8Array(count), minX: width, minY: height, maxX: -1, maxY: -1 })
        keys.set(key, index)
      }
      return index
    }
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = y * width + x
        if (!dark[i]) continue
        const module = matrix.getModule(x, y)
        let index = -1
        if (finder && (module.type === 'finder' || module.type === 'subFinder')) {
          const landmark = module.landmark !== undefined ? landmarks[module.landmark] : undefined
          const corner =
            landmarkCorner(landmark, matrix) ??
            (module.type === 'subFinder' ? 2 : quadrantOf(x + 0.5, y + 0.5, width, height))
          const part = module.part ?? 'outer'
          const found = finder(corner, part)
          if (found) {
            const key = `finder|${module.landmark ?? `c${corner}`}|${found.region}`
            index = claim(key, () => ({
              region: found.region,
              corner,
              style: found.style,
              order: corner * 10 + (REGION_RANK[found.region] ?? 0),
            }))
          }
        } else if (alignment && module.type === 'alignment') {
          index = claim('alignment', () => ({ region: 'alignment', style: alignment, order: 100 }))
        } else if (timing && module.type === 'timing') {
          index = claim('timing', () => ({ region: 'timing', style: timing, order: 200 }))
        }
        if (index < 0) continue
        layerOf[i] = index
        const spec = specs[index]
        spec.mask[i] = 1
        if (module.landmark !== undefined && landmarks[module.landmark]) {
          landmarkOf[i] = module.landmark
        } else {
          if (x < spec.minX) spec.minX = x
          if (y < spec.minY) spec.minY = y
          if (x > spec.maxX) spec.maxX = x
          if (y > spec.maxY) spec.maxY = y
        }
      }
    }

    // Scopes: one per landmark, plus one fallback per layer for cells without a landmark.
    const landmarkScopes = new Map<number, Scope>()
    const fallbackScopes = specs.map<Scope>((spec) => {
      const box: Box =
        spec.maxX >= 0
          ? { x: spec.minX, y: spec.minY, width: spec.maxX - spec.minX + 1, height: spec.maxY - spec.minY + 1 }
          : { x: 0, y: 0, width, height }
      const corner =
        spec.corner ?? (spec.maxX >= 0 ? quadrantOf(box.x + box.width / 2, box.y + box.height / 2, width, height) : undefined)
      return { box, corner }
    })
    patternScope = (layer: number, x: number, y: number): Scope => {
      const i = y * width + x
      const lm = landmarkOf[i]
      if (lm < 0) return fallbackScopes[layer]
      let scope = landmarkScopes.get(lm)
      if (!scope) {
        const landmark = landmarks[lm]
        scope = {
          box: { x: landmark.x, y: landmark.y, width: landmark.width, height: landmark.height },
          corner: specs[layer].corner ?? landmarkCorner(landmark, matrix),
        }
        landmarkScopes.set(lm, scope)
      }
      return scope
    }
  }

  const blockedFor = (mask: Uint8Array) => (x: number, y: number) => {
    const i = y * width + x
    return !mask[i] && (hidden[i] === 1 || dark[i] === 1)
  }

  const baseMask = new Uint8Array(count)
  for (let i = 0; i < count; i++) if (dark[i] && layerOf[i] < 0) baseMask[i] = 1
  const symbolScope: Scope = { box: { x: 0, y: 0, width, height } }

  const layers: RenderLayer[] = [
    {
      region: 'base',
      color: input.color,
      shapes: renderRegion(
        { width, height, layout, mask: baseMask, blocked: blockedFor(baseMask), scopeAt: () => symbolScope },
        input.shape,
      ),
    },
  ]

  const ordered = specs.map((spec, index) => ({ spec, index })).sort((a, b) => a.spec.order - b.spec.order)
  for (const { spec, index } of ordered) {
    const scopeAt = (x: number, y: number) => patternScope!(index, x, y)
    const layer: RenderLayer = {
      region: spec.region,
      ...(spec.corner !== undefined && spec.region.startsWith('finder') ? { corner: spec.corner } : {}),
      color: spec.style.color ?? input.color,
      shapes: renderRegion({ width, height, layout, mask: spec.mask, blocked: blockedFor(spec.mask), scopeAt }, spec.style.shape),
    }
    layers.push(layer)
  }

  return { layers }
}
