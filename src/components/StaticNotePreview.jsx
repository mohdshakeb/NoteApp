import React, { useRef } from 'react';
import { findTagMatches } from '../lib/tags';
import { getTagColor } from '../lib/colors';
import { NOTE_PLACEHOLDER_TEXT } from '../lib/constants';

// Resolves a click point to a character offset within `container`'s text
// content, by asking the browser for the caret position at (x, y) and then
// walking the container's text nodes in document order to accumulate the
// offset. Works because every run we render (plain text or a tag span) is
// exactly one text node whose content is a verbatim slice of note.content,
// in the same order — so DOM order matches string order.
function resolveOffsetFromPoint(container, clientX, clientY) {
    let node = null;
    let offset = 0;

    if (typeof document.caretPositionFromPoint === 'function') {
        const pos = document.caretPositionFromPoint(clientX, clientY);
        if (pos) {
            node = pos.offsetNode;
            offset = pos.offset;
        }
    } else if (typeof document.caretRangeFromPoint === 'function') {
        const range = document.caretRangeFromPoint(clientX, clientY);
        if (range) {
            node = range.startContainer;
            offset = range.startOffset;
        }
    }

    if (!node || !container.contains(node)) return null;

    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
    let total = 0;
    let current;
    while ((current = walker.nextNode())) {
        if (current === node) {
            return total + offset;
        }
        total += current.textContent.length;
    }
    return null;
}

// Interleaves plain-text runs with highlighted tag spans, using the exact
// class string TagHighlight.js's ProseMirror decorations use, so static tag
// styling is pixel-identical to the live editor's.
function renderContentRuns(content) {
    const matches = findTagMatches(content);
    if (matches.length === 0) return content;

    const runs = [];
    let cursor = 0;
    matches.forEach(({ tag, start, end }, i) => {
        if (start > cursor) {
            runs.push(content.slice(cursor, start));
        }
        runs.push(
            <span key={i} className={`rounded px-0.5 -mx-0.5 ${getTagColor(tag)}`}>
                {content.slice(start, end)}
            </span>
        );
        cursor = end;
    });
    if (cursor < content.length) {
        runs.push(content.slice(cursor));
    }
    return runs;
}

export const StaticNotePreview = React.memo(function StaticNotePreview({ note, onActivate }) {
    const contentRef = useRef(null);
    const isEmpty = note.content.length === 0;

    const handleClick = (e) => {
        const offset = contentRef.current
            ? resolveOffsetFromPoint(contentRef.current, e.clientX, e.clientY)
            : null;
        onActivate(note.id, offset ?? note.content.length);
    };

    return (
        <div
            className="group relative w-full max-w-3xl mx-auto py-4 cursor-text"
            onClick={handleClick}
        >
            <div
                ref={contentRef}
                className="ProseMirror prose prose-sm w-full max-w-none focus:outline-none min-h-[1.5em] text-sm font-mono text-foreground whitespace-pre-wrap leading-relaxed"
            >
                {isEmpty ? (
                    <p className="is-editor-empty is-empty" data-placeholder={NOTE_PLACEHOLDER_TEXT} />
                ) : (
                    renderContentRuns(note.content)
                )}
            </div>
        </div>
    );
});
