import type { SegmentParameters } from '../encoding/segments.js'
import type { EncodingMode, ErrorCorrectionLevel, SymbolType } from '../types.js'
import type { CodewordStream, ModuleGrid } from './grid.js'
import type { EccBlocks } from './tables.js'

/** One version of a symbology. */
export interface VersionInfo {
  /** Public identifier (`5`, `'M3'`, `'R13x77'`). */
  readonly id: number | string
  /** 1-based position in the symbology's version list. */
  readonly number: number
  readonly width: number
  readonly height: number
}

export interface BlockLayout {
  readonly data: number
  readonly ecc: number
}

/** Codeword layout of a (version, error correction level) pair. */
export interface CodeLayout {
  readonly dataCodewords: number
  /** Bits available for the data bit stream. */
  readonly dataBits: number
  readonly blocks: readonly BlockLayout[]
  /** Misdecode protection codewords per block (reduce the correction capacity). */
  readonly misdecodeProtection: number
  /** Whether the final data codeword is only 4 bits long (Micro QR M1 and M3). */
  readonly halfFinalCodeword: boolean
  /** Model 1 concatenates blocks back to back instead of interleaving them. @default true */
  readonly interleaved?: boolean
}

/** Mode indicator values. */
export interface Indicators {
  readonly mode: Readonly<Record<EncodingMode, number>>
  readonly eci?: number
  readonly fnc1First?: number
  readonly fnc1Second?: number
  readonly structuredAppend?: number
}

/** Everything the encoder needs to know about a symbology. */
export interface SymbolDefinition {
  readonly type: SymbolType
  readonly label: string
  readonly versions: readonly VersionInfo[]
  readonly defaultErrorCorrection: ErrorCorrectionLevel
  readonly defaultQuietZone: number
  /** Number of selectable mask patterns (1 = a single fixed mask). */
  readonly maskCount: number
  /** How candidate masks are compared. */
  readonly maskSelection: 'penalty' | 'micro' | 'fixed'
  readonly supportsEci: boolean
  readonly supportsFnc1: boolean
  readonly supportsStructuredAppend: boolean
  readonly indicators: Indicators
  /** Zero bits written before the data (Model 1 starts every symbol with 4). */
  readonly streamPrefixBits: number
  errorCorrectionLevels(version: VersionInfo): readonly ErrorCorrectionLevel[]
  layout(version: VersionInfo, ecc: ErrorCorrectionLevel): CodeLayout
  segmentParameters(version: VersionInfo): SegmentParameters
  terminatorBits(version: VersionInfo): number
  /** Paints function patterns and reserves format/version areas. */
  drawFunctionPatterns(version: VersionInfo, grid: ModuleGrid): void
  /** Places the final codeword stream into the free modules. */
  placeCodewords(version: VersionInfo, grid: ModuleGrid, stream: CodewordStream): void
  /** Writes format (and, if mask dependent, version) information into `dark`. */
  writeFormat(version: VersionInfo, ecc: ErrorCorrectionLevel, mask: number, grid: ModuleGrid, dark: Uint8Array): void
  /** Mask condition for a mask pattern number of this symbology. */
  maskCondition(mask: number): (x: number, y: number) => boolean
}

/** Expands a `[ecPerBlock, [[count, data], ...]]` table entry into individual blocks. */
export function expandBlocks(entry: EccBlocks): BlockLayout[] {
  if (!entry) return []
  const [ecc, groups] = entry
  const blocks: BlockLayout[] = []
  for (const [count, data] of groups) for (let i = 0; i < count; i++) blocks.push({ data, ecc })
  return blocks
}

export function sumData(blocks: readonly BlockLayout[]): number {
  return blocks.reduce((sum, block) => sum + block.data, 0)
}
