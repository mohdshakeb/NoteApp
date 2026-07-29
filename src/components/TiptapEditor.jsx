import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { TagHighlight } from './extensions/TagHighlight';
import { TagSuggestion } from './extensions/TagSuggestion';
import Placeholder from '@tiptap/extension-placeholder'; // [NEW]
import { useEffect, useImperativeHandle, forwardRef, useRef } from 'react';
import { Button } from './ui/button';
import { NOTE_PLACEHOLDER_TEXT } from '../lib/constants';

export const TiptapEditor = forwardRef(({
    note,
    getSuggestions,
    onSave,
    onAutoSave, // [NEW]
    onInput,
    onFocus,
    onBlur,
    autoFocus = false,
    isLast = false,
    initialSelectionOffset
}, ref) => {
    // Use refs to keep handlers fresh without re-initializing editor
    const onSaveRef = useRef(onSave);
    const onAutoSaveRef = useRef(onAutoSave); // [NEW]
    const onInputRef = useRef(onInput);
    const onFocusRef = useRef(onFocus);
    const onBlurRef = useRef(onBlur);
    // Same "stay fresh without re-initializing the editor" pattern — the
    // TagSuggestion extension's items() closes over this ref, not the prop
    // directly, since extensions are captured once at mount (see useEditor below).
    const getSuggestionsRef = useRef(getSuggestions);
    // Captured once, not resynced like the handler refs above — this must
    // fire exactly once per mount (click-to-edit activation), not on every render.
    const initialSelectionOffsetRef = useRef(initialSelectionOffset);

    useEffect(() => {
        onSaveRef.current = onSave;
        onAutoSaveRef.current = onAutoSave;
        onInputRef.current = onInput;
        onFocusRef.current = onFocus;
        onBlurRef.current = onBlur;
        getSuggestionsRef.current = getSuggestions;
    }, [onSave, onAutoSave, onInput, onFocus, onBlur, getSuggestions]);

    const editor = useEditor({
        immediatelyRender: false,
        extensions: [
            StarterKit,
            TagHighlight,
            TagSuggestion.configure({
                getSuggestions: (query) => getSuggestionsRef.current?.(query) ?? [],
            }),
            Placeholder.configure({
                placeholder: NOTE_PLACEHOLDER_TEXT,
                emptyEditorClass: 'is-editor-empty',
                emptyNodeClass: 'is-empty',
                showOnlyCurrent: false,
            }),
        ],
        content: note.content,
        editorProps: {
            attributes: {
                class: 'prose prose-sm w-full max-w-none focus:outline-none min-h-[1.5em] text-sm font-mono text-foreground whitespace-pre-wrap leading-relaxed',
            },
        },
        onUpdate: ({ editor }) => {
            const text = editor.getText();
            if (onInputRef.current) {
                onInputRef.current(note.id, text);
            }

            // Debounced Auto-Save (1000ms)
            // Clear existing timer
            if (editor.storage.saveTimer) {
                clearTimeout(editor.storage.saveTimer);
            }

            // Set new timer
            editor.storage.saveTimer = setTimeout(() => {
                if (onAutoSaveRef.current) {
                    onAutoSaveRef.current(note.id, text);
                }
            }, 1000);
        },
        onBlur: ({ editor, event }) => {
            const text = editor.getText();

            // Clear pending auto-save if we are blurring (save immediately)
            if (editor.storage.saveTimer) {
                clearTimeout(editor.storage.saveTimer);
                editor.storage.saveTimer = null;
            }

            if (onSaveRef.current) {
                onSaveRef.current(note.id, text);
            }
            if (onBlurRef.current) onBlurRef.current(event);
        },
        onFocus: () => {
            if (onFocusRef.current) onFocusRef.current(note);
        },
        // We handle content sync manually via useEffect to avoid cursor jumps
        // if the parent sends back the same content.
    });

    // Expose focus method to parent
    useImperativeHandle(ref, () => ({
        // scrollIntoView: false — Tiptap's own focus-driven scroll (which only
        // nudges the cursor minimally into view) otherwise fires a frame after
        // this and overrides whatever explicit scrollIntoView the caller just
        // did (e.g. NotebookFeed's "jump to latest" pill, which aligns the
        // note to the 25vh scroll-margin target) — always losing that race.
        focus: () => {
            editor?.commands.focus('end', { scrollIntoView: false });
        }
    }));

    // Auto-focus logic
    useEffect(() => {
        if (autoFocus && editor) {
            // Small delay to ensure editor is ready
            requestAnimationFrame(() => {
                editor?.commands.focus('end');
            });
        }
    }, [autoFocus, editor]);

    // Click-to-edit activation from a StaticNotePreview: focus at the
    // character offset the user actually clicked, instead of always landing
    // at the end. Mutually exclusive with autoFocus by construction —
    // autoFocus only applies to the bootstrap `note.isNew` note, this only
    // applies to activating an existing note.
    useEffect(() => {
        if (editor && initialSelectionOffsetRef.current != null) {
            const offset = initialSelectionOffsetRef.current;
            initialSelectionOffsetRef.current = null;
            requestAnimationFrame(() => {
                const size = editor.state.doc.content.size;
                const pos = Math.min(Math.max(1, 1 + offset), Math.max(1, size - 1));
                editor.chain().focus().setTextSelection(pos).run();
            });
        }
    }, [editor]);

    // Handle Delete button logic (replicated from EntryBlock)
    const clearContent = () => {
        if (editor) {
            editor.commands.clearContent();
            editor.commands.blur(); // Trigger save -> delete
        }
    };

    if (!editor) {
        return null;
    }

    return (
        <div
            className="group relative w-full max-w-3xl mx-auto py-4 cursor-text"
            onClick={() => {
                if (!editor?.isFocused) {
                    editor?.commands.focus();
                }
            }}
        >
            <EditorContent editor={editor} />
        </div>
    );
});

TiptapEditor.displayName = 'TiptapEditor';
