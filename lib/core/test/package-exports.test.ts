import { describe, expect, it } from 'vitest'
import * as root from '@sculli/qr-utils'
import * as core from '@sculli/qr-utils/core'
import { toSJIS } from '@sculli/qr-utils/core/sjis'
import * as render from '@sculli/qr-utils/render'

describe('@sculli/qr-utils public entry points', () => {
  it('re-exports every core and render export from the root', () => {
    for (const [name, value] of Object.entries({ ...core, ...render })) {
      expect(root).toHaveProperty(name, value)
    }
    expect(root).not.toHaveProperty('toSJIS')
  })

  it('shares the QR class between root and subpath imports', () => {
    const qr = new root.QR('https://example.com')
    expect(qr).toBeInstanceOf(core.QR)
    expect(render.renderQR(qr)).toContain('<svg')
    expect(root.renderQR(new core.QR('hello'))).toContain('<svg')
  })

  it('provides the optional Kanji table via its own subpath', () => {
    expect(toSJIS('漢')).toBe(0x8abf)
    expect(new core.QR('漢字', { toSJIS })).toBeInstanceOf(root.QR)
  })
})
