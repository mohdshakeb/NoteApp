import React, { useEffect, useState } from 'react';
import { ChevronUp, ChevronDown, X } from 'lucide-react';
import { Button } from './ui/button';
import { cn } from '../lib/utils';
import { getTagMeta } from '../lib/colors';
import { usePresence } from '../hooks/usePresence';

export const TagNavigator = ({
    tag,
    currentIndex,
    totalMatches,
    onNext,
    onPrev,
    onClose,
    onOpenOverlay
}) => {
    const { shouldRender, handleTransitionEnd } = usePresence(!!tag);

    // Snapshot the last non-null props so content doesn't blank out
    // while the exit animation is still playing (tag goes null immediately,
    // but the element stays mounted for `handleTransitionEnd` to fire).
    const [display, setDisplay] = useState({ tag, currentIndex, totalMatches });
    useEffect(() => {
        if (tag) setDisplay({ tag, currentIndex, totalMatches });
    }, [tag, currentIndex, totalMatches]);

    if (!shouldRender) return null;

    const meta = getTagMeta(display.tag);

    return (
        <div
            data-state={tag ? 'open' : 'closed'}
            onTransitionEnd={handleTransitionEnd}
            className="anim-pill fixed bottom-6 inset-x-0 mx-auto w-max max-w-[90vw] sm:inset-x-auto sm:right-8 sm:bottom-8 z-[60]"
        >
            <div className="flex items-center gap-2 px-4 h-[54px] bg-background/80 backdrop-blur-md border border-border/50 rounded-full shadow-lg">
                <div className="flex items-center gap-2 pl-1 pr-3 border-r relative group">
                    {/* Tag colored dot */}
                    <div className={cn("w-2 h-2 rounded-full", meta.tick)} />
                    <span className={cn("text-sm font-medium", meta.text)}>
                        #{display.tag}
                    </span>
                    <button
                        onClick={onOpenOverlay}
                        className="text-xs text-muted-foreground font-mono ml-1 rounded can-hover:hover:text-foreground transition-[color,transform] duration-150 ease-out active:scale-95"
                        title="View all matches"
                    >
                        {display.currentIndex + 1} / {display.totalMatches}
                    </button>
                </div>

                <div className="flex items-center gap-1">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 rounded-full can-hover:hover:bg-muted active:scale-95 transition-transform"
                        onClick={onPrev}
                        disabled={display.totalMatches <= 1}
                    >
                        <ChevronUp className="h-4 w-4" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 rounded-full can-hover:hover:bg-muted active:scale-95 transition-transform"
                        onClick={onNext}
                        disabled={display.totalMatches <= 1}
                    >
                        <ChevronDown className="h-4 w-4" />
                    </Button>

                    <div className="w-[1px] h-4 bg-border mx-1" />

                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 rounded-full can-hover:hover:bg-destructive/10 can-hover:hover:text-destructive active:scale-95 transition-transform"
                        onClick={onClose}
                    >
                        <X className="h-3.5 w-3.5" />
                    </Button>
                </div>
            </div>
        </div>
    );
};
