import React from 'react';
import { cn } from '../lib/utils';
import { Button } from "./ui/button";
import { getTagMeta } from '../lib/colors';
import { extractUniqueTags } from '../lib/tags';
import { getSlidingWindow } from '../lib/slidingWindow';

export const TagsRail = ({ notes, activeNoteId, tags = [], onTagClick }) => {
    // Get active tags for the current note
    const activeTags = React.useMemo(() => {
        if (!activeNoteId) return new Set();
        const note = notes.find(n => n.id === activeNoteId);
        if (!note) return new Set();

        return new Set(extractUniqueTags(note.content));
    }, [activeNoteId, notes]);

    // Sort tags alphabetically? Or by frequency?
    // Let's stick to alphabetical for stability.
    const sortedTags = React.useMemo(() => {
        return [...tags].sort();
    }, [tags]);

    // Sliding window (25 items, centered on active tag) — shared with TimelineRail via lib/slidingWindow.js
    const windowedTags = React.useMemo(() => {
        if (!activeTags.size) return sortedTags;
        // Find the index of the first active tag in the sorted list — acts as our "center of gravity"
        const firstActiveTag = sortedTags.find(t => activeTags.has(t));
        const activeIndex = sortedTags.indexOf(firstActiveTag);
        return getSlidingWindow(sortedTags, activeIndex);
    }, [sortedTags, activeTags]);

    if (!tags || tags.length === 0) return null;

    return (
        <div className="fixed right-8 top-24 bottom-32 w-48 z-40 hidden sm:flex flex-col justify-center pointer-events-none">
            {/* Inner container with scroll if needed */}
            <div className="max-h-full overflow-y-auto no-scrollbar py-4 flex flex-col items-center">
                <div className="flex flex-col gap-1 w-full px-2">
                    {windowedTags.map(tag => {
                        const isActive = activeTags.has(tag);
                        const meta = getTagMeta(tag);

                        return (
                            <div
                                key={tag}
                                onClick={() => onTagClick(tag)}
                                className="group flex items-center justify-end w-full gap-3 h-3 cursor-pointer pointer-events-auto"
                            >
                                {/* Tag Label (Appears on LEFT of tick for Right Rail) */}
                                <span className={cn(
                                    "text-[11px] font-mono tracking-wide transition-[transform,opacity,color] duration-150 ease-out whitespace-nowrap",
                                    isActive
                                        ? `opacity-100 translate-x-0 ${meta.text}`
                                        : "opacity-0 text-muted-foreground translate-x-4 group-hover:opacity-100 group-hover:translate-x-0 group-hover:text-foreground"
                                )}>
                                    {tag}
                                </span>

                                {/* Ruler Tick (Right side) — box stays w-6 always; visual width comes
                                    from scaleX so the tick never triggers layout reflow or nudges
                                    the label (right edge is the anchor, matching justify-end). */}
                                <div className={cn(
                                    "shrink-0 w-6 h-[2px] rounded-full origin-right transition-transform duration-150 ease-out opacity-100",
                                    meta.tick, // Always apply the color
                                    isActive
                                        ? "scale-x-100" // Active: Wide
                                        : "scale-x-50 group-hover:scale-x-100" // Inactive: Short, expands on hover
                                )} />
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};
