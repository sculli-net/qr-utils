import { QRError } from '../errors.js'
import type { EncodingMode, ToSJIS } from '../types.js'
import type { BitBuffer } from './bit-buffer.js'
import { type ResolvedEncoding, unencodable } from './charsets.js'

export const MODES: readonly EncodingMode[] = ['numeric', 'alphanumeric', 'byte', 'kanji']

const ALPHANUMERIC_CHARSET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:'
const PERCENT = ALPHANUMERIC_CHARSET.indexOf('%')
const GROUP_SEPARATOR = '\x1d'

/** One input character analysed for every mode it can be stored in. */
export interface CharInfo {
  /** The character (one code point), or the byte as a Latin-1 character for binary input. */
  readonly text: string
  readonly numeric: number | undefined
  /** Alphanumeric values; two values for `%` in FNC1 mode (escaped as `%%`). */
  readonly alphanumeric: readonly number[] | undefined
  readonly byte: Uint8Array | undefined
  /** 13-bit Kanji mode value. */
  readonly kanji: number | undefined
}

/** Per-version encoding parameters needed to size segments. */
export interface SegmentParameters {
  /** Length of a mode indicator in bits (0 for Micro QR M1). */
  readonly modeBits: number
  /** Character count indicator length per mode; 0 means the mode is not available. */
  readonly countBits: Readonly<Record<EncodingMode, number>>
}

export interface PlannedSegment {
  readonly mode: EncodingMode
  readonly chars: readonly CharInfo[]
  readonly eci?: number
}

interface AnalyseOptions {
  readonly encoding: ResolvedEncoding
  readonly toSJIS: ToSJIS | undefined
  /** In FNC1 modes `\x1D` is the FNC1 separator and `%` must be escaped in alphanumeric mode. */
  readonly fnc1: boolean
}

function kanjiValue(code: number | undefined): number | undefined {
  if (code === undefined) return undefined
  let offset: number
  if (code >= 0x8140 && code <= 0x9ffc) offset = code - 0x8140
  else if (code >= 0xe040 && code <= 0xebbf) offset = code - 0xc140
  else return undefined
  const low = code & 0xff
  if (low < 0x40 || low === 0x7f || low > 0xfc) return undefined
  return (offset >>> 8) * 0xc0 + (offset & 0xff)
}

function alphanumericValues(character: string, fnc1: boolean): readonly number[] | undefined {
  if (fnc1 && character === GROUP_SEPARATOR) return [PERCENT]
  if (fnc1 && character === '%') return [PERCENT, PERCENT]
  const index = character.length === 1 ? ALPHANUMERIC_CHARSET.indexOf(character) : -1
  return index >= 0 ? [index] : undefined
}

function numericValue(character: string): number | undefined {
  const code = character.charCodeAt(0)
  return character.length === 1 && code >= 0x30 && code <= 0x39 ? code - 0x30 : undefined
}

/** Analyses a string character by character. */
export function analyseText(text: string, { encoding, toSJIS, fnc1 }: AnalyseOptions): CharInfo[] {
  const chars: CharInfo[] = []
  for (const character of text) {
    chars.push({
      text: character,
      numeric: numericValue(character),
      alphanumeric: alphanumericValues(character, fnc1),
      byte: encoding.encodeChar(character),
      kanji: toSJIS ? kanjiValue(safeSJIS(toSJIS, character)) : undefined,
    })
  }
  return chars
}

function safeSJIS(toSJIS: ToSJIS, character: string): number | undefined {
  try {
    return toSJIS(character) ?? undefined
  } catch {
    return undefined
  }
}

/** Analyses binary input: every byte is a character; ASCII digits/letters may still use numeric/alphanumeric mode. */
export function analyseBytes(bytes: Uint8Array, fnc1: boolean): CharInfo[] {
  return Array.from(bytes, (byte) => {
    const character = String.fromCharCode(byte)
    return {
      text: character,
      numeric: numericValue(character),
      alphanumeric: alphanumericValues(character, fnc1),
      byte: Uint8Array.of(byte),
      kanji: undefined,
    }
  })
}

function canEncode(char: CharInfo, mode: EncodingMode): boolean {
  switch (mode) {
    case 'numeric': return char.numeric !== undefined
    case 'alphanumeric': return char.alphanumeric !== undefined
    case 'byte': return char.byte !== undefined
    case 'kanji': return char.kanji !== undefined
  }
}

/** Number of characters as written in the character count indicator. */
export function segmentCount(mode: EncodingMode, chars: readonly CharInfo[]): number {
  let count = 0
  for (const char of chars) {
    if (mode === 'byte') count += char.byte!.length
    else if (mode === 'alphanumeric') count += char.alphanumeric!.length
    else count++
  }
  return count
}

/** Bits of the segment payload (excluding mode indicator and character count). */
export function payloadBits(mode: EncodingMode, count: number): number {
  switch (mode) {
    case 'numeric': return Math.floor(count / 3) * 10 + [0, 4, 7][count % 3]!
    case 'alphanumeric': return Math.floor(count / 2) * 11 + (count % 2) * 6
    case 'byte': return count * 8
    case 'kanji': return count * 13
  }
}

/** Total bits of a segment, or `Infinity` when the mode is not available. */
export function segmentBits(segment: PlannedSegment, params: SegmentParameters): number {
  const countBits = params.countBits[segment.mode]
  if (!countBits) return Infinity
  const count = segmentCount(segment.mode, segment.chars)
  return params.modeBits + countBits + payloadBits(segment.mode, count)
}

/** Splits segments whose character count exceeds the character count indicator. */
export function splitOversized(segments: readonly PlannedSegment[], params: SegmentParameters): PlannedSegment[] {
  const result: PlannedSegment[] = []
  for (const segment of segments) {
    const max = 2 ** params.countBits[segment.mode] - 1
    if (segmentCount(segment.mode, segment.chars) <= max) {
      result.push(segment)
      continue
    }
    let chunk: CharInfo[] = []
    let count = 0
    let eci = segment.eci
    for (const char of segment.chars) {
      const size = segmentCount(segment.mode, [char])
      if (count + size > max) {
        result.push({ mode: segment.mode, chars: chunk, ...(eci !== undefined && { eci }) })
        eci = undefined
        chunk = []
        count = 0
      }
      chunk.push(char)
      count += size
    }
    if (chunk.length) result.push({ mode: segment.mode, chars: chunk, ...(eci !== undefined && { eci }) })
  }
  return result
}

/**
 * Optimal segmentation (minimum total bits) with dynamic programming over (character, mode) states.
 * Costs are tracked in sixths of a bit so numeric (10/3 bits) and alphanumeric (11/2 bits) stay integral.
 * Returns `undefined` when some character cannot be stored in any mode available for these parameters.
 */
export function optimalSegments(chars: readonly CharInfo[], params: SegmentParameters): PlannedSegment[] | undefined {
  if (chars.length === 0) return []
  const modeCount = MODES.length
  const headCosts = MODES.map((mode) => (params.countBits[mode] ? (params.modeBits + params.countBits[mode]) * 6 : Infinity))
  const charCost = (char: CharInfo, mode: number): number => {
    switch (mode) {
      case 0: return 20
      case 1: return 33 * char.alphanumeric!.length
      case 2: return 48 * char.byte!.length
      default: return 78
    }
  }

  let previous = headCosts.slice()
  // choices[i][m] = mode of character i on the cheapest path that is in mode m after character i
  const choices: Int8Array[] = []
  for (const char of chars) {
    const current = new Array<number>(modeCount).fill(Infinity)
    const choice = new Int8Array(modeCount).fill(-1)
    for (let m = 0; m < modeCount; m++) {
      if (headCosts[m] !== Infinity && canEncode(char, MODES[m]!) && previous[m] !== Infinity) {
        current[m] = previous[m]! + charCost(char, m)
        choice[m] = m
      }
    }
    // Option to switch mode after this character (a new segment starts with the next character)
    const encoded = current.slice()
    for (let to = 0; to < modeCount; to++) {
      if (headCosts[to] === Infinity) continue
      for (let from = 0; from < modeCount; from++) {
        if (encoded[from] === Infinity || from === to) continue
        const cost = Math.ceil(encoded[from]! / 6) * 6 + headCosts[to]!
        if (cost < current[to]!) {
          current[to] = cost
          choice[to] = from
        }
      }
    }
    choices.push(choice)
    previous = current
  }

  let mode = -1
  let best = Infinity
  for (let m = 0; m < modeCount; m++) {
    if (previous[m]! < best) {
      best = previous[m]!
      mode = m
    }
  }
  if (mode === -1) return undefined

  const charModes = new Array<number>(chars.length)
  for (let i = chars.length - 1; i >= 0; i--) {
    mode = choices[i]![mode]!
    charModes[i] = mode
  }

  const segments: PlannedSegment[] = []
  let start = 0
  for (let i = 1; i <= chars.length; i++) {
    if (i === chars.length || charModes[i] !== charModes[start]) {
      segments.push({ mode: MODES[charModes[start]!]!, chars: chars.slice(start, i) })
      start = i
    }
  }
  return segments
}

/** A single segment in a forced mode; throws when a character cannot be represented in it. */
export function singleModeSegment(
  chars: readonly CharInfo[],
  mode: EncodingMode,
  encoding: ResolvedEncoding,
): PlannedSegment {
  for (const char of chars) {
    if (canEncode(char, mode)) continue
    if (mode === 'byte') throw unencodable(char.text, encoding)
    const hint = mode === 'kanji' ? ' Kanji mode requires the `toSJIS` option and Shift JIS Kanji characters.' : ''
    throw new QRError('INVALID_DATA', `The character "${char.text}" cannot be encoded in ${mode} mode.${hint}`)
  }
  return { mode, chars }
}

/** Writes the payload of a segment (no mode indicator / character count). */
export function writePayload(segment: PlannedSegment, buffer: BitBuffer): void {
  const { mode, chars } = segment
  if (mode === 'numeric') {
    for (let i = 0; i < chars.length; i += 3) {
      const group = chars.slice(i, i + 3)
      const value = group.reduce((acc, char) => acc * 10 + char.numeric!, 0)
      buffer.put(value, [0, 4, 7, 10][group.length]!)
    }
  } else if (mode === 'alphanumeric') {
    const values = chars.flatMap((char) => char.alphanumeric!)
    for (let i = 0; i + 1 < values.length; i += 2) buffer.put(values[i]! * 45 + values[i + 1]!, 11)
    if (values.length % 2) buffer.put(values[values.length - 1]!, 6)
  } else if (mode === 'byte') {
    for (const char of chars) for (const byte of char.byte!) buffer.put(byte, 8)
  } else {
    for (const char of chars) buffer.put(char.kanji!, 13)
  }
}

/** Human readable text of a segment. */
export function segmentText(segment: PlannedSegment): string {
  return segment.chars.map((char) => char.text).join('')
}
