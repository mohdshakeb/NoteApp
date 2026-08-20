import { Extension } from '@tiptap/core';
import { Plugin } from 'prosemirror-state';
import { Decoration, DecorationSet } from 'prosemirror-view';
import { findLinkMatches } from '../../lib/links';

// Decoration-only, mirrors TagHighlight.js exactly. Never a real mark/link —
// that's the point: a click while focused just places the cursor instead of
// hijacking it. StaticNotePreview renders the clickable <a> version once the
// note is blurred.
function findLinks(doc) {
    const decorations = [];
    doc.descendants((node, pos) => {
        if (node.isText) {
            findLinkMatches(node.text).forEach(({ start, end }) => {
                const from = pos + start;
                const to = pos + end;
                decorations.push(
                    Decoration.inline(from, to, {
                        class: 'underline decoration-1 underline-offset-2',
                    })
                );
            });
        }
    });
    return DecorationSet.create(doc, decorations);
}

export const LinkHighlight = Extension.create({
    name: 'linkHighlight',

    addProseMirrorPlugins() {
        return [
            new Plugin({
                state: {
                    init(_, { doc }) {
                        return findLinks(doc);
                    },
                    apply(tr, oldState) {
                        return tr.docChanged ? findLinks(tr.doc) : oldState;
                    },
                },
                props: {
                    decorations(state) {
                        return this.getState(state);
                    },
                },
            }),
        ];
    },
});
