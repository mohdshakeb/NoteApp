import React, { useMemo, useRef } from 'react';
import { findTagMatches } from '../lib/tags';
import { findLinkMatches } from '../lib/links';
import { getTagColor } from '../lib/colors';
import { NOTE_PLACEHOLDER_TEXT } from '../lib/constants';
import { LinkCard } from './LinkCard';

const LIST_LINE_PATTERN = /^- /;

// Precomputes each line's start offset in the raw note.content string
// (line.length + 1 per line, the +1 for the \n consumed between lines).
// Rendered line containers carry this as data-line-start so click-to-edit
// offset resolution can work per-line instead of assuming the whole DOM is
// one flat run of text nodes reconstructing note.content character-for-
// character (which stopped being true the moment line breaks became implied
// block boundaries instead of literal \n text characters).
function computeLineStarts(content) {
    const lines = content.split('\n');
    const starts = [];
    let offset = 0;
    for (const line of lines) {
        starts.push(offset);
        offset += line.length + 1;
    }
    return { lines, starts };
}

// Resolves a click point to a character offset within note.content, by
// asking the browser for the caret position at (x, y), finding which line
// container that landed in, then walking just that line's text nodes to
// accumulate the within-line offset. Scoping the walk to one line is what
// keeps this correct: within a single line every rendered run (plain text,
// tag span, link span) is still a literal contiguous substring, so the
// text-node-sum approach is exact once it's never asked to cross a block
// boundary.
//
// List lines are a special case: the "- " prefix is rendered as a separate
// .note-list-marker element (see renderBlocks below), not as literal text
// inside .note-list-content — matching the live editor's real listItem
// nodes, whose "- " trigger text is consumed by the input rule and never
// exists as text at all. So a list line's content DOM is 2 characters
// shorter than its raw text; clicking inside it needs +2 added back, and
// clicking the marker itself just resolves to the start of the line.
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

    const lineEl = (node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement)?.closest(
        '[data-line-start]'
    );
    if (!lineEl) return null;
    const lineStart = Number(lineEl.dataset.lineStart);

    const contentEl = lineEl.querySelector(':scope > .note-list-content');
    const prefixLength = contentEl ? 2 : 0;
    const scopeEl = contentEl ?? lineEl;

    if (contentEl && !contentEl.contains(node)) {
        // Click landed on the marker (or elsewhere in the <li>, outside content).
        return lineStart;
    }

    if (node.nodeType !== Node.TEXT_NODE) {
        return lineStart + prefixLength;
    }

    const walker = document.createTreeWalker(scopeEl, NodeFilter.SHOW_TEXT);
    let total = 0;
    let current;
    while ((current = walker.nextNode())) {
        if (current === node) {
            return lineStart + prefixLength + total + offset;
        }
        total += current.textContent.length;
    }
    return lineStart + prefixLength;
}

// Merges tag and link matches within one line into an ordered run list.
function buildLineRuns(line) {
    const tagMatches = findTagMatches(line).map((m) => ({ ...m, kind: 'tag' }));
    const linkMatches = findLinkMatches(line).map((m) => ({ ...m, kind: 'link' }));
    const merged = [...tagMatches, ...linkMatches].sort((a, b) => a.start - b.start);

    // Defensive overlap guard — tags ('#...') and links ('http.../www...')
    // can't syntactically overlap given their character sets, but this keeps
    // the interleave below correct even if that assumption is ever wrong.
    const resolved = [];
    let lastEnd = 0;
    for (const m of merged) {
        if (m.start < lastEnd) continue;
        resolved.push(m);
        lastEnd = m.end;
    }

    const runs = [];
    let cursor = 0;
    resolved.forEach((m) => {
        if (m.start > cursor) runs.push({ kind: 'text', text: line.slice(cursor, m.start) });
        runs.push({ kind: m.kind, text: line.slice(m.start, m.end), tag: m.tag, url: m.url });
        cursor = m.end;
    });
    if (cursor < line.length) runs.push({ kind: 'text', text: line.slice(cursor) });

    return runs;
}

function renderRuns(runs) {
    if (runs.length === 0) return <br />;
    return runs.map((run, i) => {
        if (run.kind === 'tag') {
            return (
                <span key={i} className={`rounded px-0.5 -mx-0.5 ${getTagColor(run.tag)}`}>
                    {run.text}
                </span>
            );
        }
        if (run.kind === 'link') {
            const href = /^https?:\/\//i.test(run.url) ? run.url : `https://${run.url}`;
            return (
                <a
                    key={i}
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline decoration-1 underline-offset-2"
                    onClick={(e) => e.stopPropagation()}
                >
                    {run.text}
                </a>
            );
        }
        return <React.Fragment key={i}>{run.text}</React.Fragment>;
    });
}

// Groups raw lines into render blocks: consecutive "- "-prefixed lines form
// one list block, everything else is its own paragraph line — mirrors
// lib/noteContent.js's contentToDoc grouping exactly, so the static view's
// block structure always matches what the live editor would build from the
// same string.
function renderBlocks(content) {
    const { lines, starts } = computeLineStarts(content);
    const blocks = [];
    let i = 0;
    while (i < lines.length) {
        if (LIST_LINE_PATTERN.test(lines[i])) {
            const items = [];
            while (i < lines.length && LIST_LINE_PATTERN.test(lines[i])) {
                items.push({ line: lines[i], start: starts[i] });
                i += 1;
            }
            blocks.push({ type: 'list', items });
        } else {
            blocks.push({ type: 'paragraph', line: lines[i], start: starts[i] });
            i += 1;
        }
    }

    return blocks.map((block, bi) => {
        if (block.type === 'list') {
            return (
                <ul key={bi} className="note-list">
                    {block.items.map((item, ii) => (
                        <li key={ii} data-line-start={item.start} className="note-list-item">
                            <span className="note-list-marker" aria-hidden="true">
                                •
                            </span>
                            <span className="note-list-content">
                                {renderRuns(buildLineRuns(item.line.slice(2)))}
                            </span>
                        </li>
                    ))}
                </ul>
            );
        }
        return (
            <p key={bi} data-line-start={block.start}>
                {renderRuns(buildLineRuns(block.line))}
            </p>
        );
    });
}

export const StaticNotePreview = React.memo(function StaticNotePreview({ note, onActivate }) {
    const contentRef = useRef(null);
    const isEmpty = note.content.length === 0;
    const linkMatches = useMemo(() => findLinkMatches(note.content), [note.content]);

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
                    <p
                        className="is-editor-empty is-empty"
                        data-placeholder={NOTE_PLACEHOLDER_TEXT}
                        data-line-start={0}
                    />
                ) : (
                    renderBlocks(note.content)
                )}
            </div>
            {/* Derived purely from note.content at render time, never stored —
                same "derived, never stored" principle as tags. One card per
                detected link occurrence, not deduped by URL. */}
            {linkMatches.length > 0 && (
                <div className="mt-3 flex flex-col gap-1.5">
                    {linkMatches.map((m, i) => (
                        <LinkCard key={`${m.start}-${i}`} url={m.url} />
                    ))}
                </div>
            )}
        </div>
    );
});
