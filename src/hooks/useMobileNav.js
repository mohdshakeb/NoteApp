import { useState, useCallback } from 'react';

export function useMobileNav(notes, setActiveNoteId, handleTagClick) {
    const [mobileDrawer, setMobileDrawer] = useState({
        isOpen: false,
        type: null // 'date' | 'tags'
    });

    // Track editor focus to hide generic floating UI on mobile
    const [isEditorFocused, setIsEditorFocused] = useState(false);

    const handleMobileDateClick = useCallback(() => {
        setMobileDrawer({ isOpen: true, type: 'date' });
    }, []);

    const handleMobileTagsClick = useCallback(() => {
        setMobileDrawer({ isOpen: true, type: 'tags' });
    }, []);

    const closeMobileDrawer = useCallback(() => {
        setMobileDrawer({ isOpen: false, type: null });
    }, []);

    const handleMobileDateSelect = useCallback((date) => {
        // Find first note for this date
        const target = notes.find(n => {
            const d = new Date(n.createdAt);
            return d.getFullYear() === date.getFullYear() &&
                d.getMonth() === date.getMonth() &&
                d.getDate() === date.getDate();
        });

        if (target) {
            const el = document.getElementById(target.id);
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            setActiveNoteId(target.id);
        }
        closeMobileDrawer();
    }, [notes, setActiveNoteId, closeMobileDrawer]);

    const handleMobileTagSelect = useCallback((tag) => {
        handleTagClick(tag);
        closeMobileDrawer();
    }, [handleTagClick, closeMobileDrawer]);

    return {
        mobileDrawer,
        isEditorFocused,
        setIsEditorFocused,
        handleMobileDateClick,
        handleMobileTagsClick,
        closeMobileDrawer,
        handleMobileDateSelect,
        handleMobileTagSelect
    };
}
