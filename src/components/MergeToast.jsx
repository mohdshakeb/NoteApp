"use client";
import React from 'react';
import { Button } from './ui/button';
import { AlertCircle } from 'lucide-react';

export function MergeToast({ isOpen, guestNoteCount, onMerge, onDiscard }) {
    if (!isOpen) return null;

    return (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[100] animate-in fade-in slide-in-from-bottom-4 duration-300 w-max max-w-[90vw]">
            <div className="flex items-center gap-3 px-4 h-[54px] bg-background/80 backdrop-blur-md border border-border/50 text-foreground rounded-full shadow-xl">
                <div className="flex items-center gap-2 pr-3 border-r border-border/50">
                    <AlertCircle className="w-5 h-5 text-yellow-500" />
                    <span className="text-sm font-medium whitespace-nowrap">
                        Found {guestNoteCount} existing notes
                    </span>
                </div>

                <div className="flex items-center gap-2">
                    <Button
                        size="sm"
                        onClick={onMerge}
                        className="h-7 px-3 text-xs font-semibold rounded-full"
                    >
                        Merge
                    </Button>
                    <Button
                        size="sm"
                        variant="ghost"
                        onClick={onDiscard}
                        className="h-7 px-3 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-full"
                    >
                        Discard
                    </Button>
                </div>
            </div>
        </div>
    );
}
