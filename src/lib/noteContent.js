// Single canonical text <-> ProseMirror-doc conversion, shared by load, save,
// and paste in TiptapEditor.jsx. All three MUST route through this pair so
// they can't silently disagree about what a `\n` in note.content means.
//
// Convention (matches NoteAppAndroid's parser exactly — do not change
// without updating that side too): one `\n` == one paragraph break. A line
// whose raw text starts with literal "- " (hyphen + space) is a list item;
// consecutive such lines form one flat list. No nesting, no numbered lists —
// Android has no renderer for either.

const LIST_LINE_PATTERN = /^- /;

function textNode(text) {
    return text ? [{ type: 'text', text }] : undefined;
}

// contentToDoc(content) -> ProseMirror JSON doc
export function contentToDoc(content) {
    if (content === '') {
        return { type: 'doc', content: [{ type: 'paragraph' }] };
    }

    const lines = content.split('\n');
    const blocks = [];
    let i = 0;

    while (i < lines.length) {
        const line = lines[i];

        if (LIST_LINE_PATTERN.test(line)) {
            const items = [];
            while (i < lines.length && LIST_LINE_PATTERN.test(lines[i])) {
                const remainder = lines[i].slice(2);
                items.push({
                    type: 'listItem',
                    content: [{ type: 'paragraph', content: textNode(remainder) }],
                });
                i += 1;
            }
            blocks.push({ type: 'bulletList', content: items });
        } else {
            blocks.push({ type: 'paragraph', content: textNode(line) });
            i += 1;
        }
    }

    return { type: 'doc', content: blocks };
}

function flattenInlineText(node) {
    if (!node?.content) return '';
    return node.content.map((n) => n.text || '').join('');
}

// docToText(doc) -> string
export function docToText(doc) {
    if (!doc?.content?.length) return '';

    const lines = [];
    for (const node of doc.content) {
        if (node.type === 'paragraph') {
            lines.push(flattenInlineText(node));
        } else if (node.type === 'bulletList') {
            for (const item of node.content || []) {
                const [firstPara, ...rest] = item.content || [];
                lines.push('- ' + flattenInlineText(firstPara));
                // Defensive: a nested bulletList shouldn't be reachable (Tab/
                // Shift-Tab are unbound on our ListItem), but if one slips
                // through, flatten it to more flat "- " lines rather than
                // silently dropping content.
                rest.forEach((extra) => {
                    if (extra.type === 'bulletList') {
                        for (const nestedItem of extra.content || []) {
                            lines.push('- ' + flattenInlineText(nestedItem.content?.[0]));
                        }
                    }
                });
            }
        }
        // Any other top-level node type shouldn't occur given the editor's
        // restricted schema — skip defensively rather than throw.
    }
    return lines.join('\n');
}
