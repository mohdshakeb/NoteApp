import React, { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { cn } from '../lib/utils';
import { JumpToLatestPill } from './JumpToLatestPill';

// Lazy load the editor to reduce initial bundle size to improve performance
const TiptapEditor = dynamic(() => import('./TiptapEditor').then(mod => mod.TiptapEditor), {
    ssr: false,
    loading: () => <div className="h-24 w-full animate-pulse bg-muted/20 rounded-lg" />
});

export const NotebookFeed = ({
    notes,
    onUpdateNote,
    onCreateNote,
    onDeleteNote,
    onFocusBox,
    onEditorFocus,
    onEditorBlur,
    activeMatchIds,
    matchWashClass,
    isTagNavActive
}) => {
    const feedRef = useRef(null);
    const bottomRef = useRef(null);
    const lastNoteRef = useRef(null);

    // Sort notes: Oldest -> Newest for "Notebook" feel
    const sortedNotes = React.useMemo(() => {
        return [...notes].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    }, [notes]);

    // Intersection Observer to track scroll position
    const intersectingNotesRef = useRef(new Set());

    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                // Update the set of candidates
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        intersectingNotesRef.current.add(entry.target);
                    } else {
                        intersectingNotesRef.current.delete(entry.target);
                    }
                });

                // Find the winner
                // Find the winner
                let bestCandidate = null;
                let minDistance = Infinity;
                // Target Line: 25% down (Center of the 10%-40% active zone)
                const targetLine = window.innerHeight * 0.25;

                intersectingNotesRef.current.forEach((node) => {
                    const rect = node.getBoundingClientRect();
                    const nodeCenter = rect.top + (rect.height / 2);
                    const dist = Math.abs(targetLine - nodeCenter);

                    if (dist < minDistance) {
                        minDistance = dist;
                        bestCandidate = node;
                    }
                });

                if (bestCandidate) {
                    const noteId = bestCandidate.getAttribute('data-note-id');
                    const note = notes.find(n => n.id == noteId);
                    if (note) {
                        onFocusBox(note);
                    }
                }
            },
            {
                root: null,
                threshold: 0,
                // Top 10% ignored, Bottom 60% ignored -> 10% to 40% Active Zone (30% height)
                rootMargin: "-10% 0px -60% 0px"
            }
        );

        const noteElements = document.querySelectorAll('.entry-block');
        noteElements.forEach(el => observer.observe(el));

        return () => observer.disconnect();
    }, [notes, onFocusBox, sortedNotes]);

    // Initial Scroll to Bottom (Newest Note)
    const hasInitialScrolled = useRef(false);
    useEffect(() => {
        if (!hasInitialScrolled.current && sortedNotes.length > 0) {
            // Find the last entry block
            const blocks = document.querySelectorAll('.entry-block');
            const lastBlock = blocks[blocks.length - 1];

            if (lastBlock) {
                // 'start' aligns with scroll-margin-top (25vh) -> Perfect Position
                lastBlock.scrollIntoView({ block: 'start' });
                hasInitialScrolled.current = true;
            }
        }
    }, [sortedNotes]);

    // Tracks whether the trailing spacer (right after the newest note) is in
    // view, so we know when to surface the "jump to latest" pill — mirrors
    // the chat-app "scroll to bottom" affordance instead of requiring a
    // permanent add-note button.
    const [isNearBottom, setIsNearBottom] = useState(true);
    useEffect(() => {
        const root = feedRef.current;
        const target = bottomRef.current;
        if (!root || !target) return;

        const observer = new IntersectionObserver(
            ([entry]) => setIsNearBottom(entry.isIntersecting),
            { root, threshold: 0 }
        );
        observer.observe(target);
        return () => observer.disconnect();
    }, []);

    // If focusOrCreateLastNote (below) has to create a brand-new note, the
    // DOM node doesn't exist yet at click time — wait for it to render, then
    // scroll to it (same 'start' + scroll-margin alignment used everywhere
    // else).
    const pendingScrollRef = useRef(false);
    useEffect(() => {
        if (pendingScrollRef.current) {
            pendingScrollRef.current = false;
            const blocks = document.querySelectorAll('.entry-block');
            const lastBlock = blocks[blocks.length - 1];
            lastBlock?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }, [sortedNotes.length]);

    // Shared by the gutter click, the trailing spacer click, and the jump
    // pill: focus the existing blank note if one's waiting, otherwise create
    // a fresh one.
    const focusOrCreateLastNote = () => {
        const lastNote = sortedNotes[sortedNotes.length - 1];
        if (lastNote && !lastNote.content.trim()) {
            lastNoteRef.current?.focus();
        } else {
            pendingScrollRef.current = true;
            onCreateNote('');
        }
    };

    const handleJumpToLatest = () => {
        const lastNote = sortedNotes[sortedNotes.length - 1];
        if (lastNote && !lastNote.content.trim()) {
            // Blank note already waiting — just scroll to it and focus.
            document.getElementById(lastNote.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            lastNoteRef.current?.focus();
        } else {
            focusOrCreateLastNote();
        }
    };

    return (
        <div className="flex-1 h-full overflow-y-auto bg-background scroll-smooth" ref={feedRef}>
            {/* Adjusted padding: px-4 for mobile, sm:px-8 for tablet/desktop */}
            <div
                className="min-h-full w-full max-w-4xl mx-auto px-8 pt-[25vh] pb-12 sm:px-8 sm:pl-32 sm:pr-32 flex flex-col cursor-text"
                onClick={(e) => {
                    // Only trigger if clicking the container itself (gutters), not children
                    if (e.target === e.currentTarget) {
                        focusOrCreateLastNote();
                    }
                }}
            >
                <div className="flex flex-col gap-12">
                    {sortedNotes.map((note, index) => {
                        const isLast = index === sortedNotes.length - 1;
                        return (
                            <div
                                key={note.id}
                                id={note.id}
                                className={cn(
                                    "entry-block -mx-6 px-6 rounded-xl transition-colors duration-150",
                                    activeMatchIds?.has(note.id) && matchWashClass
                                )}
                                data-note-id={note.id}
                            >
                                <TiptapEditor
                                    ref={isLast ? lastNoteRef : null}
                                    note={note}
                                    onAutoSave={(id, content) => {
                                        // Auto-save always UPDATES, never deletes.
                                        // This ensures typing is saved safely.
                                        onUpdateNote(note, content);
                                    }}
                                    onSave={(id, content) => {
                                        // Only delete if empty AND not the only note (on Blur)
                                        if ((!content || !content.trim()) && sortedNotes.length > 1) {
                                            onDeleteNote(note.id);
                                        } else {
                                            onUpdateNote(note, content);
                                        }
                                    }}
                                    onInput={(id, content) => {
                                        // Optional: live update state?
                                    }}
                                    onFocus={() => {
                                        if (onEditorFocus) onEditorFocus();
                                    }}
                                    onBlur={(e) => {
                                        if (onEditorBlur) onEditorBlur();
                                    }}
                                    // Disable auto-focus on mobile to keep Nav Pill visible
                                    autoFocus={note.isNew && (typeof window !== 'undefined' ? window.innerWidth >= 640 : true)}
                                    isLast={isLast}
                                />
                            </div>
                        );
                    })}
                </div>

                <div
                    ref={bottomRef}
                    className="flex-1 w-full cursor-text min-h-[50vh]"
                    onClick={focusOrCreateLastNote}
                />
            </div>

            <JumpToLatestPill
                visible={!isNearBottom && !isTagNavActive}
                onClick={handleJumpToLatest}
            />
        </div>
    );
};
