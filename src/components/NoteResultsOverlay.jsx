import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Search, X } from 'lucide-react';
import { Button } from './ui/button';
import { cn, formatDate } from '../lib/utils';
import { getTagMeta } from '../lib/colors';
import { exactTagFromQuery } from '../lib/tagMatch';
import { usePresence } from '../hooks/usePresence';
import { extractSnippet } from '../lib/snippet';

const SEARCH_DEBOUNCE_MS = 200;
const MIN_QUERY_LENGTH = 2;

export const NoteResultsOverlay = ({
    isOpen,
    session, // { mode: 'tag'|'search', query, matches, currentIndex }
    notes,
    onSelect,
    onClose,
    onQueryChange
}) => {
    const { shouldRender, handleTransitionEnd } = usePresence(isOpen);
    const panelRef = useRef(null);

    // Snapshot the last non-null session so content (and, for search, the
    // live-filtered list) doesn't blank out while the exit animation plays.
    // While isOpen stays true this tracks every session change, which is
    // exactly what powers search's live-filter-as-you-type.
    const [display, setDisplay] = useState(session);
    useEffect(() => {
        if (isOpen) setDisplay(session);
    }, [isOpen, session]);

    // Close on Esc (both mobile sheet and desktop panel)
    useEffect(() => {
        if (!isOpen) return;
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    // Desktop: close on outside-click (no backdrop to catch it for us)
    useEffect(() => {
        if (!isOpen) return;
        const handlePointerDown = (e) => {
            if (panelRef.current && !panelRef.current.contains(e.target)) onClose();
        };
        document.addEventListener('mousedown', handlePointerDown);
        return () => document.removeEventListener('mousedown', handlePointerDown);
    }, [isOpen, onClose]);

    if (!shouldRender) return null;

    const { mode, query, matches, currentIndex } = display;
    const isSearch = mode === 'search';
    const exactTag = isSearch ? exactTagFromQuery(query.trim()) : null;
    const tagForMeta = mode === 'tag' ? query : exactTag;
    const meta = tagForMeta ? getTagMeta(tagForMeta) : null;
    const snippetQuery = tagForMeta || query.trim();

    const rows = matches
        .map((id) => notes.find(n => n.id === id))
        .filter(Boolean);

    const trimmedLen = query.trim().length;
    const showPrompt = isSearch && trimmedLen < MIN_QUERY_LENGTH;
    const showEmpty = isSearch && trimmedLen >= MIN_QUERY_LENGTH && rows.length === 0;

    const handleEnter = () => {
        if (rows.length > 0) onSelect(matches.indexOf(rows[0].id));
    };

    const state = isOpen ? 'open' : 'closed';

    const content = (
        <>
            {showPrompt && <StatusRow text="Type to search…" />}
            {showEmpty && <StatusRow text={`No notes match "${query.trim()}"`} />}
            {!showPrompt && !showEmpty && rows.map((note) => (
                <ResultRow
                    key={note.id}
                    note={note}
                    snippetQuery={snippetQuery}
                    meta={meta}
                    onClick={() => onSelect(matches.indexOf(note.id))}
                />
            ))}
        </>
    );

    return (
        <>
            {/* Mobile: full-sheet, matches MobileDrawers */}
            <div className="fixed inset-0 z-[70] sm:hidden">
                <div
                    data-state={state}
                    className="anim-backdrop absolute inset-0 bg-background/80 backdrop-blur-sm"
                    onClick={onClose}
                />
                <div
                    data-state={state}
                    onTransitionEnd={handleTransitionEnd}
                    className="anim-sheet absolute bottom-0 left-0 right-0 bg-background border-t rounded-t-3xl shadow-2xl max-h-[80vh] flex flex-col"
                >
                    {isSearch ? (
                        <SearchHeader query={query} rows={rows} showCount={!showPrompt && !showEmpty} onQueryChange={onQueryChange} onEnter={handleEnter} onClose={onClose} exactTagMeta={meta} />
                    ) : (
                        <TagHeader tag={query} count={rows.length} meta={meta} onClose={onClose} />
                    )}
                    <div className="overflow-y-auto p-2 flex flex-col gap-1 min-h-[50vh]">
                        {content}
                    </div>
                </div>
            </div>

            {/* Desktop: panel opens from its own trigger — below the top-right
                search icon for search mode, above the bottom-right tag pill
                for tag mode — never a fixed corner unrelated to either. */}
            <div
                ref={panelRef}
                data-state={state}
                onTransitionEnd={handleTransitionEnd}
                className={cn(
                    "hidden sm:flex fixed z-[70] w-[380px] max-h-[60vh] flex-col bg-background/95 backdrop-blur-md border border-border/50 rounded-2xl shadow-lg",
                    isSearch
                        ? "anim-panel-top top-20 right-8 origin-top-right"
                        : "anim-panel bottom-24 right-8 origin-bottom-right"
                )}
            >
                {isSearch ? (
                    <SearchHeader query={query} rows={rows} showCount={!showPrompt && !showEmpty} onQueryChange={onQueryChange} onEnter={handleEnter} onClose={onClose} exactTagMeta={meta} />
                ) : (
                    <TagHeader tag={query} count={rows.length} meta={meta} onClose={onClose} />
                )}
                <div className="overflow-y-auto p-2 flex flex-col gap-1">
                    {content}
                </div>
            </div>
        </>
    );
};

const TagHeader = ({ tag, count, meta, onClose }) => (
    <div className="flex items-center justify-between p-4 border-b shrink-0">
        <h2 className="text-sm font-semibold font-mono flex items-center gap-2">
            <span className={cn("w-2 h-2 rounded-full", meta.tick)} />
            <span className={meta.text}>#{tag}</span>
            <span className="text-muted-foreground font-normal">— {count} notes</span>
        </h2>
        <Button variant="ghost" size="icon" onClick={onClose} className="h-7 w-7 rounded-full">
            <X className="h-4 w-4" />
        </Button>
    </div>
);

const SearchHeader = ({ query, rows, showCount, onQueryChange, onEnter, onClose, exactTagMeta }) => {
    const [value, setValue] = useState(query);
    const inputRef = useRef(null);
    const debounceRef = useRef(null);

    // Autofocus whenever a fresh search session opens.
    useEffect(() => {
        setValue(query);
        inputRef.current?.focus();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => () => clearTimeout(debounceRef.current), []);

    const handleChange = (e) => {
        const next = e.target.value;
        setValue(next);
        clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => onQueryChange(next), SEARCH_DEBOUNCE_MS);
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') onEnter();
    };

    return (
        <div className="flex items-center gap-2 p-4 border-b shrink-0">
            <Search className="h-4 w-4 text-muted-foreground shrink-0" />
            {exactTagMeta && <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", exactTagMeta.tick)} />}
            <input
                ref={inputRef}
                value={value}
                onChange={handleChange}
                onKeyDown={handleKeyDown}
                placeholder="Search notes…"
                className="flex-1 min-w-0 bg-transparent text-sm font-medium placeholder:text-muted-foreground placeholder:font-normal outline-none"
            />
            {showCount && (
                <span className="text-xs text-muted-foreground font-mono shrink-0">{rows.length} notes</span>
            )}
            <Button variant="ghost" size="icon" onClick={onClose} className="h-7 w-7 rounded-full shrink-0">
                <X className="h-4 w-4" />
            </Button>
        </div>
    );
};

const StatusRow = ({ text }) => (
    <div className="flex-1 flex items-center justify-center py-12 px-6 text-sm text-muted-foreground text-center">
        {text}
    </div>
);

const ResultRow = ({ note, snippetQuery, meta, onClick }) => {
    const snippet = useMemo(() => extractSnippet(note.content, snippetQuery), [note.content, snippetQuery]);

    return (
        <button
            onClick={onClick}
            className="w-full text-left px-3 py-2.5 rounded-lg can-hover:hover:bg-muted transition-[background-color,transform] duration-150 ease-out active:scale-[0.98] flex flex-col gap-1"
        >
            <div className="flex items-center gap-2">
                {meta && <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", meta.tick)} />}
                <span className="text-xs text-muted-foreground font-mono">{formatDate(note.createdAt)}</span>
            </div>
            <p className="text-sm text-foreground/90 line-clamp-1 pl-3.5">{snippet}</p>
        </button>
    );
};
