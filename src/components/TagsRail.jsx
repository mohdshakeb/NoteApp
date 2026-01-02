import React from 'react';
import { cn } from '../lib/utils';
import { Button } from "./ui/button";
import { getTagMeta } from '../lib/colors';

export const TagsRail = ({ notes, activeNoteId, tags = [], onTagClick }) => {
    // Get active tags for the current note
    const activeTags = React.useMemo(() => {
        if (!activeNoteId) return new Set();
        const note = notes.find(n => n.id === activeNoteId);
        if (!note) return new Set();

        // Extract tags from note content (naive regex or pre-parsed?)
        // Assuming tags are hashtags like #tag
        const found = note.content.match(/#[\w-]+/g) || [];
        // Clean them (remove #)
        return new Set(found.map(t => t.slice(1)));
    }, [activeNoteId, notes]);

    // Sort tags alphabetically? Or by frequency?
    // Let's stick to alphabetical for stability.
    const sortedTags = React.useMemo(() => {
        return [...tags].sort();
    }, [tags]);

    // Sliding Window Logic for Tags
    const windowedTags = React.useMemo(() => {
        if (!activeTags.size || tags.length <= 25) return sortedTags;

        // Find the index of the first active tag in the sorted list
        // This acts as our "center of gravity"
        const firstActiveTag = sortedTags.find(t => activeTags.has(t));
        const activeIndex = sortedTags.indexOf(firstActiveTag);

        if (activeIndex === -1) return sortedTags.slice(0, 25);

        // Center (~12th item)
        let start = activeIndex - 12;
        let end = activeIndex + 13;

        // Clamp
        if (start < 0) {
            start = 0;
            end = 25;
        }
        if (end > sortedTags.length) {
            end = sortedTags.length;
            start = Math.max(0, end - 25);
        }

        return sortedTags.slice(start, end);
    }, [sortedTags, activeTags, tags.length]);

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
                                    "text-[11px] font-mono tracking-wide transition-all duration-300 whitespace-nowrap",
                                    isActive
                                        ? `opacity-100 translate-x-0 ${meta.text}`
                                        : "opacity-0 text-muted-foreground translate-x-4 group-hover:opacity-100 group-hover:translate-x-0 group-hover:text-foreground"
                                )}>
                                    {tag}
                                </span>

                                {/* Ruler Tick (Right side) */}
                                <div className={cn(
                                    "shrink-0 h-[2px] rounded-full transition-all duration-300 opacity-100",
                                    meta.tick, // Always apply the color
                                    isActive
                                        ? "w-6" // Active: Wide
                                        : "w-3 group-hover:w-6" // Inactive: Short, expands on hover
                                )} />
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};
