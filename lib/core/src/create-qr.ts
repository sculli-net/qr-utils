import { QR, type QRBitmap } from './qr.js'
import type { ModuleType, QRData, QRModule, QROptions } from './types.js'

/**
 * Output format of {@link createQR}.
 *
 * - `'matrix'` (default) `boolean[][]` rows, `true` = dark
 * - `'binary'` `(0 | 1)[][]` rows, `1` = dark
 * - `'bitmap'` `{ width, height, data: Uint8Array }` packed row-major bytes, `1` = dark
 * - `'points'` `{ x, y }[]` coordinates of every dark module
 * - `'modules'` `QRModule[][]` rows with module type, landmark and codeword details
 * - `'types'` `ModuleType[][]` rows of module classifications
 * - `'text'` a string, two block characters per dark module (handy for terminals)
 * - `'qr'` the {@link QR} instance itself
 */
export type QRFormat = 'matrix' | 'binary' | 'bitmap' | 'points' | 'modules' | 'types' | 'text' | 'qr'

/** Result type of {@link createQR} for each format. */
export interface QRFormatResult {
  matrix: boolean[][]
  binary: (0 | 1)[][]
  bitmap: QRBitmap
  points: { x: number; y: number }[]
  modules: QRModule[][]
  types: ModuleType[][]
  text: string
  qr: QR
}

/** Options for {@link createQR}: every {@link QROptions} field plus the output format. */
export type CreateQROptions<F extends QRFormat = QRFormat> = QROptions & {
  /** Output format. @default 'matrix' */
  format?: F
  /**
   * Include the quiet zone (`true` for the symbol's recommended width, or a number of modules) in matrix,
   * bitmap, points and text outputs.
   *
   * @default false
   */
  includeQuietZone?: boolean | number
}

/**
 * Generates a QR Code and returns it in the requested format (a boolean dot matrix by default).
 *
 * @example
 * const dots = createQR('https://web-site.com')                       // boolean[][]
 * const bitmap = createQR('https://web-site.com', { format: 'bitmap' }) // { width, height, data }
 * const micro = createQR('12345', { symbol: 'micro', format: 'text' })
 */
export function createQR<F extends QRFormat = 'matrix'>(data: QRData, options?: CreateQROptions<F>): QRFormatResult[F] {
  const { format = 'matrix', includeQuietZone, ...qrOptions } = (options ?? {}) as CreateQROptions
  const qr = new QR(data, qrOptions as QROptions)
  const matrixOptions = { quietZone: includeQuietZone ?? false }
  const outputs: { [K in QRFormat]: () => QRFormatResult[K] } = {
    matrix: () => qr.dotMatrix(matrixOptions),
    binary: () => qr.binaryMatrix(matrixOptions),
    bitmap: () => qr.bitmap(matrixOptions),
    points: () => qr.points(matrixOptions),
    modules: () => qr.moduleMatrix(),
    types: () => qr.typeMatrix(),
    text: () => qr.toText(matrixOptions),
    qr: () => qr,
  }
  const output = outputs[format]
  if (!output) {
    throw new TypeError(`Unknown format '${String(format)}'. Expected one of: ${Object.keys(outputs).join(', ')}.`)
  }
  return output() as QRFormatResult[F]
}
