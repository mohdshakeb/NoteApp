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
│   ├── NotebookFeed.jsx     # Scrollable feed of TiptapEditor instances — re-sorts ASCENDING for display (see Patterns below)
│   ├── TiptapEditor.jsx     # Rich text editor with auto-save
│   ├── extensions/
│   │   └── TagHighlight.js  # ProseMirror plugin: inline #tag highlighting — extraction via `lib/tags.js`
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
│   ├── useTags.js           # Extract and aggregate tags from notes — extraction via `lib/tags.js`
│   ├── useNoteFinder.js     # Renamed from useTagNavigation.js — generalized to a single `session` state (`{mode: 'tag'|'search'|null, query, matches, currentIndex}`) driving BOTH tag-click nav and free-text search. `handleTagClick` ALWAYS sets `mode: 'tag'`, even for a single match — it no longer special-cases match count (that used to also suppress the wash highlight as a side effect; match-count-based pill suppression now lives in `NoteApp.js` alone, see `TagNavigator.jsx` above). `handleSearchQuery` live-filters (no auto-scroll), treats an exact `#tag` query as equivalent to `handleTagClick` via the shared helper in `lib/tagMatch.js`, and doesn't scan below 2 trimmed chars. `openSearchOverlay` is a no-op on the session if search is already active (so re-triggering ⌘K doesn't blow away typed text). `isOverlayOpen`/`openOverlay`/`closeOverlay`/`jumpToMatch` as before — `closeOverlay` additionally clears the session when `mode === 'search'` (no persistent pill to leave it dangling on, unlike tag mode)
│   └── useMobileNav.js      # Mobile drawer state management
├── lib/
│   ├── db.js                # IndexedDB operations + Supabase sync — MOST CRITICAL FILE, see Patterns below
│   ├── supabase.js          # Supabase client initialization
│   ├── colors.js            # Deterministic hash → 8-color palette for tag highlighting
│   ├── snippet.js           # extractSnippet(content, query, radius) — single-line snippet centered on a query match, used by NoteResultsOverlay rows
│   ├── tags.js              # `findTagMatches`/`extractUniqueTags` — single canonical "#tag" extraction from raw note text, consumed by TagHighlight.js, useTags.js, and TagsRail.jsx
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
- **The scroll-target `id={note.id}` MUST live on the `.entry-block` div in `NotebookFeed.jsx`, not on any element inside `TiptapEditor.jsx`** — every `document.getElementById(note.id).scrollIntoView(...)` call (`useNoteFinder.js`, `TimelineRail.jsx`, `useMobileNav.js`) only lands with the intended `25vh` top offset if the target element itself carries `scroll-margin-top` (2026-07-23 bug: the id used to sit on TiptapEditor's inner div, one level below `.entry-block`, so tag/timeline clicks landed the note flush against the viewport's top edge instead of offset — only the unrelated initial-load auto-scroll, which queries `.entry-block` directly, looked right). All four scroll call sites now consistently use `block: 'start'`.
- **`colors.js`'s `bg` vs `wash` fields are NOT interchangeable** — both use the same stock Tailwind shade (`-200`/`-900`) but `bg` is a vibrant, higher-opacity chip color (mobile Tags drawer chips) while `wash` is the same shade at much lower opacity (`/15` light, `/25` dark) for the notebook-feed match background, so it blends close to the page background instead of reading as a distinct pastel block. Adding a new palette entry means defining both.
- **`.entry-block` bleed pattern** — `-mx-6 px-6` (Tailwind classes, not in `globals.css`) on every entry-block, washed or not: the negative margin + equal padding cancel out for the *text*, which stays exactly where it was, while the wash background (when present) visibly bleeds 24px past the text on both sides instead of sitting flush against it. Keep the margin/padding pair equal-and-opposite if this value ever changes, or the text will shift.
- **Top-right cluster (`NoteApp.js`, `top-8 right-8`) holds Search + the theme toggle on every breakpoint** — aligned with the top-left logo, always rendered (not `hidden sm:*`). This is the single source for both triggers; `MobileNavPill`'s bottom pill does NOT have its own Search button anymore (removed — Tags trigger, divider, Login/Avatar only) and `UserDropdown.jsx` does NOT have a theme-toggle menu item anymore (removed — was mobile-only via `sm:hidden`, now redundant since the top-right toggle covers mobile too). Bottom-left (`bottom-8 left-8`, desktop-only `hidden sm:block`) holds just Login/account; on mobile that same role is the avatar/Login slot inside `MobileNavPill`'s bottom pill. Don't reintroduce a second Search or theme control on mobile — route both back through the top-right cluster.
- **"Jump to latest" affordance instead of a permanent add-note button** — `NotebookFeed.jsx` watches the trailing spacer div (`bottomRef`) with an `IntersectionObserver` against its own scroll container (`feedRef` as `root`) to derive `isNearBottom`; `JumpToLatestPill.jsx` renders only when `!isNearBottom && !isTagNavActive` (the `isTagNavActive` prop, `session.mode === 'tag'` from `NoteApp.js`, prevents it from colliding with `TagNavigator` in the same fixed slot). Clicking it reuses `focusOrCreateLastNote` — the same handler as the gutter/spacer clicks — and if that handler had to create a brand-new note (DOM node doesn't exist yet at click time), a `pendingScrollRef` flag defers the `scrollIntoView` to a `useEffect` keyed on `sortedNotes.length`, once the new note has actually rendered.
- **Desktop search overlay anchors under the top-right search icon; tag overlay anchors above the bottom-right tag pill; mobile is a separate full-screen bottom sheet, untouched by any of this** — `NoteResultsOverlay.jsx`'s desktop panel branches on `session.mode`: search mode anchors `top-20 right-8 origin-top-right` (tight ~8px gap under the icon, matching `UserDropdown`'s own `sideOffset={8}` convention; `.anim-panel-top` sliding down) while tag mode keeps `bottom-24 right-8 origin-bottom-right` (above `TagNavigator`'s bottom-right pill, `.anim-panel` sliding up). **Any new overlay must anchor near its own trigger, not a fixed unrelated corner** — adding a third trigger location means adding a third anchor branch here, not reusing one of these two by default. The `sm:hidden` mobile branch (full-width bottom sheet, `.anim-sheet`) is intentionally identical for both modes and out of scope for per-trigger anchoring — don't extend the desktop branching logic to it.

## Patterns to Avoid

- **Don't add another tag-matching regex** — `useNoteFinder`'s `handleTagClick` and search's exact-`#tag` detection already share one via `lib/tagMatch.js`; route any new "does this note have tag X" check through that instead of writing a fourth variant. This is a separate concern from tag *extraction* (parsing tag names OUT of raw text), which is canonically handled by `lib/tags.js` — don't conflate the two, and don't add a fourth extraction regex either.
- **Don't assume `getNotes()`'s return order is display order** — it isn't; see Patterns above.

## Known Issues (found during 2026-07-20 audit)

- **Unused `tags` column on the Supabase `notes` table (found 2026-07-27, while scoping NoteAppAndroid):** Confirmed via a live PostgREST schema probe that a `tags` column exists on `notes` (`db.js:getNotes()` reads `note.tags || []` off the Supabase row) — but no code path (`saveNote`, `updateNote`, `syncPendingNotes`, `createDefaultNotes`) ever writes to it. This directly contradicts this project's own documented principle that "tags are derived, never stored" (see `Planning/CONTEXT.md` Architectural Principles). In practice the column is presumably always null/empty and the read is a no-op, but it's dead schema surface that could confuse future work (e.g. someone "fixing" tag storage by writing to a column that was never meant to be the source of truth). Needs a decision: drop the column, or document why it exists if there's a reason not visible in the client code. Not resolved here — flagging only.
- **Tag-extraction regex split-brain — resolved 2026-07-27** via `lib/tags.js` (canonical rule = `TagHighlight.js`'s original regex: `#` + word chars/hyphens, anchored to start-of-text or preceding whitespace). Two accepted, intentional behavior deltas versus the old `useTags.js`/`TagsRail.jsx` regex — not regressions: (1) a `#tag` glued mid-word with no leading space (`foo#bar`) no longer appears in the tag cloud (it never highlighted inline either way); (2) hyphenated tags (`#to-do`) now appear in the tag cloud (they already highlighted inline and in the rail).

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
There's now a single canonical extraction module, `src/lib/tags.js` (`findTagMatches`/`extractUniqueTags`), consumed by all three call sites: `TagHighlight.js` (inline highlighting), `useTags.js` (tag cloud), and `TagsRail.jsx` (active-tags rail). Update the regex there and all three stay in sync automatically.

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
