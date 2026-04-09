export const levels = {
    L: { bit: 1 },
    M: { bit: 0 },
    Q: { bit: 3 },
    H: { bit: 2 }
} as const

export type LevelValue = typeof levels[keyof typeof levels]

const fromString = (str: string | LevelValue) => {
  if (typeof str !== 'string') {
    throw new Error('Param is not a string')
  }

  const lcStr = str.toLowerCase()

  switch (lcStr) {
    case 'l':
    case 'low':
      return levels.L

    case 'm':
    case 'medium':
      return levels.M

    case 'q':
    case 'quartile':
      return levels.Q

    case 'h':
    case 'high':
      return levels.H

    default:
      throw new Error('Unknown EC Level: ' + str)
  }
}


export const isValid = (level: LevelValue | string) => {
    if (typeof level === "string") return false
    return level && typeof level.bit !== 'undefined' &&
        level.bit >= 0 && level.bit < 4
}

export const from = (value: LevelValue | string, defaultValue: LevelValue) => {
  if (isValid(value)) {
    return value
  }

  try {
    return fromString(value)
  } catch (e) {
    return defaultValue
  }
}

export default {
    ...levels,
    fromString,
    isValid,
    from
}
