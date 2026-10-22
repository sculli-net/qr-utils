import { describe, expect, it } from 'vitest'
import { createQR, QR, QRError, type QROptions } from '../src/index.js'
import { toSJIS } from '../src/sjis.js'
import { bch18, formatBits } from '../src/symbols/bch.js'

function error(fn: () => unknown): QRError {
  try {
    fn()
  } catch (e) {
    expect(e).toBeInstanceOf(QRError)
    return e as QRError
  }
  throw new Error('expected an error')
}

describe('defaults', () => {
  it('picks the smallest version, ECC M and the best mask', () => {
    const qr = new QR('https://web-site.com')
    expect(qr.symbol).toBe('model2')
    expect(qr.version).toBe(2)
    expect(qr.errorCorrection).toBe('M')
    expect(qr.maskPattern).toBeGreaterThanOrEqual(0)
    expect(qr.width).toBe(25)
    expect(qr.quietZone).toBe(4)
  })

  it('uses per-symbol defaults', () => {
    const micro = new QR('12345', { symbol: 'micro' })
    expect(micro.version).toBe('M1')
    expect(micro.errorCorrection).toBe('L')
    expect(micro.quietZone).toBe(2)
    // Smallest area: R11x27 (297 modules) beats R7x43 (301)
    const rmqr = new QR('12345', { symbol: 'rmqr' })
    expect(rmqr.version).toBe('R11x27')
    expect(rmqr.maskPattern).toBeNull()
    expect([rmqr.width, rmqr.height]).toEqual([27, 11])
  })

  it('accepts an empty string', () => {
    expect(new QR('').version).toBe(1)
  })
})

describe('segmentation', () => {
  it('chooses optimal mixed segments', () => {
    const qr = new QR('ABCDEF0123456789012345abc')
    expect(qr.segments.map((s) => s.mode)).toEqual(['alphanumeric', 'numeric', 'byte'])
    expect(qr.segments.map((s) => s.text).join('')).toBe('ABCDEF0123456789012345abc')
  })

  it('keeps short runs in the surrounding mode when switching costs more', () => {
    expect(new QR('a1b').segments.map((s) => s.mode)).toEqual(['byte'])
  })

  it('forces a single mode', () => {
    expect(new QR('12345', { mode: 'byte' }).segments).toMatchObject([{ mode: 'byte', count: 5 }])
    expect(error(() => new QR('abc', { mode: 'numeric' })).code).toBe('INVALID_DATA')
  })

  it('accepts explicit segments', () => {
    const qr = new QR(['HELLO', { data: '123', mode: 'byte' }, { data: Uint8Array.of(1, 2, 3) }])
    expect(qr.segments.map((s) => s.mode)).toEqual(['alphanumeric', 'byte', 'byte'])
  })

  it('uses kanji mode only with toSJIS', () => {
    expect(new QR('漢字').segments[0]!.mode).toBe('byte')
    expect(new QR('漢字', { toSJIS }).segments[0]).toMatchObject({ mode: 'kanji', count: 2, bits: 4 + 8 + 26 })
  })

  it('counts UTF-8 bytes', () => {
    expect(new QR('é').segments[0]).toMatchObject({ mode: 'byte', count: 2 })
    expect(new QR('é', { encoding: 'ISO-8859-1' }).segments[0]).toMatchObject({ mode: 'byte', count: 1 })
  })
})

describe('version selection', () => {
  it('respects version and versionRange', () => {
    expect(new QR('hi', { version: 10 }).version).toBe(10)
    expect(new QR('hi', { versionRange: [5, 8] }).version).toBe(5)
    expect(new QR('hi', { symbol: 'micro', versionRange: ['M3', 'M4'] }).version).toBe('M3')
  })

  it('throws the capacity error with details', () => {
    const e = error(() => new QR('x'.repeat(100), { version: 2, errorCorrection: 'H' }))
    expect(e.code).toBe('DATA_TOO_LARGE')
    expect(e.message).toBe(
      'The supplied data is larger than the available data capacity. Data size (bits): 812; ECC Level: H; Available bits: 128 (Version 2);',
    )
    expect(error(() => new QR('x'.repeat(3000))).message).toContain('(Version 40);')
  })

  it('orders rMQR versions by the size preference', () => {
    const text = 'x'.repeat(20)
    const area = new QR(text, { symbol: 'rmqr' })
    const height = new QR(text, { symbol: 'rmqr', sizePreference: 'height' })
    const width = new QR(text, { symbol: 'rmqr', sizePreference: 'width' })
    expect(height.height).toBeLessThanOrEqual(area.height)
    expect(width.width).toBeLessThanOrEqual(area.width)
    expect(height.height).toBe(7)
  })

  it('boosts error correction for free', () => {
    const qr = new QR('hello', { boostErrorCorrection: true })
    expect(qr.version).toBe(1)
    expect(qr.errorCorrection).toBe('H')
    expect(new QR('1', { symbol: 'rmqr', boostErrorCorrection: true }).errorCorrection).toBe('H')
  })

  it('reports why Micro QR cannot hold the data', () => {
    const e = error(() => new QR('hello', { symbol: 'micro', version: 'M1' }))
    expect(e.code).toBe('INVALID_DATA')
    expect(e.message).toMatch(/M1 only stores digits/)
  })
})

describe('option validation', () => {
  const cases: [string, QROptions, string, RegExp][] = [
    ['version + versionRange', { version: 1, versionRange: [1, 2] } as never, 'INCOMPATIBLE_OPTIONS', /cannot both be set/],
    ['mask + range', { maskPattern: 1, maskPatternRange: [0, 2] } as never, 'INCOMPATIBLE_OPTIONS', /cannot both be set/],
    ['bad version', { version: 41 as never }, 'INVALID_OPTION', /Invalid version 41/],
    ['bad micro version', { symbol: 'micro', version: 'M5' as never }, 'INVALID_OPTION', /M1, M2, M3, M4/],
    ['reversed range', { versionRange: [9, 3] as never }, 'INVALID_OPTION', /minimum 9 is larger/],
    ['bad mask', { maskPattern: 8 as never }, 'INVALID_OPTION', /0 to 7/],
    ['micro mask', { symbol: 'micro', maskPattern: 5 as never }, 'INVALID_OPTION', /0 to 3/],
    ['rMQR mask', { symbol: 'rmqr', maskPattern: 1 } as never, 'INCOMPATIBLE_OPTIONS', /single fixed mask/],
    ['micro H', { symbol: 'micro', errorCorrection: 'H' as never }, 'INCOMPATIBLE_OPTIONS', /Available levels: L, M, Q/],
    ['rMQR L', { symbol: 'rmqr', errorCorrection: 'L' as never }, 'INCOMPATIBLE_OPTIONS', /Available levels: M, H/],
    ['M1 with M', { symbol: 'micro', version: 'M1', errorCorrection: 'M' }, 'INCOMPATIBLE_OPTIONS', /not available for Micro QR Code version M1/],
    ['micro ECI', { symbol: 'micro', eci: 26 } as never, 'INCOMPATIBLE_OPTIONS', /does not support ECI/],
    ['model1 FNC1', { symbol: 'model1', fnc1: 'first' } as never, 'INCOMPATIBLE_OPTIONS', /does not support FNC1/],
    ['rMQR SA', { symbol: 'rmqr', structuredAppend: { index: 0, total: 2, parity: 0 } } as never, 'INCOMPATIBLE_OPTIONS', /Structured Append/],
    ['SA index', { structuredAppend: { index: 3, total: 2, parity: 0 } }, 'INVALID_OPTION', /index must be/],
    ['bad ECI', { eci: 1_000_000 }, 'INVALID_OPTION', /0 to 999999/],
    ['bad AI', { fnc1: { position: 'second', applicationIndicator: '123' } }, 'INVALID_OPTION', /application indicator/],
    ['bad symbol', { symbol: 'aztec' as never }, 'INVALID_OPTION', /Invalid symbol/],
    ['bad quiet zone', { quietZone: -1 }, 'INVALID_OPTION', /quietZone/],
    ['size preference', { sizePreference: 'area' } as never, 'INCOMPATIBLE_OPTIONS', /only applies to rMQR/],
  ]
  it.each(cases)('%s', (_name, options, code, message) => {
    const e = error(() => new QR('123', options))
    expect(e.code).toBe(code)
    expect(e.message).toMatch(message)
  })

  it('rejects unencodable characters', () => {
    expect(error(() => new QR('€', { encoding: 'ISO-8859-1' })).message).toMatch(/cannot be represented in the ISO-8859-1/)
    expect(error(() => new QR(42 as never)).code).toBe('INVALID_DATA')
  })
})

describe('type level option exclusivity', () => {
  it('is enforced by TypeScript', () => {
    // @ts-expect-error version and versionRange are mutually exclusive
    const both: QROptions = { version: 2, versionRange: [1, 3] }
    // @ts-expect-error maskPattern and maskPatternRange are mutually exclusive
    const masks: QROptions = { maskPattern: 2, maskPatternRange: [0, 3] }
    // @ts-expect-error Micro QR versions are M1–M4
    const micro: QROptions = { symbol: 'micro', version: 5 }
    // @ts-expect-error rMQR has a fixed mask
    const rmqr: QROptions = { symbol: 'rmqr', maskPattern: 2 }
    // @ts-expect-error Micro QR has no ECI
    const eci: QROptions = { symbol: 'micro', eci: 26 }
    const ok: QROptions[] = [{ versionRange: [1, 3] }, { symbol: 'rmqr', version: 'R13x99', errorCorrection: 'H' }]
    expect([both, masks, micro, rmqr, eci, ok]).toBeDefined()
  })
})

describe('landmarks and modules', () => {
  it('locates function patterns', () => {
    const qr = new QR('landmarks', { version: 7 })
    const finders = qr.finderPatterns()
    expect(finders.map((f) => [f.corner, f.x, f.y, f.width])).toEqual([
      ['top-left', 0, 0, 7],
      ['top-right', 38, 0, 7],
      ['bottom-left', 0, 38, 7],
    ])
    expect(qr.alignmentPatterns()).toHaveLength(6)
    expect(qr.landmarks('version')).toHaveLength(2)
    expect(qr.timingPatterns().map((t) => t.orientation)).toEqual(['horizontal', 'vertical'])
    expect(qr.getModule(3, 3)).toMatchObject({ type: 'finder', part: 'inner', dark: true, landmark: finders[0]!.index })
    expect(qr.getModule(1, 1)).toMatchObject({ type: 'finder', part: 'outer', dark: false })
    expect(qr.getModuleType(8, qr.height - 8)).toBe('darkModule')
    expect(qr.landmarkModules(finders[0]!)).toHaveLength(49)
  })

  it('maps data modules to codewords', () => {
    const qr = new QR('codewords', { version: 5, errorCorrection: 'Q' })
    const corner = qr.getModule(qr.width - 1, qr.height - 1)
    expect(corner).toMatchObject({ type: 'data', codeword: { index: 0, block: 0, indexInBlock: 0, bit: 7, kind: 'data' } })
    expect(qr.errorCorrectionBlocks()).toEqual([
      { dataCodewords: 15, eccCodewords: 18, correctableCodewords: 9 },
      { dataCodewords: 15, eccCodewords: 18, correctableCodewords: 9 },
      { dataCodewords: 16, eccCodewords: 18, correctableCodewords: 9 },
      { dataCodewords: 16, eccCodewords: 18, correctableCodewords: 9 },
    ])
    expect(qr.codewords()).toHaveLength(134)
  })

  it('classifies rMQR and Micro QR patterns', () => {
    const rmqr = new QR('1', { symbol: 'rmqr', version: 'R13x43' })
    expect(rmqr.landmarks('subFinder')).toMatchObject([{ corner: 'bottom-right', x: 38, y: 8, width: 5, height: 5 }])
    expect(rmqr.landmarks('cornerFinder').map((l) => l.corner)).toEqual(['top-right', 'bottom-left'])
    expect(rmqr.alignmentPatterns()).toHaveLength(2)
    const micro = new QR('1', { symbol: 'micro' })
    expect(micro.finderPatterns()).toHaveLength(1)
    expect(micro.alignmentPatterns()).toHaveLength(0)
  })
})

describe('outputs', () => {
  const qr = new QR('outputs')

  it('dot matrix with and without quiet zone', () => {
    const matrix = qr.dotMatrix()
    expect(matrix).toHaveLength(21)
    expect(matrix[0]![0]).toBe(true)
    const padded = qr.dotMatrix({ quietZone: true })
    expect(padded).toHaveLength(29)
    expect(padded[4]![4]).toBe(true)
    expect(padded[0]!.every((v) => v === false)).toBe(true)
    expect(qr.binaryMatrix({ quietZone: 1 })).toHaveLength(23)
  })

  it('bitmap, points, text and JSON', () => {
    const bitmap = qr.bitmap()
    expect(bitmap.data.reduce((a, b) => a + b, 0)).toBe(qr.points().length)
    expect(qr.toText({ dark: '#', light: '.' }).split('\n')[0]).toBe('#######.' + qr.dotMatrix()[0]!.slice(8, 13).map((d) => (d ? '#' : '.')).join('') + '.#######')
    expect(JSON.parse(JSON.stringify(qr))).toMatchObject({ symbol: 'model2', version: 1, width: 21 })
  })

  it('createQR formats', () => {
    expect(createQR('x')).toEqual(new QR('x').dotMatrix())
    expect(createQR('x', { format: 'binary', includeQuietZone: true })).toHaveLength(29)
    expect(createQR('x', { format: 'bitmap' }).width).toBe(21)
    expect(createQR('x', { format: 'qr', errorCorrection: 'H' }).errorCorrection).toBe('H')
    expect(createQR('x', { format: 'types' })[0]![0]).toBe('finder')
    expect(createQR('x', { format: 'modules' })[0]![0]).toMatchObject({ x: 0, y: 0, type: 'finder' })
    expect(typeof createQR('x', { format: 'text' })).toBe('string')
    expect(() => createQR('x', { format: 'png' as never })).toThrow(/Unknown format/)
  })

  it('throws RangeError for modules outside the symbol', () => {
    expect(() => qr.getModule(21, 0)).toThrow(RangeError)
    expect(qr.isDark(-1, 0)).toBe(false)
  })
})

describe('structured append', () => {
  it('uses as few symbols as needed and returns one symbol when it fits', () => {
    expect(QR.split('short')).toHaveLength(1)
    const parts = QR.split('y'.repeat(500), { versionRange: [1, 10] })
    expect(parts.length).toBeGreaterThan(1)
    expect(parts.length).toBeLessThanOrEqual(16)
    expect(new Set(parts.map((p) => p.version)).size).toBe(1)
  })

  it('rejects non Model 2 symbols', () => {
    expect(error(() => QR.split('x', { symbol: 'micro' })).code).toBe('INCOMPATIBLE_OPTIONS')
  })
})

describe('format information', () => {
  it('matches the ISO tables', () => {
    // QR Model 2: ECC M (00), mask 0 -> 0x5412; ECC L (01), mask 0 -> 0x77C4
    expect(formatBits(0, 0x5412)).toBe(0x5412)
    expect(formatBits(0b01000, 0x5412)).toBe(0x77c4)
    // Version information for version 7 is 0x07C94
    expect(bch18(7)).toBe(0x07c94)
    // rMQR (finder side): version index 1, ECC M -> 0x1E597
    expect(bch18(1) ^ 0x1fab2).toBe(0x1e597)
    expect(bch18(32 | 31) ^ 0x1fab2).toBe(0x20137)
  })
})
