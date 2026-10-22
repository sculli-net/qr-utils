import { describe, expect, it } from 'vitest'
import { QR, type RMQRVersion } from '../src/index.js'
import { toSJIS } from '../src/sjis.js'
import { model1Capacity } from '../src/symbols/model1.js'
import { MODEL1_BLOCKS } from '../src/symbols/tables.js'
import { decodeMatrix } from './helpers/decode.js'

async function decodeText(qr: QR) {
  const results = await decodeMatrix(qr, { quietZone: qr.quietZone, pure: true })
  expect(results, `no symbol decoded (${qr.symbol} ${qr.version}-${qr.errorCorrection})`).toHaveLength(1)
  const result = results[0]!
  expect(result.error, result.error).toBe('')
  return result
}

const URL_TEXT = 'https://web-site.com/some/path?query=123'

describe('QR Model 2 decodes', () => {
  it.each(['L', 'M', 'Q', 'H'] as const)('every mask at ECC %s', async (errorCorrection) => {
    for (let maskPattern = 0 as 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7; maskPattern < 8; maskPattern++) {
      const qr = new QR(URL_TEXT, { errorCorrection, maskPattern })
      const result = await decodeText(qr)
      expect(result.text).toBe(URL_TEXT)
      expect(result.ecLevel).toBe(errorCorrection)
    }
  })

  it('every version', async () => {
    for (let version = 1; version <= 40; version++) {
      // Fill roughly 90% of the version's byte capacity
      const capacity = new QR('', { version: version as 1, errorCorrection: 'L' }).capacity.dataBits
      const text = `v${version}:`.padEnd(Math.floor((capacity * 0.9 - 20) / 8), 'x')
      const qr = new QR(text, { version: version as 1, errorCorrection: 'L' })
      expect(qr.version).toBe(version)
      expect((await decodeText(qr)).text).toBe(text)
    }
  })

  it('mixed segments, unicode and binary', async () => {
    const samples = ['0123456789012345', 'HELLO WORLD 123', 'Grüße 👋 こんにちは', 'ABC123def456GHI']
    for (const text of samples) expect((await decodeText(new QR(text))).text).toBe(text)
    const bytes = Uint8Array.from({ length: 50 }, (_, i) => (i * 37) % 256)
    const result = await decodeText(new QR(bytes))
    expect(Array.from(result.bytes)).toEqual(Array.from(bytes))
  })

  it('kanji mode', async () => {
    const text = '漢字テスト日本'
    const qr = new QR(text, { toSJIS })
    expect(qr.segments.map((s) => s.mode)).toEqual(['kanji'])
    expect((await decodeText(qr)).text).toBe(text)
  })

  it('ECI', async () => {
    const qr = new QR('Grüße', { encoding: 'ISO-8859-1', eci: true })
    expect((await decodeText(qr)).text).toBe('Grüße')
    const utf16 = new QR('Привет', { encoding: 'UTF-16BE' })
    expect((await decodeText(utf16)).text).toBe('Привет')
  })

  it('FNC1 first position (GS1)', async () => {
    const qr = new QR('0109501101530003\x1d17150101', { fnc1: 'first' })
    const result = await decodeText(qr)
    expect(result.symbologyIdentifier).toBe(']Q3')
    // zxing renders GS1 data as human readable text with application identifiers in brackets
    expect(result.text).toBe('(01)09501101530003(17)150101')
  })

  it('FNC1 second position', async () => {
    const qr = new QR('AB%CD', { fnc1: { position: 'second', applicationIndicator: 'a' } })
    const result = await decodeText(qr)
    expect(result.symbologyIdentifier).toBe(']Q5')
    expect(result.text).toBe('aAB%CD')
  })

  it('structured append', async () => {
    const text = 'Structured append splits long content over several symbols. '.repeat(4)
    const parts = QR.split(text, { symbols: 3 })
    expect(parts).toHaveLength(3)
    expect(new Set(parts.map((p) => p.version)).size).toBe(1)
    let joined = ''
    for (const [index, part] of parts.entries()) {
      const result = await decodeText(part)
      expect(result.sequenceIndex).toBe(index)
      expect(result.sequenceSize).toBe(3)
      joined += result.text
    }
    expect(joined).toBe(text)
  })
})

describe('Micro QR decodes', () => {
  const cases = [
    ['M1', 'L', '12345'],
    ['M2', 'L', 'AB12'],
    ['M2', 'M', '1234'],
    ['M3', 'L', 'hello!'],
    ['M3', 'M', 'abc12'],
    ['M4', 'L', 'Micro QR 12'],
    ['M4', 'M', 'micro-qr'],
    ['M4', 'Q', 'micro'],
  ] as const
  it.each(cases)('%s-%s', async (version, errorCorrection, text) => {
    for (let maskPattern = 0 as 0 | 1 | 2 | 3; maskPattern < 4; maskPattern++) {
      const qr = new QR(text, { symbol: 'micro', version, errorCorrection, maskPattern })
      const result = await decodeText(qr)
      expect(result.text).toBe(text)
      expect(result.format).toBe('MicroQRCode')
      expect(result.version).toBe(version)
    }
  })
})

describe('rMQR decodes', () => {
  const versions = [
    'R7x43', 'R7x59', 'R7x77', 'R7x99', 'R7x139', 'R9x43', 'R9x59', 'R9x77', 'R9x99', 'R9x139',
    'R11x27', 'R11x43', 'R11x59', 'R11x77', 'R11x99', 'R11x139', 'R13x27', 'R13x43', 'R13x59', 'R13x77',
    'R13x99', 'R13x139', 'R15x43', 'R15x59', 'R15x77', 'R15x99', 'R15x139', 'R17x43', 'R17x59', 'R17x77',
    'R17x99', 'R17x139',
  ] as const satisfies readonly RMQRVersion[]
  it.each(versions)('%s', async (version) => {
    for (const errorCorrection of ['M', 'H'] as const) {
      const qr = new QR('R12', { symbol: 'rmqr', version, errorCorrection })
      const result = await decodeText(qr)
      expect(result.text).toBe('R12')
      expect(result.format).toBe('RMQRCode')
      expect(result.version).toBe(version)
    }
  })

  it('fills large versions completely', async () => {
    const text = 'x'.repeat(140)
    const qr = new QR(text, { symbol: 'rmqr' })
    expect(qr.version).toBe('R17x139')
    expect((await decodeText(qr)).text).toBe(text)
  })
})

describe('QR Model 1 decodes', () => {
  // zxing-cpp's Model 1 block table does not add up to the symbol capacity for a few version/level pairs
  // (e.g. all of version 13), so it cannot decode those; only verifiable combinations are checked here.
  // zxing also uses the L row's total as the codeword count for every level.
  const total = (version: number, level: number) => {
    const entry = MODEL1_BLOCKS[version - 1]![level]!
    return entry[1].reduce((sum, [count, data]) => sum + count * (data + entry[0]), 0)
  }
  const verifiable = (version: number, level: number) =>
    total(version, level) === model1Capacity(version) && total(version, 0) === model1Capacity(version)
  it.each(Array.from({ length: 14 }, (_, i) => i + 1))('version %i', async (version) => {
    for (const [level, errorCorrection] of (['L', 'M', 'Q', 'H'] as const).entries()) {
      if (!verifiable(version, level)) continue
      const qr = new QR('MODEL 1', { symbol: 'model1', version: version as 1, errorCorrection })
      const result = await decodeText(qr)
      expect(result.text).toBe('MODEL 1')
      expect(result.symbologyIdentifier).toBe(']Q0')
    }
  })
})
