import { Extension } from '@tiptap/core';
import { Plugin } from 'prosemirror-state';
import { Decoration, DecorationSet } from 'prosemirror-view';
import { getTagColor } from '../../lib/colors';

// Helper function to find tags
function findTags(doc) {
    const decorations = [];
    doc.descendants((node, pos) => {
        if (node.isText) {
            const text = node.text;
            // Regex to match #tags
            const regex = /(?:^|\s)(#[\w-]+)/g;
            let match;
            while ((match = regex.exec(text)) !== null) {
                // Calculate correct positions
                // match[0] might include leading space.
                // We want to color only the #tag part.
                const matchText = match[1];
                const startIndex = match.index + match[0].indexOf(matchText);
                const from = pos + startIndex;
                const to = from + matchText.length;

                const tagName = matchText.substring(1); // remove #
                const colorClass = getTagColor(tagName);

                decorations.push(
                    Decoration.inline(from, to, {
                        class: `rounded px-0.5 -mx-0.5 ${colorClass}`,
                    })
                );
            }
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
