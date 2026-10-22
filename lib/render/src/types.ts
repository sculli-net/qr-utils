import type { ModulesOption, QRColor, QRShape } from './qr-styles/index.js'

/**
 * Options shared by every output format.
 *
 * @example
 * new RenderQR(qr, {
 *   size: 512,
 *   padding: 16,
 *   color: '#1a1a2e',
 *   backgroundColor: null,          // transparent
 *   shape: { borderRadius: '50%' }, // smooth, merged dots
 *   modules: { finder: { color: '#e94560', shape: { borderRadius: 8 } } },
 *   excavate: 60,                   // clear 60% of the safely removable centre for a logo
 * })
 */
export interface RenderOptions {
  /**
   * Output size in pixels of the longest side of the image (padding and quiet zone included).
   * The other side follows the symbol's aspect ratio (rMQR is rectangular).
   *
   * @default 256
   */
  size?: number
  /**
   * Space in pixels between the image border and the quiet zone, added on top of the quiet zone.
   *
   * @default 0
   */
  padding?: number
  /**
   * Blank margin in modules between the symbol and the padding. `true` uses the QR's recommended quiet zone
   * (4 modules for QR Code, 2 for Micro QR and rMQR), `false` disables it, a number sets the width in modules.
   * Scanners need a quiet zone: only disable it when the surrounding area is already light.
   *
   * @default true
   */
  quietZone?: boolean | number
  /**
   * Background colour (any CSS colour). `null` for a transparent background.
   *
   * @default 'white'
   */
  backgroundColor?: QRColor | null
  /**
   * Foreground (dark module) colour, any CSS colour.
   *
   * @default 'black'
   */
  color?: QRColor
  /**
   * Clears data modules in the centre of the symbol to make room for a logo, relying on error correction to
   * restore them. Function patterns (finder, alignment, timing…) are never removed.
   *
   * - `false` / `0` (default) nothing is removed
   * - a number from 0–100: the share of the largest safely removable area to clear
   * - `true` the same as `100`
   *
   * The removable area is computed from the symbol's actual codeword layout so that every error correction block
   * keeps a safety margin. Higher error correction levels (`Q`, `H`) leave much more room.
   * The cleared area is available as {@link RenderQR.excavation} for positioning the logo.
   *
   * @default false
   */
  excavate?: boolean | number
  /** Shape of the dots / the merged outline. See {@link QRShape}. Plain squares when omitted. */
  shape?: QRShape
  /** Separate styles for function patterns (finder, alignment, timing). See {@link ModulesOption}. */
  modules?: ModulesOption
  /** `class` attribute of the root element (SVG and HTML outputs). */
  className?: string
  /**
   * DEFLATE compression level for PNG output, 0 (none, fastest) to 9 (smallest).
   *
   * @default 6
   */
  compression?: number
}

/** Output-specific options for {@link RenderQR.toSVG}. */
export interface SVGOptions {
  /** `class` attribute of the `<svg>` element. */
  className?: string
}

/** Output-specific options for {@link RenderQR.toHTML}. */
export interface HTMLOptions {
  /** `class` attribute of the root `<div>`. */
  className?: string
}

/** Output-specific options for {@link RenderQR.toPNG}. */
export interface PNGOptions {
  /** DEFLATE compression level 0–9. */
  compression?: number
}

/** Pixel geometry of the rendered image. */
export interface RenderLayoutInfo {
  /** Image width in pixels. */
  readonly width: number
  /** Image height in pixels. */
  readonly height: number
  /** Size of one module in pixels. */
  readonly moduleSize: number
  /** Quiet zone width in modules. */
  readonly quietZone: number
  /** Padding in pixels. */
  readonly padding: number
  /** Pixel position of the symbol's top-left module. */
  readonly originX: number
  readonly originY: number
}

/** The cleared logo area. */
export interface Excavation {
  /** Area in output pixels. */
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
  /** Area in modules (symbol coordinates). */
  readonly modules: { readonly x: number; readonly y: number; readonly width: number; readonly height: number }
  /** Number of data/ECC modules removed. */
  readonly removedModules: number
}

/** RGBA pixel buffer (compatible with the DOM `ImageData` constructor). */
export interface RGBAImage {
  readonly width: number
  readonly height: number
  readonly data: Uint8ClampedArray
}
