/**
 * Systematic BCH encoding used for format and version information: returns `data` followed by the remainder of
 * `data · x^degree` divided by `generator` (a polynomial of the given degree, as a bit mask).
 */
export function bchEncode(data: number, generator: number, degree: number): number {
  let remainder = data << degree
  for (let bit = 31 - Math.clz32(remainder); bit >= degree; bit--) {
    if ((remainder >>> bit) & 1) remainder ^= generator << (bit - degree)
  }
  return (data << degree) | remainder
}

/** BCH(15,5) with generator x^10 + x^8 + x^5 + x^4 + x^2 + x + 1, for 15-bit format information. */
export const formatBits = (data: number, xorMask: number): number => bchEncode(data, 0x537, 10) ^ xorMask

/** BCH(18,6) with generator x^12 + x^11 + x^10 + x^9 + x^8 + x^5 + x^2 + 1, for version / rMQR format information. */
export const bch18 = (data: number): number => bchEncode(data, 0x1f25, 12)

/** 2-bit ECC level indicator used in QR Model 1/2 format information. */
export const ECC_FORMAT_BITS = { L: 0b01, M: 0b00, Q: 0b11, H: 0b10 } as const
