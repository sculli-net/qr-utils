/**
 * Public style option types for the `shape` and `modules` renderer props.
 *
 * These types surface directly in users' editors, so every field carries a description and examples.
 */

/**
 * A single CSS-like length used for corner radii.
 *
 * - `number` - output pixels (`8` is the same as `"8px"`).
 * - `string` - a number with an optional unit:
 *   - `"8"` / `"8px"`: output pixels.
 *   - `"50%"`: a percentage of the element being rounded. For individual dots that is the module size, for
 *     global outlines it is the smaller side of the outline's bounding box (so `"50%"` always produces a
 *     circle / pill rather than an ellipse).
 *   - `"1rem"` / `"1em"`: multiples of 16px (there is no DOM, so both use the default root font size).
 *
 * Negative values are rejected, as they are in CSS.
 *
 * @example 4
 * @example "4px"
 * @example "50%"
 * @example "0.25rem"
 */
export type CSSRadiusAttribute = string | number

/**
 * One to four radius values, following the CSS `border-radius` shorthand rules.
 *
 * Values are ordered `[top-left, top-right, bottom-right, bottom-left]` and missing values are filled in
 * exactly as CSS does:
 *
 * | Values           | top-left | top-right | bottom-right | bottom-left |
 * | ---------------- | -------- | --------- | ------------ | ----------- |
 * | `a`              | a        | a         | a            | a           |
 * | `[a, b]`         | a        | b         | a            | b           |
 * | `[a, b, c]`      | a        | b         | c            | b           |
 * | `[a, b, c, d]`   | a        | b         | c            | d           |
 *
 * When `alignmentOffset` is enabled the tuple is *relative to the closest symbol corner* instead of
 * fixed to the screen (see {@link BaseQRShape.alignmentOffset}).
 *
 * @example 6
 * @example "25%"
 * @example ["50%", 0]
 * @example [8, "2px", 8, "2px"]
 */
export type VariedLengthTuple =
  | CSSRadiusAttribute
  | readonly [CSSRadiusAttribute, CSSRadiusAttribute?, CSSRadiusAttribute?, CSSRadiusAttribute?]

/**
 * A border radius: a single length, a CSS shorthand string with 1-4 space separated lengths, or a tuple.
 * Elliptical radii (`"10px / 5px"`) are not supported.
 *
 * @example 8
 * @example "50%"
 * @example "0 20 0 20"
 * @example ["20px", "5%"]
 */
export type BorderRadius = VariedLengthTuple

/**
 * How a set of modules is rounded.
 *
 * @example
 * // Rounded corners
 * { borderRadius: 4 }
 *
 * @example
 * // Leaf-shaped dots that "point" towards the centre of the code from every quadrant
 * { borderRadius: ["50%", 0], alignmentOffset: true }
 *
 * @example
 * // Dots become rounder towards the edges of the code
 * { borderRadius: "50%", distanceWeight: [0, 1] }
 */
export interface BaseQRShape {
  /**
   * Corner radii, using CSS `border-radius` semantics.
   *
   * Radii are clamped the way CSS clamps them: if two adjacent radii add up to more than the side they share,
   * all radii of that element are scaled down uniformly. Global outlines additionally clamp each corner to half
   * of the shorter edge it touches, so neighbouring corners can never overlap.
   *
   * @default 0
   * @example 6
   * @example "50%"
   * @example "0 50% 0 50%"
   * @example ["50%", 0, "50%", 0]
   */
  borderRadius?: BorderRadius
  /**
   * Rotates the corner mapping of {@link borderRadius} so it is relative to the symbol corner the element is
   * closest to, instead of fixed to the screen.
   *
   * The tuple is written as if the element were in the top-left quadrant (`[tl, tr, br, bl]`). Then:
   *
   * - top-left quadrant: `[tl, tr, br, bl]` (unchanged)
   * - top-right quadrant: rotated 90° clockwise once, the values apply to `[tr, br, bl, tl]`
   * - bottom-right quadrant: rotated twice, the values apply to `[br, bl, tl, tr]`
   * - bottom-left quadrant: rotated three times, the values apply to `[bl, tl, tr, br]`
   *
   * `'mirror'` applies the same rotation and then swaps the 2nd and 4th entries for every quadrant except
   * top-left. The aligned corner and its diagonal opposite stay in place and the two adjacent corners trade places,
   * so the shapes in each quadrant are reflections of the top-left shapes rather than rotations of them.
   * For example, in the top-right quadrant the values apply to `[tr, tl, bl, br]`.
   *
   * The quadrant comes from the element's centre compared with the symbol's centre. For non-square rMQR symbols
   * this is the centre of the rectangle. Elements of a function pattern (finder, alignment, ...) use the pattern's
   * corner, so a whole finder pattern rotates as one. Global outlines in the main layer use the centre of each
   * connected blob.
   *
   * @default false
   * @example
   * // Every finder eye gets one sharp corner pointing at the centre of the code
   * { borderRadius: [8, 8, 0, 8], alignmentOffset: true }
   * @example { borderRadius: [8, 0, 8, 0], alignmentOffset: 'mirror' }
   */
  alignmentOffset?: boolean | 'mirror'
  /**
   * Scales the radii by how far the element is from the centre of its object. The first value (`near`) applies at
   * the centre and the second value (`far`) at the edge, with linear interpolation in between.
   *
   * The "object" is the whole symbol for the main layer, or the pattern's bounding box for layers styled through
   * `modules` (for example one finder pattern). Distance is the normalised **Chebyshev** distance: the larger of
   * `|dx| / halfWidth` and `|dy| / halfHeight`. It follows the square shape of a QR code, so every module on the
   * outer edge counts as distance `1` and the centre module counts as `0`. Individual dots measure from their
   * centre, and global outlines measure at each outline corner.
   *
   * Values are usually in the 0-1 range. Values above 1 increase the radius, which is still clamped to fit.
   *
   * @example
   * // sharp in the middle, fully rounded at the edges
   * { borderRadius: "50%", distanceWeight: [0, 1] }
   * @example
   * // round in the middle, square at the edges
   * { borderRadius: "50%", distanceWeight: [1, 0] }
   */
  distanceWeight?: readonly [number, number]
}

/**
 * Split form of {@link QRShape}: style individual dots and the merged outline separately.
 *
 * - `individual` rounds every module as its own square. Adjacent dots no longer touch at their rounded corners,
 *   which gives the classic "dots" look.
 * - `global` traces the outline of every 4-connected group of dark modules and rounds that outline, which gives
 *   "liquid" blobs. Convex (outer) corners are rounded with the radius. Concave (inner) corners get an inverse
 *   fillet of the same radius, so the inside of an L-shape is filled with a smooth curve.
 *
 * **When both are set** the merged outline is used, so dots stay connected, and the two styles combine per corner:
 * - convex corners use the larger of the global radius and the individual radius of the module that owns the corner,
 * - concave corners use the global radius only, because individual dots have no inner corners.
 *
 * So `individual` sets the minimum roundness of every dot corner, and `global` controls the overall outline and
 * the liquid inner fillets.
 *
 * @example
 * // Circle dots
 * { individual: { borderRadius: "50%" } }
 * @example
 * // Liquid blobs whose free-standing dots are circles
 * { individual: { borderRadius: "50%" }, global: { borderRadius: 3 } }
 */
export interface SplitQRShape {
  /** Style applied to every module (dot) on its own. */
  individual?: BaseQRShape
  /** Style applied to the merged outline of connected modules. */
  global?: BaseQRShape
  borderRadius?: never
  alignmentOffset?: never
  distanceWeight?: never
}

/**
 * Shape of the QR modules.
 *
 * Without `individual` / `global` the options apply to the **global** outline, so `{ borderRadius: 4 }` is
 * shorthand for `{ global: { borderRadius: 4 } }`. The outline of each connected group of dark modules is traced
 * and rounded as a single shape.
 *
 * Without a shape every module is a plain square.
 *
 * @example { borderRadius: 4 }
 * @example { global: { borderRadius: "50%" } }
 * @example { individual: { borderRadius: "50%" } }
 * @example { individual: { borderRadius: "50%", distanceWeight: [0.3, 1] }, global: { borderRadius: 2 } }
 */
export type QRShape = (BaseQRShape & { individual?: never; global?: never }) | SplitQRShape

/**
 * Any CSS colour string. It is passed through to the output unchanged.
 *
 * @example "black"
 * @example "#0f172a"
 * @example "rgb(15 23 42 / 0.9)"
 * @example "var(--qr-foreground)"
 */
export type QRColor = string

/**
 * Style for a group of modules. Both fields are optional. A missing `color` falls back to the renderer's `color`,
 * and a missing `shape` renders plain squares.
 *
 * @example { color: "#e11d48" }
 * @example { shape: { borderRadius: "50%" } }
 * @example { color: "navy", shape: { borderRadius: 6 } }
 */
export interface QRStyleProps {
  /** Fill colour for these modules. Defaults to the renderer's `color`. */
  color?: QRColor
  /** Shape for these modules. Defaults to plain squares. */
  shape?: QRShape
}

/**
 * Either one style for every corner, or a tuple with one entry per symbol corner, ordered
 * `[top-left, top-right, bottom-right, bottom-left]`.
 *
 * A `null` / `undefined` entry leaves that corner's pattern in the main layer with the main style.
 *
 * Model 2 QR codes have finder patterns at top-left, top-right and bottom-left, so the bottom-right entry only
 * applies to rMQR's bottom-right sub-finder pattern. Micro QR has a single top-left finder.
 *
 * @example { color: "crimson" }
 * @example [{ color: "crimson" }, null, null, { color: "teal" }]
 */
export type QRCornerStyleTuple =
  | QRStyleProps
  | readonly [
      QRStyleProps | null | undefined,
      (QRStyleProps | null | undefined)?,
      (QRStyleProps | null | undefined)?,
      (QRStyleProps | null | undefined)?,
    ]

/**
 * Finder style split into the 3x3 centre ("eye", `inner`) and the 7x7 ring (`outer`).
 *
 * @example { outer: { shape: { borderRadius: "30%" } }, inner: { color: "crimson", shape: { borderRadius: "50%" } } }
 */
export interface FinderPartsStyle {
  /** The dark centre of the finder pattern: 3x3 for finders, 1x1 for the rMQR sub-finder. */
  inner?: QRCornerStyleTuple
  /** The ring of the finder pattern. With a global shape it renders as one ring with a hole. */
  outer?: QRCornerStyleTuple
}

/**
 * Style overrides for individual function patterns.
 *
 * A pattern listed here is removed from the main layer and drawn in its own layer, on top of the main layer,
 * with its own `color` and `shape`. Inside these layers, `%` radii and `distanceWeight` are relative to the
 * pattern itself, and `alignmentOffset` uses the corner of the pattern.
 *
 * @example
 * // Round, red finder patterns
 * { finder: { color: "red", shape: { borderRadius: "50%" } } }
 *
 * @example
 * // Square rings with round eyes, but only the top-left eye is blue
 * {
 *   finder: {
 *     outer: { shape: { borderRadius: 4 } },
 *     inner: [{ color: "blue", shape: { borderRadius: "50%" } }, { shape: { borderRadius: "50%" } }, null, { shape: { borderRadius: "50%" } }],
 *   },
 *   alignment: { color: "gray" },
 * }
 */
export interface ModulesOption {
  /**
   * Finder patterns (the three large "eyes"). Accepts one style for all finders, a per-corner tuple, or an
   * `{ inner, outer }` object to style the centre and the ring separately (each of those also accepts a tuple).
   *
   * A single style also applies to rMQR's sub-finder pattern (bottom-right). With a tuple, the sub-finder uses the
   * bottom-right entry. rMQR corner patterns (`cornerFinder`) always stay in the main layer.
   */
  finder?: QRCornerStyleTuple | FinderPartsStyle
  /** Alignment patterns (the smaller 5x5 squares in version 2+ symbols). */
  alignment?: QRStyleProps
  /** Timing patterns (the alternating lines between the finders). */
  timing?: QRStyleProps
}
