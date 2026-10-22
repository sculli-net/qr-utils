import type { QR } from '../../core/src/index.js'
import { parseColor } from './color.js'
import { computeExcavation, type ExcavationArea } from './excavate.js'
import { encodePNG } from './png.js'
import { buildRenderPlan, type RenderPlan, shapeToPathCommands } from './qr-styles/index.js'
import { compositeOver, CoverageRaster } from './raster.js'
import { toHTMLString, toSVGString } from './serialize.js'
import type {
  Excavation,
  HTMLOptions,
  PNGOptions,
  RenderLayoutInfo,
  RenderOptions,
  RGBAImage,
  SVGOptions,
} from './types.js'

/** Output formats of {@link RenderQR.render}. */
export type RenderFormat = 'svg' | 'png' | 'html'

function base64(bytes: Uint8Array): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
  let out = ''
  for (let i = 0; i < bytes.length; i += 3) {
    const n = (bytes[i]! << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0)
    out += alphabet[(n >>> 18) & 63]! + alphabet[(n >>> 12) & 63]!
    out += i + 1 < bytes.length ? alphabet[(n >>> 6) & 63]! : '='
    out += i + 2 < bytes.length ? alphabet[n & 63]! : '='
  }
  return out
}

function computeLayout(qr: QR, options: RenderOptions): RenderLayoutInfo {
  const size = options.size ?? 256
  const padding = options.padding ?? 0
  const quietZoneOption = options.quietZone ?? true
  if (typeof size !== 'number' || !Number.isFinite(size) || size <= 0) {
    throw new RangeError(`size must be a positive number of pixels. Received: ${String(options.size)}`)
  }
  if (typeof padding !== 'number' || !Number.isFinite(padding) || padding < 0) {
    throw new RangeError(`padding must be a non-negative number of pixels. Received: ${String(options.padding)}`)
  }
  const quietZone = quietZoneOption === true ? qr.quietZone : quietZoneOption === false ? 0 : quietZoneOption
  if (!Number.isInteger(quietZone) || quietZone < 0) {
    throw new RangeError(`quietZone must be a boolean or a non-negative integer. Received: ${String(options.quietZone)}`)
  }
  const columns = qr.width + quietZone * 2
  const rows = qr.height + quietZone * 2
  const moduleSize = (size - padding * 2) / Math.max(columns, rows)
  if (moduleSize <= 0) throw new RangeError(`padding (${padding}px) leaves no room for the symbol in a ${size}px image.`)
  const width = columns >= rows ? size : Math.round(columns * moduleSize + padding * 2)
  const height = rows >= columns ? size : Math.round(rows * moduleSize + padding * 2)
  return {
    width,
    height,
    moduleSize,
    quietZone,
    padding,
    originX: (width - qr.width * moduleSize) / 2,
    originY: (height - qr.height * moduleSize) / 2,
  }
}

/**
 * Renders a `QR` from `@sculli/qr-utils/core` as SVG (default), PNG or HTML.
 *
 * @example
 * import { QR } from '@sculli/qr-utils/core'
 * import { RenderQR } from '@sculli/qr-utils/render'
 *
 * const qr = new QR('https://web-site.com')
 * const renderer = new RenderQR(qr, { size: 300, color: '#222' })
 * const svg = renderer.toSVG()        // or renderer.render()
 * const png = renderer.toPNG()        // Uint8Array
 * const html = renderer.toHTML()      // <div> based markup
 */
export class RenderQR {
  readonly qr: QR
  readonly options: Readonly<RenderOptions>
  readonly #layout: RenderLayoutInfo
  readonly #area: ExcavationArea | undefined
  #plan: RenderPlan | undefined

  /**
   * @param qr a QR code created with `new QR()` from `@sculli/qr-utils/core`.
   * @param options size, colours, quiet zone, padding, shapes, module styles and excavation.
   */
  constructor(qr: QR, options: RenderOptions = {}) {
    this.qr = qr
    this.options = { ...options }
    this.#layout = computeLayout(qr, options)
    this.#area = computeExcavation(qr, options.excavate)
    this.#plan = undefined
    // Build eagerly so invalid style options fail at construction
    this.#getPlan()
  }

  /** Pixel geometry of the output: image size, module size and symbol origin. */
  get layout(): RenderLayoutInfo {
    return this.#layout
  }

  /**
   * The area cleared by `excavate`, in output pixels and modules, or `null` when nothing was removed.
   * Use it to position a logo over the symbol.
   *
   * @example
   * const { x, y, width, height } = renderer.excavation!
   * svg.replace('</svg>', `<image href="logo.svg" x="${x}" y="${y}" width="${width}" height="${height}"/></svg>`)
   */
  get excavation(): Excavation | null {
    const area = this.#area
    if (!area) return null
    const { moduleSize, originX, originY } = this.#layout
    return {
      x: originX + area.x * moduleSize,
      y: originY + area.y * moduleSize,
      width: area.width * moduleSize,
      height: area.height * moduleSize,
      modules: { x: area.x, y: area.y, width: area.width, height: area.height },
      removedModules: area.removedModules,
    }
  }

  /** The geometry (layers of shapes in output pixels) every output format draws. */
  get plan(): RenderPlan {
    return this.#getPlan()
  }

  #getPlan(): RenderPlan {
    this.#plan ??= buildRenderPlan({
      matrix: this.qr,
      layout: {
        moduleSize: this.#layout.moduleSize,
        originX: this.#layout.originX,
        originY: this.#layout.originY,
        outputWidth: this.#layout.width,
        outputHeight: this.#layout.height,
      },
      color: this.options.color ?? 'black',
      ...(this.options.shape !== undefined && { shape: this.options.shape }),
      ...(this.options.modules !== undefined && { modules: this.options.modules }),
      ...(this.#area && { isHidden: this.#area.isHidden }),
    })
    return this.#plan
  }

  #background(): string | null {
    return this.options.backgroundColor === undefined ? 'white' : this.options.backgroundColor
  }

  /** Renders in the given format (SVG by default). */
  render(format: 'svg'): string
  render(format: 'html'): string
  render(format: 'png'): Uint8Array
  render(): string
  render(format: RenderFormat = 'svg'): string | Uint8Array {
    if (format === 'svg') return this.toSVG()
    if (format === 'png') return this.toPNG()
    if (format === 'html') return this.toHTML()
    throw new TypeError(`Unknown render format '${String(format)}'. Expected 'svg', 'png' or 'html'.`)
  }

  /** SVG markup (`<svg>…</svg>`). Each layer is one `<path>` with a `qr-{region}` class. */
  toSVG(options: SVGOptions = {}): string {
    return toSVGString(this.#getPlan(), this.#layout, this.#background(), options.className ?? this.options.className)
  }

  /**
   * HTML markup: a relatively positioned `<div>` containing absolutely positioned `<div>`s for the modules
   * (rounded corners via `border-radius`, merged outlines via `clip-path: path()`).
   */
  toHTML(options: HTMLOptions = {}): string {
    return toHTMLString(this.#getPlan(), this.#layout, this.#background(), options.className ?? this.options.className)
  }

  /** Creates a DOM element from {@link toHTML}. Requires a DOM (`document`). */
  toElement(doc: Document | undefined = globalThis.document): HTMLElement {
    if (!doc) throw new Error('toElement() requires a DOM document. Use toHTML() in non-browser environments.')
    const template = doc.createElement('template')
    template.innerHTML = this.toHTML()
    return template.content.firstElementChild as HTMLElement
  }

  /** Anti-aliased RGBA pixels, e.g. for `new ImageData(pixels.data, pixels.width, pixels.height)` on a canvas. */
  toPixels(): RGBAImage {
    const { width, height } = this.#layout
    const pixelWidth = Math.max(1, Math.round(width))
    const pixelHeight = Math.max(1, Math.round(height))
    const image = new Float32Array(pixelWidth * pixelHeight * 4)
    const background = this.#background()
    if (background !== null) {
      const color = parseColor(background)
      for (let i = 0; i < image.length; i += 4) {
        image[i] = color.r
        image[i + 1] = color.g
        image[i + 2] = color.b
        image[i + 3] = color.a
      }
    }
    for (const layer of this.#getPlan().layers) {
      if (!layer.shapes.length) continue
      const raster = new CoverageRaster(pixelWidth, pixelHeight)
      for (const shape of layer.shapes) raster.addPath(shapeToPathCommands(shape))
      compositeOver(image, raster.coverage(), parseColor(layer.color))
    }
    const data = new Uint8ClampedArray(image.length)
    for (let i = 0; i < image.length; i += 4) {
      data[i] = Math.round(image[i]!)
      data[i + 1] = Math.round(image[i + 1]!)
      data[i + 2] = Math.round(image[i + 2]!)
      data[i + 3] = Math.round(image[i + 3]! * 255)
    }
    return { width: pixelWidth, height: pixelHeight, data }
  }

  /** PNG file bytes. */
  toPNG(options: PNGOptions = {}): Uint8Array {
    const compression = options.compression ?? this.options.compression ?? 6
    if (!Number.isInteger(compression) || compression < 0 || compression > 9) {
      throw new RangeError(`compression must be an integer from 0 to 9. Received: ${String(compression)}`)
    }
    return encodePNG(this.toPixels(), compression)
  }

  /** A `data:` URL for `<img src>` (SVG by default). */
  toDataURL(format: 'svg' | 'png' = 'svg'): string {
    if (format === 'png') return `data:image/png;base64,${base64(this.toPNG())}`
    return `data:image/svg+xml;base64,${base64(new TextEncoder().encode(this.toSVG()))}`
  }

  /** The SVG markup. */
  toString(): string {
    return this.toSVG()
  }
}
