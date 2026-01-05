import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { TagHighlight } from './extensions/TagHighlight';
import Placeholder from '@tiptap/extension-placeholder'; // [NEW]
import { useEffect, useImperativeHandle, forwardRef, useRef } from 'react';
import { Button } from './ui/button';

export const TiptapEditor = forwardRef(({
    note,
    onSave,
    onAutoSave, // [NEW]
    onInput,
    onFocus,
    onBlur,
    autoFocus = false,
    isLast = false
}, ref) => {
    // Use refs to keep handlers fresh without re-initializing editor
    const onSaveRef = useRef(onSave);
    const onAutoSaveRef = useRef(onAutoSave); // [NEW]
    const onInputRef = useRef(onInput);
    const onFocusRef = useRef(onFocus);
    const onBlurRef = useRef(onBlur);

    useEffect(() => {
        onSaveRef.current = onSave;
        onAutoSaveRef.current = onAutoSave;
        onInputRef.current = onInput;
        onFocusRef.current = onFocus;
        onBlurRef.current = onBlur;
    }, [onSave, onAutoSave, onInput, onFocus, onBlur]);

    const editor = useEditor({
        immediatelyRender: false,
        extensions: [
            StarterKit,
            TagHighlight,
            Placeholder.configure({
                placeholder: 'Start writing... Use #tags to organize.',
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
        focus: () => {
            editor?.commands.focus('end');
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
            id={note.id}
            className="group relative w-full max-w-3xl mx-auto py-4 cursor-text"
            onClick={() => {
                if (!editor?.isFocused) {
                    editor?.commands.focus();
                }
            }}
        >
            <EditorContent editor={editor} />

            {/* Hover Controls */}
            <div className="absolute -right-12 top-4 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={clearContent}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                    </svg>
                </Button>
            </div>
        </div>
    );
});

TiptapEditor.displayName = 'TiptapEditor';
