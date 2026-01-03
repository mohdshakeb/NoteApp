import { useState, useCallback } from 'react';

export function useTagNavigation(notes, setActiveNoteId) {
    const [tagNav, setTagNav] = useState({
        tag: null,
        matches: [],
        currentIndex: 0
    });

    const handleTagClick = useCallback((tag) => {
        // 1. Find all notes with this tag
        const regex = new RegExp(`#${tag}\\b`, 'i');
        const matches = notes
            .filter(n => regex.test(n.content))
            .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
            .map(n => n.id);

        if (matches.length === 0) return;

        // 2. Set State (Only if > 1 match)
        if (matches.length > 1) {
            setTagNav({
                tag,
                matches,
                currentIndex: 0
            });
        } else {
            // Clear nav if we were open on another tag
            setTagNav({ tag: null, matches: [], currentIndex: 0 });
        }

        // 3. Scroll to first
        const element = document.getElementById(matches[0]);
        if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            setActiveNoteId(matches[0]);
        }
    }, [notes, setActiveNoteId]);

    const handleNavNext = useCallback(() => {
        if (!tagNav.tag || tagNav.matches.length === 0) return;

        const nextIndex = (tagNav.currentIndex + 1) % tagNav.matches.length;

        setTagNav(prev => ({ ...prev, currentIndex: nextIndex }));

        const id = tagNav.matches[nextIndex];
        const element = document.getElementById(id);
        if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            setActiveNoteId(id);
        }
    }, [tagNav, setActiveNoteId]);

    const handleNavPrev = useCallback(() => {
        if (!tagNav.tag || tagNav.matches.length === 0) return;

        // Wrap around correctly
        const prevIndex = (tagNav.currentIndex - 1 + tagNav.matches.length) % tagNav.matches.length;

        setTagNav(prev => ({ ...prev, currentIndex: prevIndex }));

        const id = tagNav.matches[prevIndex];
        const element = document.getElementById(id);
        if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            setActiveNoteId(id);
        }
    }, [tagNav, setActiveNoteId]);

    const handleNavClose = useCallback(() => {
        setTagNav({ tag: null, matches: [], currentIndex: 0 });
    }, []);

    return {
        tagNav,
        handleTagClick,
        handleNavNext,
        handleNavPrev,
        handleNavClose
    };
}
