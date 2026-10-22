# Usage

A reference for every function, class and constant exported by `qr-util`, plus examples of how they are used.

> **Current state of the entry points**
>
> - `package.json` sets `"main": "./src/index.js"`, but `src/index.js` is **empty**. For now, importing the package by name gives you nothing.
> - The working high-level API is `createQR` in `src/qrcode.js` (CommonJS).
> - `src/qrcode.ts` is the TypeScript port of `qrcode.js`. It is in progress: it imports its dependencies but does not export anything yet.
> - All other modules are TypeScript ES modules. Each one has **named exports** and a **default export** object that holds the same members. The project has no build step or `tsconfig.json` yet, so you need a TypeScript-aware runtime or bundler (for example `tsx`, `ts-node`, Vite or esbuild) to use them.

---

## Contents

- [Quick start](#quick-start)
- [`createQR`](#createqrdata-options) — high-level API
- [Rendering the result](#rendering-the-result)
- Module reference
  - [`utils`](#utils)
  - [`error-correction-level`](#error-correction-level)
  - [`version`](#version)
  - [`version-check`](#version-check)
  - [`mode`](#mode)
  - [`segments`](#segments)
  - [`regex`](#regex)
  - [`mask-pattern`](#mask-pattern)
  - [`finder-pattern`](#finder-pattern)
  - [`alignment-pattern`](#alignment-pattern)
  - [`format-info`](#format-info)
  - [`error-correction-code`](#error-correction-code)
  - [`bit-buffer`](#bit-buffer)
  - [`bit-matrix`](#bit-matrix)
  - Segment data classes: [`numeric-data`](#numeric-data), [`alphanumeric-data`](#alphanumeric-data), [`byte-data`](#byte-data), [`kanji-data`](#kanji-data)
  - Reed–Solomon internals: [`galois-field`](#galois-field), [`polynomial`](#polynomial), [`reed-solomon-encoder`](#reed-solomon-encoder)
  - [`dijkstrajs`](#dijkstrajs)

---

## Quick start

```js
const { createQR } = require('./src/qrcode')

const qr = createQR('https://sculli.net', { errorCorrectionLevel: 'H' })

qr.version              // 3
qr.modules.size         // 29  (modules per side)
qr.modules.get(0, 0)    // 1   (dark)
qr.maskPattern          // 0–7, chosen automatically
```

The library does not draw anything itself. It gives you a matrix of dark and light modules, and you choose how to render it (SVG, DOM, canvas, PNG, and so on).

---

## `createQR(data, options?)`

**Source:** `src/qrcode.js`

Builds a complete QR code symbol: it encodes the data, adds error correction, places the function patterns and applies the best mask.

### Parameters

| Name | Type | Description |
| --- | --- | --- |
| `data` | `string \| Array<string \| { data, mode? }>` | The content to encode. A string is split into optimised segments for you. An array lets you set the segments yourself (see [`Segments.fromArray`](#segments)). |
| `options.errorCorrectionLevel` | `'L' \| 'M' \| 'Q' \| 'H'` (or `'low'`, `'medium'`, `'quartile'`, `'high'`) | Defaults to `M`. |
| `options.version` | `number` (1–40) | QR version (symbol size). If you leave it out, the smallest version that fits the data is used. |
| `options.maskPattern` | `number` (0–7) | Forces a mask. If you leave it out, the mask with the lowest penalty score is chosen. |
| `options.toSJISFunc` | `(char: string) => number` | Converts a UTF-8 character to its Shift JIS value. Supplying it **turns on Kanji mode**. |

### Returns

```ts
{
  modules: BitMatrix,           // the symbol grid — see bit-matrix
  version: number,              // 1–40
  errorCorrectionLevel: { bit: number },
  maskPattern: number,          // 0–7
  segments: Segment[]           // the encoded data segments
}
```

### Errors

- `'No input text'`: `data` is `undefined` or `''`.
- `'Invalid data'`: `data` is not a string or an array.
- `'The amount of data is too big to be stored in a QR Code'`: the data does not fit even in version 40.
- `'The chosen QR Code version cannot contain this amount of data…'`: the `version` you passed is too small.

### Examples

```js
// Let the library choose everything
createQR('Hello world')

// Fixed version and error correction level
createQR('Hello world', { version: 5, errorCorrectionLevel: 'Q' })

// Manual segments: mixed numeric + byte data
createQR([
  { data: '0123456789', mode: 'numeric' },
  { data: 'abc' }                // mode is detected automatically
])

// Kanji support (the toSJIS helper from node-qrcode works here)
const toSJIS = require('qrcode/helper/to-sjis')
createQR('漢字', { toSJISFunc: toSJIS })
```

---

## Rendering the result

`qr.modules` is a [`BitMatrix`](#bit-matrix). Read it with `get(row, col)`. A value of `1` means dark.

```js
function toSVG (qr, { margin = 4, scale = 10 } = {}) {
  const { size } = qr.modules
  const full = size + margin * 2
  let path = ''

  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      if (qr.modules.get(row, col)) {
        path += `M${col + margin} ${row + margin}h1v1h-1z`
      }
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${full} ${full}" ` +
    `width="${full * scale}" height="${full * scale}" shape-rendering="crispEdges">` +
    `<rect width="100%" height="100%" fill="#fff"/><path d="${path}" fill="#000"/></svg>`
}
```

To pick out structural parts of the code (for example to style the corners differently), use [`FinderPattern.getPositions`](#finder-pattern) and [`AlignmentPattern.getPositions`](#alignment-pattern). `qr.modules.isReserved(row, col)` tells you whether a module is a function pattern or format/version information rather than data.

---

## Module reference

Every module below can be imported in either style:

```ts
import { getSymbolSize } from './src/utils'   // named
import Utils from './src/utils'               // default object
Utils.getSymbolSize(1)
```

### `utils`

**Source:** `src/utils.ts`

| Function | Description |
| --- | --- |
| `getSymbolSize(version: number): number` | Number of modules per side for a version (`version * 4 + 17`). Throws if `version` is missing or outside 1–40. |
| `getSymbolTotalCodewords(version: number): number` | Total codewords (data + error correction) for a version. |
| `getBCHDigit(data: number): number` | Position of the highest set bit. Used for BCH encoding of format and version info. |
| `setToSJISFunction(fn)` | Registers a UTF-8 → Shift JIS converter and turns on Kanji mode globally. Throws if `fn` is not a function. |
| `isKanjiModeEnabled(): boolean` | `true` once `setToSJISFunction` has been called. |
| `toSJIS(char: string): number` | Calls the registered SJIS converter. |

```ts
getSymbolSize(1)            // 21
getSymbolSize(40)           // 177
getSymbolTotalCodewords(1)  // 26
```

### `error-correction-level`

**Source:** `src/error-correction-level.ts`

| Export | Description |
| --- | --- |
| `levels` | `{ L: { bit: 1 }, M: { bit: 0 }, Q: { bit: 3 }, H: { bit: 2 } }`. Recovery capacity is about 7%, 15%, 25% and 30%. |
| `LevelValue` (type) | The type of one of the `levels` entries. |
| `isValid(level): boolean` | `true` for a level **object**. Strings always return `false`. |
| `from(value, defaultValue): LevelValue` | Accepts a level object or a string (`'l'`, `'low'`, `'M'`, `'medium'`, …, case-insensitive). Returns `defaultValue` if the value is not recognised. |

The default export also includes `L`, `M`, `Q`, `H` and `fromString(str)`. `fromString` throws on unknown input instead of falling back to a default.

```ts
import ECLevel from './src/error-correction-level'
ECLevel.from('high', ECLevel.M)   // { bit: 2 }  (H)
ECLevel.from('nope', ECLevel.M)   // { bit: 0 }  (M)
ECLevel.fromString('q')           // { bit: 3 }
```

### `version`

**Source:** `src/version.ts`

| Function | Description |
| --- | --- |
| `getCapacity(version, errorCorrectionLevel, mode?): number` | Maximum number of characters that fit for the given version, error correction level and mode (defaults to `Mode.BYTE`). With `Mode.MIXED` it returns the raw data **bits** available. |
| `getBestVersionForData(data, errorCorrectionLevel): number \| undefined` | Smallest version that holds a segment or an array of segments. Returns `undefined` if nothing fits. The error correction level defaults to `M`. |
| `from(value, defaultValue): number` | Parses a version number or string. Returns `defaultValue` if it is not in 1–40. |
| `getEncodedBits(version): number` | The 18-bit version information block (Golay-encoded). Only valid for versions 7 and above; throws otherwise. |

```ts
import Version from './src/version'
import ECLevel from './src/error-correction-level'
import Mode from './src/mode'

Version.getCapacity(1, ECLevel.L, Mode.NUMERIC)   // 41
Version.getCapacity(1, ECLevel.H, Mode.BYTE)      // 7
Version.from('10', undefined)                     // 10
Version.getEncodedBits(7)                         // 0x07C94
```

### `version-check`

**Source:** `src/version-check.ts`

| Function | Description |
| --- | --- |
| `isValid(version: number): boolean` | `true` if `version` is a number from 1 to 40. |

### `mode`

**Source:** `src/mode.ts`

Each mode is an object `{ id, bit, ccBits }`. `ccBits` holds the length of the character count indicator for versions 1–9, 10–26 and 27–40.

| Export | Description |
| --- | --- |
| `NUMERIC` | Digits `0–9`, 3 characters per 10 bits. |
| `ALPHANUMERIC` | `0–9 A–Z space $ % * + - . / :`, 2 characters per 11 bits. |
| `BYTE` | Any data, 8 bits per byte (UTF-8). |
| `KANJI` | Shift JIS Kanji, 13 bits per character. Requires a `toSJISFunc`. |
| `MIXED` | `{ bit: -1 }`. Marker used for capacity calculations on several segments. |
| `getCharCountIndicator(mode, version): number` | Number of bits used for the length field. Throws on an invalid mode or version. |
| `getBestModeForData(str): Mode` | The most compact single mode that can encode `str`. |
| `toString(mode): string` | The mode's `id` (for example `'Numeric'`). Throws on an invalid mode. |
| `isValid(mode)` | Truthy for a mode object that has `bit` and `ccBits`. |
| `from(value, defaultValue): Mode` | Accepts a mode object or a name (`'numeric'`, `'alphanumeric'`, `'byte'`, `'kanji'`). Returns `defaultValue` otherwise. |

```ts
import Mode from './src/mode'
Mode.getBestModeForData('12345')      // NUMERIC
Mode.getBestModeForData('HELLO 123')  // ALPHANUMERIC
Mode.getBestModeForData('hello')      // BYTE
Mode.getCharCountIndicator(Mode.BYTE, 10)  // 16
```

### `segments`

**Source:** `src/segments.ts`

A segment is an encoded run of data in a single mode (an instance of one of the [segment data classes](#numeric-data)).

| Function | Description |
| --- | --- |
| `fromString(data: string, version: number): Segment[]` | Splits a string into the **optimal** sequence of segments: the shortest bitstream for that version, found with Dijkstra's algorithm. |
| `fromArray(array): Segment[]` | Builds segments from your own list. Each item is either a string (mode detected automatically) or `{ data, mode? }`. Throws if the requested mode cannot encode the data. If Kanji is requested without a `toSJISFunc`, it falls back to Byte. |
| `rawSplit(data: string): Segment[]` | Quick split that is not optimised. Used only to estimate a version before the full optimisation runs. |

```ts
import Segments from './src/segments'

Segments.fromString('ABC123456789xyz', 1)
// → [AlphanumericData('ABC'), NumericData('123456789'), ByteData('xyz')]

Segments.fromArray(['HELLO', { data: '42', mode: 'byte' }])
```

### `regex`

**Source:** `src/regex.ts`

| Export | Description |
| --- | --- |
| `NUMERIC`, `ALPHANUMERIC`, `BYTE`, `KANJI`, `BYTE_KANJI` | Global (`/g`) regular expressions that match runs of each character class. `BYTE_KANJI` is used for Byte mode when Kanji mode is off. |
| `testNumeric(str): boolean` | The whole string is digits. |
| `testAlphanumeric(str): boolean` | The whole string is in the alphanumeric character set. |
| `testKanji(str): boolean` | The whole string is Kanji. |

> The exported patterns use the `g` flag, so `.exec()` and `.test()` keep state in `lastIndex`. Reset `lastIndex = 0` before reusing one.

### `mask-pattern`

**Source:** `src/mask-pattern.ts`

| Export | Description |
| --- | --- |
| `Patterns` | `{ PATTERN000: 0, …, PATTERN111: 7 }`. |
| `isValid(mask): boolean` | `true` for an integer from 0 to 7. |
| `from(value: number \| string): number \| undefined` | Parses a mask value. Returns `undefined` if it is invalid. |
| `applyMask(pattern, matrix)` | XORs the mask onto every non-reserved module of a `BitMatrix`, in place. Applying it twice removes it. |
| `getBestMask(matrix, setupFormatFunc): number` | Tries all 8 masks and returns the one with the lowest penalty. `setupFormatFunc(mask)` is called before each try so that the format bits are included in the score. |
| `getPenaltyN1(matrix)` | Penalty for 5 or more same-coloured modules in a row or column. |
| `getPenaltyN2(matrix)` | Penalty for 2×2 blocks of one colour. |
| `getPenaltyN3(matrix)` | Penalty for finder-like `1:1:3:1:1` sequences. |
| `getPenaltyN4(matrix)` | Penalty for a dark/light balance that strays from 50%. |

```ts
import MaskPattern from './src/mask-pattern'
MaskPattern.from('3')     // 3
MaskPattern.from(9)       // undefined
```

### `finder-pattern`

**Source:** `src/finder-pattern.ts`

| Function | Description |
| --- | --- |
| `getPositions(version): [number, number][]` | Top-left coordinates of the three 7×7 finder patterns (the "eyes"). |

```ts
getPositions(1)   // [[0, 0], [14, 0], [0, 14]]
```

### `alignment-pattern`

**Source:** `src/alignment-pattern.ts`

| Function | Description |
| --- | --- |
| `getRowColCoords(version): number[]` | Row/column values where alignment pattern centres sit. Returns an empty array for version 1. |
| `getPositions(version): [number, number][]` | Centre `[row, col]` of every 5×5 alignment pattern, leaving out the ones that would overlap a finder pattern. |

```ts
getRowColCoords(7)   // [6, 22, 38]
getPositions(7)      // [[6,22], [22,6], [22,22], [22,38], [38,22], [38,38]]
```

### `format-info`

**Source:** `src/format-info.ts`

| Function | Description |
| --- | --- |
| `getEncodedBits(errorCorrectionLevel, mask): number` | The 15-bit format information (error correction level + mask, BCH(15,5)-encoded and XOR-masked). |

### `error-correction-code`

**Source:** `src/error-correction-code.ts`

| Function | Description |
| --- | --- |
| `getBlocksCount(version, errorCorrectionLevel): number` | Number of Reed–Solomon blocks the data is split into. |
| `getTotalCodewordsCount(version, errorCorrectionLevel): number` | Total error correction codewords for the symbol. |

Both take a level object from [`error-correction-level`](#error-correction-level) and return `undefined` for anything else.

### `bit-buffer`

**Source:** `src/bit-buffer.ts` (default export only)

A growable buffer that you append to one bit at a time. It is used to assemble the data stream.

| Member | Description |
| --- | --- |
| `new BitBuffer()` | Creates an empty buffer. |
| `.put(num, length)` | Appends the lowest `length` bits of `num`, most significant bit first. |
| `.putBit(bit)` | Appends a single bit. |
| `.get(index): boolean` | Reads the bit at `index`. |
| `.getLengthInBits(): number` | Number of bits written so far. |
| `.buffer: number[]` | The underlying bytes. |

```ts
const buf = new BitBuffer()
buf.put(0b0100, 4)        // Byte mode indicator
buf.getLengthInBits()     // 4
```

### `bit-matrix`

**Source:** `src/bit-matrix.ts` (default export only)

The square module grid returned as `createQR(...).modules`.

| Member | Description |
| --- | --- |
| `new BitMatrix(size)` | Creates a `size × size` grid. Throws if `size < 1`. |
| `.size: number` | Modules per side. |
| `.data: Uint8Array` | Row-major module values (`1` = dark). |
| `.reservedBit: Uint8Array` | Row-major flags marking function-pattern and format/version modules. |
| `.get(row, col)` | Module value. |
| `.set(row, col, value, reserved?)` | Sets a module and optionally marks it reserved. |
| `.xor(row, col, value)` | XORs a module (used for masking). |
| `.isReserved(row, col)` | `true` for function-pattern and format/version modules. |

### Segment data classes

Each class represents one segment and has the same interface:

| Member | Description |
| --- | --- |
| `.mode` | The [`Mode`](#mode) object. |
| `.data` | The raw data. |
| `.getLength()` | Character count (for `ByteData`, the byte count). |
| `.getBitsLength()` | Number of bits this segment's data takes up. |
| `.write(bitBuffer)` | Writes the encoded data into a [`BitBuffer`](#bit-buffer). |
| `Class.getBitsLength(length)` | Static: bits needed for `length` characters. |

#### `numeric-data`

**Source:** `src/numeric-data.ts`. This is a **factory function**: call it without `new`.

```ts
import NumericData, { getBitsLength } from './src/numeric-data'
const seg = NumericData('01234567')
seg.getBitsLength()   // 27
getBitsLength(8)      // 27
```

#### `alphanumeric-data`

**Source:** `src/alphanumeric-data.ts`. Constructor: `new AlphanumericData('HELLO WORLD')`.

#### `byte-data`

**Source:** `src/byte-data.ts`. Constructor: `new ByteData(data)`. A string is UTF-8-encoded with `TextEncoder`. Any other input is wrapped in a `Uint8Array`.

#### `kanji-data`

**Source:** `src/kanji-data.ts`. Constructor: `new KanjiData('漢字')`. `write()` needs a converter registered through `setToSJISFunction` and throws on characters that are not valid SJIS Kanji.

### Reed–Solomon internals

#### `galois-field`

**Source:** `src/galois-field.ts`. Arithmetic in GF(2⁸) with the QR primitive polynomial `0x11D`.

| Function | Description |
| --- | --- |
| `log(n)` | Discrete log of `n`. Throws if `n < 1`. |
| `exp(n)` | Antilog (2ⁿ in the field). |
| `mul(x, y)` | Field multiplication. |

#### `polynomial`

**Source:** `src/polynomial.ts`. Polynomials over GF(2⁸) stored as `Uint8Array` coefficients, highest degree first.

| Function | Description |
| --- | --- |
| `mul(p1, p2)` | Product of two polynomials. |
| `mod(dividend, divisor)` | Remainder of polynomial division. |
| `generateECPolynomial(degree)` | Reed–Solomon generator polynomial of the given degree. |

#### `reed-solomon-encoder`

**Source:** `src/reed-solomon-encoder.ts` (default export only).

| Member | Description |
| --- | --- |
| `new ReedSolomonEncoder(degree?)` | Creates an encoder. `degree` is the number of error correction codewords per block. |
| `.initialize(degree)` | (Re)builds the generator polynomial. |
| `.encode(data: Uint8Array): Uint8Array` | Returns `degree` error correction codewords for the data block. Throws `'Encoder not initialized'` if no degree was set. |

```ts
const rs = new ReedSolomonEncoder(10)
const ec = rs.encode(new Uint8Array([32, 91, 11, 120, 209, 114, 220, 77, 67, 64, 236, 17, 236, 17, 236, 17]))
ec.length   // 10
```

### `dijkstrajs`

**Source:** `src/dijkstrajs.ts` (default export only). A shortest-path finder over a weighted graph. [`Segments.fromString`](#segments) uses it to choose the best segment split.

A graph is `Record<string, Record<string, number>>`, mapping each node to its neighbours and edge costs.

| Member | Description |
| --- | --- |
| `find_path(graph, start, end): string[]` | Node IDs along the cheapest path from `start` to `end`. Throws if `end` cannot be reached. |
| `single_source_shortest_paths(graph, start, end?)` | Predecessor map for every node reachable from `start`. |
| `extract_shortest_path_from_predecessor_list(predecessors, end)` | Rebuilds the path from a predecessor map. |
| `PriorityQueue.make({ sorter? })` | Creates a simple priority queue with `push(value, cost)`, `pop()` and `empty()`. |

```ts
import dijkstra from './src/dijkstrajs'
const graph = { a: { b: 1, c: 4 }, b: { c: 1 }, c: {} }
dijkstra.find_path(graph, 'a', 'c')   // ['a', 'b', 'c']
```
