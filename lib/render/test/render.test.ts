import { QR } from '@sculli/qr-utils/core'
import { describe, expect, it } from 'vitest'
import { decodeImage } from '../../core/test/helpers/decode.js'
import { parseColor, RenderQR, renderQR } from '../src/index.js'

const TEXT = 'https://web-site.com/render?test=1'

async function expectDecodes(png: Uint8Array, text = TEXT) {
  const results = await decodeImage(png)
  expect(results.length, 'no symbol decoded').toBeGreaterThan(0)
  expect(results[0]!.error).toBe('')
  expect(results[0]!.text).toBe(text)
}

describe('PNG output decodes', () => {
  it('plain squares', async () => {
    await expectDecodes(new RenderQR(new QR(TEXT)).toPNG())
  })

  it('global rounded outline, individual dots and styled finders', async () => {
    const qr = new QR(TEXT, { errorCorrection: 'Q' })
    await expectDecodes(new RenderQR(qr, { size: 400, shape: { borderRadius: '50%' } }).toPNG())
    // Dotted finder patterns are hard to detect, so dots are combined with solid finders
    await expectDecodes(
      new RenderQR(qr, {
        size: 400,
        shape: { individual: { borderRadius: '40%' } },
        modules: { finder: { shape: { borderRadius: 6 } } },
      }).toPNG(),
    )
    await expectDecodes(
      new RenderQR(qr, {
        size: 400,
        color: '#123456',
        backgroundColor: '#fafafa',
        modules: {
          finder: { outer: { color: 'rgb(200 0 80)', shape: { borderRadius: 10 } }, inner: { shape: { borderRadius: '50%' } } },
          alignment: { color: 'navy' },
        },
      }).toPNG(),
    )
  })

  it.each(['L', 'M', 'Q', 'H'] as const)('excavated to the maximum at ECC %s', async (errorCorrection) => {
    const qr = new QR(TEXT, { errorCorrection })
    const renderer = new RenderQR(qr, { size: 400, excavate: true })
    const excavation = renderer.excavation
    if (errorCorrection !== 'L') expect(excavation?.removedModules).toBeGreaterThan(0)
    await expectDecodes(renderer.toPNG())
  })

  it('Micro QR and rMQR', async () => {
    await expectDecodes(new RenderQR(new QR('MICRO 42', { symbol: 'micro' })).toPNG(), 'MICRO 42')
    const rmqr = new RenderQR(new QR('rMQR render', { symbol: 'rmqr' }), { size: 600 })
    expect(rmqr.layout.width).toBe(600)
    expect(rmqr.layout.height).toBeLessThan(600)
    await expectDecodes(rmqr.toPNG(), 'rMQR render')
  })
})

describe('excavation', () => {
  it('grows with the error correction level and the percentage', () => {
    const sides = (['L', 'M', 'Q', 'H'] as const).map(
      (errorCorrection) => new RenderQR(new QR(TEXT, { errorCorrection, version: 5 }), { excavate: 100 }).excavation?.modules.width ?? 0,
    )
    expect(sides).toEqual([...sides].sort((a, b) => a - b))
    const qr = new QR(TEXT, { errorCorrection: 'H' })
    const half = new RenderQR(qr, { excavate: 50 }).excavation!.modules.width
    const full = new RenderQR(qr, { excavate: 100 }).excavation!.modules.width
    expect(half).toBeLessThan(full)
    expect(new RenderQR(qr, { excavate: 0 }).excavation).toBeNull()
    expect(new RenderQR(qr).excavation).toBeNull()
  })

  it('never removes function patterns and reports the pixel area', () => {
    const qr = new QR(TEXT, { errorCorrection: 'H', version: 10 })
    const renderer = new RenderQR(qr, { excavate: true, size: 570, quietZone: false })
    const area = renderer.excavation!
    expect(area.x).toBeCloseTo(area.modules.x * 10)
    // The centre alignment pattern of version 10 stays visible
    const centre = qr.alignmentPatterns().find((p) => p.x === 26 && p.y === 26)
    expect(centre).toBeDefined()
    expect(renderer.toSVG()).toContain('qr-base')
  })

  it('rejects invalid values', () => {
    expect(() => new RenderQR(new QR(TEXT), { excavate: 150 })).toThrow(RangeError)
  })
})

describe('SVG output', () => {
  it('has the requested size, background, colour and class', () => {
    const svg = new RenderQR(new QR(TEXT), { size: 300, color: '#ff0000', className: 'my-qr' }).toSVG()
    expect(svg).toMatch(/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" width="300" height="300" viewBox="0 0 300 300"/)
    expect(svg).toContain('class="my-qr"')
    expect(svg).toContain('<rect width="100%" height="100%" fill="white"/>')
    expect(svg).toContain('fill="#ff0000"')
    expect(svg).toContain('shape-rendering="crispEdges"')
  })

  it('omits the background when null and anti-aliases curves', () => {
    const svg = new RenderQR(new QR(TEXT), { backgroundColor: null, shape: { borderRadius: 3 } }).toSVG()
    expect(svg).not.toContain('<rect')
    expect(svg).not.toContain('crispEdges')
    expect(svg).toMatch(/C[0-9]/)
  })

  it('escapes attribute values', () => {
    const svg = new RenderQR(new QR(TEXT), { className: '"><script>' }).toSVG()
    expect(svg).not.toContain('<script>')
  })

  it('renders separate finder layers', () => {
    // Tuple order: top-left, top-right, bottom-right, bottom-left (QR Code has no bottom-right finder)
    const svg = new RenderQR(new QR(TEXT), { modules: { finder: [{ color: 'red' }, null, null, { color: 'blue' }] } }).toSVG()
    expect(svg).toContain('qr-corner-0')
    expect(svg).toContain('qr-corner-3')
    expect(svg).not.toContain('qr-corner-1')
    expect(svg).toContain('fill="red"')
    expect(svg).toContain('fill="blue"')
  })

  it('padding and quiet zone shift the symbol', () => {
    const qr = new QR(TEXT)
    const plain = new RenderQR(qr, { size: 290, quietZone: false })
    expect(plain.layout.moduleSize).toBeCloseTo(290 / qr.width)
    expect(plain.layout.originX).toBe(0)
    const padded = new RenderQR(qr, { size: 290, padding: 10, quietZone: 2 })
    expect(padded.layout.originX).toBeCloseTo(10 + 2 * padded.layout.moduleSize)
  })
})

describe('HTML output', () => {
  it('renders squares as divs', () => {
    const html = new RenderQR(new QR('HTML'), { className: 'qr' }).toHTML()
    expect(html).toMatch(/^<div class="qr" role="img" style="position:relative;overflow:hidden;width:256px;height:256px;background:white">/)
    expect(html).toContain('position:absolute;left:')
    expect(html).not.toContain('<svg')
  })

  it('uses border-radius and clip-path for shapes', () => {
    expect(new RenderQR(new QR('HTML'), { shape: { individual: { borderRadius: 2 } } }).toHTML()).toContain('border-radius:')
    expect(new RenderQR(new QR('HTML'), { shape: { borderRadius: 2 } }).toHTML()).toContain("clip-path:path('M")
  })
})

describe('PNG encoding', () => {
  it('writes a valid signature and honours the compression level', () => {
    const renderer = new RenderQR(new QR(TEXT), { size: 512 })
    const fast = renderer.toPNG({ compression: 0 })
    const small = renderer.toPNG({ compression: 9 })
    expect(Array.from(fast.slice(0, 8))).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    expect(small.length).toBeLessThan(fast.length)
    expect(() => renderer.toPNG({ compression: 12 })).toThrow(RangeError)
  })

  it('keeps transparency', () => {
    const pixels = new RenderQR(new QR(TEXT), { backgroundColor: null }).toPixels()
    expect(pixels.data[3]).toBe(0)
  })

  it('produces data URLs', () => {
    const renderer = new RenderQR(new QR('data'))
    expect(renderer.toDataURL()).toMatch(/^data:image\/svg\+xml;base64,/)
    expect(renderer.toDataURL('png')).toMatch(/^data:image\/png;base64,iVBORw0KGgo/)
  })
})

describe('renderQR()', () => {
  it('defaults to SVG and accepts raw data', async () => {
    expect(renderQR('hello')).toMatch(/^<svg/)
    expect(renderQR(new QR('hello'), { format: 'html' })).toMatch(/^<div/)
    const png = renderQR('hello', { format: 'png', qr: { errorCorrection: 'H' } })
    expect(png).toBeInstanceOf(Uint8Array)
    await expectDecodes(png, 'hello')
  })
})

describe('parseColor', () => {
  it.each([
    ['black', { r: 0, g: 0, b: 0, a: 1 }],
    ['#fff', { r: 255, g: 255, b: 255, a: 1 }],
    ['#11223380', { r: 0x11, g: 0x22, b: 0x33, a: 128 / 255 }],
    ['rgb(255, 0, 0)', { r: 255, g: 0, b: 0, a: 1 }],
    ['rgba(0 128 255 / 50%)', { r: 0, g: 128, b: 255, a: 0.5 }],
    ['hsl(120deg 100% 25%)', { r: 0, g: 128, b: 0, a: 1 }],
    ['hwb(0 0% 0%)', { r: 255, g: 0, b: 0, a: 1 }],
    ['oklch(62.8% 0.2577 29.23)', { r: 255, g: 0, b: 0, a: 1 }],
    ['transparent', { r: 0, g: 0, b: 0, a: 0 }],
  ])('%s', (input, expected) => {
    const color = parseColor(input)
    expect(color.r).toBeCloseTo(expected.r, -0.5)
    expect(color.g).toBeCloseTo(expected.g, -0.5)
    expect(color.b).toBeCloseTo(expected.b, -0.5)
    expect(color.a).toBeCloseTo(expected.a, 2)
  })

  it('rejects unsupported colours with a clear error', () => {
    expect(() => parseColor('currentColor')).toThrow(/Cannot use colour "currentColor"/)
    expect(() => parseColor('#12')).toThrow(TypeError)
  })
})
