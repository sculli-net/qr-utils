/**
 * @sculli/qr-utils/render — render QR codes from `@sculli/qr-utils/core` as SVG, PNG or HTML.
 *
 * @packageDocumentation
 */
import { QR, type QRData, type QROptions } from '../../core/src/index.js'
import { type RenderFormat, RenderQR } from './renderer.js'
import type { RenderOptions } from './types.js'

export { RenderQR } from './renderer.js'
export type { RenderFormat } from './renderer.js'
export type {
  Excavation,
  HTMLOptions,
  PNGOptions,
  RenderLayoutInfo,
  RenderOptions,
  RGBAImage,
  SVGOptions,
} from './types.js'
export { parseColor } from './color.js'
export type { RGBA } from './color.js'
export type {
  BaseQRShape,
  BorderRadius,
  CornerRadii,
  CSSRadiusAttribute,
  FinderPartsStyle,
  LayerRegion,
  ModulesOption,
  PathCommand,
  PathShape,
  QRColor,
  QRCornerStyleTuple,
  QRShape,
  QRStyleProps,
  RectShape,
  RenderLayer,
  RenderPlan,
  Shape,
  SplitQRShape,
  VariedLengthTuple,
} from './qr-styles/index.js'

/** Options for {@link renderQR}. */
export type RenderQROptions<F extends RenderFormat = RenderFormat> = RenderOptions & {
  /** Output format. @default 'svg' */
  format?: F
  /** Options for generating the QR code when `renderQR` is given data instead of a `QR`. */
  qr?: QROptions
}

/**
 * One-call rendering: accepts a `QR` (or the data to create one) and returns SVG markup by default,
 * PNG bytes for `format: 'png'` or HTML markup for `format: 'html'`.
 *
 * @example
 * const svg = renderQR('https://web-site.com')
 * const png = renderQR('https://web-site.com', { format: 'png', size: 512, qr: { errorCorrection: 'H' } })
 */
export function renderQR<F extends RenderFormat = 'svg'>(
  input: QR | QRData,
  options?: RenderQROptions<F>,
): F extends 'png' ? Uint8Array : string {
  const { format = 'svg', qr: qrOptions, ...renderOptions } = (options ?? {}) as RenderQROptions
  const qr = input instanceof QR ? input : new QR(input, qrOptions)
  return new RenderQR(qr, renderOptions).render(format as 'svg') as F extends 'png' ? Uint8Array : string
}
