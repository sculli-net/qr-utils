# qr-util

Vector based QR Code tooling for Node and browsers, used for the "Learn QR" site from sculli.net.
Based on code from [soldair/node-qrcode](https://github.com/soldair/node-qrcode).

| Package | Purpose |
| --- | --- |
| [`@qr-util/core`](lib/core) | Generates QR Code Model 1/2, Micro QR and rMQR symbols. Exposes the module matrix in several formats, plus landmarks (function patterns) and codeword metadata |
| [`@qr-util/render`](lib/render) | Renders a core `QR` as SVG, PNG or HTML with shapes, per-pattern styles and logo excavation |

```ts
import { QR } from '@qr-util/core'
import { RenderQR } from '@qr-util/render'

const qr = new QR('https://web-site.com', { errorCorrection: 'Q' })
const svg = new RenderQR(qr, { shape: { borderRadius: '50%' } }).toSVG()
```

## Repository layout

```
lib/core            @qr-util/core (published)
lib/render          @qr-util/render (published)
lib/render/src/qr-styles   style engine (shape / modules geometry) used by the renderer
app                 docs & interactive playground (not published)
documentation       project specification
```

## Development

```sh
pnpm install
pnpm test        # vitest: unit tests + every symbol type decoded with zxing-cpp (WebAssembly)
pnpm typecheck
pnpm build       # emits lib/*/dist
```

Publishing: `pnpm --filter @qr-util/core publish` and then `pnpm --filter @qr-util/render publish`. pnpm replaces
the `workspace:^` dependency with the released version. The `@qr-util` npm scope must exist (the unscoped
`qr-util` name is taken on npm).
