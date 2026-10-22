/**
 * Machine readable reason for a {@link QRError}.
 *
 * - `INVALID_OPTION` an option value is out of range or of the wrong type.
 * - `INCOMPATIBLE_OPTIONS` two or more options (or an option and the chosen symbol type) cannot be combined.
 * - `INVALID_DATA` the data cannot be encoded with the requested mode / character encoding.
 * - `DATA_TOO_LARGE` the data does not fit in any allowed version.
 */
export type QRErrorCode = 'INVALID_OPTION' | 'INCOMPATIBLE_OPTIONS' | 'INVALID_DATA' | 'DATA_TOO_LARGE'

/**
 * Error thrown for every invalid input or option combination.
 *
 * @example
 * try {
 *   new QR('hello', { symbol: 'micro', version: 'M1' })
 * } catch (error) {
 *   if (error instanceof QRError && error.code === 'INVALID_DATA') {
 *     // M1 can only store digits
 *   }
 * }
 */
export class QRError extends Error {
  /** Machine readable reason for the error. */
  readonly code: QRErrorCode

  constructor(code: QRErrorCode, message: string) {
    super(message)
    this.name = 'QRError'
    this.code = code
  }
}
