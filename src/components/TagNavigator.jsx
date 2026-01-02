import React from 'react';
import { ChevronUp, ChevronDown, X } from 'lucide-react';
import { Button } from './ui/button';
import { cn } from '../lib/utils';
import { getTagMeta } from '../lib/colors';

export const TagNavigator = ({
    tag,
    currentIndex,
    totalMatches,
    onNext,
    onPrev,
    onClose
}) => {
    if (!tag) return null;

    const meta = getTagMeta(tag);

    return (
        <div className="fixed bottom-8 right-8 z-50 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="flex items-center gap-2 px-3 py-2 bg-background border rounded-full shadow-lg">
                <div className="flex items-center gap-2 pl-1 pr-3 border-r relative group">
                    {/* Tag colored dot */}
                    <div className={cn("w-2 h-2 rounded-full", meta.tick)} />
                    <span className={cn("text-sm font-medium", meta.text)}>
                        #{tag}
                    </span>
                    <span className="text-xs text-muted-foreground font-mono ml-1">
                        {currentIndex + 1} / {totalMatches}
                    </span>

                    {/* Close button (Hidden until hover? Or always visible? Let's make it always visible but minimal) 
                         Wait, the design says "Next/Prev/Close".
                         Let's put Close at the end.
                     */}
                </div>

                <div className="flex items-center gap-1">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 rounded-full hover:bg-muted"
                        onClick={onPrev}
                        disabled={totalMatches <= 1}
                    >
                        <ChevronUp className="h-4 w-4" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 rounded-full hover:bg-muted"
                        onClick={onNext}
                        disabled={totalMatches <= 1}
                    >
                        <ChevronDown className="h-4 w-4" />
                    </Button>

                    <div className="w-[1px] h-4 bg-border mx-1" />

                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 rounded-full hover:bg-destructive/10 hover:text-destructive"
                        onClick={onClose}
                    >
                        <X className="h-3.5 w-3.5" />
                    </Button>
                </div>
            </div>
        </div>
    );
};
