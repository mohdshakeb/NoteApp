import { useEffect, useRef, useState } from 'react';
import { Copy, Check, Trash2 } from 'lucide-react';
import { Button } from './ui/button';
import { usePresence } from '../hooks/usePresence';

// Sits directly below a note while it's the one being actively edited
// (isOpen = note.id === editingNoteId in NotebookFeed). Desktop/pointer-
// capable only — mobile gets the equivalent actions via a long-press bottom
// sheet instead (see NoteActionsSheet), gated with `hidden sm:flex` below.
// Rendered for every non-last note (not just the active one) so usePresence
// can keep the PREVIOUSLY-active note's row mounted through its own exit
// transition while the newly-active note's row enters — each instance only
// cares about its own isOpen prop.
export function NoteActionsRow({ isOpen, onCopy, onRequestDelete }) {
    const { shouldRender, handleTransitionEnd } = usePresence(isOpen);
    const [justCopied, setJustCopied] = useState(false);
    const resetTimerRef = useRef(null);

    useEffect(() => () => clearTimeout(resetTimerRef.current), []);

    if (!shouldRender) return null;

    const handleCopy = async (e) => {
        e.stopPropagation();
        const ok = await onCopy();
        if (ok) {
            setJustCopied(true);
            clearTimeout(resetTimerRef.current);
            resetTimerRef.current = setTimeout(() => setJustCopied(false), 1200);
        }
    };

    const handleDelete = (e) => {
        e.stopPropagation();
        onRequestDelete();
    };

    // A plain <button> steals focus on mousedown by default, which blurs the
    // still-focused Tiptap editor BEFORE the click event fires. That blur is
    // wired to clear editingNoteId (NotebookFeed.jsx), which unmounts this
    // row mid-click — so onClick never runs. Preempt the focus shift so the
    // editor never blurs in the first place.
    const preventFocusSteal = (e) => e.preventDefault();

    return (
        // Grid row that animates 0fr -> 1fr (see .anim-reveal in globals.css)
        // so revealing the row grows its actual height instead of fading in
        // at full height and shoving the next note down in one frame. The
        // inner `overflow-hidden` wrapper is required for the 0fr state to
        // actually clip the content instead of being clamped by its
        // min-content size.
        <div
            data-state={isOpen ? 'open' : 'closed'}
            onTransitionEnd={handleTransitionEnd}
            className="anim-reveal hidden sm:grid w-full max-w-3xl mx-auto"
        >
            <div className="overflow-hidden">
                <div className="flex justify-end gap-1 pt-1 pb-2">
                    <Button
                        variant="ghost"
                        size="icon"
                        onMouseDown={preventFocusSteal}
                        onClick={handleCopy}
                        title="Copy note"
                        className="h-8 w-8 rounded-full text-muted-foreground can-hover:hover:bg-muted can-hover:hover:text-foreground"
                    >
                        <span className="icon-pop inline-flex">
                            {justCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                        </span>
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        onMouseDown={preventFocusSteal}
                        onClick={handleDelete}
                        title="Delete note"
                        className="h-8 w-8 rounded-full text-muted-foreground can-hover:hover:bg-destructive/10 can-hover:hover:text-destructive"
                    >
                        <Trash2 className="h-4 w-4" />
                    </Button>
                </div>
            </div>
        </div>
    );
}
