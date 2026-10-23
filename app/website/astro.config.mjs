import { fileURLToPath } from 'node:url';
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import mdx from '@astrojs/mdx';
import vercel from '@astrojs/vercel';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import { componentList } from '@/components/mdx';


const resolveLib = (path) => fileURLToPath(new URL(`../../lib/${path}`, import.meta.url));

// https://astro.build/config
export default defineConfig({
    site: `https://qr-utils.sculli.dev`,
    prefetch: true,
    integrations: [react(), sitemap(), mdx({
        shikiConfig: {
            theme: 'tokyo-night',
        },
        optimize: {
            ignoreElementNames: [ ...componentList ]
        }
    })],
    adapter: vercel(),
    vite: {
        plugins: [tailwindcss()],
        resolve: {
            // Use the library sources directly so the site never needs a prior `pnpm build`
            alias: [
                { find: /^@sculli\/qr-utils$/, replacement: resolveLib('index.ts') },
                { find: /^@sculli\/qr-utils\/core$/, replacement: resolveLib('core/src/index.ts') },
                { find: /^@sculli\/qr-utils\/core\/sjis$/, replacement: resolveLib('core/src/sjis.ts') },
                { find: /^@sculli\/qr-utils\/render$/, replacement: resolveLib('render/src/index.ts') },
            ],
        },
    },
});
