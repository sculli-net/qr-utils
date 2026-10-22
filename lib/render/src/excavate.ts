import type { QR } from '../../core/src/index.js'

/** Share of each block's correction capacity a full (100%) excavation may use, leaving room for real damage. */
const SAFETY = 0.8

export interface ExcavationArea {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
  /** Whether the module is removed (data / ECC module inside the area). */
  readonly isHidden: (x: number, y: number) => boolean
  readonly removedModules: number
}

/** Centred square of `side` modules, clipped to the symbol. */
function centredSquare(qr: QR, side: number) {
  const size = Math.min(side, qr.width, qr.height)
  return { x: Math.floor((qr.width - size) / 2), y: Math.floor((qr.height - size) / 2), width: size, height: size }
}

/** Number of damaged codewords per block if every data/ECC module in `area` is removed. */
function damagePerBlock(
  modules: ReturnType<QR['moduleMatrix']>,
  area: { x: number; y: number; width: number; height: number },
  blocks: number,
): number[] {
  const damaged = new Set<number>()
  const perBlock = new Array<number>(blocks).fill(0)
  for (let y = area.y; y < area.y + area.height; y++) {
    for (let x = area.x; x < area.x + area.width; x++) {
      const codeword = modules[y]![x]!.codeword
      if (!codeword || damaged.has(codeword.index)) continue
      damaged.add(codeword.index)
      perBlock[codeword.block]! += 1
    }
  }
  return perBlock
}

/**
 * Largest centred square (in modules) whose removal keeps every error correction block within
 * `SAFETY` × its correction capacity.
 */
export function maxExcavationSide(qr: QR): number {
  const blocks = qr.errorCorrectionBlocks()
  const budget = blocks.map((block) => Math.floor(block.correctableCodewords * SAFETY))
  const modules = qr.moduleMatrix()
  let best = 0
  for (let side = 1; side <= Math.min(qr.width, qr.height); side++) {
    const damage = damagePerBlock(modules, centredSquare(qr, side), blocks.length)
    if (damage.some((count, i) => count > budget[i]!)) break
    best = side
  }
  return best
}

/** Resolves the `excavate` option to the area to clear, or `undefined` when nothing is removed. */
export function computeExcavation(qr: QR, excavate: boolean | number | undefined): ExcavationArea | undefined {
  if (excavate === undefined || excavate === false || excavate === 0) return undefined
  const percent = excavate === true ? 100 : excavate
  if (typeof percent !== 'number' || Number.isNaN(percent) || percent < 0 || percent > 100) {
    throw new RangeError(`excavate must be a boolean or a number from 0 to 100. Received: ${String(excavate)}`)
  }
  const max = maxExcavationSide(qr)
  // The percentage scales the removable area (not the side length)
  const side = Math.floor(max * Math.sqrt(percent / 100))
  if (side <= 0) return undefined
  const area = centredSquare(qr, side)
  let removedModules = 0
  for (let y = area.y; y < area.y + area.height; y++) {
    for (let x = area.x; x < area.x + area.width; x++) if (!qr.isFunctionModule(x, y)) removedModules++
  }
  return {
    ...area,
    removedModules,
    isHidden: (x, y) =>
      x >= area.x && y >= area.y && x < area.x + area.width && y < area.y + area.height && !qr.isFunctionModule(x, y),
  }
}
