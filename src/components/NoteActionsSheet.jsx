import { useEffect, useRef, useState } from 'react';
import { Copy, Check, Trash2 } from 'lucide-react';
import { usePresence } from '../hooks/usePresence';

// Mobile equivalent of NoteActionsRow, opened by a long-press on a note
// (see useLongPress + NotebookFeed). Mirrors MobileDrawers.jsx's structural
// pattern (usePresence + data-state + .anim-sheet/.anim-backdrop) — the
// documented template for new floating/dismissible UI (src/CONTEXT.md).
export function NoteActionsSheet({ isOpen, note, onClose, onCopy, onRequestDelete }) {
    const { shouldRender, handleTransitionEnd } = usePresence(isOpen);
    const [justCopied, setJustCopied] = useState(false);

    // Snapshot the target note so the sheet's content doesn't blank out
    // while it's still sliding away after `note` is cleared by the caller.
    const [displayNote, setDisplayNote] = useState(note);
    useEffect(() => {
        if (isOpen) setDisplayNote(note);
    }, [isOpen, note]);

    // Delete needs to happen AFTER the sheet has fully closed, not
    // underneath it — the confirm AlertDialog is z-50, this sheet is z-[60].
    const pendingDeleteRef = useRef(false);
    const handleSheetTransitionEnd = (e) => {
        handleTransitionEnd(e);
        if (!isOpen && pendingDeleteRef.current) {
            pendingDeleteRef.current = false;
            onRequestDelete(displayNote);
        }
    };

    if (!shouldRender) return null;

    const state = isOpen ? 'open' : 'closed';

    const handleCopy = async () => {
        const ok = await onCopy(displayNote);
        if (ok) {
            setJustCopied(true);
            setTimeout(() => setJustCopied(false), 1200);
            setTimeout(onClose, 400);
        }
    };

    const handleDelete = () => {
        pendingDeleteRef.current = true;
        onClose();
    };

    return (
        <div className="fixed inset-0 z-[60] sm:hidden">
            <div
                data-state={state}
                className="anim-backdrop absolute inset-0 bg-background/80 backdrop-blur-sm"
                onClick={onClose}
            />

            <div
                data-state={state}
                onTransitionEnd={handleSheetTransitionEnd}
                className="anim-sheet absolute bottom-0 left-0 right-0 bg-background border-t rounded-t-3xl shadow-2xl flex flex-col pb-[env(safe-area-inset-bottom)]"
            >
                <div className="mx-auto mt-3 h-1 w-10 rounded-full bg-muted" />

                <div className="p-2 flex flex-col gap-1">
                    <button
                        onClick={handleCopy}
                        className="flex items-center gap-3 p-4 text-left rounded-lg text-sm font-mono active:bg-muted transition-colors"
                    >
                        <span className="icon-pop inline-flex">
                            {justCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                        </span>
                        {justCopied ? 'Copied' : 'Copy note'}
                    </button>
                    <button
                        onClick={handleDelete}
                        className="flex items-center gap-3 p-4 text-left rounded-lg text-sm font-mono text-destructive active:bg-destructive/10 transition-colors"
                    >
                        <Trash2 className="h-4 w-4" />
                        Delete note
                    </button>
                </div>
            </div>
        </div>
    );
}
