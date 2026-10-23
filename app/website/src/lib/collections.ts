
import type { CollectionEntry } from 'astro:content';

type Doc = CollectionEntry<'docs'>

type DocRoute = {
    path: string[];
    data: Doc | null;
    children: DocRoute[];
}

const getPath = (doc: Doc) => doc.id.split('/');

export const getDocPages = (docs: Doc[]) => {

    const routes: Map<string, DocRoute> = new Map();

    docs.forEach(doc => {
        const docPath = getPath(doc);
        const rootRoute = docPath[0];

        if (!rootRoute) {
            throw new Error(`Doc of path: ${doc.id} has an invalid root route.`);
        }

        let currentDoc = routes.get(rootRoute);

        if (!currentDoc) {
            currentDoc = {
                path: [rootRoute],
                data: null,
                children: []
            }
            routes.set(rootRoute, currentDoc);
        }

        for (let i = 1; i < docPath.length; i++) {
            const path = docPath.slice(0, i + 1);
            let nextChild: DocRoute | undefined = currentDoc?.children.find(c => c.path[i] === docPath[i]);

            if (!nextChild) {
                nextChild = {
                    path,
                    data: null,
                    children: []
                }
                currentDoc.children.push(nextChild);
            }

            currentDoc = nextChild;
        }

        currentDoc.data = doc;
    })

    return routes;
}
