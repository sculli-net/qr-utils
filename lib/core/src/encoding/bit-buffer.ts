/** Append-only bit sequence, most significant bit first. */
export class BitBuffer {
  private bytes = new Uint8Array(64)
  private bitLength = 0

  /** Number of bits written. */
  get length(): number {
    return this.bitLength
  }

  /** Appends the lowest `length` bits of `value`, most significant bit first. */
  put(value: number, length: number): void {
    for (let i = length - 1; i >= 0; i--) {
      this.putBit(Math.floor(value / 2 ** i) % 2 === 1)
    }
  }

  putBit(bit: boolean): void {
    const index = this.bitLength >>> 3
    if (index >= this.bytes.length) {
      const grown = new Uint8Array(this.bytes.length * 2)
      grown.set(this.bytes)
      this.bytes = grown
    }
    if (bit) this.bytes[index] |= 0x80 >>> (this.bitLength & 7)
    this.bitLength++
  }

  getBit(index: number): boolean {
    return ((this.bytes[index >>> 3] >>> (7 - (index & 7))) & 1) === 1
  }

  /** The written bits packed into bytes; a trailing partial byte is zero padded. */
  toBytes(): Uint8Array {
    return this.bytes.slice(0, Math.ceil(this.bitLength / 8))
  }
}
