import React, { useMemo } from 'react';
import { cn, formatDate } from '../lib/utils';
import { ChevronUp } from 'lucide-react';
import { UserDropdown } from './ui/UserDropdown';

import { LoginDropdown } from './LoginDropdown'; // [NEW]

export const MobileNavPill = ({
    notes,
    activeNoteId,
    isVisible = true,
    user,
    onSignOut,
    onDeleteAccount,
    onDateClick,
    onTagsClick,
    // onLoginClick removed as Dropdown handles it
}) => {
    // ... (memo hooks same as before) ...
    // Derive active date from activeNoteId
    const activeDate = useMemo(() => {
        if (!activeNoteId) return null;
        const note = notes.find(n => n.id === activeNoteId);
        if (!note) return null;
        return new Date(note.createdAt);
    }, [activeNoteId, notes]);

    // Format date using shared utility (handles Year logic)
    const dateLabel = useMemo(() => {
        if (!activeDate) return "Timeline";
        return formatDate(activeDate);
    }, [activeDate]);

    // Visual: 3 overlapping circles for tags
    const tagCircles = (
        <div className="flex items-center -space-x-2">
            <div className="w-6 h-6 rounded-full border-2 border-background bg-blue-400 opacity-90" />
            <div className="w-6 h-6 rounded-full border-2 border-background bg-pink-400 opacity-90" />
            <div className="w-6 h-6 rounded-full border-2 border-background bg-yellow-400 opacity-90" />
        </div>
    );

    return (
        <div className={cn(
            "fixed bottom-6 inset-x-4 z-50 transition-all duration-300 sm:hidden",
            isVisible ? "translate-y-0 opacity-100" : "translate-y-20 opacity-0 pointer-events-none"
        )}>
            <div className="flex items-center justify-between w-full h-[54px] bg-background/80 backdrop-blur-md border border-border/50 rounded-full shadow-lg px-2 pl-4">

                {/* Date Side (Left) */}
                <button
                    onClick={onDateClick}
                    className="flex items-center gap-2 text-sm font-medium active:opacity-70 transition-opacity"
                >
                    <span className="text-foreground">{dateLabel}</span>
                    <ChevronUp className="w-3 h-3 text-muted-foreground" />
                </button>

                {/* Right Side: Tags + Avatar/Login */}
                <div className="flex items-center gap-3">
                    {/* Tags Trigger */}
                    <button
                        onClick={onTagsClick}
                        className="flex items-center active:scale-95 transition-transform p-1"
                    >
                        {tagCircles}
                    </button>

                    {/* Divider */}
                    <div className="w-[1px] h-5 bg-border" />

                    {/* User Avatar or Login */}
                    <div className="flex items-center pr-1">
                        {user ? (
                            <UserDropdown
                                user={user}
                                onSignOut={onSignOut}
                                onDeleteAccount={onDeleteAccount}
                                align="end"
                            />
                        ) : (
                            <LoginDropdown>
                                <button className="text-sm font-semibold text-primary hover:opacity-80 px-2">
                                    Login
                                </button>
                            </LoginDropdown>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
