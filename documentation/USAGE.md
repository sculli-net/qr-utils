# Usage

The API reference lives with each package:

- [`@qr-util/core`](../lib/core/README.md): generating symbols, options, output formats, landmarks, errors
- [`@qr-util/render`](../lib/render/README.md): SVG / PNG / HTML rendering, shapes, module styles, excavation

Every public option and method also carries JSDoc with examples, so editors show the documentation inline.

## Internals (`lib/core/src`)

| Path | Responsibility |
| --- | --- |
| `qr.ts` | `QR` class: metadata, module access, landmarks, output formats, `QR.split` |
| `create-qr.ts` | `createQR(data, { format })` |
| `encode.ts` | option validation, version/ECC selection, bit stream assembly, Reed–Solomon blocks, mask selection |
| `encoding/` | character sets & ECI, optimal segmentation (dynamic programming over modes), bit buffer |
| `ecc/reed-solomon.ts` | GF(256) Reed–Solomon encoder |
| `symbols/` | one definition per symbology (`model2`, `model1`, `micro`, `rmqr`): function patterns, codeword placement, format information, masks; `tables.ts` holds the ISO block tables |
| `sjis.ts` | optional Shift JIS table (`@qr-util/core/sjis`) for Kanji mode |

## Internals (`lib/render/src`)

| Path | Responsibility |
| --- | --- |
| `renderer.ts` | `RenderQR`: layout, excavation, output methods |
| `qr-styles/` | style engine: turns `color` / `shape` / `modules` into layers of rects and paths (`contract.ts` is the interface with the renderer) |
| `excavate.ts` | computes the largest safely removable centre area from the codeword layout |
| `serialize.ts` | SVG and HTML serialisation |
| `raster.ts`, `png.ts`, `color.ts` | anti-aliased rasteriser, PNG encoder (DEFLATE via `fflate`), CSS colour parser |

## Verification

The test suite decodes generated symbols with [zxing-cpp](https://github.com/zxing-cpp/zxing-cpp) (via `zxing-wasm`).
It covers every Model 2 version, ECC level and mask, every Micro QR version/level/mask, all 32 rMQR versions at M and
H, Model 1 (where the reader supports it), ECI, FNC1, Kanji and Structured Append. Rendered PNGs (plain, shaped,
styled and excavated) are decoded as well.
