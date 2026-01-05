import React from 'react';
import { cn } from '../lib/utils';

// Helper to find the first note ID for a given date
const getNoteIdForDate = (notes, year, month, day) => {
    const note = notes.find(n => {
        const d = new Date(n.createdAt);
        return d.getFullYear() === year && d.getMonth() === month && d.getDate() === day;
    });
    return note ? note.id : null;
};

export const TimelineRail = ({ notes, activeNoteId, tags, onTagClick }) => {
    // Group notes by sorted keys to render in order
    // But we don't display the group headers anymore.
    // Flatten dates into a sorted array for the sliding window
    // Flatten dates into a sorted array for the sliding window
    // We compute this directly from the notes prop now, skipping the intermediate 'groupedDates' object
    const allDates = React.useMemo(() => {
        const uniqueDates = new Set();
        const flat = [];

        // 1. Extract unique dates
        notes.forEach(note => {
            const d = new Date(note.createdAt);
            const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
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
    }, [notes]);

    // Added activeDateKey back for window calculation
    const activeDateKey = React.useMemo(() => {
        if (!activeNoteId) return null;
        const note = notes.find(n => n.id === activeNoteId);
        if (!note) return null;
        const d = new Date(note.createdAt);
        return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    }, [activeNoteId, notes]);

    // Calculate Sliding Window (Limit to 25 items, centered on active date)
    const windowedDates = React.useMemo(() => {
        if (!activeDateKey || allDates.length <= 25) return allDates;

        const activeIndex = allDates.findIndex(d => d.key === activeDateKey);
        if (activeIndex === -1) return allDates.slice(0, 25); // Fallback to start

        // Center the window: activeIndex is in the middle (~12th item)
        let start = activeIndex - 12;
        let end = activeIndex + 13; // Total 25

        // Clamp bounds
        if (start < 0) {
            start = 0;
            end = 25;
        }
        if (end > allDates.length) {
            end = allDates.length;
            start = Math.max(0, end - 25);
        }

        return allDates.slice(start, end);
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
                            const noteId = getNoteIdForDate(notes, parseInt(year), parseInt(month), day);
                            if (noteId) {
                                const element = document.getElementById(noteId);
                                if (element) {
                                    element.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                }
                            }
                        };

                        return (
                            <div
                                key={key}
                                onClick={handleDateClick}
                                className="group flex items-center justify-start w-full gap-3 h-3 cursor-pointer pointer-events-auto"
                            >
                                {/* Ruler Tick (Left side) */}
                                <div className={cn(
                                    "h-[1.5px] rounded-full transition-all duration-300 group-hover:w-6 group-hover:bg-foreground group-hover:opacity-100",
                                    isSameDate
                                        ? "w-6 bg-foreground opacity-100"
                                        : "w-2 bg-muted-foreground opacity-30"
                                )} />

                                {/* Date Label (Appears on Right of tick) */}
                                <span className={cn(
                                    "text-[11px] font-mono tracking-wide transition-all duration-300 whitespace-nowrap group-hover:opacity-100 group-hover:translate-x-0 group-hover:text-foreground",
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
