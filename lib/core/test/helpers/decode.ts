import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { prepareZXingModule, type ReadResult, readBarcodes } from 'zxing-wasm/reader'

/** Minimal matrix view shared by `QR` instances and raw test fixtures. */
export interface Decodable {
  readonly width: number
  readonly height: number
  isDark(x: number, y: number): boolean
}

let ready: Promise<unknown> | undefined

function prepare() {
  ready ??= prepareZXingModule({
    overrides: {
      wasmBinary: readFileSync(
        fileURLToPath(new URL('../../../../node_modules/zxing-wasm/dist/reader/zxing_reader.wasm', import.meta.url)),
      ).buffer as ArrayBuffer,
    },
    fireImmediately: true,
  })
  return ready
}

/** RGBA pixels of a symbol with a quiet zone, `scale` pixels per module. */
export function toImageData(matrix: Decodable, { scale = 4, quietZone = 4 } = {}) {
  const width = (matrix.width + quietZone * 2) * scale
  const height = (matrix.height + quietZone * 2) * scale
  const data = new Uint8ClampedArray(width * height * 4).fill(255)
  for (let y = 0; y < matrix.height; y++) {
    for (let x = 0; x < matrix.width; x++) {
      if (!matrix.isDark(x, y)) continue
      for (let dy = 0; dy < scale; dy++) {
        for (let dx = 0; dx < scale; dx++) {
          const i = (((y + quietZone) * scale + dy) * width + (x + quietZone) * scale + dx) * 4
          data[i] = data[i + 1] = data[i + 2] = 0
        }
      }
    }
  }
  return { width, height, data, colorSpace: 'srgb' as const }
}

/** Decodes a symbol with zxing-cpp (WebAssembly). Returns every barcode found. */
export async function decodeMatrix(
  matrix: Decodable,
  options: { scale?: number; quietZone?: number; pure?: boolean } = {},
): Promise<ReadResult[]> {
  await prepare()
  return readBarcodes(toImageData(matrix, options) as unknown as ImageData, {
    formats: ['QRCode', 'MicroQRCode', 'rMQRCode'],
    tryHarder: true,
    isPure: options.pure ?? false,
    maxNumberOfSymbols: 1,
  })
}

/** Decodes an encoded image (PNG etc.). */
export async function decodeImage(bytes: Uint8Array): Promise<ReadResult[]> {
  await prepare()
  return readBarcodes(bytes, { formats: ['QRCode', 'MicroQRCode', 'rMQRCode'], tryHarder: true })
}

/** Decodes RGBA pixels. */
export async function decodePixels(pixels: { width: number; height: number; data: Uint8ClampedArray }): Promise<ReadResult[]> {
  await prepare()
  return readBarcodes({ ...pixels, colorSpace: 'srgb' } as unknown as ImageData, {
    formats: ['QRCode', 'MicroQRCode', 'rMQRCode'],
    tryHarder: true,
  })
}
