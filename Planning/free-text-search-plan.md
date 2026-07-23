# Free-Text Search (Phase B)

## Context

[Phase A](tag-results-overlay-plan.md) adds a "view all" results overlay to the tag-nav pill plus a persistent match wash — solving "too many notes for one tag to step through" and "which note did I land on." This phase generalizes that same overlay into a second entry point: typed free-text search, opened via a search icon or `Cmd/Ctrl+K` instead of a tag click.

This was the original motivation from the brainstorm that led to Phase A: search will hit the exact same "50 results, can't step through one at a time" problem tag-nav already has, so it should reuse the same results-list UI rather than getting its own. **This plan assumes Phase A has already shipped** — it builds directly on `NoteResultsOverlay.jsx`, the extended `useTagNavigation` hook, and the match-wash mechanism from that plan, rather than re-describing them.

## Approach

### 1. Generalize the nav hook: `useTagNavigation.js` → `useNoteFinder.js`

This is the point where the "mode/query" generalization that Phase A deliberately deferred actually belongs — search is now a real, concrete second consumer, so the rework is no longer speculative.

New state shape:
```js
{ mode: 'tag' | 'search' | null, query: '', matches: [...], currentIndex: 0, isOverlayOpen: false }
```

- `handleTagClick(tag)` — same regex/sort/scroll logic as today, sets `mode:'tag'`, `query:tag`.
- `handleSearchQuery(text)` — new. Sets `mode:'search'`, `query:text`. Matching:
  - If the trimmed query matches `/^#[\w-]+$/` (i.e. the user typed an exact tag), route through the **same** tag-matching helper `handleTagClick` uses internally — so `#work` typed in search behaves identically to clicking the `#work` tag, including getting that tag's color wash instead of the generic search wash. Factor the `` `#${tag}\b` `` regex out into one small exported helper (e.g. in `src/lib/tagMatch.js`) so both call sites share it — per `src/CONTEXT.md`'s existing warning not to add another tag-regex variant.
  - Otherwise, plain case-insensitive substring match against `note.content`. No regex needed for this path.
  - Unlike `handleTagClick`, does **not** auto-scroll on every call — search live-filters as you type, and jumping only happens when the user picks a result (or presses Enter on the top one).
- `TagNavigator` (the floating pill) continues to render only when `mode === 'tag'` — search has no pill equivalent; the overlay itself is the only surface, opened directly.

### 2. Extend `NoteResultsOverlay.jsx`

- New props: `mode` (`'tag'|'search'`), `onQueryChange`.
- **Search mode header**: replaces the static `#tag — n notes` title with a text `<input>` (autofocus on open), styled consistent with the panel/sheet chrome already built in Phase A.
- **Debounce**: owned by the input itself (~200ms before calling `onQueryChange` → `handleSearchQuery`), keeping the hook synchronous — matches Phase A's principle of a narrow, presentation-focused prop surface.
- **Minimum query length**: below 2 trimmed characters, don't scan — show a quiet "Type to search…" prompt state instead of flashing every note as a match on the first keystroke.
- **Zero matches**: show a "No notes match '…'" row rather than an empty panel or auto-closing.
- **Snippet extraction**: reuses `extractSnippet` from Phase A as-is — for search mode, `query` is the raw search text instead of a bare tag name.

### 3. Search entry points

- **Desktop icon**: add a `Search` icon button (`lucide-react`, consistent with existing icon usage) as a sibling to `UserDropdown` inside the existing bottom-left stack (`NoteApp.js:177`, the `flex-col items-center gap-6` container) — sits with the account controls rather than opening a new fixed corner, per the earlier "actions are scattered" discussion. `onClick` opens the overlay directly in `mode:'search'` with an empty query.
- **`Cmd/Ctrl+K`**: global `keydown` listener owned by `NoteApp.js` (it already owns the other cross-cutting effects, e.g. the guest-data-check). Checks `e.metaKey || e.ctrlKey` + `key.toLowerCase() === 'k'`, `preventDefault()`, opens the search overlay. Verified safe against the current Tiptap extension list (`StarterKit + TagHighlight + Placeholder` — none bind Cmd+K today); if a link extension is ever added later, re-check this, since Cmd+K is a common "insert link" binding in rich text editors.
- **Mobile**: add a `Search` icon button into `MobileNavPill`'s existing right-side icon row (between the tag-circles button and the divider), new `onSearchClick` prop threaded from `NoteApp.js`. This bypasses `useMobileNav`'s `mobileDrawer` (`'date'|'tags'`) state entirely — search isn't drawer content, it opens the same `NoteResultsOverlay` component mobile already gets for tag "view all," so conflating it with `MobileDrawers`' state would misuse that hook.

### 4. Match wash for search mode

In `NoteApp.js`, extend the `matchWashClass` derivation from Phase A:
```js
const matchWashClass =
  session.mode === 'tag' ? getTagMeta(session.query).bg :
  session.mode === 'search' && isExactTagQuery(session.query) ? getTagMeta(bareTag).bg :
  session.mode === 'search' ? 'bg-accent/40 dark:bg-accent/20' :
  '';
```
The neutral fallback (`bg-accent/40 dark:bg-accent/20`) is a placeholder — run it through `colorize`/`impeccable` at build time so it reads as clearly "generic match," not clashing with any of the 8 tag palette colors it might sit next to in the feed.

### 5. Update CONTEXT.md

Same as Phase A — document the generalized hook, the new entry points, and the shared tag-match helper in `src/CONTEXT.md` before considering this done.

## Critical Files

- `src/hooks/useTagNavigation.js` → rename/expand to `src/hooks/useNoteFinder.js`
- `src/lib/tagMatch.js` — new, shared tag-token regex helper (used by both `handleTagClick` and search's `#tag` detection)
- `src/components/NoteResultsOverlay.jsx` — add search-input header, live-filter, debounce, prompt/empty states
- `src/components/NoteApp.js` — search icon button, `Cmd/Ctrl+K` listener, `openSearchOverlay`, wash fallback logic
- `src/components/MobileNavPill.jsx` — new search icon button, `onSearchClick` prop
- `src/CONTEXT.md`

## Design Skills

`emil-design-eng` (input focus/typing feel, live-filter transitions), `impeccable` (search-mode wash color, input styling inside the existing panel/sheet chrome), `interface-design` audit, `ui-skills` final pass — per this project's CLAUDE.md.

## Decisions made without re-asking (flag if any should change)

- Typing an exact `#tag` in search is treated as equivalent to clicking that tag (same matching, same color wash) — not just a substring match against the literal `#tag` text.
- Minimum 2-character query length before scanning; ~200ms debounce owned by the search input.
- Zero matches shows an empty-state row rather than closing the overlay.
- No pill equivalent for search — `TagNavigator` stays tag-click-only; search only ever surfaces through the overlay.
- Search-mode wash color is a neutral placeholder, expected to be tuned visually at build time rather than finalized now.

## Verification

1. With Phase A already in place, click the new desktop search icon (next to the avatar) — overlay opens with an empty, focused search input.
2. Press `Cmd/Ctrl+K` from anywhere, including while a note is focused in the editor — confirm it opens search and doesn't insert a literal "k" or conflict with editor input.
3. Type a query under 2 characters — confirm no scan runs, prompt state shows.
4. Type a 2+ character query with no matches — confirm the empty state shows, not a blank panel.
5. Type a query that matches several notes — confirm live-filtered results appear (debounced, not on every keystroke), each with a snippet centered on the match and a correct date.
6. Type an exact `#tagname` that exists — confirm results match exactly what clicking that tag in `TagsRail` would produce, and the match wash uses that tag's color, not the generic fallback.
7. Click a result — confirm it jumps to the note, closes the overlay, and applies the correct wash (tag color or neutral) to all matches while the session stays open.
8. On mobile, confirm the new search icon in `MobileNavPill` opens the same overlay as the desktop icon (full sheet layout), and that it doesn't interfere with the existing date/tags drawer icons.
9. Check light and dark mode for the search input styling and the neutral wash color.
