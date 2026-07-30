"use client";
import React from 'react';
import { Button } from './ui/button';
import { AlertCircle } from 'lucide-react';
import { usePresence } from '../hooks/usePresence';

export function MergeToast({ isOpen, guestNoteCount, onMerge, onDiscard }) {
    const { shouldRender, handleTransitionEnd } = usePresence(isOpen);
    if (!shouldRender) return null;

    return (
        <div
            data-state={isOpen ? 'open' : 'closed'}
            onTransitionEnd={handleTransitionEnd}
            className="anim-pill fixed bottom-24 sm:bottom-8 inset-x-0 mx-auto z-[100] w-max max-w-[90vw]"
        >
            <div className="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 h-[54px] bg-background/80 backdrop-blur-md border border-border/50 text-foreground rounded-full shadow-xl">
                <div className="flex items-center gap-2 pr-2 sm:pr-3 border-r border-border/50 min-w-0">
                    <AlertCircle className="w-5 h-5 text-yellow-500 shrink-0" />
                    <span className="text-sm font-medium truncate min-w-0 sm:hidden">
                        {guestNoteCount} notes to sync
                    </span>
                    <span className="text-sm font-medium whitespace-nowrap hidden sm:inline">
                        Found {guestNoteCount} existing notes
                    </span>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                    <Button
                        size="sm"
                        onClick={onMerge}
                        className="h-7 px-3 text-xs font-semibold rounded-full active:scale-95 transition-transform"
                    >
                        Merge
                    </Button>
                    <Button
                        size="sm"
                        variant="ghost"
                        onClick={onDiscard}
                        className="h-7 px-3 text-xs text-muted-foreground can-hover:hover:text-destructive can-hover:hover:bg-destructive/10 rounded-full active:scale-95 transition-transform"
                    >
                        Discard
                    </Button>
                </div>
            </div>
        </div>
    );
}
