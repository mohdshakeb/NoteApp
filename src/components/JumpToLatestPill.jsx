import React from 'react';
import { ArrowDown } from 'lucide-react';
import { usePresence } from '../hooks/usePresence';

// Shares TagNavigator's fixed slot (bottom-right pill). The two are mutually
// exclusive by construction — this only renders while no tag-nav session is
// active — so they never compete for the same spot.
export const JumpToLatestPill = ({ visible, onClick }) => {
    const { shouldRender, handleTransitionEnd } = usePresence(visible);

    if (!shouldRender) return null;

    return (
        <div
            data-state={visible ? 'open' : 'closed'}
            onTransitionEnd={handleTransitionEnd}
            className="anim-pill fixed bottom-24 right-4 sm:bottom-8 sm:right-8 z-[60]"
        >
            <button
                onClick={onClick}
                title="Jump to latest note"
                className="flex items-center justify-center h-[54px] w-[54px] rounded-full bg-background/80 backdrop-blur-md border border-border/50 shadow-lg can-hover:hover:bg-muted active:scale-95 transition-transform"
            >
                <ArrowDown className="h-4 w-4" />
            </button>
        </div>
    );
};
