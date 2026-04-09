import Mode from './mode'
const { NUMERIC } = Mode


export const getBitsLength = (length: number) => 10 * Math.floor(length / 3) + ((length % 3) ? ((length % 3) * 3 + 1) : 0)

const NumericData = (data) => {
    const dataString = data.toString();
    return {
        mode: NUMERIC,
        data: dataString,
        getBitsLength: () => getBitsLength(dataString.length),
        getLength: () => dataString.length,
        write: (bitBuffer) => {
            let i, group, value

            // The input data string is divided into groups of three digits,
            // and each group is converted to its 10-bit binary equivalent.
            for (i = 0; i + 3 <= dataString.length; i += 3) {
                group = dataString.substr(i, 3)
                value = parseInt(group, 10)

                bitBuffer.put(value, 10)
            }

            // If the number of input digits is not an exact multiple of three,
            // the final one or two digits are converted to 4 or 7 bits respectively.
            const remainingNum = dataString.length - i
            if (remainingNum > 0) {
                group = dataString.substr(i)
                value = parseInt(group, 10)

                bitBuffer.put(value, remainingNum * 3 + 1)
            }
        },

    }
}

NumericData.getBitsLength = getBitsLength

export default NumericData


// Potential class implementation
/*
import Mode from './mode'

export const getBitsLength = (length: number): number =>
  10 * Math.floor(length / 3) + ((length % 3) ? ((length % 3) * 3 + 1) : 0)

class NumericData {
  mode: number
  data: string

  constructor(data: string | number) {
    this.mode = Mode.NUMERIC
    this.data = data.toString()
  }

  static getBitsLength(length: number): number {
    return getBitsLength(length)
  }

  getLength(): number {
    return this.data.length
  }

  getBitsLength(): number {
    return NumericData.getBitsLength(this.data.length)
  }

  write(bitBuffer: { put: (value: number, length: number) => void }): void {
    let i: number
    let group: string
    let value: number

    for (i = 0; i + 3 <= this.data.length; i += 3) {
      group = this.data.substr(i, 3)
      value = parseInt(group, 10)
      bitBuffer.put(value, 10)
    }

    const remainingNum = this.data.length - i
    if (remainingNum > 0) {
      group = this.data.substr(i)
      value = parseInt(group, 10)
      bitBuffer.put(value, remainingNum * 3 + 1)
    }
  }
}

export default NumericData
*/