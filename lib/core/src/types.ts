/**
 * The symbology (symbol type / model) to generate.
 *
 * - `'model2'` the standard QR Code everyone knows (ISO/IEC 18004). Versions 1–40, 21×21 to 177×177 modules.
 * - `'model1'` the original 1994 QR Code. Versions 1–14, no alignment patterns. Only use it for legacy systems.
 * - `'micro'` Micro QR Code. Versions M1–M4, 11×11 to 17×17 modules with a single finder pattern.
 * - `'rmqr'` Rectangular Micro QR Code (ISO/IEC 23941). 32 rectangular sizes from R7x43 to R17x139.
 *
 * @default 'model2'
 */
export type SymbolType = 'model2' | 'model1' | 'micro' | 'rmqr'

/**
 * Error correction level. Roughly the share of codewords that can be restored:
 * `L` ≈ 7%, `M` ≈ 15%, `Q` ≈ 25%, `H` ≈ 30%.
 *
 * Availability depends on the symbol type: Micro QR supports `L`, `M`, `Q` (M1 only offers error *detection*,
 * reported as `L`), and rMQR supports only `M` and `H`.
 */
export type ErrorCorrectionLevel = 'L' | 'M' | 'Q' | 'H'

/**
 * Data encoding mode of a segment.
 *
 * - `'numeric'` digits 0–9 (3.33 bits per character)
 * - `'alphanumeric'` `0–9 A–Z`, space and `$ % * + - . / :` (5.5 bits per character)
 * - `'byte'` any bytes, strings are converted with the `encoding` option (8 bits per byte)
 * - `'kanji'` Shift JIS double-byte characters (13 bits per character). Requires the `toSJIS` option.
 */
export type EncodingMode = 'numeric' | 'alphanumeric' | 'byte' | 'kanji'

/** QR Model 2 version (symbol size). Version `v` is `17 + 4v` modules wide. */
export type Model2Version =
  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18 | 19 | 20
  | 21 | 22 | 23 | 24 | 25 | 26 | 27 | 28 | 29 | 30 | 31 | 32 | 33 | 34 | 35 | 36 | 37 | 38 | 39 | 40

/** QR Model 1 version. Version `v` is `17 + 4v` modules wide. */
export type Model1Version = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14

/** Micro QR version. M1 = 11×11, M2 = 13×13, M3 = 15×15, M4 = 17×17 modules. */
export type MicroVersion = 'M1' | 'M2' | 'M3' | 'M4'

/** rMQR version, written `R{height}x{width}` in modules. Listed in specification order. */
export type RMQRVersion =
  | 'R7x43' | 'R7x59' | 'R7x77' | 'R7x99' | 'R7x139'
  | 'R9x43' | 'R9x59' | 'R9x77' | 'R9x99' | 'R9x139'
  | 'R11x27' | 'R11x43' | 'R11x59' | 'R11x77' | 'R11x99' | 'R11x139'
  | 'R13x27' | 'R13x43' | 'R13x59' | 'R13x77' | 'R13x99' | 'R13x139'
  | 'R15x43' | 'R15x59' | 'R15x77' | 'R15x99' | 'R15x139'
  | 'R17x43' | 'R17x59' | 'R17x77' | 'R17x99' | 'R17x139'

/** Any version identifier. */
export type QRVersion = Model2Version | MicroVersion | RMQRVersion

/** Mask pattern for QR Model 1 and Model 2. */
export type MaskPattern = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7

/** Mask pattern for Micro QR. */
export type MicroMaskPattern = 0 | 1 | 2 | 3

/**
 * Character encoding used to turn strings into bytes for byte-mode segments.
 *
 * - `'UTF-8'` (default) the de-facto standard, understood by all modern scanners.
 * - `'ISO-8859-1'` Latin-1, the encoding the QR specification assumes when no ECI is present.
 * - `'US-ASCII'` 7-bit ASCII only.
 * - `'UTF-16BE'` two bytes per UTF-16 code unit.
 * - `'Shift_JIS'` Japanese. Double-byte characters require the `toSJIS` option.
 * - A custom encoder object for any other character set; pair it with its ECI assignment number.
 *
 * @example
 * // A custom Windows-1251 (Cyrillic) encoder, announced with ECI 22
 * new QR('Привет', { encoding: { encode: win1251Encode, eci: 22 } })
 */
export type CharacterEncoding =
  | 'UTF-8'
  | 'ISO-8859-1'
  | 'US-ASCII'
  | 'UTF-16BE'
  | 'Shift_JIS'
  | CustomCharacterEncoding

/** A user supplied character encoder. */
export interface CustomCharacterEncoding {
  /** Converts a string to bytes. Throw (or return `undefined`) for characters that cannot be represented. */
  encode: (text: string) => Uint8Array | undefined
  /** ECI assignment number of the character set (e.g. 22 for Windows-1251). Used when an ECI header is written. */
  eci?: number
}

/**
 * Converts a single character to its Shift JIS code (e.g. `'漢'` → `0x8ABF`), or `undefined` if it has none.
 * A complete implementation ships in `@qr-util/core/sjis`.
 */
export type ToSJIS = (character: string) => number | undefined

/**
 * FNC1 mode, used to mark data as GS1 (first position) or as following another industry standard (second position).
 *
 * In FNC1 modes, the ASCII group separator `\x1D` (GS) in the data is the FNC1 field separator.
 *
 * - `'none'` (default) plain data.
 * - `'first'` GS1 data, e.g. `'01095011010209171719050810ABCD1234\x1D2110'`.
 * - `{ position: 'second', applicationIndicator }` AIM application indicator: a single letter `a–z`/`A–Z`
 *   or a two digit number `00`–`99`.
 */
export type FNC1Mode = 'none' | 'first' | { position: 'second'; applicationIndicator: string | number }

/**
 * Marks this symbol as part of a Structured Append sequence (up to 16 symbols that a scanner joins together).
 * Use {@link QR.split} to split data into a sequence automatically.
 */
export interface StructuredAppendInfo {
  /** Zero based position of this symbol in the sequence (0–15). */
  index: number
  /** Total number of symbols in the sequence (1–16). */
  total: number
  /** Parity byte: XOR of every byte of the complete (unsplit) data. Must be identical for all symbols. */
  parity: number
}

/**
 * An explicitly defined segment. Use an array of segments as the data to control segmentation yourself.
 *
 * @example
 * new QR([
 *   { data: 'ORDER', mode: 'alphanumeric' },
 *   { data: '0123456789', mode: 'numeric' },
 *   { data: '?ref=abc' }, // mode chosen automatically
 * ])
 */
export interface SegmentInput {
  /** The segment content. Strings are converted with `encoding` when stored in byte mode. */
  data: string | Uint8Array
  /** Mode for this segment. `'auto'` (default) splits the segment optimally into sub-segments. */
  mode?: EncodingMode | 'auto'
  /**
   * Writes an ECI designator before this segment so scanners switch character set from here on.
   * Only for QR Model 2 and rMQR.
   */
  eci?: number
  /** Character encoding for this segment's byte data. Defaults to the `encoding` option. */
  encoding?: CharacterEncoding
}

/** Data accepted by `new QR()` and `createQR()`. */
export type QRData = string | Uint8Array | readonly (string | Uint8Array | SegmentInput)[]

/** Inclusive `[min, max]` range. */
export type Range<T> = readonly [min: T, max: T]

type VersionChoice<V> =
  | {
      /**
       * Fixed version (symbol size). Leave unset to pick the smallest version that fits the data.
       * Cannot be combined with `versionRange`.
       */
      version?: V
      versionRange?: never
    }
  | {
      version?: never
      /**
       * Inclusive `[min, max]` range the version is picked from (smallest that fits wins).
       * Cannot be combined with `version`.
       *
       * @example
       * { versionRange: [5, 10] } // at least 37×37, at most 57×57 modules
       */
      versionRange?: Range<V>
    }

type MaskChoice<M> =
  | {
      /**
       * Fixed mask pattern. Leave unset to evaluate every mask and pick the one with the lowest penalty score
       * (the specification's way of avoiding patterns that are hard to scan). Cannot be combined with `maskPatternRange`.
       */
      maskPattern?: M
      maskPatternRange?: never
    }
  | {
      maskPattern?: never
      /** Inclusive `[min, max]` range of masks to evaluate; the best scoring one is used. Cannot be combined with `maskPattern`. */
      maskPatternRange?: Range<M>
    }

/** Options shared by every symbol type. */
export interface BaseOptions {
  /**
   * How data is split into segments: `'auto'` (default) computes the optimal mix of numeric, alphanumeric,
   * byte and kanji segments for the smallest bit stream. Pass a mode to store everything in that single mode
   * (an error is thrown if the data cannot be represented in it).
   *
   * @default 'auto'
   */
  mode?: EncodingMode | 'auto'
  /**
   * Character encoding for byte-mode data.
   *
   * @default 'UTF-8'
   */
  encoding?: CharacterEncoding
  /**
   * Converts characters to Shift JIS. Supplying it enables Kanji mode (13 bits per character instead of 16–24)
   * and the `'Shift_JIS'` byte encoding.
   *
   * @example
   * import { toSJIS } from '@qr-util/core/sjis'
   * new QR('漢字テスト', { toSJIS })
   */
  toSJIS?: ToSJIS
  /**
   * Quiet zone (blank margin) width in modules that should surround the symbol. Used by the matrix outputs
   * when they include the quiet zone, and by `@qr-util/render`.
   * The specification minimum is 4 for QR Model 1/2 and 2 for Micro QR and rMQR (the defaults).
   */
  quietZone?: number
  /**
   * After the version is chosen, raise the error correction level as long as the data still fits in that version.
   * Gives free extra robustness without making the symbol larger.
   *
   * @default false
   */
  boostErrorCorrection?: boolean
}

/** Options for ECI capable symbols (QR Model 2 and rMQR). */
export interface ECIOptions {
  /**
   * Extended Channel Interpretation: announces the character set of byte data to the scanner.
   *
   * - unset (default) write an ECI header only when it is needed: never for UTF-8 (scanners detect it),
   *   ISO-8859-1 or ASCII, always for other encodings.
   * - `true` always write the ECI header for the chosen encoding.
   * - `false` never write it.
   * - a number writes that ECI assignment number (0–999999).
   */
  eci?: boolean | number
  /** FNC1 mode (GS1 / AIM application indicator). See {@link FNC1Mode}. @default 'none' */
  fnc1?: FNC1Mode
}

/** Options for QR Code Model 2 (the default symbol). */
export type Model2Options = BaseOptions &
  ECIOptions &
  VersionChoice<Model2Version> &
  MaskChoice<MaskPattern> & {
    /** Symbol type. @default 'model2' */
    symbol?: 'model2'
    /** Error correction level. @default 'M' */
    errorCorrection?: ErrorCorrectionLevel
    /** Structured Append header for this symbol. See {@link StructuredAppendInfo} and {@link QR.split}. */
    structuredAppend?: StructuredAppendInfo
  }

/** Options for QR Code Model 1 (legacy). Model 1 supports neither ECI, FNC1 nor Structured Append. */
export type Model1Options = BaseOptions &
  VersionChoice<Model1Version> &
  MaskChoice<MaskPattern> & {
    symbol: 'model1'
    /** Error correction level. @default 'M' */
    errorCorrection?: ErrorCorrectionLevel
    eci?: never
    fnc1?: never
    structuredAppend?: never
  }

/** Options for Micro QR Code. Micro QR supports neither ECI, FNC1 nor Structured Append. */
export type MicroOptions = BaseOptions &
  VersionChoice<MicroVersion> &
  MaskChoice<MicroMaskPattern> & {
    symbol: 'micro'
    /** Error correction level: `L` (M1–M4), `M` (M2–M4) or `Q` (M4 only). @default 'L' */
    errorCorrection?: Exclude<ErrorCorrectionLevel, 'H'>
    eci?: never
    fnc1?: never
    structuredAppend?: never
  }

/**
 * Options for rMQR. rMQR has a single fixed mask pattern and no Structured Append.
 */
export type RMQROptions = BaseOptions &
  ECIOptions &
  VersionChoice<RMQRVersion> & {
    symbol: 'rmqr'
    /** Error correction level: `M` or `H`. @default 'M' */
    errorCorrection?: 'M' | 'H'
    /**
     * Which dimension to minimise when the version is chosen automatically:
     * `'area'` (default) the fewest modules, `'height'` the shortest symbol, `'width'` the narrowest symbol.
     */
    sizePreference?: 'area' | 'height' | 'width'
    maskPattern?: never
    maskPatternRange?: never
    structuredAppend?: never
  }

/** Options for `new QR()`. The available options depend on `symbol`. */
export type QROptions = Model2Options | Model1Options | MicroOptions | RMQROptions

/**
 * Classification of a module (one square of the symbol).
 *
 * - `finder` the large "eye" position detection patterns
 * - `separator` the light border around finder patterns
 * - `timing` alternating dark/light lines used to find module coordinates
 * - `alignment` alignment patterns (Model 2 and rMQR)
 * - `format` format information (ECC level, mask, rMQR version)
 * - `version` version information (Model 2, version 7+)
 * - `darkModule` the single always-dark module next to the bottom-left finder (Model 1 / Model 2)
 * - `subFinder` the 5×5 finder sub-pattern at the bottom right of rMQR
 * - `cornerFinder` the L-shaped corner patterns of rMQR
 * - `extension` Model 1 extension patterns
 * - `data` data codeword bits
 * - `ecc` error correction codeword bits
 * - `remainder` unused remainder bits in the data region
 */
export type ModuleType =
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

/** Symbol corner, in the order used by corner tuples: top-left, top-right, bottom-right, bottom-left. */
export type Corner = 'top-left' | 'top-right' | 'bottom-right' | 'bottom-left'

/** A function pattern (landmark) of the symbol, e.g. one finder pattern or one alignment pattern. */
export interface Landmark {
  /** Position of this landmark in {@link QR.landmarks}. */
  readonly index: number
  readonly type: ModuleType
  /** Left column of the bounding box (modules). */
  readonly x: number
  /** Top row of the bounding box (modules). */
  readonly y: number
  /** Bounding box width in modules. */
  readonly width: number
  /** Bounding box height in modules. */
  readonly height: number
  /** Closest symbol corner. Set for finder-like patterns, format/version copies and corner patterns. */
  readonly corner?: Corner
  /** Orientation of line-shaped landmarks (timing patterns). */
  readonly orientation?: 'horizontal' | 'vertical'
}

/** Location of a data/ECC module inside the codeword stream. */
export interface CodewordPosition {
  /** Index of the codeword in the final (interleaved) codeword sequence. */
  readonly index: number
  /** Error correction block the codeword belongs to. */
  readonly block: number
  /** Index of the codeword inside its block (data codewords first, then ECC codewords). */
  readonly indexInBlock: number
  /** Bit of the codeword stored in this module (7 = most significant). */
  readonly bit: number
  readonly kind: 'data' | 'ecc'
}

/** Everything known about one module. */
export interface QRModule {
  /** Column, 0 = left edge of the symbol (quiet zone excluded). */
  readonly x: number
  /** Row, 0 = top edge of the symbol (quiet zone excluded). */
  readonly y: number
  /** `true` for dark (usually black) modules. */
  readonly dark: boolean
  readonly type: ModuleType
  /**
   * For finder, sub-finder and alignment patterns: `'inner'` is the centre (3×3 eye of a finder, the 1×1 centre of
   * an alignment pattern), `'outer'` the rest of the pattern.
   */
  readonly part?: 'inner' | 'outer'
  /** Index into {@link QR.landmarks} for function pattern modules. */
  readonly landmark?: number
  /** Codeword information for `data` and `ecc` modules. */
  readonly codeword?: CodewordPosition
}

/** Error correction block summary, e.g. for computing how much of the symbol may be covered by a logo. */
export interface ErrorCorrectionBlock {
  readonly dataCodewords: number
  readonly eccCodewords: number
  /**
   * Number of erroneous codewords this block can correct: `floor((ecc - p) / 2)` where `p` is the number of
   * misdecode protection codewords defined by the specification for small symbols.
   */
  readonly correctableCodewords: number
}

/** Description of one encoded segment. */
export interface EncodedSegment {
  readonly mode: EncodingMode
  /** The characters (or byte values for binary input) stored in the segment. */
  readonly text: string
  /** Value of the character count indicator. */
  readonly count: number
  /** Bits used by the segment including mode indicator and character count indicator. */
  readonly bits: number
  /** ECI designator written before this segment, if any. */
  readonly eci?: number
}
