/**
 * Reed–Solomon error correction over GF(2^8) with the QR Code primitive polynomial x^8 + x^4 + x^3 + x^2 + 1 (0x11D).
 */

const EXP = new Uint8Array(512)
const LOG = new Uint8Array(256)

{
  let x = 1
  for (let i = 0; i < 255; i++) {
    EXP[i] = x
    LOG[x] = i
    x <<= 1
    if (x & 0x100) x ^= 0x11d
  }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255]!
}

function multiply(a: number, b: number): number {
  return a === 0 || b === 0 ? 0 : EXP[LOG[a]! + LOG[b]!]!
}

const generatorCache = new Map<number, Uint8Array>()

/** Coefficients (highest degree first, leading 1 omitted) of the generator polynomial ∏ (x - α^i), i < degree. */
function generator(degree: number): Uint8Array {
  let poly = generatorCache.get(degree)
  if (poly) return poly
  poly = new Uint8Array(degree)
  poly[degree - 1] = 1
  let root = 1
  for (let i = 0; i < degree; i++) {
    // Multiply the current polynomial by (x - root)
    for (let j = 0; j < degree; j++) {
      poly[j] = multiply(poly[j]!, root) ^ (j + 1 < degree ? poly[j + 1]! : 0)
    }
    root = multiply(root, 0x02)
  }
  generatorCache.set(degree, poly)
  return poly
}

/** Computes `degree` error correction codewords for `data`. */
export function reedSolomonEncode(data: Uint8Array, degree: number): Uint8Array {
  const divisor = generator(degree)
  const result = new Uint8Array(degree)
  for (const byte of data) {
    const factor = byte ^ result[0]!
    result.copyWithin(0, 1)
    result[degree - 1] = 0
    for (let i = 0; i < degree; i++) result[i] ^= multiply(divisor[i]!, factor)
  }
  return result
}
