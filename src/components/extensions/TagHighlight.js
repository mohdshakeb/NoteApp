import { Extension } from '@tiptap/core';
import { Plugin } from 'prosemirror-state';
import { Decoration, DecorationSet } from 'prosemirror-view';
import { getTagColor } from '../../lib/colors';
import { findTagMatches } from '../../lib/tags';

// Helper function to find tags
function findTags(doc) {
    const decorations = [];
    doc.descendants((node, pos) => {
        if (node.isText) {
            findTagMatches(node.text).forEach(({ tag, start, end }) => {
                const from = pos + start;
                const to = pos + end;
                const colorClass = getTagColor(tag);
                decorations.push(
                    Decoration.inline(from, to, {
                        class: `rounded px-0.5 -mx-0.5 ${colorClass}`,
                    })
                );
            });
        }
    });
    return DecorationSet.create(doc, decorations);
}

export const TagHighlight = Extension.create({
    name: 'tagHighlight',

    addProseMirrorPlugins() {
        return [
            new Plugin({
                state: {
                    init(_, { doc }) {
                        return findTags(doc);
                    },
                    apply(tr, oldState) {
                        return tr.docChanged ? findTags(tr.doc) : oldState;
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
