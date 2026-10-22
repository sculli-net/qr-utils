import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

const resolveLocal = (path: string) => fileURLToPath(new URL(path, import.meta.url))

export default defineConfig({
  resolve: {
    alias: [
      { find: /^@qr-util\/core$/, replacement: resolveLocal('./lib/core/src/index.ts') },
      { find: /^@qr-util\/core\/sjis$/, replacement: resolveLocal('./lib/core/src/sjis.ts') },
      { find: /^@qr-util\/render$/, replacement: resolveLocal('./lib/render/src/index.ts') },
    ],
  },
  test: {
    include: ['lib/*/test/**/*.test.ts', 'lib/*/src/**/*.test.ts'],
    testTimeout: 30_000,
  },
})
