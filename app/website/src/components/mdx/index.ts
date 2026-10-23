// import Blockquote from './Blockquote.astro';
// import CodeBlock from "../CodeBlock.astro"

// export const components = {
//     blockquote: Blockquote,
//     code: CodeBlock
// };

// export const componentList = Object.keys(components);

const loaders = {
    blockquote: () => import('./Blockquote.astro'),
    pre: () => import('./Pre.astro'),
  };
  
export const componentList = Object.keys(loaders);
  
export async function getComponents() {
    const entries = await Promise.all(
        Object.entries(loaders).map(async ([name, load]) => {
        const { default: Component } = await load();
        return [name, Component] as const;
        })
    );

    return Object.fromEntries(entries);
}