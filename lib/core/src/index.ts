/**
 * @qr-util/core — headless QR Code generation.
 *
 * Original code by Ryan Day & Kazuhiko Arase (node-qrcode), rewritten by Matt Scullino.
 * Licensed under the MIT license.
 *
 * The word "QR Code" is a registered trademark of DENSO WAVE INCORPORATED.
 *
 * @packageDocumentation
 */
export { QR } from './qr.js'
export type { MatrixOptions, QRBitmap, SplitOptions, TextOptions } from './qr.js'
export { createQR } from './create-qr.js'
export type { CreateQROptions, QRFormat, QRFormatResult } from './create-qr.js'
export { QRError } from './errors.js'
export type { QRErrorCode } from './errors.js'
export type {
  BaseOptions,
  CharacterEncoding,
  CodewordPosition,
  Corner,
  CustomCharacterEncoding,
  ECIOptions,
  EncodedSegment,
  EncodingMode,
  ErrorCorrectionBlock,
  ErrorCorrectionLevel,
  FNC1Mode,
  Landmark,
  MaskPattern,
  MicroMaskPattern,
  MicroOptions,
  MicroVersion,
  Model1Options,
  Model1Version,
  Model2Options,
  Model2Version,
  ModuleType,
  QRData,
  QRModule,
  QROptions,
  QRVersion,
  Range,
  RMQROptions,
  RMQRVersion,
  SegmentInput,
  StructuredAppendInfo,
  SymbolType,
  ToSJIS,
} from './types.js'
