/**
 * Contract between the renderer (`lib/render/src`) and the style engine (`lib/render/src/qr-styles`).
 *
 * The renderer owns layout (size, padding, quiet zone), excavation and output encoding (SVG / PNG / HTML).
 * The style engine owns *geometry*: it turns the QR module grid plus the user's style props
 * (`color`, `shape`, `modules`) into a list of painted layers made of simple primitives,
 * which every output format can draw.
 *
 * Changes to this file must stay backwards compatible (additive only) because both sides depend on it.
 */

/** Function-pattern / region classification of a single module (mirrors `ModuleType` in `@qr-util/core`). */
export type StyleModuleType =
  | 'finder'
  | 'separator'
  | 'timing'
  | 'alignment'
  | 'format'
  | 'version'
  | 'darkModule'
  | 'subFinder'
  | 'cornerFinder'
  | 'extension'
  | 'data'
  | 'ecc'
  | 'remainder'

/** Corner of the symbol, in tuple order used everywhere: top-left, top-right, bottom-right, bottom-left. */
export type StyleCorner = 'top-left' | 'top-right' | 'bottom-right' | 'bottom-left'

/** Per-module information the style engine can query. Coordinates are in modules, origin top-left. */
export interface StyleModule {
  readonly x: number
  readonly y: number
  readonly dark: boolean
  readonly type: StyleModuleType
  /**
   * For modules inside a finder, sub-finder or alignment pattern:
   * `'inner'` = the dark centre (3x3 for finders, 1x1 for alignment/sub-finder),
   * `'outer'` = everything else inside the pattern (the dark ring and the light ring between).
   */
  readonly part?: 'inner' | 'outer'
  /** Index into `StyleMatrix.landmarks()` for modules that belong to a landmark (pattern). */
  readonly landmark?: number
}

/** A function pattern ("landmark") on the symbol. */
export interface StyleLandmark {
  readonly type: StyleModuleType
  /** Bounding box in modules. */
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
  /** Closest symbol corner (always set for finder-like patterns, set for others where meaningful). */
  readonly corner?: StyleCorner
}

/** Read-only view of a generated QR symbol (implemented by `QR` in `@qr-util/core`). */
export interface StyleMatrix {
  /** Symbol width in modules (excluding quiet zone). */
  readonly width: number
  /** Symbol height in modules (excluding quiet zone). Differs from width only for rMQR. */
  readonly height: number
  isDark(x: number, y: number): boolean
  getModule(x: number, y: number): StyleModule
  landmarks(): readonly StyleLandmark[]
}

/**
 * Where the symbol's modules sit in the output, in output pixels.
 * Module (x, y) covers the rect `[originX + x * moduleSize, originY + y * moduleSize, moduleSize, moduleSize]`.
 */
export interface StyleLayout {
  readonly moduleSize: number
  readonly originX: number
  readonly originY: number
  /** Full output width/height in pixels (useful for resolving `%` values against the whole image). */
  readonly outputWidth: number
  readonly outputHeight: number
}

/** Input to the style engine. `TShape`/`TModules` are the style engine's own public option types. */
export interface StyleInput<TShape = unknown, TModules = unknown> {
  readonly matrix: StyleMatrix
  readonly layout: StyleLayout
  /** Foreground colour for everything not overridden by `modules` (any CSS colour string). */
  readonly color: string
  readonly shape?: TShape
  readonly modules?: TModules
  /**
   * Modules the renderer has excavated (e.g. to make room for a logo). Hidden modules must not be painted
   * and must be treated as light when computing merged/global outlines.
   */
  readonly isHidden?: (x: number, y: number) => boolean
}

// ---------------------------------------------------------------------------------------------------------------
// Output geometry. All coordinates are absolute output pixels.
// ---------------------------------------------------------------------------------------------------------------

/** Circular corner radii in output pixels, ordered [top-left, top-right, bottom-right, bottom-left]. */
export type CornerRadii = readonly [number, number, number, number]

/** An axis-aligned rectangle with optional rounded corners (radii already clamped to fit, CSS-style). */
export interface RectShape {
  readonly kind: 'rect'
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
  readonly radii?: CornerRadii
}

/**
 * Path commands. Only absolute move/line/cubic/close are allowed so every backend
 * (SVG `d`, PNG rasteriser, CSS `clip-path: path()`) can consume them directly.
 * Arcs must be approximated with cubic Béziers.
 */
export type PathCommand =
  | readonly ['M', number, number]
  | readonly ['L', number, number]
  | readonly ['C', number, number, number, number, number, number]
  | readonly ['Z']

/**
 * An arbitrary closed outline (one or more subpaths), filled with the **non-zero** rule.
 * Holes must be wound opposite to their outer contour.
 */
export interface PathShape {
  readonly kind: 'path'
  readonly commands: readonly PathCommand[]
}

export type Shape = RectShape | PathShape

/** Which part of the symbol a layer paints. Used for class names / debugging; purely informative. */
export type LayerRegion =
  | 'base'
  | 'finder'
  | 'finder-inner'
  | 'finder-outer'
  | 'alignment'
  | 'timing'

export interface RenderLayer {
  readonly region: LayerRegion
  /** Index of the corner for per-corner finder layers (0 = top-left … 3 = bottom-left). */
  readonly corner?: number
  /** Fill colour (CSS colour string), passed through untouched from the user's options. */
  readonly color: string
  readonly shapes: readonly Shape[]
}

/** Painted in order: later layers paint over earlier ones. */
export interface RenderPlan {
  readonly layers: readonly RenderLayer[]
}

/** Signature the style engine exports as `buildRenderPlan`. */
export type BuildRenderPlan<TShape = unknown, TModules = unknown> = (input: StyleInput<TShape, TModules>) => RenderPlan
