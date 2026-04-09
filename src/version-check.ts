// TODO: Rename to 'isValidVersion

/**
 * Check if QR Code version is valid
 *
 * @param  {Number}  version QR Code version
 * @return {Boolean}         true if valid version, false otherwise
 */
export const isValid = (version: number) => {
  return !isNaN(version) && version >= 1 && version <= 40
}

export default {
  isValid
}
