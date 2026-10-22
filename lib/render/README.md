# @qr-util/render

Renders QR codes from [`@qr-util/core`](../core) as **SVG** (default), **PNG** or **HTML**. It supports rounded and
"liquid" shapes, separate styles for finder, alignment and timing patterns, and a safe centre cut-out for logos.
It runs in Node and browsers; PNG output is rasterised in pure JavaScript.

```sh
npm install @qr-util/core @qr-util/render
```

```ts
import { QR } from '@qr-util/core'
import { RenderQR, renderQR } from '@qr-util/render'

const qr = new QR('https://web-site.com')
const renderer = new RenderQR(qr)

renderer.toSVG()      // '<svg …>'      (also renderer.render() / String(renderer))
renderer.toPNG()      // Uint8Array PNG file
renderer.toHTML()     // '<div …>' of absolutely positioned <div>s
renderer.toPixels()   // { width, height, data } RGBA, e.g. for canvas ImageData
renderer.toDataURL('png')

renderQR('https://web-site.com', { format: 'png', size: 512, qr: { errorCorrection: 'H' } })
```

## Options

| Option | Purpose | Default |
| --- | --- | --- |
| `size` | output size in px (longest side; rMQR keeps its aspect ratio) | `256` |
| `padding` | px between the image border and the quiet zone | `0` |
| `quietZone` | `true` (the QR's recommended width), `false`, or a number of modules | `true` |
| `backgroundColor` | any CSS colour, or `null` for transparent | `'white'` |
| `color` | dark module colour (CSS colour) | `'black'` |
| `excavate` | `true`/`false` or `0`–`100`: clear the centre for a logo | `false` |
| `shape` | dot / outline shape (see below) | plain squares |
| `modules` | separate styles for `finder`, `alignment`, `timing` | none |
| `className` | `class` of the root element (SVG, HTML) | none |
| `compression` | PNG DEFLATE level `0`–`9` | `6` |

`className` and `compression` can also be passed per call: `toSVG({ className })`, `toPNG({ compression })`.

Colours are passed through unchanged to SVG and HTML, so `var(--brand)` works there. PNG output accepts named
colours, hex, `rgb()`, `hsl()`, `hwb()`, `oklab()` and `oklch()`.

## Shapes

`shape` uses CSS `border-radius` values: numbers are px, and strings may use `px`, `%`, `rem`/`em`, or the 1–4 value
shorthand. Tuples work too.

```ts
{ shape: { borderRadius: 4 } }                        // merged outlines with rounded corners ("liquid")
{ shape: { individual: { borderRadius: '50%' } } }    // round dots
{ shape: { individual: { borderRadius: '50%' }, global: { borderRadius: 3 } } }
{ shape: { borderRadius: ['50%', 0], alignmentOffset: true } }       // leaf shapes pointing to the centre
{ shape: { individual: { borderRadius: '50%', distanceWeight: [0, 1] } } } // rounder towards the edges
```

- `global` (the default target) traces connected groups of modules and rounds the outline. Inner corners get a
  smooth fillet.
- `individual` rounds every module separately.
- `alignmentOffset: true | 'mirror'` rotates the corner tuple based on which corner of the symbol the element is
  closest to.
- `distanceWeight: [near, far]` scales radii from the centre of the object to its edge.

## Function pattern styles

```ts
new RenderQR(qr, {
  color: '#0f172a',
  modules: {
    finder: {
      outer: { color: '#e11d48', shape: { borderRadius: 10 } },
      inner: { shape: { borderRadius: '50%' } },
    },
    alignment: { color: '#334155' },
    timing: { color: '#94a3b8' },
  },
})

// Per corner: [top-left, top-right, bottom-right, bottom-left]; null keeps the default style
{ modules: { finder: [{ color: 'red' }, null, null, { color: 'blue' }] } }
```

Each styled pattern is drawn in its own layer. In SVG every layer is one `<path class="qr-{region}">` (with
`qr-corner-{n}` for finders). In HTML every layer is a `<div class="qr-layer qr-{region}">`.

> **Scanning tip:** finder patterns are how scanners find the code. When you use round `individual` dots, give the
> finders their own solid style (e.g. `modules: { finder: { shape: { borderRadius: 6 } } }`), otherwise many readers
> cannot detect the symbol.

## Logos: `excavate`

`excavate` clears data modules from a centred square so a logo can sit on top. The largest safe square is
computed from the symbol's actual codeword layout. It counts how many codewords of every error correction block the
square would destroy, and keeps each block within 80% of its correction capacity. Function patterns are never
removed. `100` (or `true`) clears that whole square, and smaller numbers clear that share of its area.

```ts
const qr = new QR('https://web-site.com', { errorCorrection: 'H' }) // more ECC = more room
const renderer = new RenderQR(qr, { size: 400, excavate: 80 })
const { x, y, width, height } = renderer.excavation! // where to place the logo (px)
```

## Layout

`renderer.layout` gives the image `width`/`height`, `moduleSize`, `quietZone`, `padding` and the pixel origin of
the symbol. `renderer.plan` exposes the geometry that every output draws: layers of rectangles and paths in pixels.

## License

MIT
