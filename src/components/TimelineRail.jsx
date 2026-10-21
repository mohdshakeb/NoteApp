import React from 'react';
import { cn } from '../lib/utils';
import { getSlidingWindow } from '../lib/slidingWindow';

// Helper to find the first note ID for a given date
const getNoteIdForDate = (notes, year, month, day) => {
    const note = notes.find(n => {
        const d = new Date(n.createdAt);
        return d.getFullYear() === year && d.getMonth() === month && d.getDate() === day;
    });
    return note ? note.id : null;
};

const getNewestNoteId = (notes) => notes.reduce(
    (newest, n) => (!newest || new Date(n.createdAt) > new Date(newest.createdAt) ? n : newest),
    null
)?.id ?? null;

const toDateKey = (d) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

export const TimelineRail = ({ notes, activeNoteId, isAtBottom, tags, onTagClick, onSelectNote }) => {
    // Recomputed every render (cheap) so the rail rolls over at midnight on
    // the next re-render instead of staying pinned to the day the memo ran.
    const todayKey = toDateKey(new Date());

    // Group notes by sorted keys to render in order
    // But we don't display the group headers anymore.
    // Flatten dates into a sorted array for the sliding window
    // Flatten dates into a sorted array for the sliding window
    // We compute this directly from the notes prop now, skipping the intermediate 'groupedDates' object
    const allDates = React.useMemo(() => {
        const uniqueDates = new Set();
        const flat = [];

        // 1. Extract unique dates
        // Today is always on the rail, even with no note dated today: the
        // bottom of the feed is where today's writing happens (the perpetual
        // blank note keeps whatever day it was created), and the rail pins
        // there when scrolled to the end — same as Android's NoteFeedScreen.
        [...notes.map(note => new Date(note.createdAt)), new Date()].forEach(d => {
            const key = toDateKey(d);
            if (!uniqueDates.has(key)) {
                uniqueDates.add(key);
                flat.push({
                    year: d.getFullYear(),
                    month: d.getMonth(),
                    day: d.getDate(),
                    key: key
                });
            }
        });

        // 2. Sort them broadly by time (Oldest -> Newest)
        return flat.sort((a, b) => {
            const dateA = new Date(a.year, a.month, a.day);
            const dateB = new Date(b.year, b.month, b.day);
            return dateA - dateB;
        });
    }, [notes, todayKey]);

    // Scrolled to the end of a chronological feed means "today", regardless of
    // which note the reading-line observer lands on — a short last note can
    // never reach that line, which left the rail stuck on an older date.
    const activeDateKey = React.useMemo(() => {
        if (isAtBottom) return todayKey;
        if (!activeNoteId) return null;
        const note = notes.find(n => n.id === activeNoteId);
        if (!note) return null;
        return toDateKey(new Date(note.createdAt));
    }, [isAtBottom, todayKey, activeNoteId, notes]);

    // Sliding window (25 items, centered on active date) — shared with TagsRail via lib/slidingWindow.js
    const windowedDates = React.useMemo(() => {
        if (!activeDateKey) return allDates;
        const activeIndex = allDates.findIndex(d => d.key === activeDateKey);
        return getSlidingWindow(allDates, activeIndex);
    }, [allDates, activeDateKey]);


    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    return (
        // Adjusted vertical constraints to avoid overlapping Logo (Top) and Avatar/Toggle (Bottom)
        <div className="fixed left-8 top-24 bottom-32 w-24 z-40 hidden sm:flex flex-col justify-center pointer-events-none">
            {/* Inner container for scrolling if needed, max height constraint */}
            <div className="max-h-full overflow-y-auto no-scrollbar py-4 flex flex-col items-center">
                <div className="flex flex-col gap-1 w-full px-2">
                    {windowedDates.map(({ year, month, day, key }) => {
                        const isSameDate = activeDateKey === key;
                        const handleDateClick = () => {
                            // Today with no note of its own → the newest note, i.e. the bottom of the feed
                            const noteId = getNoteIdForDate(notes, parseInt(year), parseInt(month), day)
                                ?? (key === todayKey ? getNewestNoteId(notes) : null);
                            if (noteId) onSelectNote(noteId);
                        };

                        return (
                            <div
                                key={key}
                                onClick={handleDateClick}
                                className="group flex items-center justify-start w-full gap-3 h-3 cursor-pointer pointer-events-auto"
                            >
                                {/* Ruler Tick (Left side) — box stays w-6 always; visual width comes
                                    from scaleX so the tick never triggers layout reflow or nudges
                                    the label (left edge is the anchor, matching justify-start). */}
                                <div className={cn(
                                    "w-6 h-[1.5px] rounded-full origin-left transition-[transform,background-color,opacity] duration-150 ease-out group-hover:scale-x-100 group-hover:bg-foreground group-hover:opacity-100",
                                    isSameDate
                                        ? "scale-x-100 bg-foreground opacity-100"
                                        : "scale-x-[0.333] bg-muted-foreground opacity-30"
                                )} />

                                {/* Date Label (Appears on Right of tick) */}
                                <span className={cn(
                                    "text-[11px] font-sans tracking-wide transition-[transform,opacity,color] duration-150 ease-out whitespace-nowrap group-hover:opacity-100 group-hover:translate-x-0 group-hover:text-foreground",
                                    isSameDate
                                        ? "opacity-100 text-foreground translate-x-0"
                                        : "opacity-0 text-muted-foreground -translate-x-4"
                                )}>
                                    {monthNames[parseInt(month)]} {day}
                                </span>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};
