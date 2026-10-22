import { fileURLToPath } from 'node:url';
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import mdx from '@astrojs/mdx';
import vercel from '@astrojs/vercel';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';

const resolveLib = (path) => fileURLToPath(new URL(`../../lib/${path}`, import.meta.url));

// https://astro.build/config
export default defineConfig({
    site: `https://qr-utils.sculli.dev`,
    prefetch: true,
    integrations: [react(), mdx(), sitemap()],
    adapter: vercel(),
    vite: {
        plugins: [tailwindcss()],
        resolve: {
            // Use the library sources directly so the site never needs a prior `pnpm build`
            alias: [
                { find: /^@qr-util\/core$/, replacement: resolveLib('core/src/index.ts') },
                { find: /^@qr-util\/core\/sjis$/, replacement: resolveLib('core/src/sjis.ts') },
                { find: /^@qr-util\/render$/, replacement: resolveLib('render/src/index.ts') },
            ],
        },
    },
});
