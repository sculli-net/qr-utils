/** Straight (non-premultiplied) RGBA colour with channels 0–255 and alpha 0–1. */
export interface RGBA {
  readonly r: number
  readonly g: number
  readonly b: number
  readonly a: number
}

// CSS Color Module Level 4 named colours (hex without '#')
const NAMED: Record<string, string> = {
  aliceblue: 'f0f8ff', antiquewhite: 'faebd7', aqua: '00ffff', aquamarine: '7fffd4', azure: 'f0ffff',
  beige: 'f5f5dc', bisque: 'ffe4c4', black: '000000', blanchedalmond: 'ffebcd', blue: '0000ff',
  blueviolet: '8a2be2', brown: 'a52a2a', burlywood: 'deb887', cadetblue: '5f9ea0', chartreuse: '7fff00',
  chocolate: 'd2691e', coral: 'ff7f50', cornflowerblue: '6495ed', cornsilk: 'fff8dc', crimson: 'dc143c',
  cyan: '00ffff', darkblue: '00008b', darkcyan: '008b8b', darkgoldenrod: 'b8860b', darkgray: 'a9a9a9',
  darkgreen: '006400', darkgrey: 'a9a9a9', darkkhaki: 'bdb76b', darkmagenta: '8b008b', darkolivegreen: '556b2f',
  darkorange: 'ff8c00', darkorchid: '9932cc', darkred: '8b0000', darksalmon: 'e9967a', darkseagreen: '8fbc8f',
  darkslateblue: '483d8b', darkslategray: '2f4f4f', darkslategrey: '2f4f4f', darkturquoise: '00ced1',
  darkviolet: '9400d3', deeppink: 'ff1493', deepskyblue: '00bfff', dimgray: '696969', dimgrey: '696969',
  dodgerblue: '1e90ff', firebrick: 'b22222', floralwhite: 'fffaf0', forestgreen: '228b22', fuchsia: 'ff00ff',
  gainsboro: 'dcdcdc', ghostwhite: 'f8f8ff', gold: 'ffd700', goldenrod: 'daa520', gray: '808080',
  green: '008000', greenyellow: 'adff2f', grey: '808080', honeydew: 'f0fff0', hotpink: 'ff69b4',
  indianred: 'cd5c5c', indigo: '4b0082', ivory: 'fffff0', khaki: 'f0e68c', lavender: 'e6e6fa',
  lavenderblush: 'fff0f5', lawngreen: '7cfc00', lemonchiffon: 'fffacd', lightblue: 'add8e6', lightcoral: 'f08080',
  lightcyan: 'e0ffff', lightgoldenrodyellow: 'fafad2', lightgray: 'd3d3d3', lightgreen: '90ee90',
  lightgrey: 'd3d3d3', lightpink: 'ffb6c1', lightsalmon: 'ffa07a', lightseagreen: '20b2aa',
  lightskyblue: '87cefa', lightslategray: '778899', lightslategrey: '778899', lightsteelblue: 'b0c4de',
  lightyellow: 'ffffe0', lime: '00ff00', limegreen: '32cd32', linen: 'faf0e6', magenta: 'ff00ff',
  maroon: '800000', mediumaquamarine: '66cdaa', mediumblue: '0000cd', mediumorchid: 'ba55d3',
  mediumpurple: '9370db', mediumseagreen: '3cb371', mediumslateblue: '7b68ee', mediumspringgreen: '00fa9a',
  mediumturquoise: '48d1cc', mediumvioletred: 'c71585', midnightblue: '191970', mintcream: 'f5fffa',
  mistyrose: 'ffe4e1', moccasin: 'ffe4b5', navajowhite: 'ffdead', navy: '000080', oldlace: 'fdf5e6',
  olive: '808000', olivedrab: '6b8e23', orange: 'ffa500', orangered: 'ff4500', orchid: 'da70d6',
  palegoldenrod: 'eee8aa', palegreen: '98fb98', paleturquoise: 'afeeee', palevioletred: 'db7093',
  papayawhip: 'ffefd5', peachpuff: 'ffdab9', peru: 'cd853f', pink: 'ffc0cb', plum: 'dda0dd',
  powderblue: 'b0e0e6', purple: '800080', rebeccapurple: '663399', red: 'ff0000', rosybrown: 'bc8f8f',
  royalblue: '4169e1', saddlebrown: '8b4513', salmon: 'fa8072', sandybrown: 'f4a460', seagreen: '2e8b57',
  seashell: 'fff5ee', sienna: 'a0522d', silver: 'c0c0c0', skyblue: '87ceeb', slateblue: '6a5acd',
  slategray: '708090', slategrey: '708090', snow: 'fffafa', springgreen: '00ff7f', steelblue: '4682b4',
  tan: 'd2b48c', teal: '008080', thistle: 'd8bfd8', tomato: 'ff6347', turquoise: '40e0d0', violet: 'ee82ee',
  wheat: 'f5deb3', white: 'ffffff', whitesmoke: 'f5f5f5', yellow: 'ffff00', yellowgreen: '9acd32',
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

/** Parses a CSS number/percentage; `percentScale` is the value 100% maps to. */
function component(token: string, percentScale: number): number {
  if (token === 'none') return 0
  const value = Number.parseFloat(token)
  if (Number.isNaN(value)) throw new Error(`invalid component "${token}"`)
  return token.endsWith('%') ? (value / 100) * percentScale : value
}

function hue(token: string): number {
  if (token === 'none') return 0
  const value = Number.parseFloat(token)
  if (Number.isNaN(value)) throw new Error(`invalid hue "${token}"`)
  if (token.endsWith('grad')) return value * 0.9
  if (token.endsWith('rad')) return (value * 180) / Math.PI
  if (token.endsWith('turn')) return value * 360
  return value
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const f = (n: number) => {
    const k = (n + h / 30) % 12
    const a = s * Math.min(l, 1 - l)
    return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))
  }
  return [f(0) * 255, f(8) * 255, f(4) * 255]
}

const linearToSrgb = (c: number) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055)

function oklabToRgb(l: number, a: number, b: number): [number, number, number] {
  const l_ = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m_ = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s_ = (l - 0.0894841775 * a - 1.291485548 * b) ** 3
  return [
    linearToSrgb(4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_) * 255,
    linearToSrgb(-1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_) * 255,
    linearToSrgb(-0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_) * 255,
  ]
}

/**
 * Parses a CSS colour string: named colours, `transparent`, `#rgb[a]`, `#rrggbb[aa]`, `rgb[a]()`, `hsl[a]()`,
 * `hwb()`, `oklab()` and `oklch()` (legacy comma and modern space/slash syntaxes).
 *
 * @throws {TypeError} for unsupported or malformed colours (e.g. `currentColor`, CSS variables, gradients).
 */
export function parseColor(input: string): RGBA {
  const text = input.trim().toLowerCase()
  try {
    if (text === 'transparent') return { r: 0, g: 0, b: 0, a: 0 }
    const named = NAMED[text]
    if (named) return parseColor(`#${named}`)

    if (text.startsWith('#')) {
      const hex = text.slice(1)
      if (!/^[0-9a-f]+$/.test(hex) || ![3, 4, 6, 8].includes(hex.length)) throw new Error('invalid hex colour')
      const full = hex.length <= 4 ? [...hex].map((c) => c + c).join('') : hex
      const n = (i: number) => Number.parseInt(full.slice(i, i + 2), 16)
      return { r: n(0), g: n(2), b: n(4), a: full.length === 8 ? n(6) / 255 : 1 }
    }

    const match = /^([a-z]+)\((.*)\)$/.exec(text)
    if (!match) throw new Error('unsupported colour')
    const [, fn, args] = match
    // Split "a, b, c, d" or "a b c / d"
    const [main, slashAlpha] = args!.split('/')
    const parts = main!.trim().split(/[\s,]+/).filter(Boolean)
    // Alpha is either after a slash or the legacy fourth comma separated value
    const alphaToken = slashAlpha?.trim() ?? parts[3]
    if (parts.length < 3) throw new Error('expected three components')
    const a = alphaToken === undefined ? 1 : clamp(component(alphaToken, 1), 0, 1)
    let rgb: [number, number, number]
    switch (fn) {
      case 'rgb':
      case 'rgba':
        rgb = [component(parts[0]!, 255), component(parts[1]!, 255), component(parts[2]!, 255)]
        break
      case 'hsl':
      case 'hsla':
        rgb = hslToRgb(hue(parts[0]!), component(parts[1]!, 100) / 100, component(parts[2]!, 100) / 100)
        break
      case 'hwb': {
        const w = component(parts[1]!, 100) / 100
        const bl = component(parts[2]!, 100) / 100
        if (w + bl >= 1) {
          const gray = (w / (w + bl)) * 255
          rgb = [gray, gray, gray]
          break
        }
        const [r, g, b] = hslToRgb(hue(parts[0]!), 1, 0.5)
        const scale = 1 - w - bl
        rgb = [r * scale + w * 255, g * scale + w * 255, b * scale + w * 255]
        break
      }
      case 'oklab':
        rgb = oklabToRgb(component(parts[0]!, 1), component(parts[1]!, 0.4), component(parts[2]!, 0.4))
        break
      case 'oklch': {
        const c = component(parts[1]!, 0.4)
        const h = (hue(parts[2]!) * Math.PI) / 180
        rgb = oklabToRgb(component(parts[0]!, 1), c * Math.cos(h), c * Math.sin(h))
        break
      }
      default:
        throw new Error(`unsupported colour function ${fn}()`)
    }
    return { r: clamp(Math.round(rgb[0]), 0, 255), g: clamp(Math.round(rgb[1]), 0, 255), b: clamp(Math.round(rgb[2]), 0, 255), a }
  } catch (error) {
    throw new TypeError(
      `Cannot use colour "${input}" for PNG output (${(error as Error).message}). ` +
        'Use a named colour, hex, rgb(), hsl(), hwb(), oklab() or oklch().',
    )
  }
}
