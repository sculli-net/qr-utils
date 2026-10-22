import { QRError } from '../errors.js'
import type { CharacterEncoding, ToSJIS } from '../types.js'

/** A character encoding resolved into a per-character encoder. */
export interface ResolvedEncoding {
  readonly name: string
  /** ECI assignment number of the encoding, if it has one. */
  readonly eci: number | undefined
  /** Whether scanners interpret the bytes correctly without an ECI header (so automatic mode skips it). */
  readonly implicit: boolean
  /** Bytes for one character (a single code point), or `undefined` if it cannot be represented. */
  encodeChar(character: string): Uint8Array | undefined
}

const utf8 = new TextEncoder()

const singleByte = (name: string, eci: number, max: number): ResolvedEncoding => ({
  name,
  eci,
  implicit: true,
  encodeChar(character) {
    const cp = character.codePointAt(0)!
    return cp <= max ? Uint8Array.of(cp) : undefined
  },
})

/**
 * Resolves the `encoding` option.
 *
 * ECI numbers: UTF-8 = 26, ISO-8859-1 = 3, US-ASCII = 27, UTF-16BE = 25, Shift JIS = 20.
 */
export function resolveEncoding(encoding: CharacterEncoding | undefined, toSJIS: ToSJIS | undefined): ResolvedEncoding {
  if (encoding === undefined || encoding === 'UTF-8') {
    return { name: 'UTF-8', eci: 26, implicit: true, encodeChar: (character) => utf8.encode(character) }
  }
  if (encoding === 'ISO-8859-1') return singleByte('ISO-8859-1', 3, 0xff)
  if (encoding === 'US-ASCII') return singleByte('US-ASCII', 27, 0x7f)
  if (encoding === 'UTF-16BE') {
    return {
      name: 'UTF-16BE',
      eci: 25,
      implicit: false,
      encodeChar(character) {
        const bytes = new Uint8Array(character.length * 2)
        for (let i = 0; i < character.length; i++) {
          const unit = character.charCodeAt(i)
          bytes[i * 2] = unit >>> 8
          bytes[i * 2 + 1] = unit & 0xff
        }
        return bytes
      },
    }
  }
  if (encoding === 'Shift_JIS') {
    return {
      name: 'Shift_JIS',
      eci: 20,
      implicit: false,
      encodeChar(character) {
        const cp = character.codePointAt(0)!
        if (cp <= 0x7f) return Uint8Array.of(cp)
        // Half-width katakana
        if (cp >= 0xff61 && cp <= 0xff9f) return Uint8Array.of(cp - 0xff61 + 0xa1)
        const code = toSJIS?.(character)
        return code === undefined || code < 0x8140 ? undefined : Uint8Array.of(code >>> 8, code & 0xff)
      },
    }
  }
  if (typeof encoding === 'object' && encoding !== null && typeof encoding.encode === 'function') {
    const { encode, eci } = encoding
    if (eci !== undefined) assertEciNumber(eci)
    return {
      name: 'custom',
      eci,
      implicit: false,
      encodeChar(character) {
        try {
          const bytes = encode(character)
          return bytes instanceof Uint8Array && bytes.length > 0 ? bytes : undefined
        } catch {
          return undefined
        }
      },
    }
  }
  throw new QRError(
    'INVALID_OPTION',
    `Unsupported character encoding: ${JSON.stringify(encoding)}. Use 'UTF-8', 'ISO-8859-1', 'US-ASCII', 'UTF-16BE', 'Shift_JIS' or { encode, eci }.`,
  )
}

export function assertEciNumber(eci: number): void {
  if (!Number.isInteger(eci) || eci < 0 || eci > 999999) {
    throw new QRError('INVALID_OPTION', `ECI assignment number must be an integer from 0 to 999999. Received: ${eci};`)
  }
}

/** Encodes a whole string, throwing a descriptive error for unrepresentable characters. */
export function encodeString(text: string, encoding: ResolvedEncoding): Uint8Array {
  const parts: Uint8Array[] = []
  let length = 0
  for (const character of text) {
    const bytes = encoding.encodeChar(character)
    if (!bytes) throw unencodable(character, encoding)
    parts.push(bytes)
    length += bytes.length
  }
  const result = new Uint8Array(length)
  let offset = 0
  for (const part of parts) {
    result.set(part, offset)
    offset += part.length
  }
  return result
}

export function unencodable(character: string, encoding: ResolvedEncoding): QRError {
  const cp = character.codePointAt(0)!.toString(16).toUpperCase().padStart(4, '0')
  const hint = encoding.name === 'Shift_JIS' ? ' Provide the `toSJIS` option to encode double-byte characters.' : ''
  return new QRError(
    'INVALID_DATA',
    `The character "${character}" (U+${cp}) cannot be represented in the ${encoding.name} character encoding.${hint}`,
  )
}
