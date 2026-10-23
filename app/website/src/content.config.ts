import { defineCollection } from 'astro:content';
import { glob, file } from 'astro/loaders';
import { z } from 'astro/zod';

const docs = defineCollection({
  loader: glob({
    base: './src/content/docs',
    pattern: '**/*.{md,mdx}',
    generateId: ({ entry }) => {
        return entry.replace(/\.(mdx?|astro|json)$/, "")
    }
  }),
  schema: z.object({
    title: z.string(),
    subtitle: z.string(),
  }),
});

export const collections = { docs };