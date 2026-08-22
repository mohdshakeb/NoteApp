import { useEditor, EditorContent } from '@tiptap/react';
import { mergeAttributes } from '@tiptap/core';
import { Plugin } from '@tiptap/pm/state';
import { canJoin } from '@tiptap/pm/transform';
import StarterKit from '@tiptap/starter-kit';
import { ListItem, BulletList } from '@tiptap/extension-list';
import { TagHighlight } from './extensions/TagHighlight';
import { LinkHighlight } from './extensions/LinkHighlight';
import { TagSuggestion } from './extensions/TagSuggestion';
import Placeholder from '@tiptap/extension-placeholder'; // [NEW]
import { useEffect, useImperativeHandle, forwardRef, useRef, useState, useMemo } from 'react';
import { Button } from './ui/button';
import { NOTE_PLACEHOLDER_TEXT, NOTE_PLACEHOLDER_TEXT_ONLY_NOTE } from '../lib/constants';
import { contentToDoc, docToText } from '../lib/noteContent';
import { findLinkMatches } from '../lib/links';
import { LinkCard } from './LinkCard';

// ListItem's default keyboard shortcuts bind Tab/Shift-Tab to
// sinkListItem/liftListItem, which create real nested bulletList nodes.
// note.content's "- "-prefixed-line convention is flat only (matches
// NoteAppAndroid's parser, which has no concept of nesting) — so nesting
// must never be reachable from the keyboard. No indent/outdent in v1.
//
// renderHTML is overridden on both this and FlatBulletList below so the
// live editor's list markup uses the exact same marker+content structure
// and class names (.note-list/.note-list-item/.note-list-marker/
// .note-list-content, see globals.css) as StaticNotePreview.jsx's
// React-rendered list lines — one shared bullet-drawing mechanism instead
// of two independently-approximated ones, so focused and resting states
// can never visually drift apart.
const FlatListItem = ListItem.extend({
    addKeyboardShortcuts() {
        return {
            Enter: () => this.editor.commands.splitListItem(this.name),
        };
    },
    renderHTML({ HTMLAttributes }) {
        return [
            'li',
            mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, { class: 'note-list-item' }),
            ['span', { class: 'note-list-marker', 'aria-hidden': 'true' }, '•'],
            ['span', { class: 'note-list-content' }, 0],
        ];
    },
});

const FlatBulletList = BulletList.extend({
    renderHTML({ HTMLAttributes }) {
        return ['ul', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, { class: 'note-list' }), 0];
    },
    // Tiptap's wrappingInputRule (what actually fires on typing "- ") only
    // ever checks backward-joining — if you convert an existing line into a
    // list item that happens to sit right before an already-existing list
    // (rather than typing fresh lines where Enter continues the same list),
    // it wraps that line in a brand-new bulletList instead of joining it
    // forward into the adjacent one. Two separate <ul>s end up sitting next
    // to each other, which is invisible in note.content (docToText walks
    // top-level nodes regardless of how many bulletList nodes they're split
    // across) but visually wrong — they'd get the paragraph-sized block gap
    // between them instead of the tight list-item gap. This plugin cleans
    // that up generally: after any change, join any two adjacent top-level
    // bulletList nodes back into one.
    addProseMirrorPlugins() {
        const typeName = this.name;
        return [
            new Plugin({
                appendTransaction: (transactions, oldState, newState) => {
                    if (!transactions.some((tr) => tr.docChanged)) return null;

                    const positions = [];
                    newState.doc.forEach((node, offset) => {
                        if (node.type.name === typeName) positions.push(offset);
                    });

                    let tr = null;
                    // Reverse order: joining a later pair never invalidates
                    // the position of an earlier one.
                    for (let i = positions.length - 1; i > 0; i -= 1) {
                        const doc = tr ? tr.doc : newState.doc;
                        const prevPos = positions[i - 1];
                        const prevNode = doc.nodeAt(prevPos);
                        if (!prevNode) continue;
                        const joinPos = prevPos + prevNode.nodeSize;
                        if (joinPos === positions[i] && canJoin(doc, joinPos)) {
                            tr = (tr || newState.tr).join(joinPos);
                        }
                    }
                    return tr;
                },
            }),
        ];
    },
});

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
    isOnlyNote = false,
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
    // Same reasoning — Placeholder.configure's `placeholder` below is a
    // function so it can read this live rather than freeze whatever
    // `isOnlyNote` was at editor-init time.
    const isOnlyNoteRef = useRef(isOnlyNote);
    // Captured once, not resynced like the handler refs above — this must
    // fire exactly once per mount (click-to-edit activation), not on every render.
    const initialSelectionOffsetRef = useRef(initialSelectionOffset);
    // Drives the link-card list below the editor. The `note` prop only
    // reflects saved content (parent re-renders lag onUpdate/onAutoSave), so
    // this is tracked independently from the live doc rather than derived
    // from `note.content` — otherwise a note that's always-live (the feed's
    // perpetual last note, which never downgrades to StaticNotePreview)
    // would never show cards at all.
    const [liveText, setLiveText] = useState(note.content);
    const linkMatches = useMemo(() => findLinkMatches(liveText), [liveText]);

    useEffect(() => {
        onSaveRef.current = onSave;
        onAutoSaveRef.current = onAutoSave;
        onInputRef.current = onInput;
        onFocusRef.current = onFocus;
        onBlurRef.current = onBlur;
        getSuggestionsRef.current = getSuggestions;
        isOnlyNoteRef.current = isOnlyNote;
    }, [onSave, onAutoSave, onInput, onFocus, onBlur, getSuggestions, isOnlyNote]);

    const editor = useEditor({
        immediatelyRender: false,
        extensions: [
            StarterKit.configure({
                listItem: false, // replaced by FlatListItem below
                bulletList: false, // replaced by FlatBulletList below
                heading: false,
                blockquote: false,
                codeBlock: false,
                horizontalRule: false,
                bold: false,
                italic: false,
                strike: false,
                code: false,
                underline: false, // v3 StarterKit bundles this now
                link: false, // real Link mark would fight with LinkHighlight's
                             // decoration-only, non-clickable-while-focused link handling
                orderedList: false, // no numbered lists — Android has no renderer
                hardBreak: false, // no representation in the paragraph/list model
                trailingNode: false, // would otherwise append a phantom blank
                                      // paragraph every time a note ends in a list
                gapcursor: false,
                dropcursor: false,
            }),
            FlatListItem,
            FlatBulletList,
            TagHighlight,
            LinkHighlight,
            TagSuggestion.configure({
                getSuggestions: (query) => getSuggestionsRef.current?.(query) ?? [],
            }),
            Placeholder.configure({
                // Function, not a fixed string — extensions are captured
                // once at useEditor init, so this reads isOnlyNoteRef live
                // instead of freezing whatever it was at mount.
                placeholder: () => (isOnlyNoteRef.current ? NOTE_PLACEHOLDER_TEXT_ONLY_NOTE : NOTE_PLACEHOLDER_TEXT),
                emptyEditorClass: 'is-editor-empty',
                emptyNodeClass: 'is-empty',
                showOnlyCurrent: false,
            }),
        ],
        content: contentToDoc(note.content),
        editorProps: {
            attributes: {
                class: 'prose prose-sm w-full max-w-none focus:outline-none min-h-[1.5em] text-sm font-sans text-foreground whitespace-pre-wrap leading-relaxed',
            },
            handlePaste: (view, event) => {
                const text = event.clipboardData?.getData('text/plain');
                if (text == null) return false; // let default handling run for non-text paste

                event.preventDefault();
                const { content: nodes } = contentToDoc(text);
                editor.commands.insertContent(nodes);
                return true;
            },
        },
        onUpdate: ({ editor }) => {
            const text = docToText(editor.getJSON());
            setLiveText(text);
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
            const text = docToText(editor.getJSON());

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

    // Auto-focus logic. scrollIntoView: false for the same reason the
    // imperative focus() above uses it — ProseMirror's own default
    // focus-driven scroll otherwise fires a frame later and overrides
    // NotebookFeed's own initial-load scroll glide (which this note, as the
    // bootstrap `isNew` note, is a candidate for on first launch).
    useEffect(() => {
        if (autoFocus && editor) {
            // Small delay to ensure editor is ready
            requestAnimationFrame(() => {
                editor?.commands.focus('end', { scrollIntoView: false });
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
            {/* Live counterpart to StaticNotePreview's card list — needed
                because the feed's perpetual last note (see NotebookFeed's
                `isLive = isLast || ...`) never downgrades to
                StaticNotePreview, so a static-only card would never show
                for it. Derived from `liveText`, not `note.content`, so it
                stays in sync with the doc as you type, not just on save. */}
            {linkMatches.length > 0 && (
                <div className="mt-3 flex flex-col gap-1.5">
                    {linkMatches.map((m, i) => (
                        <LinkCard key={`${m.start}-${i}`} url={m.url} />
                    ))}
                </div>
            )}
        </div>
    );
});

TiptapEditor.displayName = 'TiptapEditor';
