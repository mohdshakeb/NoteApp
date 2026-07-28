# NotebookFeed scale fix: lazy-hydrate editors instead of virtualizing the list

_Drafted 2026-07-28, during a broader cleanup/scale-scoping pass ahead of NoteAppAndroid. Not yet executed._

## Context

`NotebookFeed.jsx` mounts a live `<TiptapEditor>` (a full ProseMirror `EditorView`, with its own plugin state and a `TagHighlight` decoration plugin that recomputes on every doc change) for *every* note, unconditionally, via `sortedNotes.map(...)`. At the scale this app is being scoped for (1000+ notes, ahead of the NoteAppAndroid build), that means 1000 concurrent live editor instances sitting in the DOM at once — clicking a tag or date in the rails doesn't reduce this; `useNoteFinder`'s `handleTagClick` only scrolls to and color-washes the match, every other note stays fully mounted underneath.

The explicit, non-negotiable constraint on this fix: the existing "click a tag in TagsRail, or a date in TimelineRail, and the feed scrolls to the matching note" interaction must keep working exactly as it does today. A full codebase trace (see below) found this interaction is actually **four independent, fragile implementations**, all built on the assumption that every note has a permanently-mounted DOM row with a stable `id`/`.entry-block` class. A conventional list-virtualization library (react-virtuoso, react-window) unmounts off-screen rows entirely, which would require rewriting all four of these paths and is high-risk given how much of this is undocumented, timing-sensitive behavior. The approach below avoids that risk entirely by never removing any row from the DOM — it only changes what renders *inside* a row.

## What the trace found (why this approach, not virtualization)

Four independent "scroll to note by id" implementations exist, none shared:
1. `useNoteFinder.js`'s `scrollToNote` (`document.getElementById` + `scrollIntoView` + `setActiveNoteId`) — used by desktop `TagsRail` clicks, the search overlay, and mobile tag selection.
2. `TimelineRail.jsx`'s inline `handleDateClick` (~line 93-96) — its own `document.getElementById`+`scrollIntoView`, bypassing `useNoteFinder` entirely, and it **never** calls `setActiveNoteId` directly (it settles later via the scroll-tracking observer, see below).
3. `useMobileNav.js`'s `handleMobileDateSelect` (~line 34-36) — a third independent implementation, which *does* call `setActiveNoteId` directly (unlike #2).
4. `NotebookFeed.jsx`'s `handleJumpToLatest` (~line 157) — a fourth ad hoc one for the "jump to latest" pill.

Separately, `NotebookFeed.jsx`'s `IntersectionObserver` (lines 36-90) watches every `.entry-block`, picks whichever note's center is nearest a 25%-viewport target line, and calls `onFocusBox` → `setActiveNoteId` continuously while scrolling — a second, independent writer of `activeNoteId` with no coordination against the click-driven paths above (this is pre-existing behavior, not something to "fix").

Also load-bearing and DOM-existence-dependent: `hasInitialScrolled` (queries `.entry-block` synchronously on mount), `lastNoteRef`'s imperative `.focus()` (only ever attached to the last row), the `pendingScrollRef` effect that scrolls to a newly-created note once its row exists, and the `.entry-block { scroll-margin-top: 25vh }` CSS every scroll relies on for correct landing position.

None of this cares what renders *inside* a row — only that the row (`id`, `.entry-block` class, position) exists. That's the opening this plan uses.

## Approach: lazy hydration, not DOM virtualization

Keep every note's outer row permanently mounted, exactly as today — zero changes to any of the four scroll paths, the `IntersectionObserver`, `hasInitialScrolled`, or the creation-scroll effect. Render each row's *inner* content as either a live `<TiptapEditor>` or a cheap static read-only preview, based on whether that note is actually being edited. This targets the real cost driver (live ProseMirror instances) rather than raw DOM node count, and by construction can't regress any of the scroll mechanics above since they never inspect a row's contents.

**Which notes are live:** the last note (always — required by `lastNoteRef`/`autoFocus`/new-note-creation) plus at most one more: whichever note the user has explicitly clicked/focused into (`editingNoteId`). This is deliberately *not* tied to the scroll-driven `activeNoteId` (which changes continuously while scrolling and would thrash editor mount/unmount if reused here) — confirmed safe because `NotebookFeed` doesn't even receive `activeNoteId` as a prop today; the observer writes it into a sibling's (`NoteApp.js`) state, so this new local state is already architecturally isolated from scroll churn.

### New file: `src/components/StaticNotePreview.jsx`

Read-only, non-ProseMirror render of a note, used for every row that's neither the last note nor `editingNoteId`.

- Outer wrapper: identical classes to `TiptapEditor`'s (`"group relative w-full max-w-3xl mx-auto py-4 cursor-text"`), with an `onClick` handler on the same element so the clickable hit-area matches exactly.
- Inner container: `TiptapEditor`'s editable-area classes with `"ProseMirror"` prepended — deliberately reusing the two existing CSS rules in `globals.css` (`.ProseMirror { outline: none; caret-color: ... }`, inert on a non-editable div; and the placeholder rule below), not writing new CSS.
- Empty note (`note.content.length === 0` — matches ProseMirror's own emptiness check, not `.trim()`, so whitespace-only content behaves identically to today): render `<p className="is-editor-empty is-empty" data-placeholder="Start writing... Use #tags to organize." />`. The existing CSS selector `.ProseMirror p.is-editor-empty:first-child::before` picks this up for free — reproduces the fact that *every* empty note (not just focused/last) shows the placeholder today, via `Placeholder.configure({ showOnlyCurrent: false })`.
- Non-empty note: walk `findTagMatches(note.content)` (imported unmodified from `src/lib/tags.js`) and render interleaved plain-text runs and `<span className={`rounded px-0.5 -mx-0.5 ${getTagColor(tag)}`}>` runs (`getTagColor` from `src/lib/colors.js`) — the exact class string `TagHighlight.js` uses for its ProseMirror decorations, so static tag styling is pixel-identical to live. Render as plain React children (never `dangerouslySetInnerHTML` — note content is untrusted user text).
- Click-to-edit: resolve a character offset from the click point via `document.caretPositionFromPoint`/`caretRangeFromPoint` (fallback: end-of-content, matching the existing "focus at end" idiom used elsewhere), call `onActivate(note.id, offset)`.
- Wrap in `React.memo`. `useNotes.js`'s `editNote` (`prev.map(n => n.id === originalNote.id ? result : n)`) keeps every *other* note's object reference stable across a save — confirmed by reading the hook — so memoized static rows correctly skip re-rendering (and skip re-running `findTagMatches`) on every autosave tick elsewhere in a 1000-note list.

### New file: `src/lib/constants.js`

```js
export const NOTE_PLACEHOLDER_TEXT = 'Start writing... Use #tags to organize.';
```
Single source, imported by both `TiptapEditor.jsx` (replacing its inline literal) and `StaticNotePreview.jsx`, so they can't drift.

### `src/components/TiptapEditor.jsx` — additive only

1. Use `NOTE_PLACEHOLDER_TEXT` in the existing `Placeholder.configure(...)`.
2. New prop `initialSelectionOffset`, captured once into a ref (not resynced every render like the other handler refs, since it must fire exactly once per mount):
   ```js
   const initialSelectionOffsetRef = useRef(initialSelectionOffset);
   ```
3. New effect, mirroring the existing `autoFocus` RAF-focus effect:
   ```js
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
   ```
   Mutually exclusive with `autoFocus` by construction (`autoFocus` only applies to the bootstrap `note.isNew` note; `initialSelectionOffset` only applies to click-to-edit activation of an existing note) — no ordering conflict.

Everything else (`useImperativeHandle`'s `focus()`, the native `onClick`, `onBlur`/`onSave` wiring, the "content read once at mount" behavior) is untouched.

### `src/components/NotebookFeed.jsx` — the core change

1. Import `StaticNotePreview`.
2. New state, alongside the existing refs:
   ```js
   const [editingNoteId, setEditingNoteId] = useState(null);
   const pendingActivationRef = useRef(null); // { noteId, offset } | null
   const handleActivateNote = useCallback((noteId, offset) => {
     pendingActivationRef.current = { noteId, offset };
     setEditingNoteId(noteId);
   }, []);
   ```
   `handleActivateNote` must be this single stable callback (not an inline closure per row) for `React.memo(StaticNotePreview)` to actually bail out.
3. In the `.map`: `const isLive = isLast || note.id === editingNoteId;` (plain `===` is safe — `editingNoteId` is always assigned directly from a `note.id` value, never round-tripped through a DOM string attribute like the `IntersectionObserver`'s `==` case).
4. Branch the row body:
   - `isLive`: existing `<TiptapEditor>` JSX unchanged, plus `initialSelectionOffset={pendingActivationRef.current?.noteId === note.id ? pendingActivationRef.current.offset : undefined}`, and inside the existing `onBlur` callback (after the existing `onEditorBlur?.()` call), add `setEditingNoteId(prev => (prev === note.id ? null : prev));` — safe to call unconditionally even for the last note, since `isLast ||` in the `isLive` check means it stays live regardless.
   - `!isLive`: `<StaticNotePreview note={note} onActivate={handleActivateNote} />`.
5. Nothing else in this file changes — the `IntersectionObserver`, `hasInitialScrolled`, the near-bottom pill observer, `pendingScrollRef`'s creation-scroll effect, `focusOrCreateLastNote`, `handleJumpToLatest`, and the wrapper `<div id={note.id} className="entry-block ...">` stay byte-for-byte identical.

### Explicitly not touched
`useNoteFinder.js`, `TimelineRail.jsx`, `useMobileNav.js`, `TagsRail.jsx`, `useTags.js`, `tagMatch.js`, `NoteApp.js`, `globals.css` — all four scroll implementations and the tag/rail logic operate on `document.getElementById`/`.entry-block` or the in-memory `notes` array, both unaffected by what's rendered inside a row.

### Known pre-existing quirks this plan deliberately preserves (not new, not to be "fixed")
- `useNotes.js`'s `addNote` never sets `isNew: true` — so today, creating a genuinely new note (not reusing an existing blank one) scrolls to it but does not auto-focus it. This stays exactly as-is.
- `TimelineRail`'s date click still won't update `activeNoteId` synchronously (only the `IntersectionObserver` settles it afterward) — this asymmetry with tag clicks is existing behavior, not something this change should alter.

### UI work note
`StaticNotePreview` is new UI — apply this project's mandatory UI guardrails (`emil-design-eng`, `impeccable`, `interface-design`, `ui-skills`) while building it, per CLAUDE.md, even though visually it's designed to be indistinguishable from the existing live editor.

## Verification

**The four scroll call sites — must be byte-identical in behavior:**
1. Desktop `TagsRail` tag click → `useNoteFinder.scrollToNote` — lands correctly whether the target note was static or live; `activeNoteId` updates synchronously as before.
2. Search overlay → `jumpToMatch` → same `scrollToNote`.
3. Mobile tag selection → `handleMobileTagSelect` → same `handleTagClick`.
4. `TimelineRail`'s inline date click — confirm `activeNoteId` still does *not* update synchronously (only via the observer, as today).
5. `useMobileNav.handleMobileDateSelect` — confirm it still updates `activeNoteId` directly.
6. `handleJumpToLatest`, both branches (reuse blank last note vs. create new).

**Existing invariants:**
7. Cold load lands instantly on the last note (`hasInitialScrolled`).
8. Creating a new note smooth-scrolls to it (`pendingScrollRef` effect).
9. `lastNoteRef.current?.focus()` still works from gutter click, trailing-spacer click, and the jump pill.
10. Bootstrap `note.isNew` note still auto-focuses.
11. The "new note doesn't auto-focus" gap and the "TimelineRail doesn't sync `activeNoteId` synchronously" quirk are unchanged — confirm neither was accidentally fixed nor newly broken.

**New behavior:**
12. Click into a static note at different x-positions on one line, and on different lines of a multi-line note — cursor lands where clicked, not always at the end.
13. Edit a non-last note, then click elsewhere (gutter/another note/a rail item) — it downgrades to static, visually identical to its pre-edit appearance including the new content.
14. Last note stays live regardless of `editingNoteId` changes elsewhere.
15. An empty non-last note (seed one manually) shows the placeholder identically to a live empty note.
16. Static tag-highlight colors/positions match the live editor's decorations for several tags (different palette hashes).
17. Mobile tap-to-edit on a static note opens the keyboard / hides the nav pill correctly — test on an actual touch device or emulator (blur/focus ordering on tap can lag on mobile Safari).
18. Tag-nav match wash (`activeMatchIds`) still renders correctly on both static and live rows during an active tag session.
19. Seed 1000+ notes (existing `ops/runbooks/seed-scale-test-notes.md` tooling), confirm via React DevTools Profiler that only 1-2 `TiptapEditor` instances are ever mounted, and that typing in one note doesn't cause visible stutter or re-renders in other rows.

### Critical files
- `src/components/NotebookFeed.jsx` — core change
- `src/components/TiptapEditor.jsx` — additive `initialSelectionOffset` support
- `src/components/StaticNotePreview.jsx` — new
- `src/lib/constants.js` — new
- `src/lib/tags.js`, `src/lib/colors.js` — reused unmodified (`findTagMatches`, `getTagColor`)
- `src/app/globals.css` — reference only, not modified (`.ProseMirror`, `.entry-block`, placeholder rules being reused)
