import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { cn } from '../lib/utils';
import { JumpToLatestPill } from './JumpToLatestPill';
import { StaticNotePreview } from './StaticNotePreview';
import { NoteActionsRow } from './NoteActionsRow';
import { NoteActionsSheet } from './NoteActionsSheet';
import { DaveIllustration } from './DaveIllustration';
import { useLongPress } from '../hooks/useLongPress';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from './ui/alert-dialog';

// Lazy load the editor to reduce initial bundle size to improve performance
const TiptapEditor = dynamic(() => import('./TiptapEditor').then(mod => mod.TiptapEditor), {
    ssr: false,
    // h-14 (56px) matches a real blank editor's rendered height (~55px) —
    // h-24 previously left a ~41px gap that snapped shut the instant the
    // chunk resolved, shifting the feed's scrollHeight mid-glide (see the
    // scroll glide's comment below).
    loading: () => <div className="h-14 w-full animate-pulse bg-muted/20 rounded-lg" />
});

// Initial-load scroll glide (Planning/CONTEXT.md, 2026-08-22) — a fixed
// distance/duration, never proportional to note count, mirroring the Android
// app's glideToTarget/SCROLL_GLIDE_DISTANCE pattern for the same problem.
const INITIAL_SCROLL_GLIDE_DISTANCE_PX = 240;
const INITIAL_SCROLL_GLIDE_DURATION_MS = 450;

// Small hand-rolled cubic-bezier evaluator — mirrors globals.css's
// --ease-out (cubic-bezier(0.23, 1, 0.32, 1)) so the JS-driven scroll glide
// below uses the same curve as every other animated element in the app.
// Duplicated here (not read from the CSS custom property) because there's no
// browser API that exposes a WAAPI/CSS easing curve's eased output as a
// queryable number — this binary search is the standard way to hand-roll a
// bezier-eased value in JS. Keep in sync with globals.css if --ease-out
// ever changes.
const EASE_OUT_BEZIER = [0.23, 1, 0.32, 1];
function makeCubicBezierEase([x1, y1, x2, y2]) {
    const bezierPoint = (t, a, b) => 3 * (1 - t) ** 2 * t * a + 3 * (1 - t) * t ** 2 * b + t ** 3;
    return (targetX) => {
        let lo = 0, hi = 1, t = targetX;
        for (let i = 0; i < 20; i++) {
            const x = bezierPoint(t, x1, x2);
            if (Math.abs(x - targetX) < 1e-4) break;
            if (x < targetX) lo = t; else hi = t;
            t = (lo + hi) / 2;
        }
        return bezierPoint(t, y1, y2);
    };
}
const easeOutProgress = makeCubicBezierEase(EASE_OUT_BEZIER);

// Permanent leading item above the oldest note (Planning/CONTEXT.md, 2026-08-22)
// — illustration plus a fixed four-line tagline, ported from the Android app's
// NoteFeedHeader. Sits inside the same `flex flex-col gap-12` list as the notes
// below so it shares their inter-item rhythm, and needs no separate horizontal
// padding — it inherits the feed container's own inset. Unlike Android, this
// doesn't fade on scroll: that fade exists there to smooth keyboard-avoidance
// auto-scrolls, which web's feed doesn't do (see Planning/CONTEXT.md).
const TAGLINE_LINES = ["HALF SENTENCE", "INCOMPLETE THOUGHT", "A THING TO NOT FORGET", "AN IDEA"];

// Stagger gaps in ms (emil-design-eng: 30-80ms between items). Illustration
// leads at 0, each line follows 40ms after the previous, the perpetual
// blank note picks up 60ms after the last line starts — enough to read as
// "following the cascade" rather than overlapping it.
const STAGGER_GAP_MS = 40;
const NOTE_STAGGER_DELAY_MS = STAGGER_GAP_MS * TAGLINE_LINES.length + 60;

// animateIn only ever arrives `true` on this element's actual first paint
// (see NotebookFeed's `playEmptyEntrance` — FeedHeader isn't rendered at
// all until that's decided), so @starting-style below fires as real
// insertion, not a class toggled onto an already-mounted node.
const FeedHeader = ({ animateIn }) => (
    <div className="flex flex-col">
        <DaveIllustration
            className={cn("w-40 sm:w-52 h-auto", animateIn && "feed-stagger-item")}
        />
        <p className="mt-4 text-2xl sm:text-3xl font-semibold leading-tight tracking-tight text-foreground">
            {TAGLINE_LINES.map((line, i) => (
                <span
                    key={line}
                    className={cn("block", animateIn && "feed-stagger-item")}
                    style={animateIn ? { transitionDelay: `${(i + 1) * STAGGER_GAP_MS}ms` } : undefined}
                >
                    {line}
                </span>
            ))}
        </p>
    </div>
);

export const NotebookFeed = ({
    notes,
    getSuggestions,
    onUpdateNote,
    onCreateNote,
    onDeleteNote,
    onFocusBox,
    onEditorFocus,
    onEditorBlur,
    activeMatchIds,
    matchWashClass,
    isTagNavActive,
    onNoteInteract
}) => {
    const feedRef = useRef(null);
    const bottomRef = useRef(null);
    const lastNoteRef = useRef(null);

    // Which non-last note (if any) is rendered as a live TiptapEditor instead
    // of a StaticNotePreview. Deliberately separate from the scroll-driven
    // activeNoteId (owned by a sibling component) — that changes continuously
    // while scrolling and would thrash editor mount/unmount if reused here.
    const [editingNoteId, setEditingNoteId] = useState(null);
    const pendingActivationRef = useRef(null); // { noteId, offset } | null
    const handleActivateNote = useCallback((noteId, offset) => {
        pendingActivationRef.current = { noteId, offset };
        setEditingNoteId(noteId);
        onNoteInteract?.(noteId);
    }, [onNoteInteract]);

    // Sort notes: Oldest -> Newest for "Notebook" feel
    const sortedNotes = React.useMemo(() => {
        return [...notes].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    }, [notes]);

    // Which note ids were already present before this render — anything NOT
    // in this set gets the `.note-enter` entrance treatment (see the
    // `.entry-block.note-enter` @starting-style rule in globals.css). Seeded
    // synchronously on the very first render so the initial batch (possibly
    // hundreds of notes) never animates in; only notes created during the
    // session (blur-created blank note, jump-to-latest, gutter click) do.
    // Updated in an effect (after paint), so during render it still reflects
    // the PREVIOUS commit — exactly the notes that should be excluded.
    const seenNoteIdsRef = useRef(null);
    if (seenNoteIdsRef.current === null) {
        seenNoteIdsRef.current = new Set(sortedNotes.map(n => n.id));
    }
    useEffect(() => {
        sortedNotes.forEach(n => seenNoteIdsRef.current.add(n.id));
    }, [sortedNotes]);

    // True-empty-state entrance gate: locks in, the first time real data is
    // present (notes starts as [] while useNotes' IndexedDB fetch is still
    // in flight — checking sortedNotes.length === 1 on THAT transient render
    // would misfire for every user), whether this session's genuine first
    // load was the true empty state (just the perpetual blank note). Once
    // decided it never flips back, but that's harmless: FeedHeader and the
    // blank note are never unmounted, so the @starting-style entrance below
    // only ever fires once, at their real first insertion.
    const emptyEntranceRef = useRef(undefined);
    if (emptyEntranceRef.current === undefined && sortedNotes.length >= 1) {
        emptyEntranceRef.current = sortedNotes.length === 1;
    }
    const playEmptyEntrance = emptyEntranceRef.current === true;

    // Copy / delete actions — desktop hover row (NoteActionsRow) and mobile
    // long-press sheet (NoteActionsSheet) both funnel through these.
    const handleCopy = useCallback(async (note) => {
        try {
            await navigator.clipboard.writeText(note.content);
            return true;
        } catch (error) {
            console.error('Copy failed:', error);
            return false;
        }
    }, []);

    const [pendingDeleteNote, setPendingDeleteNote] = useState(null);
    const requestDelete = useCallback((note) => setPendingDeleteNote(note), []);

    // `removeNote` filters the note out of `notes` synchronously (optimistic
    // update), which would normally unmount its row the instant we call
    // onDeleteNote — no chance for an exit transition. Keeping a snapshot
    // here lets `displayNotes` (below) re-insert it at its original position
    // for exactly as long as the shrink-and-fade takes.
    const [deletingNote, setDeletingNote] = useState(null);
    const handleDeleteExitEnd = useCallback((noteId, e) => {
        if (e.target !== e.currentTarget || e.propertyName !== 'transform') return;
        setDeletingNote(prev => (prev?.id === noteId ? null : prev));
    }, []);

    const confirmDelete = useCallback(async () => {
        const note = pendingDeleteNote;
        setPendingDeleteNote(null);
        if (!note) return;
        // Don't leave editingNoteId/TiptapEditor pointed at a note that's
        // about to be removed from `notes` — its row is unmounting, and
        // TiptapEditor's onBlur (which normally clears this) isn't
        // guaranteed to fire across an unmount.
        setEditingNoteId(prev => (prev === note.id ? null : prev));
        setDeletingNote(note);
        try {
            await onDeleteNote(note.id);
        } catch (error) {
            console.error('Error deleting note:', error);
            alert('Failed to delete note. Please try again.');
        }
    }, [pendingDeleteNote, onDeleteNote]);

    // Real data (sortedNotes) usually loses the deleted note before its exit
    // transition finishes — re-insert the snapshot at its original sorted
    // position for the duration of that transition. isLast/isLive checks
    // below key off `sortedNotes`, not this list, so a fading-out shadow can
    // never be mistaken for the perpetual last note.
    const displayNotes = React.useMemo(() => {
        if (!deletingNote || sortedNotes.some(n => n.id === deletingNote.id)) return sortedNotes;
        return [...sortedNotes, deletingNote].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    }, [sortedNotes, deletingNote]);

    const [actionsSheet, setActionsSheet] = useState({ isOpen: false, note: null });
    const closeActionsSheet = useCallback(() => {
        setActionsSheet(prev => ({ ...prev, isOpen: false }));
    }, []);
    const longPressHandlers = useLongPress(
        useCallback((el) => {
            const domId = el?.getAttribute('data-note-id');
            if (domId == null) return;
            // Intentional loose `==`: domId is always a DOM string, while
            // note.id may be a JS Number (Supabase notes) or a UUID string
            // (guest notes) — same convention as the IntersectionObserver
            // lookup below. Don't "fix" to `===`.
            const note = notes.find(n => n.id == domId);
            const last = sortedNotes[sortedNotes.length - 1];
            if (!note || note.id === last?.id) return; // no sheet for the perpetual blank note
            if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(10);
            setActionsSheet({ isOpen: true, note });
        }, [notes, sortedNotes])
    );

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
                    // Intentional loose `==`: noteId comes from a DOM data-note-id attribute
                    // (always a string), while note.id may be a JS Number for Supabase-
                    // authenticated notes (bigint) vs. a UUID string for guest notes. Do not
                    // "fix" to `===` without first normalizing ID types everywhere.
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

    // Initial-load scroll to the blank note, as a short visible glide (not a
    // proportional-to-length one) — see the constants/easing helper above.
    // useLayoutEffect (not useEffect) is required, not just tidier: it runs
    // before the browser paints, so the glide below is the first thing the
    // user sees at that position rather than a flash of the fully-scrolled
    // state followed by a jump back.
    const hasInitialScrolled = useRef(false);
    useLayoutEffect(() => {
        // length > 1, not > 0: with only the perpetual blank note present
        // (the true empty state), there's nothing above the fold to reveal —
        // scrolling there would imply hidden content that doesn't exist.
        if (hasInitialScrolled.current || sortedNotes.length <= 1) return;
        const container = feedRef.current;
        if (!container) return;

        const blocks = container.querySelectorAll('.entry-block');
        const lastBlock = blocks[blocks.length - 1];
        if (!lastBlock) return;
        hasInitialScrolled.current = true;

        // Land at the exact final position first (instant) — this correctly
        // honors .entry-block's scroll-margin-top: 25vh via the browser's
        // own scrollIntoView handling, instead of re-deriving that offset by
        // hand. An explicit `behavior` here overrides the container's own
        // `scroll-smooth` (scroll-behavior: smooth) class, which would
        // otherwise animate the FULL distance from wherever scrollTop
        // started — unbounded for a notebook with hundreds of notes.
        lastBlock.scrollIntoView({ behavior: 'instant', block: 'start' });
        const finalTop = container.scrollTop;

        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

        // Back off a small FIXED distance (never past the top) and animate
        // only that short return, so the visible glide never scales with
        // note count.
        const backOff = Math.min(INITIAL_SCROLL_GLIDE_DISTANCE_PX, finalTop);
        if (backOff <= 0) return;
        const startTop = finalTop - backOff;

        // The container's `scroll-smooth` class (scroll-behavior: smooth)
        // doesn't only affect scrollTo()/scrollIntoView() — Chromium applies
        // it to plain `scrollTop =` assignments too, unless `behavior` is
        // explicitly overridden. Left alone, the back-off jump below and
        // every rAF tick's scrollTop write each get intercepted into their
        // own competing native smooth-scroll, retargeting on top of each
        // other every ~16ms — that's what caused the visible stutter
        // (confirmed with a scrollTop trace: identical JS produced chaotic
        // direction-reversals without this line, a clean monotonic glide
        // with it). Restored once the glide finishes so `scroll-smooth`
        // still governs the deliberate smooth scrolls elsewhere in this
        // file (pendingScrollRef, handleJumpToLatest).
        container.style.scrollBehavior = 'auto';
        container.scrollTop = startTop;

        let rafId;
        const startTime = performance.now();
        const tick = (now) => {
            const progress = Math.min((now - startTime) / INITIAL_SCROLL_GLIDE_DURATION_MS, 1);
            container.scrollTop = startTop + backOff * easeOutProgress(progress);
            if (progress < 1) {
                rafId = requestAnimationFrame(tick);
            } else {
                container.style.scrollBehavior = '';
            }
        };
        rafId = requestAnimationFrame(tick);

        return () => {
            if (rafId) cancelAnimationFrame(rafId);
            container.style.scrollBehavior = '';
        };
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

    // Guards against double-creating the perpetual blank note when a blur
    // (see the last note's onSave below) and an explicit click (gutter/
    // spacer/jump pill, both routed through focusOrCreateLastNote) land in
    // the same tick — onCreateNote is async, so sortedNotes won't reflect
    // the new note until this ref-guarded window closes.
    const blankNoteInFlightRef = useRef(false);
    useEffect(() => {
        const lastNote = sortedNotes[sortedNotes.length - 1];
        if (blankNoteInFlightRef.current && lastNote && !lastNote.content.trim()) {
            blankNoteInFlightRef.current = false;
        }
    }, [sortedNotes]);

    // `scroll`: true for explicit user-driven creation (gutter/spacer/jump
    // pill click — the user wants to land on the new note); false for the
    // silent auto-create on blur below, where jumping the viewport would
    // fight whatever the user just clicked away to (e.g. a tag in TagsRail).
    const createBlankLastNote = useCallback((scroll) => {
        if (blankNoteInFlightRef.current) return;
        blankNoteInFlightRef.current = true;
        if (scroll) pendingScrollRef.current = true;
        onCreateNote('');
    }, [onCreateNote]);

    // Shared by the gutter click, the trailing spacer click, and the jump
    // pill: focus the existing blank note if one's waiting, otherwise create
    // a fresh one.
    const focusOrCreateLastNote = () => {
        const lastNote = sortedNotes[sortedNotes.length - 1];
        if (lastNote && !lastNote.content.trim()) {
            lastNoteRef.current?.focus();
        } else {
            createBlankLastNote(true);
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
            {/* Adjusted padding: px-4 for mobile, sm:px-8 for tablet/desktop.
                pt-[15vh] only in the true empty state (FeedHeader + the sole
                blank note, nothing else below) — pulls that whole stack up
                as a unit, since padding-top isn't per-item, so the gap
                between FeedHeader and the note is untouched. Every other
                state keeps pt-[25vh], which populated feeds and the
                date/tag-click scroll landing (`.entry-block`'s
                scroll-margin-top: 25vh) both depend on. */}
            <div
                className={cn(
                    "min-h-full w-full max-w-4xl mx-auto px-8 pb-12 sm:px-8 sm:pl-32 sm:pr-32 flex flex-col cursor-text",
                    sortedNotes.length === 1 ? "pt-[15vh]" : "pt-[25vh]"
                )}
                onClick={(e) => {
                    // Only trigger if clicking the container itself (gutters), not children
                    if (e.target === e.currentTarget) {
                        focusOrCreateLastNote();
                    }
                }}
            >
                <div className="flex flex-col gap-12">
                    {/* Held back until real data has loaded (not the
                        transient notes=[] pre-fetch render) — @starting-style
                        only fires at true DOM insertion, so FeedHeader can't
                        exist yet on a render where we don't know `animateIn`. */}
                    {sortedNotes.length >= 1 && <FeedHeader animateIn={playEmptyEntrance} />}
                    {displayNotes.map((note) => {
                        const isLast = sortedNotes.length > 0 && note.id === sortedNotes[sortedNotes.length - 1].id;
                        const isDeleting = deletingNote?.id === note.id;
                        const isLive = !isDeleting && (isLast || note.id === editingNoteId);
                        // The sole note in a genuine empty state: follows the
                        // FeedHeader cascade in on the same stagger clock,
                        // rather than seenNoteIdsRef's usual "already on
                        // screen, don't animate" treatment.
                        const isEmptyStateNote = playEmptyEntrance && isLast && sortedNotes.length === 1;
                        return (
                            <div
                                key={note.id}
                                id={note.id}
                                className={cn(
                                    "entry-block -mx-6 px-6 rounded-md",
                                    (!seenNoteIdsRef.current.has(note.id) || isEmptyStateNote) && "note-enter",
                                    activeMatchIds?.has(note.id) && matchWashClass
                                )}
                                style={isEmptyStateNote ? { transitionDelay: `${NOTE_STAGGER_DELAY_MS}ms` } : undefined}
                                data-note-id={note.id}
                                data-state={isDeleting ? 'closed' : undefined}
                                onTransitionEnd={isDeleting ? (e) => handleDeleteExitEnd(note.id, e) : undefined}
                                {...(isLast || isDeleting ? {} : longPressHandlers)}
                            >
                                {isLive ? (
                                    <TiptapEditor
                                        ref={isLast ? lastNoteRef : null}
                                        note={note}
                                        getSuggestions={getSuggestions}
                                        onAutoSave={(id, content) => {
                                            // Auto-save always UPDATES, never deletes.
                                            // This ensures typing is saved safely.
                                            onUpdateNote(note, content);
                                        }}
                                        onSave={(id, content) => {
                                            const isEmpty = !content || !content.trim();
                                            // Delete if empty, UNLESS it's the only note or the
                                            // perpetual last note — that one is auto-managed and
                                            // must never disappear just because it's blank (see
                                            // Planning/CONTEXT.md's "one perpetual blank note"
                                            // architectural principle).
                                            if (isEmpty && !isLast && sortedNotes.length > 1) {
                                                onDeleteNote(note.id);
                                            } else {
                                                onUpdateNote(note, content);
                                                // Leaving the last note with content in it
                                                // (blurring to click another note, a rail,
                                                // anywhere) should always leave a fresh blank one
                                                // ready at the bottom, not just on explicit
                                                // gutter/spacer clicks or a full page reload.
                                                if (isLast && !isEmpty) {
                                                    createBlankLastNote(false);
                                                }
                                            }
                                        }}
                                        onInput={(id, content) => {
                                            // Optional: live update state?
                                        }}
                                        onFocus={() => {
                                            if (onEditorFocus) onEditorFocus();
                                            onNoteInteract?.(note.id);
                                        }}
                                        onBlur={(e) => {
                                            if (onEditorBlur) onEditorBlur();
                                            // Downgrade back to static once focus leaves — the last
                                            // note always stays live regardless (isLive's `isLast ||`).
                                            setEditingNoteId(prev => (prev === note.id ? null : prev));
                                        }}
                                        // Disable auto-focus on mobile to keep Nav Pill visible
                                        autoFocus={note.isNew && (typeof window !== 'undefined' ? window.innerWidth >= 640 : true)}
                                        isLast={isLast}
                                        isOnlyNote={sortedNotes.length === 1}
                                        initialSelectionOffset={
                                            pendingActivationRef.current?.noteId === note.id
                                                ? pendingActivationRef.current.offset
                                                : undefined
                                        }
                                    />
                                ) : (
                                    <StaticNotePreview note={note} onActivate={handleActivateNote} />
                                )}
                                {!isLast && !isDeleting && (
                                    <NoteActionsRow
                                        isOpen={note.id === editingNoteId}
                                        onCopy={() => handleCopy(note)}
                                        onRequestDelete={() => requestDelete(note)}
                                    />
                                )}
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

            <NoteActionsSheet
                isOpen={actionsSheet.isOpen}
                note={actionsSheet.note}
                onClose={closeActionsSheet}
                onCopy={handleCopy}
                onRequestDelete={requestDelete}
            />

            <AlertDialog
                open={!!pendingDeleteNote}
                onOpenChange={(open) => { if (!open) setPendingDeleteNote(null); }}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete this note?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This action cannot be undone. This note will be permanently deleted.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setPendingDeleteNote(null)}>
                            Cancel
                        </AlertDialogCancel>
                        <AlertDialogAction
                            onClick={confirmDelete}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
};
