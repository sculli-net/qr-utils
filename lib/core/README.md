# @qr-util/core

Headless QR Code generation for Node and browsers. It produces the module matrix plus metadata about every
module: which function pattern it belongs to, and which codeword and error correction block it stores. It does not
draw anything; use [`@qr-util/render`](../render) for SVG, PNG and HTML output.

- **Every symbology:** QR Code Model 2, QR Code Model 1, Micro QR (M1–M4) and rMQR (R7x43–R17x139)
- **Full control, sensible defaults:** version, error correction, mask, segments, character encoding / ECI, FNC1 (GS1)
  and Structured Append
- **Optimal segmentation:** numeric, alphanumeric, byte and Kanji segments are mixed to produce the smallest bit stream
- **Landmarks:** finder, alignment and timing patterns etc. are exposed for custom rendering
- **No dependencies.** Ships as ESM with TypeScript types and JSDoc on every option.

```sh
npm install @qr-util/core
```

## Quick start

```ts
import { QR, createQR } from '@qr-util/core'

const qr = new QR('https://web-site.com')
qr.version       // 2  (smallest version that fits)
qr.errorCorrection // 'M'
qr.dotMatrix()   // boolean[][], true = dark

const custom = new QR('https://web-site.com', {
  maskPattern: 6,
  errorCorrection: 'Q',
})

// Function form returning a chosen format
const dots = createQR('https://web-site.com')                        // boolean[][] (default)
const bitmap = createQR('https://web-site.com', { format: 'bitmap' })  // { width, height, data: Uint8Array }
```

## Options

Every option is optional. TypeScript narrows the available options by `symbol`. For example, Micro QR versions are
`'M1'`–`'M4'` and rMQR has no `maskPattern`.

| Option | Values | Default |
| --- | --- | --- |
| `symbol` | `'model2'`, `'model1'`, `'micro'`, `'rmqr'` | `'model2'` |
| `version` / `versionRange` | Model 2 `1`–`40`, Model 1 `1`–`14`, Micro `'M1'`–`'M4'`, rMQR `'R7x43'`…`'R17x139'` | smallest that fits |
| `errorCorrection` | `'L'`, `'M'`, `'Q'`, `'H'` (Micro: L/M/Q, rMQR: M/H) | `'M'` (Micro: `'L'`) |
| `boostErrorCorrection` | raise ECC while the data still fits the chosen version | `false` |
| `maskPattern` / `maskPatternRange` | `0`–`7` (Micro `0`–`3`) | lowest penalty mask |
| `mode` | `'auto'`, `'numeric'`, `'alphanumeric'`, `'byte'`, `'kanji'` | `'auto'` (optimal mix) |
| `encoding` | `'UTF-8'`, `'ISO-8859-1'`, `'US-ASCII'`, `'UTF-16BE'`, `'Shift_JIS'`, `{ encode, eci }` | `'UTF-8'` |
| `eci` | `true`, `false` or an ECI number (Model 2 / rMQR) | automatic |
| `toSJIS` | Shift JIS converter: enables Kanji mode | none |
| `fnc1` | `'none'`, `'first'` (GS1), `{ position: 'second', applicationIndicator }` | `'none'` |
| `structuredAppend` | `{ index, total, parity }` (Model 2), or use `QR.split()` | none |
| `quietZone` | modules of margin to recommend (min 4 for QR, 2 for Micro/rMQR) | spec minimum |
| `sizePreference` | rMQR only: `'area'`, `'height'`, `'width'` | `'area'` |

Setting both `version` and `versionRange`, or both `maskPattern` and `maskPatternRange`, is a type error and also
throws at runtime.

### Errors

Invalid or incompatible options and unencodable data throw a `QRError`. Its `code` is one of `INVALID_OPTION`,
`INCOMPATIBLE_OPTIONS`, `INVALID_DATA` or `DATA_TOO_LARGE`, and the message says what to change:

```
The supplied data is larger than the available data capacity. Data size (bits): 812; ECC Level: H; Available bits: 128 (Version 2);
```

## Data and segments

```ts
new QR('text')                              // string, optimal segments
new QR(new Uint8Array([0, 1, 2]))           // raw bytes
new QR([                                    // explicit segments
  { data: 'ORDER', mode: 'alphanumeric' },
  { data: '0123456789', mode: 'numeric' },
  { data: 'Grüße', eci: 26 },               // ECI before this segment
])
qr.segments // [{ mode, text, count, bits, eci? }, ...]
```

### Kanji

Kanji mode stores Shift JIS characters in 13 bits each instead of 24 bits of UTF-8. The conversion table ships as a
separate entry point, so it is only bundled when you import it:

```ts
import { toSJIS } from '@qr-util/core/sjis'
new QR('漢字テスト', { toSJIS })
```

### GS1 / FNC1

```ts
new QR('0109501101530003\x1d17150101', { fnc1: 'first' }) // \x1D (GS) separates fields
```

### Structured Append

```ts
const parts = QR.split(longText, { versionRange: [1, 10] }) // as few symbols as needed (max 16)
const four = QR.split(longText, { symbols: 4 })              // exactly four symbols, same version
```

## Reading the symbol

| Method | Returns |
| --- | --- |
| `dotMatrix(opts?)` | `boolean[][]` rows (`true` = dark) |
| `binaryMatrix(opts?)` | `(0 \| 1)[][]` |
| `bitmap(opts?)` | `{ width, height, data: Uint8Array }` row-major |
| `points(opts?)` | `{ x, y }[]` of dark modules |
| `toText(opts?)` | string art for terminals |
| `moduleMatrix()` | `QRModule[][]`: type, landmark, part and codeword of each module |
| `typeMatrix()` | `ModuleType[][]` |
| `isDark(x, y)`, `getModule(x, y)`, `getModuleType(x, y)`, `isFunctionModule(x, y)` | single module access |

`opts.quietZone` adds the quiet zone (`true` for the recommended width, or a number of modules).
`createQR(data, { format })` returns any of these directly. Its formats are `'matrix'` (default), `'binary'`,
`'bitmap'`, `'points'`, `'modules'`, `'types'`, `'text'` and `'qr'`, and `includeQuietZone` adds the quiet zone.

### Landmarks (function patterns)

```ts
qr.finderPatterns()   // [{ type: 'finder', corner: 'top-left', x: 0, y: 0, width: 7, height: 7, index }, ...]
qr.alignmentPatterns()
qr.timingPatterns()   // with orientation
qr.landmarks('format')
qr.landmarkModules(qr.finderPatterns()[0])
qr.getModule(3, 3)    // { type: 'finder', part: 'inner', dark: true, landmark: 1, ... }
```

Module types are `finder`, `separator`, `timing`, `alignment`, `format`, `version`, `darkModule`, `subFinder` (rMQR),
`cornerFinder` (rMQR), `extension` (Model 1), `data`, `ecc` and `remainder`. Data and ECC modules also report
their `codeword` (index, block, bit), and `errorCorrectionBlocks()` reports how many codewords each block can
correct. `@qr-util/render` uses this to work out how much of the centre can safely be cleared for a logo.

## Standards notes

- QR Code Model 2 and Micro QR follow ISO/IEC 18004, and rMQR follows ISO/IEC 23941. Every version, error correction
  level and mask is verified by decoding with zxing-cpp in the test suite.
- **QR Model 1 is a legacy symbology.** Its layout follows the zxing-cpp Model 1 reader, and the versions that
  reader supports decode in tests. Two parts could not be checked against the original specification: the
  extension pattern module values (which readers ignore), and the block structure of a few version/level
  combinations (version 13, version 14, and some H/Q levels). For those, the published table does not add up to
  the symbol's capacity, so the difference is assigned to the last blocks. Use Model 2 unless you need Model 1.

## License

MIT. Originally based on [node-qrcode](https://github.com/soldair/node-qrcode) by Ryan Day.
"QR Code" is a registered trademark of DENSO WAVE INCORPORATED.
