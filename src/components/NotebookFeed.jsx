import React, { useEffect, useRef } from 'react';
import { TiptapEditor } from './TiptapEditor';
import { cn } from '../lib/utils';

export const NotebookFeed = ({
    notes,
    onUpdateNote,
    onCreateNote,
    onDeleteNote,
    onFocusBox,
    onEditorFocus, // [NEW]
    onEditorBlur   // [NEW]
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
                let bestCandidate = null;
                let minDistance = Infinity;
                const viewportCenter = window.innerHeight / 2;

                intersectingNotesRef.current.forEach((node) => {
                    const rect = node.getBoundingClientRect();
                    const nodeCenter = rect.top + (rect.height / 2);
                    const dist = Math.abs(viewportCenter - nodeCenter);

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
                rootMargin: "-35% 0px -35% 0px" // 30% Active Zone
            }
        );

        const noteElements = document.querySelectorAll('.entry-block');
        noteElements.forEach(el => observer.observe(el));

        return () => observer.disconnect();
    }, [notes, onFocusBox, sortedNotes]);

    return (
        <div className="flex-1 h-full overflow-y-auto bg-background scroll-smooth" ref={feedRef}>
            {/* Adjusted padding: px-4 for mobile, sm:px-8 for tablet/desktop */}
            <div className="min-h-full w-full max-w-4xl mx-auto px-4 py-12 sm:px-8 sm:pl-32 sm:pr-32">
                <div className="flex flex-col gap-12">
                    {sortedNotes.map((note, index) => {
                        const isLast = index === sortedNotes.length - 1;
                        return (
                            <div key={note.id} className="entry-block" data-note-id={note.id}>
                                <TiptapEditor
                                    ref={isLast ? lastNoteRef : null}
                                    note={note}
                                    onSave={(id, content) => {
                                        if (!content || !content.trim()) {
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

                                        // "Always Active" Logic
                                        setTimeout(() => {
                                            const active = document.activeElement;
                                            const isEditor = active && (
                                                active.classList.contains('ProseMirror') ||
                                                active.closest('.ProseMirror')
                                            );

                                            if (!isEditor) {
                                                const lastNote = sortedNotes[sortedNotes.length - 1];
                                                if (lastNote && !lastNote.content.trim()) {
                                                    lastNoteRef.current?.focus();
                                                } else {
                                                    onCreateNote('');
                                                }
                                            }
                                        }, 100);
                                    }}
                                    autoFocus={note.isNew}
                                    isLast={isLast}
                                />
                            </div>
                        );
                    })}
                </div>

                <div
                    ref={bottomRef}
                    className="h-[50vh] w-full cursor-text"
                    onClick={() => {
                        const lastNote = sortedNotes[sortedNotes.length - 1];
                        if (lastNote && !lastNote.content.trim()) {
                            lastNoteRef.current?.focus();
                        } else {
                            onCreateNote('');
                        }
                    }}
                />
            </div>
        </div>
    );
};
