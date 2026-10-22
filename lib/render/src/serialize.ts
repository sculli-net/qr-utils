import { pathCommandsToSvg, type PathCommand, type RenderPlan, type Shape, shapeToPathCommands } from './qr-styles/index.js'
import type { RenderLayoutInfo } from './types.js'

/** Formats a number with at most 3 decimals and no trailing zeros. */
export const num = (value: number): string => {
  const rounded = Number(value.toFixed(3))
  return Object.is(rounded, -0) ? '0' : String(rounded)
}

export const escapeAttribute = (value: string): string =>
  value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

const isPlainRect = (shape: Shape) => shape.kind === 'rect' && (!shape.radii || shape.radii.every((r) => r === 0))

function shapeToSvgPath(shape: Shape): string {
  if (shape.kind === 'rect' && isPlainRect(shape)) {
    return `M${num(shape.x)} ${num(shape.y)}h${num(shape.width)}v${num(shape.height)}h${num(-shape.width)}Z`
  }
  return pathCommandsToSvg(shapeToPathCommands(shape))
}

/** Serialises a render plan as an SVG document. */
export function toSVGString(
  plan: RenderPlan,
  layout: RenderLayoutInfo,
  backgroundColor: string | null,
  className: string | undefined,
): string {
  const crisp = plan.layers.every((layer) => layer.shapes.every(isPlainRect))
  const attributes = [
    'xmlns="http://www.w3.org/2000/svg"',
    `width="${num(layout.width)}"`,
    `height="${num(layout.height)}"`,
    `viewBox="0 0 ${num(layout.width)} ${num(layout.height)}"`,
    ...(className ? [`class="${escapeAttribute(className)}"`] : []),
    ...(crisp ? ['shape-rendering="crispEdges"'] : []),
  ]
  const children: string[] = []
  if (backgroundColor !== null) {
    children.push(`<rect width="100%" height="100%" fill="${escapeAttribute(backgroundColor)}"/>`)
  }
  for (const layer of plan.layers) {
    if (!layer.shapes.length) continue
    const d = layer.shapes.map(shapeToSvgPath).join('')
    const corner = layer.corner === undefined ? '' : ` qr-corner-${layer.corner}`
    children.push(`<path class="qr-${layer.region}${corner}" fill="${escapeAttribute(layer.color)}" d="${d}"/>`)
  }
  return `<svg ${attributes.join(' ')}>${children.join('')}</svg>`
}

function bounds(commands: readonly PathCommand[]) {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const command of commands) {
    for (let i = 1; i < command.length; i += 2) {
      const x = command[i] as number
      const y = command[i + 1] as number
      minX = Math.min(minX, x)
      maxX = Math.max(maxX, x)
      minY = Math.min(minY, y)
      maxY = Math.max(maxY, y)
    }
  }
  return { minX, minY, maxX, maxY }
}

function translate(commands: readonly PathCommand[], dx: number, dy: number): PathCommand[] {
  return commands.map((command) => {
    if (command[0] === 'Z') return command
    const [op, ...values] = command
    return [op, ...values.map((value, i) => value + (i % 2 === 0 ? dx : dy))] as unknown as PathCommand
  })
}

function shapeToDiv(shape: Shape, color: string): string {
  const background = `background:${escapeAttribute(color)}`
  if (shape.kind === 'rect') {
    const radius =
      shape.radii && shape.radii.some((r) => r > 0) ? `;border-radius:${shape.radii.map((r) => `${num(r)}px`).join(' ')}` : ''
    return `<div style="position:absolute;left:${num(shape.x)}px;top:${num(shape.y)}px;width:${num(shape.width)}px;height:${num(shape.height)}px;${background}${radius}"></div>`
  }
  const box = bounds(shape.commands)
  if (box.minX === Infinity) return ''
  const local = pathCommandsToSvg(translate(shape.commands, -box.minX, -box.minY))
  return (
    `<div style="position:absolute;left:${num(box.minX)}px;top:${num(box.minY)}px;width:${num(box.maxX - box.minX)}px;` +
    `height:${num(box.maxY - box.minY)}px;${background};clip-path:path('${local}')"></div>`
  )
}

/** Serialises a render plan as absolutely positioned `<div>` elements. */
export function toHTMLString(
  plan: RenderPlan,
  layout: RenderLayoutInfo,
  backgroundColor: string | null,
  className: string | undefined,
): string {
  const style = [
    'position:relative',
    'overflow:hidden',
    `width:${num(layout.width)}px`,
    `height:${num(layout.height)}px`,
    ...(backgroundColor !== null ? [`background:${escapeAttribute(backgroundColor)}`] : []),
  ].join(';')
  const layers = plan.layers
    .filter((layer) => layer.shapes.length)
    .map((layer) => {
      const corner = layer.corner === undefined ? '' : ` qr-corner-${layer.corner}`
      const shapes = layer.shapes.map((shape) => shapeToDiv(shape, layer.color)).join('')
      return `<div class="qr-layer qr-${layer.region}${corner}" style="position:absolute;inset:0">${shapes}</div>`
    })
  const classAttribute = className ? ` class="${escapeAttribute(className)}"` : ''
  return `<div${classAttribute} role="img" style="${style}">${layers.join('')}</div>`
}
