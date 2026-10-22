import { reedSolomonEncode } from './ecc/reed-solomon.js'
import { BitBuffer } from './encoding/bit-buffer.js'
import {
  assertEciNumber,
  type ResolvedEncoding,
  resolveEncoding,
  unencodable as unencodableCharacter,
} from './encoding/charsets.js'
import {
  analyseBytes,
  analyseText,
  type CharInfo,
  MODES,
  optimalSegments,
  type PlannedSegment,
  type SegmentParameters,
  segmentBits,
  segmentCount,
  segmentText,
  singleModeSegment,
  splitOversized,
  writePayload,
} from './encoding/segments.js'
import { QRError } from './errors.js'
import type { CodeLayout, SymbolDefinition, VersionInfo } from './symbols/definition.js'
import { type CodewordStream, ModuleGrid } from './symbols/grid.js'
import { SYMBOLS } from './symbols/index.js'
import { applyMask, microScore, penaltyScore } from './symbols/mask.js'
import type {
  EncodedSegment,
  EncodingMode,
  ErrorCorrectionLevel,
  QRData,
  QROptions,
  SegmentInput,
  StructuredAppendInfo,
  SymbolType,
} from './types.js'

/** Result of encoding: everything the `QR` class exposes. */
export interface EncodedSymbol {
  readonly definition: SymbolDefinition
  readonly version: VersionInfo
  readonly errorCorrection: ErrorCorrectionLevel
  /** Chosen mask pattern, or `null` for symbologies with a single fixed mask (rMQR). */
  readonly maskPattern: number | null
  readonly grid: ModuleGrid
  /** Final module values (masked, with format information). */
  readonly dark: Uint8Array
  readonly layout: CodeLayout
  readonly segments: readonly EncodedSegment[]
  readonly dataBitsUsed: number
  readonly stream: CodewordStream
  readonly quietZone: number
}

/** Loose view of the options so runtime validation can handle untyped JavaScript input. */
interface LooseOptions {
  symbol?: unknown
  version?: unknown
  versionRange?: unknown
  maskPattern?: unknown
  maskPatternRange?: unknown
  errorCorrection?: unknown
  mode?: unknown
  encoding?: unknown
  eci?: unknown
  fnc1?: unknown
  structuredAppend?: unknown
  quietZone?: unknown
  boostErrorCorrection?: unknown
  toSJIS?: unknown
  sizePreference?: unknown
}

interface InputItem {
  readonly chars: readonly CharInfo[]
  readonly mode: EncodingMode | 'auto'
  readonly eci?: number
  readonly encoding: ResolvedEncoding
}

const ECC_ORDER: readonly ErrorCorrectionLevel[] = ['L', 'M', 'Q', 'H']
const MODE_NAMES = new Set<unknown>([...MODES, 'auto'])

const describe = (value: unknown) => (typeof value === 'string' ? `'${value}'` : JSON.stringify(value))

function invalid(message: string): QRError {
  return new QRError('INVALID_OPTION', message)
}

function incompatible(message: string): QRError {
  return new QRError('INCOMPATIBLE_OPTIONS', message)
}

function findVersion(definition: SymbolDefinition, id: unknown, option: string): VersionInfo {
  const version = definition.versions.find((v) => v.id === id)
  if (!version) {
    const ids = definition.versions.map((v) => v.id)
    throw invalid(
      `Invalid ${option} ${describe(id)} for ${definition.label}. Expected one of ${ids[0]}–${ids[ids.length - 1]}` +
        (typeof ids[0] === 'string' ? ` (${ids.join(', ')}).` : '.'),
    )
  }
  return version
}

function eciDesignatorBits(eci: number): number {
  return eci < 128 ? 8 : eci < 16384 ? 16 : 24
}

function writeEci(buffer: BitBuffer, definition: SymbolDefinition, params: SegmentParameters, eci: number): void {
  buffer.put(definition.indicators.eci!, params.modeBits)
  if (eci < 128) buffer.put(eci, 8)
  else if (eci < 16384) buffer.put(0x8000 | eci, 16)
  else buffer.put(0xc00000 | eci, 24)
}

function applicationIndicatorValue(indicator: unknown): number {
  if (typeof indicator === 'number' && Number.isInteger(indicator) && indicator >= 0 && indicator <= 99) return indicator
  if (typeof indicator === 'string' && /^[0-9]{2}$/.test(indicator)) return Number(indicator)
  if (typeof indicator === 'string' && /^[A-Za-z]$/.test(indicator)) return indicator.charCodeAt(0) + 100
  throw invalid(
    `Invalid FNC1 application indicator ${describe(indicator)}. Use a single letter (a–z, A–Z) or a two digit number (00–99).`,
  )
}

interface ResolvedFnc1 {
  readonly position: 'first' | 'second'
  readonly applicationIndicator?: number
}

function resolveFnc1(fnc1: unknown): ResolvedFnc1 | undefined {
  if (fnc1 === undefined || fnc1 === 'none') return undefined
  if (fnc1 === 'first') return { position: 'first' }
  if (typeof fnc1 === 'object' && fnc1 !== null && (fnc1 as { position?: unknown }).position === 'second') {
    return {
      position: 'second',
      applicationIndicator: applicationIndicatorValue((fnc1 as { applicationIndicator?: unknown }).applicationIndicator),
    }
  }
  throw invalid(`Invalid fnc1 option ${describe(fnc1)}. Use 'none', 'first' or { position: 'second', applicationIndicator }.`)
}

function validateStructuredAppend(value: unknown): StructuredAppendInfo {
  const info = value as Partial<StructuredAppendInfo> | null
  const isInt = (n: unknown, min: number, max: number) => Number.isInteger(n) && (n as number) >= min && (n as number) <= max
  if (typeof info !== 'object' || info === null) throw invalid('structuredAppend must be an object { index, total, parity }.')
  if (!isInt(info.total, 1, 16)) throw invalid(`structuredAppend.total must be an integer from 1 to 16. Received: ${info.total};`)
  if (!isInt(info.index, 0, info.total! - 1)) {
    throw invalid(`structuredAppend.index must be an integer from 0 to total - 1 (${info.total! - 1}). Received: ${info.index};`)
  }
  if (!isInt(info.parity, 0, 255)) throw invalid(`structuredAppend.parity must be a byte value (0–255). Received: ${info.parity};`)
  return info as StructuredAppendInfo
}

/** Validates options that do not depend on the data, returning normalised values. */
function resolveOptions(options: LooseOptions) {
  const symbol = (options.symbol ?? 'model2') as SymbolType
  const definition = SYMBOLS[symbol]
  if (!definition || !Object.hasOwn(SYMBOLS, symbol)) {
    throw invalid(`Invalid symbol ${describe(options.symbol)}. Expected 'model2', 'model1', 'micro' or 'rmqr'.`)
  }
  const { label } = definition

  if (options.version !== undefined && options.versionRange !== undefined) {
    throw incompatible('`version` and `versionRange` cannot both be set. Use `version` for a fixed size or `versionRange` to choose within a range.')
  }
  if (options.maskPattern !== undefined && options.maskPatternRange !== undefined) {
    throw incompatible('`maskPattern` and `maskPatternRange` cannot both be set.')
  }

  // Versions to consider, in increasing capacity order
  let versions: readonly VersionInfo[] = definition.versions
  if (options.version !== undefined) {
    versions = [findVersion(definition, options.version, 'version')]
  } else if (options.versionRange !== undefined) {
    if (!Array.isArray(options.versionRange) || options.versionRange.length !== 2) {
      throw invalid('`versionRange` must be a [min, max] tuple.')
    }
    const min = findVersion(definition, options.versionRange[0], 'versionRange minimum')
    const max = findVersion(definition, options.versionRange[1], 'versionRange maximum')
    if (min.number > max.number) {
      throw invalid(`Invalid versionRange: minimum ${min.id} is larger than maximum ${max.id}.`)
    }
    versions = definition.versions.filter((v) => v.number >= min.number && v.number <= max.number)
  }
  if (symbol === 'rmqr') {
    const preference = options.sizePreference ?? 'area'
    if (preference !== 'area' && preference !== 'height' && preference !== 'width') {
      throw invalid(`Invalid sizePreference ${describe(preference)}. Expected 'area', 'height' or 'width'.`)
    }
    const key = (v: VersionInfo): [number, number] =>
      preference === 'height' ? [v.height, v.width] : preference === 'width' ? [v.width, v.height] : [v.width * v.height, v.height]
    versions = [...versions].sort((a, b) => key(a)[0] - key(b)[0] || key(a)[1] - key(b)[1])
  } else if (options.sizePreference !== undefined) {
    throw incompatible('`sizePreference` only applies to rMQR symbols.')
  }

  // Error correction
  const allLevels = new Set(definition.versions.flatMap((v) => definition.errorCorrectionLevels(v)))
  const errorCorrection = (options.errorCorrection ?? definition.defaultErrorCorrection) as ErrorCorrectionLevel
  if (!ECC_ORDER.includes(errorCorrection)) {
    throw invalid(`Invalid errorCorrection ${describe(options.errorCorrection)}. Expected 'L', 'M', 'Q' or 'H'.`)
  }
  if (!allLevels.has(errorCorrection)) {
    throw incompatible(`${label} does not support error correction level ${errorCorrection}. Available levels: ${[...allLevels].join(', ')}.`)
  }
  if (options.version !== undefined && !definition.errorCorrectionLevels(versions[0]!).includes(errorCorrection)) {
    const available = definition.errorCorrectionLevels(versions[0]!)
    throw incompatible(
      `Error correction level ${errorCorrection} is not available for ${label} version ${versions[0]!.id}. Available levels: ${available.join(', ')}.`,
    )
  }

  // Masks
  let masks: number[] = Array.from({ length: definition.maskCount }, (_, i) => i)
  if (definition.maskSelection === 'fixed') {
    if (options.maskPattern !== undefined || options.maskPatternRange !== undefined) {
      throw incompatible(`${label} uses a single fixed mask pattern; \`maskPattern\` cannot be set.`)
    }
  } else {
    const checkMask = (mask: unknown, name: string) => {
      if (!Number.isInteger(mask) || (mask as number) < 0 || (mask as number) >= definition.maskCount) {
        throw invalid(`Invalid ${name} ${describe(mask)} for ${label}. Expected an integer from 0 to ${definition.maskCount - 1}.`)
      }
      return mask as number
    }
    if (options.maskPattern !== undefined) masks = [checkMask(options.maskPattern, 'maskPattern')]
    else if (options.maskPatternRange !== undefined) {
      if (!Array.isArray(options.maskPatternRange) || options.maskPatternRange.length !== 2) {
        throw invalid('`maskPatternRange` must be a [min, max] tuple.')
      }
      const min = checkMask(options.maskPatternRange[0], 'maskPatternRange minimum')
      const max = checkMask(options.maskPatternRange[1], 'maskPatternRange maximum')
      if (min > max) throw invalid(`Invalid maskPatternRange: minimum ${min} is larger than maximum ${max}.`)
      masks = masks.filter((m) => m >= min && m <= max)
    }
  }

  // Features
  if (options.eci !== undefined && options.eci !== false && !definition.supportsEci) {
    throw incompatible(`${label} does not support ECI (Extended Channel Interpretation).`)
  }
  if (options.fnc1 !== undefined && options.fnc1 !== 'none' && !definition.supportsFnc1) {
    throw incompatible(`${label} does not support FNC1 modes.`)
  }
  if (options.structuredAppend !== undefined && !definition.supportsStructuredAppend) {
    throw incompatible(`${label} does not support Structured Append.`)
  }
  const fnc1 = resolveFnc1(options.fnc1)
  const structuredAppend = options.structuredAppend === undefined ? undefined : validateStructuredAppend(options.structuredAppend)
  if (typeof options.eci === 'number') assertEciNumber(options.eci)
  else if (options.eci !== undefined && typeof options.eci !== 'boolean') {
    throw invalid(`Invalid eci option ${describe(options.eci)}. Expected a boolean or an ECI assignment number.`)
  }

  const quietZone = options.quietZone ?? definition.defaultQuietZone
  if (!Number.isInteger(quietZone) || (quietZone as number) < 0) {
    throw invalid(`Invalid quietZone ${describe(options.quietZone)}. Expected a non-negative integer number of modules.`)
  }

  if (options.mode !== undefined && !MODE_NAMES.has(options.mode)) {
    throw invalid(`Invalid mode ${describe(options.mode)}. Expected 'auto', 'numeric', 'alphanumeric', 'byte' or 'kanji'.`)
  }
  if (options.toSJIS !== undefined && typeof options.toSJIS !== 'function') {
    throw invalid('`toSJIS` must be a function converting a character to its Shift JIS code.')
  }

  return {
    definition,
    versions,
    errorCorrection,
    masks,
    fnc1,
    structuredAppend,
    quietZone: quietZone as number,
    mode: (options.mode ?? 'auto') as EncodingMode | 'auto',
    boost: options.boostErrorCorrection === true,
  }
}

function buildItems(data: QRData, options: QROptions, fnc1: boolean, mode: EncodingMode | 'auto'): InputItem[] {
  const toSJIS = options.toSJIS
  const defaultEncoding = resolveEncoding(options.encoding, toSJIS)
  const item = (value: unknown, itemMode: EncodingMode | 'auto', eci?: number, encoding = defaultEncoding): InputItem => {
    if (typeof value === 'string') {
      return { chars: analyseText(value, { encoding, toSJIS, fnc1 }), mode: itemMode, encoding, ...(eci !== undefined && { eci }) }
    }
    if (value instanceof Uint8Array) {
      return { chars: analyseBytes(value, fnc1), mode: itemMode, encoding, ...(eci !== undefined && { eci }) }
    }
    throw new QRError('INVALID_DATA', `Invalid data ${describe(value)}. Expected a string, a Uint8Array or an array of segments.`)
  }

  if (typeof data === 'string' || data instanceof Uint8Array) return [item(data, mode)]
  if (!Array.isArray(data)) {
    throw new QRError(
      'INVALID_DATA',
      data === undefined || data === null
        ? 'No data supplied. Pass a string, a Uint8Array or an array of segments.'
        : `Invalid data ${describe(data)}. Expected a string, a Uint8Array or an array of segments.`,
    )
  }
  return data.map((entry) => {
    if (typeof entry === 'string' || entry instanceof Uint8Array) return item(entry, mode)
    if (typeof entry !== 'object' || entry === null) return item(entry, mode)
    const segment = entry as SegmentInput
    const segmentMode = segment.mode ?? 'auto'
    if (!MODE_NAMES.has(segmentMode)) {
      throw invalid(`Invalid segment mode ${describe(segment.mode)}. Expected 'auto', 'numeric', 'alphanumeric', 'byte' or 'kanji'.`)
    }
    if (segment.eci !== undefined) assertEciNumber(segment.eci)
    const encoding = segment.encoding === undefined ? defaultEncoding : resolveEncoding(segment.encoding, toSJIS)
    return item(segment.data, segmentMode, segment.eci, encoding)
  })
}

interface Plan {
  readonly segments: PlannedSegment[]
  readonly bits: number
}

/** Plans segments for every input item with the given version parameters. */
function planSegments(items: readonly InputItem[], params: SegmentParameters): PlannedSegment[] | string {
  const result: PlannedSegment[] = []
  for (const item of items) {
    let segments: PlannedSegment[]
    if (item.mode === 'auto') {
      const optimal = optimalSegments(item.chars, params)
      if (!optimal) {
        const bad = item.chars.find((char) => !optimalSegments([char], params))
        return bad ? `the character "${bad.text}"` : 'the data'
      }
      segments = optimal
    } else {
      if (!params.countBits[item.mode]) return `${item.mode} mode`
      segments = item.chars.length ? [singleModeSegment(item.chars, item.mode, item.encoding)] : []
    }
    segments = splitOversized(segments, params)
    if (item.eci !== undefined) {
      if (segments.length) segments[0] = { ...segments[0]!, eci: item.eci }
    }
    result.push(...segments)
  }
  return result
}

/**
 * Encodes data into a complete symbol.
 */
export function encode(data: QRData, options: QROptions = {}): EncodedSymbol {
  const loose = options as LooseOptions
  const resolved = resolveOptions(loose)
  const { definition, versions, masks, fnc1, structuredAppend } = resolved
  const { label } = definition
  let errorCorrection = resolved.errorCorrection

  const items = buildItems(data, options, fnc1 !== undefined, resolved.mode)
  const encoding = resolveEncoding(options.encoding, options.toSJIS)
  for (const item of items) {
    if (item.mode !== 'auto') continue
    const bad = item.chars.find((c) => c.byte === undefined && c.kanji === undefined && c.alphanumeric === undefined)
    if (bad) throw unencodableCharacter(bad.text, item.encoding)
  }
  if (items.some((item) => item.eci !== undefined) && !definition.supportsEci) {
    throw incompatible(`${label} does not support ECI (Extended Channel Interpretation).`)
  }

  // ECI written at the start of the stream
  let globalEci: number | undefined
  const eciOption = loose.eci as boolean | number | undefined
  if (typeof eciOption === 'number') globalEci = eciOption
  else if (eciOption === true) {
    if (encoding.eci === undefined) {
      throw incompatible('`eci: true` requires an encoding with an ECI number. Set `encoding.eci` or pass the ECI number directly.')
    }
    globalEci = encoding.eci
  } else if (eciOption === undefined && definition.supportsEci && !encoding.implicit && encoding.eci !== undefined) {
    globalEci = encoding.eci
  }

  // Bits of headers that do not depend on segmentation
  const headerBits = (params: SegmentParameters): number => {
    let bits = definition.streamPrefixBits
    if (structuredAppend) bits += params.modeBits + 16
    if (globalEci !== undefined) bits += params.modeBits + eciDesignatorBits(globalEci)
    if (fnc1) bits += params.modeBits + (fnc1.position === 'second' ? 8 : 0)
    return bits
  }
  const totalBits = (segments: readonly PlannedSegment[], params: SegmentParameters): number =>
    segments.reduce(
      (sum, segment) =>
        sum + segmentBits(segment, params) + (segment.eci !== undefined ? params.modeBits + eciDesignatorBits(segment.eci) : 0),
      headerBits(params),
    )

  // Pick the first version (in preference order) that fits
  const planCache = new Map<string, PlannedSegment[] | string>()
  const planFor = (version: VersionInfo): Plan | string => {
    const params = definition.segmentParameters(version)
    const key = JSON.stringify(params)
    let segments = planCache.get(key)
    if (segments === undefined) {
      segments = planSegments(items, params)
      planCache.set(key, segments)
    }
    return typeof segments === 'string' ? segments : { segments, bits: totalBits(segments, params) }
  }

  let chosen: { version: VersionInfo; plan: Plan; layout: CodeLayout } | undefined
  let largest: { version: VersionInfo; plan: Plan; layout: CodeLayout } | undefined
  let unencodable: string | undefined
  for (const version of versions) {
    if (!definition.errorCorrectionLevels(version).includes(errorCorrection)) continue
    const plan = planFor(version)
    if (typeof plan === 'string') {
      unencodable ??= plan
      continue
    }
    const layout = definition.layout(version, errorCorrection)
    if (!largest || layout.dataBits > largest.layout.dataBits) largest = { version, plan, layout }
    if (plan.bits <= layout.dataBits) {
      chosen = { version, plan, layout }
      break
    }
  }

  if (!chosen) {
    if (!largest) {
      const ids = versions.map((v) => v.id)
      const tried = ids.length > 2 ? `${ids[0]}–${ids[ids.length - 1]}` : ids.join(' or ')
      const hint =
        definition.type === 'micro'
          ? ' Micro QR M1 only stores digits, M2 digits and alphanumerics; byte and kanji data need M3 or M4.'
          : unencodable?.startsWith('kanji')
            ? ' Kanji mode requires the `toSJIS` option.'
            : ''
      throw new QRError('INVALID_DATA', `${unencodable ?? 'The data'} cannot be encoded in ${label} version ${tried} at error correction level ${errorCorrection}.${hint}`)
    }
    const { version, plan, layout } = largest
    throw new QRError(
      'DATA_TOO_LARGE',
      `The supplied data is larger than the available data capacity. Data size (bits): ${plan.bits}; ECC Level: ${errorCorrection}; Available bits: ${layout.dataBits} (Version ${version.id});`,
    )
  }

  let { version, plan, layout } = chosen
  if (resolved.boost) {
    for (const level of definition.errorCorrectionLevels(version)) {
      if (ECC_ORDER.indexOf(level) <= ECC_ORDER.indexOf(errorCorrection)) continue
      const boosted = definition.layout(version, level)
      if (plan.bits <= boosted.dataBits) {
        errorCorrection = level
        layout = boosted
      }
    }
  }

  // Assemble the bit stream
  const params = definition.segmentParameters(version)
  const buffer = new BitBuffer()
  buffer.put(0, definition.streamPrefixBits)
  if (structuredAppend) {
    buffer.put(definition.indicators.structuredAppend!, params.modeBits)
    buffer.put(structuredAppend.index, 4)
    buffer.put(structuredAppend.total - 1, 4)
    buffer.put(structuredAppend.parity, 8)
  }
  if (globalEci !== undefined) writeEci(buffer, definition, params, globalEci)
  if (fnc1?.position === 'first') buffer.put(definition.indicators.fnc1First!, params.modeBits)
  if (fnc1?.position === 'second') {
    buffer.put(definition.indicators.fnc1Second!, params.modeBits)
    buffer.put(fnc1.applicationIndicator!, 8)
  }
  const encodedSegments: EncodedSegment[] = []
  for (const segment of plan.segments) {
    if (segment.eci !== undefined) writeEci(buffer, definition, params, segment.eci)
    const start = buffer.length
    const count = segmentCount(segment.mode, segment.chars)
    buffer.put(definition.indicators.mode[segment.mode], params.modeBits)
    buffer.put(count, params.countBits[segment.mode])
    writePayload(segment, buffer)
    encodedSegments.push({
      mode: segment.mode,
      text: segmentText(segment),
      count,
      bits: buffer.length - start,
      ...(segment.eci !== undefined && { eci: segment.eci }),
    })
  }
  const dataBitsUsed = buffer.length

  // Terminator, bit padding and pad codewords
  const capacity = layout.dataBits
  buffer.put(0, Math.min(definition.terminatorBits(version), capacity - buffer.length))
  buffer.put(0, Math.min((8 - (buffer.length % 8)) % 8, capacity - buffer.length))
  for (let pad = 0xec; buffer.length + 8 <= capacity; pad ^= 0xec ^ 0x11) buffer.put(pad, 8)
  buffer.put(0, capacity - buffer.length)

  const dataCodewords = buffer.toBytes()
  const stream = buildStream(dataCodewords, layout)

  // Matrix
  const grid = new ModuleGrid(version.width, version.height)
  definition.drawFunctionPatterns(version, grid)
  definition.placeCodewords(version, grid, stream)

  let best: { mask: number; dark: Uint8Array; score: number } | undefined
  for (const mask of masks) {
    const dark = grid.dark.slice()
    applyMask(grid, dark, definition.maskCondition(mask))
    definition.writeFormat(version, errorCorrection, mask, grid, dark)
    if (masks.length === 1) {
      best = { mask, dark, score: 0 }
      break
    }
    const score =
      definition.maskSelection === 'micro' ? -microScore(dark, grid.width) : penaltyScore(dark, grid.width, grid.height)
    if (!best || score < best.score) best = { mask, dark, score }
  }

  return {
    definition,
    version,
    errorCorrection,
    maskPattern: definition.maskSelection === 'fixed' ? null : best!.mask,
    grid,
    dark: best!.dark,
    layout,
    segments: encodedSegments,
    dataBitsUsed,
    stream,
    quietZone: resolved.quietZone,
  }
}

/** Splits data codewords into blocks, adds Reed–Solomon codewords and interleaves everything. */
function buildStream(data: Uint8Array, layout: CodeLayout): CodewordStream {
  const blocks: { data: Uint8Array; ecc: Uint8Array }[] = []
  let offset = 0
  for (const block of layout.blocks) {
    const blockData = data.slice(offset, offset + block.data)
    offset += block.data
    blocks.push({ data: blockData, ecc: reedSolomonEncode(blockData, block.ecc) })
  }

  const codewords: number[] = []
  const lengths: number[] = []
  const kinds: ('data' | 'ecc')[] = []
  const blockIndex: number[] = []
  const indexInBlock: number[] = []
  const push = (value: number, kind: 'data' | 'ecc', block: number, index: number, length = 8) => {
    codewords.push(value)
    lengths.push(length)
    kinds.push(kind)
    blockIndex.push(block)
    indexInBlock.push(index)
  }

  if (layout.interleaved === false) {
    blocks.forEach((block, b) => block.data.forEach((value, i) => push(value, 'data', b, i)))
    blocks.forEach((block, b) => block.ecc.forEach((value, i) => push(value, 'ecc', b, block.data.length + i)))
  } else {
    const maxData = Math.max(...blocks.map((b) => b.data.length))
    for (let i = 0; i < maxData; i++) {
      blocks.forEach((block, b) => {
        if (i >= block.data.length) return
        const isHalf = layout.halfFinalCodeword && i === block.data.length - 1
        push(block.data[i]!, 'data', b, i, isHalf ? 4 : 8)
      })
    }
    const maxEcc = Math.max(...blocks.map((b) => b.ecc.length))
    for (let i = 0; i < maxEcc; i++) {
      blocks.forEach((block, b) => {
        if (i < block.ecc.length) push(block.ecc[i]!, 'ecc', b, block.data.length + i)
      })
    }
  }

  return {
    codewords: Uint8Array.from(codewords),
    lengths: Uint8Array.from(lengths),
    kinds,
    blocks: Uint16Array.from(blockIndex),
    indexInBlock: Uint16Array.from(indexInBlock),
  }
}
