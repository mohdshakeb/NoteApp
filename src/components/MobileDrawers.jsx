import React, { useMemo } from 'react';
import { cn } from '../lib/utils';
import { X } from 'lucide-react';
import { Button } from './ui/button';
import { getTagMeta } from '../lib/colors';

export const MobileDrawers = ({
    isOpen,
    type, // 'date' | 'tags'
    notes,
    activeNoteId,
    tags,
    onClose,
    onSelectDate,
    onSelectTag
}) => {
    // Shared Overlay
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[60] sm:hidden">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200"
                onClick={onClose}
            />

            {/* Sheet */}
            <div className="absolute bottom-0 left-0 right-0 bg-background border-t rounded-t-3xl shadow-2xl max-h-[80vh] flex flex-col animate-in slide-in-from-bottom duration-300">

                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b">
                    <h2 className="text-lg font-semibold font-mono">
                        {type === 'date' ? 'Timeline' : 'Tags'}
                    </h2>
                    <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full">
                        <X className="h-5 w-5" />
                    </Button>
                </div>

                {/* Content */}
                <div className="overflow-y-auto p-4 flex flex-col gap-2 min-h-[50vh]">
                    {type === 'date' && <DateList notes={notes} activeNoteId={activeNoteId} onSelect={onSelectDate} />}
                    {type === 'tags' && <TagList tags={tags} onSelect={onSelectTag} />}
                </div>
            </div>
        </div>
    );
};

const DateList = ({ notes, activeNoteId, onSelect }) => {
    // Unique dates extraction (copied logic from TimelineRail roughly)
    const dates = useMemo(() => {
        const unique = new Set();
        const list = [];
        notes.forEach(note => {
            const d = new Date(note.createdAt);
            const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
            if (!unique.has(key)) {
                unique.add(key);
                list.push({ d, key });
            }
        });
        return list.sort((a, b) => a.d - b.d);
    }, [notes]);

    return (
        <div className="flex flex-col gap-2">
            {dates.map(({ d, key }) => {
                const label = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
                return (
                    <button
                        key={key}
                        onClick={() => onSelect(d)}
                        className="p-3 text-left rounded-lg hover:bg-muted text-sm font-mono border border-transparent hover:border-border transition-all"
                    >
                        {label}
                    </button>
                );
            })}
        </div>
    );
};

const TagList = ({ tags, onSelect }) => {
    return (
        <div className="flex flex-wrap gap-2">
            {tags.map(tag => {
                const meta = getTagMeta(tag);
                return (
                    <button
                        key={tag}
                        onClick={() => onSelect(tag)}
                        className={cn(
                            "px-3 py-1.5 rounded-full text-sm font-medium border transition-all",
                            "hover:opacity-80",
                            meta.bg, meta.text, "border-transparent"
                            // Using the colored pill style for the list to be vibrant
                        )}
                    >
                        #{tag}
                    </button>
                );
            })}
        </div>
    );
};
