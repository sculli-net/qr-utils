/**
 * Style engine for `@sculli/qr-utils/render`.
 *
 * It turns a QR module grid and the user's `color` / `shape` / `modules` props into a {@link RenderPlan}: layers of
 * rectangles and paths in output pixels that every backend (SVG, PNG, HTML) can draw.
 *
 * @module qr-styles
 */

export { buildRenderPlan } from './plan.js'

export type {
  CSSRadiusAttribute,
  VariedLengthTuple,
  BorderRadius,
  BaseQRShape,
  SplitQRShape,
  QRShape,
  QRColor,
  QRStyleProps,
  QRCornerStyleTuple,
  FinderPartsStyle,
  ModulesOption,
} from './types.js'

export type * from './contract.js'

// Helpers that renderers may find useful.
export { parseCSSLength, resolveLength, ROOT_FONT_SIZE_PX, type ParsedLength } from './css-length.js'
export { expandBorderRadius, parseBorderRadius, clampRadii } from './border-radius.js'
export { alignTuple, cornerMapping, quadrantOf, CORNERS } from './corners.js'
export { KAPPA, roundedRectCommands, shapeToPathCommands, pathCommandsToSvg } from './path.js'
