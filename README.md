# @sculli/qr-utils

Vector based QR Code tooling for Node and browsers, used for the "Learn QR" site from sculli.net.
Based on code from [soldair/node-qrcode](https://github.com/soldair/node-qrcode).

Install the single package:

```sh
pnpm add @sculli/qr-utils
```

| Import | Purpose |
| --- | --- |
| `@sculli/qr-utils` | All public generation and rendering exports |
| [`@sculli/qr-utils/core`](lib/core) | Generates QR Code Model 1/2, Micro QR and rMQR symbols. Exposes the module matrix in several formats, plus landmarks (function patterns) and codeword metadata |
| [`@sculli/qr-utils/render`](lib/render) | Renders a core `QR` as SVG, PNG or HTML with shapes, per-pattern styles and logo excavation |
| `@sculli/qr-utils/core/sjis` | Optional Shift JIS table for Kanji mode (not loaded by the root import) |

```ts
import { QR, RenderQR } from '@sculli/qr-utils'

const qr = new QR('https://web-site.com', { errorCorrection: 'Q' })
const svg = new RenderQR(qr, { shape: { borderRadius: '50%' } }).toSVG()
```

Or import individual modules:

```ts
import { QR, createQR } from '@sculli/qr-utils/core'
import { RenderQR, renderQR } from '@sculli/qr-utils/render'
import { toSJIS } from '@sculli/qr-utils/core/sjis'
```

The package is ESM and includes TypeScript declarations. Generation-only consumers can use
`@sculli/qr-utils/core` without loading the renderer. Existing `@qr-util/core` and `@qr-util/render`
imports should be changed to `@sculli/qr-utils/core` and `@sculli/qr-utils/render`, respectively.

## Repository layout

```
lib/index.ts        @sculli/qr-utils root exports
lib/core            @sculli/qr-utils/core source
lib/render          @sculli/qr-utils/render source
lib/render/src/qr-styles   style engine (shape / modules geometry) used by the renderer
app                 docs & interactive playground (not published)
documentation       project specification
```

## Development

```sh
pnpm install
pnpm test        # vitest: unit tests + every symbol type decoded with zxing-cpp (WebAssembly)
pnpm typecheck
pnpm build       # emits dist/ with JavaScript and TypeScript declarations
pnpm pack        # builds and creates the publishable @sculli/qr-utils tarball
```

Publishing: run `pnpm publish` from the repository root. The `prepack` script builds the library;
only the library build, sources, API references, root README and licence are published, not the website.
