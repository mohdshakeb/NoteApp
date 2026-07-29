# Codebase Context — NoteApp

## Code Structure

```
src/
├── app/
│   ├── page.js              # Home page (client component)
│   ├── layout.js            # Root layout with metadata
│   ├── providers.js         # Provider composition (Theme + Auth)
│   └── globals.css          # Tailwind + CSS variables for theming
├── components/
│   ├── NoteApp.js           # Main app container, orchestrates all features
│   ├── NotebookFeed.jsx     # Scrollable feed — re-sorts ASCENDING for display (see Patterns below). Renders a live TiptapEditor for only the last note plus at most one other (`editingNoteId`); every other row renders StaticNotePreview.jsx (see Patterns: "Lazy-hydrated editors" below)
│   ├── StaticNotePreview.jsx # Read-only, non-ProseMirror render of a note's content (plain text + tag-highlight spans, using the same classes/decorations as the live editor). Click resolves a char offset via caretPositionFromPoint/caretRangeFromPoint and activates the row into a live TiptapEditor at that position.
│   ├── TiptapEditor.jsx     # Rich text editor with auto-save. Accepts `initialSelectionOffset` (captured once into a ref, consumed on mount) to land the cursor where a StaticNotePreview click resolved to, instead of always at the end.
│   ├── extensions/
│   │   ├── TagHighlight.js  # ProseMirror plugin: inline #tag highlighting — extraction via `lib/tags.js`
│   │   └── TagSuggestion.js # Tiptap Suggestion-utility extension: tag-autocomplete-while-typing, trigger char '#' — see Patterns below
│   ├── TagSuggestionList.jsx # Popup rendered by TagSuggestion.js via ReactRenderer — list state (keyboard nav/selection) + appearance only, positioning/lifecycle owned by the extension
│   ├── TimelineRail.jsx     # Left sidebar: date-based navigation
│   ├── TagsRail.jsx         # Right sidebar: tag cloud
│   ├── TagNavigator.jsx     # Floating nav for tag filtering (Prev/Next) — counter doubles as "view all" trigger for NoteResultsOverlay. Tag-mode only; renders nothing for a search session OR when the tag session has only 1 match (NoteApp.js passes `tag={null}` in that case — a session still exists for the wash/highlight, there's just nothing to step through so the pill itself is suppressed).
│   ├── JumpToLatestPill.jsx # Floating "scroll to newest note" affordance — appears only when NotebookFeed detects the user has scrolled away from the bottom AND no tag session is active (shares TagNavigator's fixed bottom-right slot; the two are mutually exclusive, never rendered at once). Click focuses the trailing blank note or creates one if the last note has content.
│   ├── NoteResultsOverlay.jsx # Results list for BOTH a tag-nav session and free-text search (mode-driven: 'tag' | 'search') — mobile sheet + desktop panel, row click jumps + closes overlay. Search mode replaces the static title with a debounced (~200ms) search `<input>`, gates scanning below 2 trimmed chars (prompt state), and shows an empty-state row on zero matches.
│   ├── MobileNavPill.jsx    # Bottom pill navigation (mobile only) — includes a Search icon (`onSearchClick`) alongside the date/tags triggers
│   ├── MobileDrawers.jsx    # Mobile drawers for timeline & tags
│   ├── MergeToast.jsx       # Guest data merge confirmation — ACTIVE, used by NoteApp.js
│   ├── LoginDropdown.jsx    # Login dropdown — Google OAuth + magic-link email (no GitHub)
│   ├── ThemeProvider.js     # Dark/light theme context
│   └── ui/                  # Shadcn/ui components (Button, Dropdown, AlertDialog, UserDropdown, etc.)
├── hooks/
│   ├── useNotes.js          # Core CRUD operations + DB initialization + empty-note management
│   ├── useTags.js           # Extract and aggregate tags from notes — extraction via `lib/tags.js`. `getSuggestions(partialTag)` (top-5 `startsWith` match over `allTags`) is threaded down to `TagSuggestion.js` via `NoteApp.js` → `NotebookFeed.jsx` → `TiptapEditor.jsx` for tag-autocomplete-while-typing
│   ├── useNoteFinder.js     # Renamed from useTagNavigation.js — generalized to a single `session` state (`{mode: 'tag'|'search'|null, query, matches, currentIndex}`) driving BOTH tag-click nav and free-text search. `handleTagClick` ALWAYS sets `mode: 'tag'`, even for a single match — it no longer special-cases match count (that used to also suppress the wash highlight as a side effect; match-count-based pill suppression now lives in `NoteApp.js` alone, see `TagNavigator.jsx` above). `handleSearchQuery` live-filters (no auto-scroll), treats an exact `#tag` query as equivalent to `handleTagClick` via the shared helper in `lib/tagMatch.js`, and doesn't scan below 2 trimmed chars. `openSearchOverlay` is a no-op on the session if search is already active (so re-triggering ⌘K doesn't blow away typed text). `isOverlayOpen`/`openOverlay`/`closeOverlay`/`jumpToMatch` as before — `closeOverlay` additionally clears the session when `mode === 'search'` (no persistent pill to leave it dangling on, unlike tag mode)
│   └── useMobileNav.js      # Mobile drawer state management
├── lib/
│   ├── db.js                # IndexedDB operations + Supabase sync — MOST CRITICAL FILE, see Patterns below
│   ├── supabase.js          # Supabase client initialization
│   ├── colors.js            # Deterministic hash → 8-color palette for tag highlighting
│   ├── snippet.js           # extractSnippet(content, query, radius) — single-line snippet centered on a query match, used by NoteResultsOverlay rows
│   ├── tags.js              # `findTagMatches`/`extractUniqueTags` — single canonical "#tag" extraction from raw note text, consumed by TagHighlight.js, useTags.js, TagsRail.jsx, and StaticNotePreview.jsx
│   ├── slidingWindow.js     # `getSlidingWindow(items, activeIndex)` — shared "25 items centered on active index" clamping math, consumed by TimelineRail.jsx and TagsRail.jsx
│   ├── constants.js         # `NOTE_PLACEHOLDER_TEXT` — single source for the empty-note placeholder string, shared by TiptapEditor.jsx and StaticNotePreview.jsx so they can't drift
│   ├── tagMatch.js          # `tagTokenRegex`/`noteHasTag` (the `#${tag}\b` test) + `exactTagFromQuery` — shared by useNoteFinder's handleTagClick AND search's exact-#tag detection. NOT the same problem as lib/tags.js's extraction above — this only tests whether a note contains an already-known tag name, it doesn't parse tag names out of raw text.
│   └── utils.js             # Utility functions (cn, date formatting)
└── contexts/
    └── AuthContext.js       # Authentication state (guest + Supabase)
```

## Naming Conventions

- **Files:** `.jsx` for components that render JSX with meaningful markup; `.js` for hooks, contexts, and lib modules (even ones that return JSX, e.g. `ThemeProvider.js`, `Auth.js` — inconsistent, follow whichever the neighboring file in that folder does)
- **Components:** PascalCase (`NoteApp`, `TiptapEditor`)
- **Hooks:** camelCase, `use` prefix (`useNotes`, `useNoteFinder`)
- **Variables:** camelCase
- **Constants:** UPPER_SNAKE_CASE for module-level constants (`DB_NAME`, `STORE_NAME` in `db.js`)
- **No TypeScript** — this is a plain JS/JSX codebase, no `.ts`/`.tsx` files, no PropTypes in use either

## Patterns to Follow

- **Local-first, optimistic UI** — mutate local state immediately, let Supabase calls happen in the background (`saveNote`, `updateNote` in `db.js`)
- **`getNotes()` returns DESCENDING (newest-first)**; `NotebookFeed.jsx` re-sorts ASCENDING for the visual "notebook" feed. These are two different orderings for two different purposes — don't assume one implies the other when touching either file.
- **Merge via `Map` keyed by note id** (`db.js:getNotes`, lines ~130-171): start from Supabase results, then overlay local IndexedDB notes — `pending` local always overwrites remote, `synced` local without a remote counterpart is preserved (assumed sync-lag, not a delete), `synced` local that matches remote is left alone.
- **Refs for fresh closures in Tiptap callbacks** — `TiptapEditor.jsx` stores `onSave`/`onAutoSave`/etc. in refs updated via `useEffect`, so the editor instance isn't re-created on every prop change while callbacks stay current.
- **1000ms debounced auto-save**, immediate save-on-blur — implemented via `editor.storage.saveTimer` in `TiptapEditor.jsx`'s `onUpdate`/`onBlur` handlers.
- **Guest sentinel value** — `userId: 'guest'` (string literal, not `null`/`undefined`) is checked explicitly throughout `db.js` to branch between IndexedDB-only and Supabase+IndexedDB code paths.
- **Floating overlay pattern (`usePresence` + `data-state` + CSS keyframes)** — `TagNavigator`, `MobileDrawers`, and `NoteResultsOverlay` all follow the same shape: `usePresence(isOpen)` keeps the component mounted through its exit animation, a `data-state="open"|"closed"` attribute drives one of the `.anim-pill`/`.anim-sheet`/`.anim-panel` CSS classes in `globals.css` (all sharing the `--duration-*`/`--ease-*` tokens and a `prefers-reduced-motion` override), and the last non-null content is snapshotted into local state so it doesn't blank out mid-exit-animation. Follow this template for any new floating/dismissible UI rather than inventing a new mechanism.
- **Persistent match wash** — while a `useNoteFinder` session is active (`session.mode` set), every matching note gets a wash background applied to its `.entry-block` (`NotebookFeed.jsx`, driven by `activeMatchIds`/`matchWashClass` props from `NoteApp.js`), not just the current index — this is what makes it legible while stepping with Prev/Next or scrolling manually. Tag mode (and an exact `#tag` search) uses `getTagMeta(tag).wash`; a plain-text search falls back to a neutral `bg-accent/15 dark:bg-accent/25` — same opacity convention as the tag palette's own washes (see `colors.js` note below), just on the neutral `accent` token instead of a tag color. Purely additive on top of `.entry-block`'s `scroll-margin-top: 25vh` — don't let future changes to the wash touch that rule.
- **Lazy-hydrated editors, not list virtualization (2026-07-28)** — at 1000+ notes, mounting a live `TiptapEditor` (full ProseMirror `EditorView` + `TagHighlight` decoration plugin) for every note unconditionally was the scale bottleneck. Fixed by keeping every note's outer `.entry-block` row permanently mounted (so all four scroll-to-note implementations below keep working untouched — they only care that the row's `id`/`.entry-block` class exists, never what renders inside it) while rendering the row's *inner* content as either a live `TiptapEditor` or a `StaticNotePreview` depending on whether that note is actually being edited. Live = the last note (always, per `lastNoteRef`/autoFocus/new-note-creation) plus at most one more: `editingNoteId`, set by `StaticNotePreview`'s `onActivate` when clicked. `editingNoteId` is deliberately NOT the same state as the scroll-driven `activeNoteId` (owned by a sibling component, `NoteApp.js`) — that changes continuously while scrolling and would thrash editor mount/unmount if reused here. On blur, a live non-last note downgrades back to `editingNoteId === null`. `StaticNotePreview` is wrapped in `React.memo` — safe because `useNotes.js`'s `editNote` keeps every *other* note's object reference stable across a save (`prev.map(n => n.id === originalNote.id ? result : n)`), so memoized static rows skip re-rendering (and skip re-running `findTagMatches`) on every autosave tick elsewhere in the list.
- **The scroll-target `id={note.id}` MUST live on the `.entry-block` div in `NotebookFeed.jsx`, not on any element inside `TiptapEditor.jsx` or `StaticNotePreview.jsx`** — every `document.getElementById(note.id).scrollIntoView(...)` call (`useNoteFinder.js`, `TimelineRail.jsx`, `useMobileNav.js`) only lands with the intended `25vh` top offset if the target element itself carries `scroll-margin-top` (2026-07-23 bug: the id used to sit on TiptapEditor's inner div, one level below `.entry-block`, so tag/timeline clicks landed the note flush against the viewport's top edge instead of offset — only the unrelated initial-load auto-scroll, which queries `.entry-block` directly, looked right). All four scroll call sites now consistently use `block: 'start'`.
- **`colors.js`'s `bg` vs `wash` fields are NOT interchangeable** — both use the same stock Tailwind shade (`-200`/`-900`) but `bg` is a vibrant, higher-opacity chip color (mobile Tags drawer chips) while `wash` is the same shade at much lower opacity (`/15` light, `/25` dark) for the notebook-feed match background, so it blends close to the page background instead of reading as a distinct pastel block. Adding a new palette entry means defining both.
- **`.entry-block` bleed pattern** — `-mx-6 px-6` (Tailwind classes, not in `globals.css`) on every entry-block, washed or not: the negative margin + equal padding cancel out for the *text*, which stays exactly where it was, while the wash background (when present) visibly bleeds 24px past the text on both sides instead of sitting flush against it. Keep the margin/padding pair equal-and-opposite if this value ever changes, or the text will shift.
- **Top-right cluster (`NoteApp.js`, `top-8 right-8`) holds Search + the theme toggle on every breakpoint** — aligned with the top-left logo, always rendered (not `hidden sm:*`). This is the single source for both triggers; `MobileNavPill`'s bottom pill does NOT have its own Search button anymore (removed — Tags trigger, divider, Login/Avatar only) and `UserDropdown.jsx` does NOT have a theme-toggle menu item anymore (removed — was mobile-only via `sm:hidden`, now redundant since the top-right toggle covers mobile too). Bottom-left (`bottom-8 left-8`, desktop-only `hidden sm:block`) holds just Login/account; on mobile that same role is the avatar/Login slot inside `MobileNavPill`'s bottom pill. Don't reintroduce a second Search or theme control on mobile — route both back through the top-right cluster.
- **"Jump to latest" affordance instead of a permanent add-note button** — `NotebookFeed.jsx` watches the trailing spacer div (`bottomRef`) with an `IntersectionObserver` against its own scroll container (`feedRef` as `root`) to derive `isNearBottom`; `JumpToLatestPill.jsx` renders only when `!isNearBottom && !isTagNavActive` (the `isTagNavActive` prop, `session.mode === 'tag'` from `NoteApp.js`, prevents it from colliding with `TagNavigator` in the same fixed slot). Clicking it reuses `focusOrCreateLastNote` — the same handler as the gutter/spacer clicks — and if that handler had to create a brand-new note (DOM node doesn't exist yet at click time), a `pendingScrollRef` flag defers the `scrollIntoView` to a `useEffect` keyed on `sortedNotes.length`, once the new note has actually rendered.
- **`TiptapEditor`'s exposed `focus()` must pass `{ scrollIntoView: false }` (pre-existing bug, fixed 2026-07-28)** — Tiptap's `editor.commands.focus()` defaults to its own `scrollIntoView: true`, which fires ProseMirror's built-in "nudge the cursor minimally into view" scroll a frame later (via `requestAnimationFrame`), *after* whichever explicit `element.scrollIntoView({block:'start'})` the caller just did — and since it runs later, it always wins, overriding the intended `25vh` scroll-margin alignment with a much shorter, arbitrary scroll distance. Only reproduces with enough notes to create real scroll distance (small note counts happen to land close enough that it's easy to miss). Affects every caller of the ref-exposed `focus()` (gutter/spacer click, jump-to-latest pill) since they all pair it with their own explicit scroll positioning — `TiptapEditor.jsx`'s internal `autoFocus` effect is unaffected (nothing else is scrolling at that moment to race against).
- **The perpetual blank note is (re-)created on blur, not just on reload/explicit click (2026-07-28)** — `useNotes.js`'s bootstrap only appends a blank note at fetch time; without more, typing into the last note and clicking away mid-session left no blank note until the next reload or an explicit gutter/spacer click. `NotebookFeed.jsx`'s last-note `onSave` (fires on ANY blur) now calls `createBlankLastNote(false)` whenever it saves non-empty content — same `onCreateNote('')` the gutter/spacer/jump-pill clicks use, just without forcing a scroll (an unsolicited scroll-jump here would fight whatever the user just clicked away to, e.g. a tag in `TagsRail`). A `blankNoteInFlightRef` guards both trigger paths against creating two blank notes when a blur and an explicit click land in the same tick (`onCreateNote` is async, so `sortedNotes` doesn't reflect the new note immediately). Companion fix in the same change: the last note is now exempt from the "delete empty note on blur" branch — previously tapping into the blank last note and tapping away without typing deleted it outright (silently violating the "one perpetual blank note" principle in `Planning/CONTEXT.md`); non-last empty notes still get deleted on blur as before.
- **Tag-autocomplete-while-typing (2026-07-28)** — `TagSuggestion.js` wraps `@tiptap/suggestion`'s `Suggestion()` utility with `char: '#'`, relying on its default `allowedPrefixes: [' ']` (match starts at a text node's start or right after whitespace) so it shares the same start-or-whitespace anchor as `lib/tags.js`'s extraction rule — no suggestions inside a glued `foo#bar`. Data source is `useTags.js`'s previously-unused `getSuggestions(partialTag)`, threaded as a prop (`NoteApp.js` → `NotebookFeed.jsx` → `TiptapEditor.jsx`) and read through a ref (same "stay fresh without re-initializing the editor" pattern as `onSave`/`onAutoSave`/etc., since `useEditor`'s extensions array is only evaluated once at mount). The popup (`TagSuggestionList.jsx`) is mounted via `ReactRenderer` + the Suggestion utility's built-in `mount()` (Floating UI under the hood, via the `@floating-ui/dom` peer dep) — no `tippy.js`, no manual `coordsAtPos` math. `getSuggestions` returns bare tag names (no `#`, stripped by `findTagMatches`) — `TagSuggestion.js`'s `command` handler has to re-prepend it on insert; the popup's own display does too. Escape dismissal calls the utility's exported `exitSuggestion(view, pluginKey)`; selecting a match relies on the trailing space naturally invalidating the next suggestion match rather than an explicit exit call.
- **Desktop search overlay anchors under the top-right search icon; tag overlay anchors above the bottom-right tag pill; mobile is a separate full-screen bottom sheet, untouched by any of this** — `NoteResultsOverlay.jsx`'s desktop panel branches on `session.mode`: search mode anchors `top-20 right-8 origin-top-right` (tight ~8px gap under the icon, matching `UserDropdown`'s own `sideOffset={8}` convention; `.anim-panel-top` sliding down) while tag mode keeps `bottom-24 right-8 origin-bottom-right` (above `TagNavigator`'s bottom-right pill, `.anim-panel` sliding up). **Any new overlay must anchor near its own trigger, not a fixed unrelated corner** — adding a third trigger location means adding a third anchor branch here, not reusing one of these two by default. The `sm:hidden` mobile branch (full-width bottom sheet, `.anim-sheet`) is intentionally identical for both modes and out of scope for per-trigger anchoring — don't extend the desktop branching logic to it.

## Patterns to Avoid

- **Don't add another tag-matching regex** — `useNoteFinder`'s `handleTagClick` and search's exact-`#tag` detection already share one via `lib/tagMatch.js`; route any new "does this note have tag X" check through that instead of writing a fourth variant. This is a separate concern from tag *extraction* (parsing tag names OUT of raw text), which is canonically handled by `lib/tags.js` — don't conflate the two, and don't add a fourth extraction regex either.
- **Don't assume `getNotes()`'s return order is display order** — it isn't; see Patterns above.

## Known Issues (found during 2026-07-20 audit)

- **Unused `tags` column on the Supabase `notes` table — resolved and dropped 2026-07-28:** confirmed dead (no write path ever populated it, and it contradicted this project's "tags are derived, never stored" principle — see `Planning/CONTEXT.md` Architectural Principles). Client-side read removed from `db.js:getNotes()`, and the column itself was dropped from the `notes` table (see `ops/runbooks/drop-unused-tags-column.md` for the exact steps and audit trail, including one pre-existing test row that had to be checked before dropping). Tags remain purely derived from `content` via `lib/tags.js`.
- **Tag-extraction regex split-brain — resolved 2026-07-27** via `lib/tags.js` (canonical rule = `TagHighlight.js`'s original regex: `#` + word chars/hyphens, anchored to start-of-text or preceding whitespace). Two accepted, intentional behavior deltas versus the old `useTags.js`/`TagsRail.jsx` regex — not regressions: (1) a `#tag` glued mid-word with no leading space (`foo#bar`) no longer appears in the tag cloud (it never highlighted inline either way); (2) hyphenated tags (`#to-do`) now appear in the tag cloud (they already highlighted inline and in the rail).
- **Rail sliding-window duplication — resolved 2026-07-28** via `lib/slidingWindow.js`'s `getSlidingWindow(items, activeIndex)`. `TimelineRail.jsx` and `TagsRail.jsx` now both call it instead of each maintaining their own copy of the "25 items centered on active index" clamping math; each still owns its own "what counts as active" lookup (date-key match vs. first-active-tag-in-sorted-list) before calling in.

## Testing Requirements

No test framework is currently configured. To add tests:

```bash
npm install --save-dev jest @testing-library/react @testing-library/jest-dom
```

Create `jest.config.js` and test files in `__tests__/` or colocated with components. Priority areas if/when tests are added:
- **Sync merge logic** (`db.js:getNotes`, `syncPendingNotes`) — highest risk of silent data loss
- **Tag extraction** (`lib/tags.js`'s `findTagMatches`/`extractUniqueTags`) — lock the canonical regex down with tests
- **Guest-to-user migration** (`migrateGuestData`)

## Key Libraries

- `idb` — thin Promise wrapper over IndexedDB, used for all local storage
- `@supabase/supabase-js` — Postgres + Auth client
- `@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/extension-placeholder` — rich text editor
- `@tiptap/suggestion` (+ peer dep `@floating-ui/dom`) — trigger-char/query matching and floating-popup positioning for `TagSuggestion.js`'s tag-autocomplete
- `prosemirror-state`, `prosemirror-view` — used directly (not just via Tiptap) for the custom `TagHighlight` decoration plugin
- Radix UI primitives (via shadcn-style `components/ui/`) — Dropdown, AlertDialog, ScrollArea

## Reference Documentation

- https://nextjs.org/docs — App Router, client component patterns
- https://supabase.com/docs/reference/javascript — Auth + Postgres client
- https://tiptap.dev/docs — editor extension API
- https://prosemirror.net/docs/ref/ — decoration/plugin API (used directly for `TagHighlight`)
- https://github.com/jakearchibald/idb — IndexedDB wrapper API

## Common Development Tasks

### Adding a New Note Field
1. Update `saveNote()` and `updateNote()` in `src/lib/db.js`
2. Add the column to the Supabase `notes` table (migration)
3. Update the merge logic in `getNotes()` if the field affects merge priority
4. Update the local `note` shape wherever it's constructed in `useNotes.js`

### Changing Tag Extraction Behavior
There's now a single canonical extraction module, `src/lib/tags.js` (`findTagMatches`/`extractUniqueTags`), consumed by all three call sites: `TagHighlight.js` (inline highlighting), `useTags.js` (tag cloud), and `TagsRail.jsx` (active-tags rail). Update the regex there and all three stay in sync automatically. `TagSuggestion.js`'s autocomplete trigger anchor is a separate mechanism (`@tiptap/suggestion`'s `allowedPrefixes` option, not this regex) but was deliberately chosen to match the same start-or-whitespace rule — keep them aligned if either changes.

### Adding OAuth Providers
1. Enable the provider in Supabase Dashboard → Authentication → Providers
2. Add a button in `LoginDropdown.jsx` calling `supabase.auth.signInWithOAuth({ provider: '<name>', options: { redirectTo: window.location.origin } })`
3. Configure redirect URLs in Supabase

### Modifying Auto-Save Behavior
Auto-save debounce lives in `TiptapEditor.jsx`'s `onUpdate` handler (`editor.storage.saveTimer`, 1000ms). Save-on-blur clears the pending timer and saves immediately.

### Debugging Sync Issues
- `syncPendingNotes()` in `db.js` (runs on `window.online`, wired in `useNotes.js`)
- `getNotes()` merge logic in `db.js` (~lines 130-171)
- Browser DevTools → Application → IndexedDB → `notes-app` → `notes`

## Skills

Skills relevant when working on code in this workspace.

- **`testing-skill`** — Invoke when writing or updating tests
- **`emil-design-eng`** — Invoke for any component with interaction, animation, or motion
- **`impeccable`** — Invoke for any visual design work (typography, color, spacing, layout)
- **`interface-design`** — Run `/interface-design:init` at project start; `/interface-design:audit` before shipping UI
- **`ui-skills`** — Final Web Interface Guidelines compliance check before UI is considered done
