import { useState, useCallback } from 'react';
import { exactTagFromQuery, noteHasTag } from '../lib/tagMatch';

// mode: 'tag' | 'search' | null
const EMPTY_SESSION = { mode: null, query: '', matches: [], currentIndex: 0 };

export function useNoteFinder(notes, setActiveNoteId) {
    const [session, setSession] = useState(EMPTY_SESSION);
    const [isOverlayOpen, setIsOverlayOpen] = useState(false);

    const scrollToNote = useCallback((id) => {
        const element = document.getElementById(id);
        if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'start' });
            setActiveNoteId(id);
        }
    }, [setActiveNoteId]);

    const handleTagClick = useCallback((tag) => {
        const matches = notes
            .filter(n => noteHasTag(n, tag))
            .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
            .map(n => n.id);

        if (matches.length === 0) return;

        // Always start a tag session — this is what drives the match
        // highlight wash, regardless of match count. Whether the steppable
        // pill itself renders is decided separately (see NoteApp.js), since
        // a single match has nothing to step through.
        setSession({ mode: 'tag', query: tag, matches, currentIndex: 0 });

        scrollToNote(matches[0]);
    }, [notes, scrollToNote]);

    // Live-filters as the user types. Unlike handleTagClick, this never
    // auto-scrolls — jumping only happens when the user picks a result
    // (jumpToMatch) or presses Enter on the top one. An exact "#tag" query
    // routes through the same tag-matching helper handleTagClick uses, so it
    // behaves identically (same matches, same color wash) to clicking that
    // tag. Below 2 trimmed characters we don't scan at all — the overlay
    // shows a "type to search" prompt instead, driven off `query` here.
    const handleSearchQuery = useCallback((text) => {
        const trimmed = text.trim();
        const exactTag = trimmed.length >= 2 ? exactTagFromQuery(trimmed) : null;

        const matches = trimmed.length < 2
            ? []
            : notes
                .filter(n => exactTag ? noteHasTag(n, exactTag) : n.content.toLowerCase().includes(trimmed.toLowerCase()))
                .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
                .map(n => n.id);

        setSession({ mode: 'search', query: text, matches, currentIndex: 0 });
    }, [notes]);

    const handleNavNext = useCallback(() => {
        if (session.matches.length === 0) return;

        const nextIndex = (session.currentIndex + 1) % session.matches.length;
        setSession(prev => ({ ...prev, currentIndex: nextIndex }));
        scrollToNote(session.matches[nextIndex]);
    }, [session, scrollToNote]);

    const handleNavPrev = useCallback(() => {
        if (session.matches.length === 0) return;

        const prevIndex = (session.currentIndex - 1 + session.matches.length) % session.matches.length;
        setSession(prev => ({ ...prev, currentIndex: prevIndex }));
        scrollToNote(session.matches[prevIndex]);
    }, [session, scrollToNote]);

    // Full dismiss — used by TagNavigator's X button (tag mode only).
    const handleNavClose = useCallback(() => {
        setSession(EMPTY_SESSION);
        setIsOverlayOpen(false);
    }, []);

    const openOverlay = useCallback(() => setIsOverlayOpen(true), []);

    // Search has no persistent pill like tag mode does, so closing the
    // overlay (Esc, outside-click, X) without picking a result has nothing
    // left to anchor an active session to — clear it. Tag mode keeps its
    // session alive on close so Prev/Next on the pill still work.
    const closeOverlay = useCallback(() => {
        setIsOverlayOpen(false);
        setSession(prev => (prev.mode === 'search' ? EMPTY_SESSION : prev));
    }, []);

    // No-op on the session if a search is already active — re-triggering
    // (Cmd/Ctrl+K again, clicking the search icon again) shouldn't blow away
    // what's already typed. Only starts fresh when entering search mode
    // from tag mode or a cold start, which is also the only case the
    // overlay's input needs to resync its own local (debounced) value from.
    const openSearchOverlay = useCallback(() => {
        setSession(prev => (prev.mode === 'search' ? prev : { ...EMPTY_SESSION, mode: 'search' }));
        setIsOverlayOpen(true);
    }, []);

    // Jump straight to an arbitrary match (from an overlay row click, or
    // Enter on the top search result) instead of stepping ±1. Doesn't reset
    // the session — Prev/Next (tag mode) and the match wash continue
    // coherently from wherever the user jumped to.
    const jumpToMatch = useCallback((index) => {
        if (index < 0 || index >= session.matches.length) return;

        setSession(prev => ({ ...prev, currentIndex: index }));
        setIsOverlayOpen(false);
        scrollToNote(session.matches[index]);
    }, [session, scrollToNote]);

    return {
        session,
        handleTagClick,
        handleSearchQuery,
        handleNavNext,
        handleNavPrev,
        handleNavClose,
        isOverlayOpen,
        openOverlay,
        openSearchOverlay,
        closeOverlay,
        jumpToMatch
    };
}
