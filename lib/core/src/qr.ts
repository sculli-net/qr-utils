import { encode, type EncodedSymbol } from './encode.js'
import { encodeString, resolveEncoding } from './encoding/charsets.js'
import { QRError } from './errors.js'
import { MODULE_TYPES, PART_INNER, PART_OUTER, TYPE } from './symbols/grid.js'
import type {
  CodewordPosition,
  EncodedSegment,
  ErrorCorrectionBlock,
  ErrorCorrectionLevel,
  Landmark,
  ModuleType,
  QRData,
  QRModule,
  QROptions,
  QRVersion,
  SymbolType,
} from './types.js'

/** Options for the matrix style outputs. */
export interface MatrixOptions {
  /**
   * Surround the symbol with light quiet zone modules: `true` uses the symbol's `quietZone` (4 for QR, 2 for
   * Micro QR / rMQR unless configured otherwise), a number sets the width in modules.
   *
   * @default false
   */
  quietZone?: boolean | number
}

/** Options for {@link QR.toText}. */
export interface TextOptions extends MatrixOptions {
  /** Characters for a dark module. @default '██' */
  dark?: string
  /** Characters for a light module. @default '  ' */
  light?: string
  /** Line separator. @default '\n' */
  newline?: string
}

/** A packed bitmap: one byte per module, row major, 1 = dark. */
export interface QRBitmap {
  readonly width: number
  readonly height: number
  readonly data: Uint8Array
}

/** Options for {@link QR.split}. */
export type SplitOptions = QROptions & {
  /**
   * Number of symbols to split the data into (1–16). When omitted the smallest number of symbols that fits
   * within the version constraints is used.
   */
  symbols?: number
}

/**
 * A generated QR Code (any symbology). Construct it with the data and options; read it with the
 * output methods.
 *
 * @example
 * const qr = new QR('https://web-site.com')
 * qr.version        // 3
 * qr.dotMatrix()    // boolean[][], true = dark
 *
 * @example
 * const custom = new QR('https://web-site.com', { maskPattern: 6, errorCorrection: 'Q' })
 *
 * @example
 * // Landmarks (function patterns) for custom rendering
 * for (const finder of qr.finderPatterns()) console.log(finder.corner, finder.x, finder.y)
 */
export class QR {
  /** The data the symbol was created from. */
  readonly data: QRData
  readonly #symbol: EncodedSymbol
  readonly #landmarks: readonly Landmark[]
  readonly #landmarkIndex: Int16Array

  /**
   * @param data the content: a string, raw bytes, or an array of explicit segments.
   * @param options symbol type and encoding options; every option is optional.
   * @throws {QRError} when the options are invalid/incompatible or the data does not fit.
   */
  constructor(data: QRData, options: QROptions = {}) {
    this.data = data
    this.#symbol = encode(data, options)
    const { grid } = this.#symbol
    // Landmark bounding boxes from the modules that ended up belonging to them
    const boxes = grid.landmarks.map(() => ({ minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity }))
    for (let y = 0; y < grid.height; y++) {
      for (let x = 0; x < grid.width; x++) {
        const id = grid.landmark[y * grid.width + x]!
        if (id < 0) continue
        const box = boxes[id]!
        box.minX = Math.min(box.minX, x)
        box.minY = Math.min(box.minY, y)
        box.maxX = Math.max(box.maxX, x)
        box.maxY = Math.max(box.maxY, y)
      }
    }
    const remap = new Int16Array(grid.landmarks.length).fill(-1)
    const landmarks: Landmark[] = []
    grid.landmarks.forEach((draft, id) => {
      const box = boxes[id]!
      if (box.minX === Infinity) return
      remap[id] = landmarks.length
      landmarks.push({
        index: landmarks.length,
        type: draft.type,
        x: box.minX,
        y: box.minY,
        width: box.maxX - box.minX + 1,
        height: box.maxY - box.minY + 1,
        ...(draft.corner && { corner: draft.corner }),
        ...(draft.orientation && { orientation: draft.orientation }),
      })
    })
    this.#landmarks = landmarks
    this.#landmarkIndex = grid.landmark.map((id) => (id < 0 ? -1 : remap[id]!))
  }

  /**
   * Splits data across a Structured Append sequence of up to 16 QR Code (Model 2) symbols.
   * Every symbol gets the same version so they print at the same size.
   * Returns a single symbol without a Structured Append header when the data fits into one.
   *
   * @example
   * const parts = QR.split(longText, { versionRange: [1, 10] })      // as few symbols as possible
   * const four = QR.split(longText, { symbols: 4, errorCorrection: 'Q' })
   */
  static split(data: string | Uint8Array, options: SplitOptions = {}): QR[] {
    const { symbols, ...qrOptions } = options
    const symbol = qrOptions.symbol ?? 'model2'
    if (symbol !== 'model2') {
      throw new QRError('INCOMPATIBLE_OPTIONS', `Structured Append is only available for QR Code Model 2, not '${symbol}'.`)
    }
    if (qrOptions.structuredAppend) {
      throw new QRError('INCOMPATIBLE_OPTIONS', '`structuredAppend` is set automatically by QR.split and cannot be passed.')
    }
    if (symbols !== undefined && (!Number.isInteger(symbols) || symbols < 1 || symbols > 16)) {
      throw new QRError('INVALID_OPTION', `\`symbols\` must be an integer from 1 to 16. Received: ${symbols};`)
    }
    if (typeof data !== 'string' && !(data instanceof Uint8Array)) {
      throw new QRError('INVALID_DATA', 'QR.split accepts a string or a Uint8Array.')
    }

    const units: (string | number)[] = typeof data === 'string' ? Array.from(data) : Array.from(data)
    const bytes = typeof data === 'string' ? encodeString(data, resolveEncoding(qrOptions.encoding, qrOptions.toSJIS)) : data
    const parity = bytes.reduce((acc, byte) => acc ^ byte, 0)
    const chunk = (count: number, index: number) => {
      const start = Math.round((units.length * index) / count)
      const end = Math.round((units.length * (index + 1)) / count)
      const part = units.slice(start, end)
      return typeof data === 'string' ? (part as string[]).join('') : Uint8Array.from(part as number[])
    }
    const build = (count: number, extra: Partial<QROptions> = {}): QR[] =>
      Array.from({ length: count }, (_, index) => {
        const sequence = count > 1 ? { structuredAppend: { index, total: count, parity } } : {}
        return new QR(chunk(count, index), { ...qrOptions, ...sequence, ...extra } as QROptions)
      })

    let count = symbols
    if (count === undefined) {
      // Cheap fit test with a fixed mask; the final build evaluates masks normally
      for (let n = 1; n <= 16 && count === undefined; n++) {
        try {
          build(n, { maskPattern: 0, maskPatternRange: undefined } as Partial<QROptions>)
          count = n
        } catch (error) {
          if (!(error instanceof QRError) || error.code !== 'DATA_TOO_LARGE') throw error
        }
      }
      if (count === undefined) {
        throw new QRError('DATA_TOO_LARGE', 'The supplied data does not fit into 16 Structured Append symbols with the given options.')
      }
    }
    const parts = build(count)
    if (count === 1 || qrOptions.version !== undefined) return parts
    const largest = Math.max(...parts.map((qr) => qr.versionNumber))
    return parts.every((qr) => qr.versionNumber === largest)
      ? parts
      : build(count, { version: largest, versionRange: undefined } as Partial<QROptions>)
  }

  // -----------------------------------------------------------------------------------------------------------
  // Metadata
  // -----------------------------------------------------------------------------------------------------------

  /** Symbology of this symbol. */
  get symbol(): SymbolType {
    return this.#symbol.definition.type
  }

  /** Version identifier: `1`–`40` (Model 2), `1`–`14` (Model 1), `'M1'`–`'M4'` (Micro), `'R7x43'`… (rMQR). */
  get version(): QRVersion {
    return this.#symbol.version.id as QRVersion
  }

  /** 1-based version number within the symbology (for rMQR the position in specification order, 1–32). */
  get versionNumber(): number {
    return this.#symbol.version.number
  }

  /** Error correction level actually used (may be higher than requested with `boostErrorCorrection`). */
  get errorCorrection(): ErrorCorrectionLevel {
    return this.#symbol.errorCorrection
  }

  /** Mask pattern actually used, or `null` for rMQR which has a single fixed mask. */
  get maskPattern(): number | null {
    return this.#symbol.maskPattern
  }

  /** Width in modules (quiet zone excluded). */
  get width(): number {
    return this.#symbol.version.width
  }

  /** Height in modules (quiet zone excluded). Equal to `width` except for rMQR. */
  get height(): number {
    return this.#symbol.version.height
  }

  /** Modules per side for square symbols (same as `width`). */
  get size(): number {
    return this.#symbol.version.width
  }

  /** Recommended quiet zone in modules. */
  get quietZone(): number {
    return this.#symbol.quietZone
  }

  /** The encoded segments (mode, content and bit cost of each). */
  get segments(): readonly EncodedSegment[] {
    return this.#symbol.segments
  }

  /** Data capacity summary in bits and codewords. */
  get capacity(): { dataBits: number; usedBits: number; dataCodewords: number; eccCodewords: number } {
    const { layout, dataBitsUsed } = this.#symbol
    return {
      dataBits: layout.dataBits,
      usedBits: dataBitsUsed,
      dataCodewords: layout.dataCodewords,
      eccCodewords: layout.blocks.reduce((sum, block) => sum + block.ecc, 0),
    }
  }

  /** Error correction blocks and how many codewords each can repair. */
  errorCorrectionBlocks(): ErrorCorrectionBlock[] {
    const { layout } = this.#symbol
    return layout.blocks.map((block) => ({
      dataCodewords: block.data,
      eccCodewords: block.ecc,
      correctableCodewords: Math.max(0, Math.floor((block.ecc - layout.misdecodeProtection) / 2)),
    }))
  }

  /** Final codeword sequence (data and error correction codewords, interleaved, in placement order). */
  codewords(): Uint8Array {
    return this.#symbol.stream.codewords.slice()
  }

  // -----------------------------------------------------------------------------------------------------------
  // Module access
  // -----------------------------------------------------------------------------------------------------------

  #index(x: number, y: number): number {
    if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= this.width || y >= this.height) {
      throw new RangeError(`Module (${x}, ${y}) is outside the ${this.width}×${this.height} symbol.`)
    }
    return y * this.width + x
  }

  /** Whether the module at column `x`, row `y` is dark. Coordinates outside the symbol (quiet zone) are light. */
  isDark(x: number, y: number): boolean {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return false
    return this.#symbol.dark[y * this.width + x] === 1
  }

  /** Classification of a module. */
  getModuleType(x: number, y: number): ModuleType {
    return MODULE_TYPES[this.#symbol.grid.type[this.#index(x, y)]!]!
  }

  /** Whether a module belongs to a function pattern (anything that is not data, ECC or remainder bits). */
  isFunctionModule(x: number, y: number): boolean {
    const type = this.#symbol.grid.type[this.#index(x, y)]
    return type !== TYPE.data && type !== TYPE.ecc && type !== TYPE.remainder
  }

  /** Everything known about one module. */
  getModule(x: number, y: number): QRModule {
    const i = this.#index(x, y)
    const { grid, stream } = this.#symbol
    const part = grid.part[i] === PART_INNER ? 'inner' : grid.part[i] === PART_OUTER ? 'outer' : undefined
    const landmark = this.#landmarkIndex[i]!
    const codewordIndex = grid.codeword[i]!
    let codeword: CodewordPosition | undefined
    if (codewordIndex >= 0) {
      codeword = {
        index: codewordIndex,
        block: stream.blocks[codewordIndex]!,
        indexInBlock: stream.indexInBlock[codewordIndex]!,
        bit: grid.bit[i]!,
        kind: stream.kinds[codewordIndex]!,
      }
    }
    return {
      x,
      y,
      dark: this.#symbol.dark[i] === 1,
      type: MODULE_TYPES[grid.type[i]!]!,
      ...(part && { part }),
      ...(landmark >= 0 && { landmark }),
      ...(codeword && { codeword }),
    }
  }

  // -----------------------------------------------------------------------------------------------------------
  // Landmarks (function patterns)
  // -----------------------------------------------------------------------------------------------------------

  /**
   * Function patterns of the symbol with their bounding boxes, optionally filtered by type.
   *
   * @example
   * qr.landmarks('alignment').map(({ x, y }) => [x + 2, y + 2]) // alignment pattern centres
   */
  landmarks(type?: ModuleType): readonly Landmark[] {
    return type ? this.#landmarks.filter((landmark) => landmark.type === type) : this.#landmarks
  }

  /** The finder patterns ("eyes"): three for QR Code, one for Micro QR and rMQR. */
  finderPatterns(): readonly Landmark[] {
    return this.landmarks('finder')
  }

  /** Alignment patterns (Model 2 version 2+, rMQR). */
  alignmentPatterns(): readonly Landmark[] {
    return this.landmarks('alignment')
  }

  /** Timing patterns. */
  timingPatterns(): readonly Landmark[] {
    return this.landmarks('timing')
  }

  /** All modules that belong to a landmark. */
  landmarkModules(landmark: number | Landmark): QRModule[] {
    const index = typeof landmark === 'number' ? landmark : landmark.index
    const box = this.#landmarks[index]
    if (!box) throw new RangeError(`Landmark ${index} does not exist.`)
    const modules: QRModule[] = []
    for (let y = box.y; y < box.y + box.height; y++) {
      for (let x = box.x; x < box.x + box.width; x++) {
        if (this.#landmarkIndex[y * this.width + x] === index) modules.push(this.getModule(x, y))
      }
    }
    return modules
  }

  // -----------------------------------------------------------------------------------------------------------
  // Outputs
  // -----------------------------------------------------------------------------------------------------------

  #margin(quietZone: boolean | number | undefined): number {
    if (quietZone === undefined || quietZone === false) return 0
    if (quietZone === true) return this.quietZone
    if (!Number.isInteger(quietZone) || quietZone < 0) {
      throw new QRError('INVALID_OPTION', `Invalid quietZone ${quietZone}. Expected a boolean or a non-negative integer.`)
    }
    return quietZone
  }

  #rows<T>(options: MatrixOptions | undefined, cell: (x: number, y: number) => T): T[][] {
    const margin = this.#margin(options?.quietZone)
    const rows: T[][] = []
    for (let y = 0 - margin; y < this.height + margin; y++) {
      const row: T[] = []
      for (let x = 0 - margin; x < this.width + margin; x++) row.push(cell(x, y))
      rows.push(row)
    }
    return rows
  }

  /**
   * The symbol as rows of booleans (`true` = dark). This is the default output of `createQR`.
   *
   * @example
   * qr.dotMatrix()[0][0] // true: top-left corner of the finder pattern
   */
  dotMatrix(options?: MatrixOptions): boolean[][] {
    return this.#rows(options, (x, y) => this.isDark(x, y))
  }

  /** The symbol as rows of `0`/`1` numbers (`1` = dark). */
  binaryMatrix(options?: MatrixOptions): (0 | 1)[][] {
    return this.#rows(options, (x, y) => (this.isDark(x, y) ? 1 : 0))
  }

  /** A packed, row-major bitmap with one byte per module (`1` = dark). Efficient for large symbols. */
  bitmap(options?: MatrixOptions): QRBitmap {
    const margin = this.#margin(options?.quietZone)
    const width = this.width + margin * 2
    const height = this.height + margin * 2
    const data = new Uint8Array(width * height)
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) data[(y + margin) * width + x + margin] = this.#symbol.dark[y * this.width + x]!
    }
    return { width, height, data }
  }

  /** Coordinates of every dark module, row by row. Handy for drawing dots. */
  points(options?: MatrixOptions): { x: number; y: number }[] {
    const margin = this.#margin(options?.quietZone)
    const points: { x: number; y: number }[] = []
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) if (this.isDark(x, y)) points.push({ x: x + margin, y: y + margin })
    }
    return points
  }

  /** Rows of {@link QRModule} objects with type, landmark and codeword details for every module. */
  moduleMatrix(): QRModule[][] {
    return this.#rows(undefined, (x, y) => this.getModule(x, y))
  }

  /** Rows of module types, e.g. to colour function patterns differently. */
  typeMatrix(): ModuleType[][] {
    return this.#rows(undefined, (x, y) => this.getModuleType(x, y))
  }

  /**
   * Plain text representation, one line per row. Defaults to two block characters per module so the result
   * looks square in a terminal.
   */
  toText(options: TextOptions = {}): string {
    const { dark = '██', light = '  ', newline = '\n' } = options
    return this.#rows(options, (x, y) => (this.isDark(x, y) ? dark : light))
      .map((row) => row.join(''))
      .join(newline)
  }

  /** A JSON friendly summary (metadata and the binary matrix). */
  toJSON() {
    return {
      symbol: this.symbol,
      version: this.version,
      errorCorrection: this.errorCorrection,
      maskPattern: this.maskPattern,
      width: this.width,
      height: this.height,
      quietZone: this.quietZone,
      segments: this.segments,
      matrix: this.binaryMatrix(),
    }
  }
}
