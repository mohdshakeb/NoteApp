# Tag-Nav Results Overlay + Match Highlighting (Phase A)

## Context

Clicking a tag in the right rail today opens a floating pill (`TagNavigator`) that steps through matching notes one at a time via Prev/Next. That breaks down once a tag has many matches (e.g. 50 notes) — stepping one-by-one isn't a way to *scan* results, and while stepping through, there's no visual cue for which note in the continuous notebook feed you've actually landed on.

This plan adds a "view all" escape hatch to the existing pill (a results list you can scan and jump from) and a persistent, tag-colored background wash on every matching note while a tag-nav session is active, so both problems — "too many to step through" and "which one am I looking at" — are solved together, without touching the notebook's core continuous-scroll metaphor (no notes are hidden/filtered).

This is **Phase A of two**. Free-text search (a second entry point into the same kind of results view, plus a search icon + Cmd/Ctrl+K) is deliberately out of scope here — it's a larger, more product-decision-heavy follow-up (query debouncing, minimum query length, zero-match states) that should build on top of this overlay once it's shipped and validated, not land in the same pass. Nothing in this plan should require rework when that follow-up happens: the overlay component takes a plain `matches` list + a row-click callback, so search will plug into the same UI later rather than replacing it.

## Current State (verified in code)

- `src/hooks/useTagNavigation.js` — `useTagNavigation(notes, setActiveNoteId)` owns `tagNav = {tag, matches: [noteId...], currentIndex}`. `handleTagClick(tag)` regex-matches `` `#${tag}\b` `` against `note.content`, sorts by `createdAt`, stores state (only if >1 match; a single match just scrolls without opening the pill), and jumps via `document.getElementById(matches[0]).scrollIntoView({block:'start'})`.
- Each note's DOM node has `id={note.id}` set on the Tiptap root (`src/components/TiptapEditor.jsx:122`), wrapped in `<div className="entry-block" data-note-id={note.id}>` in `src/components/NotebookFeed.jsx:121`.
- `.entry-block { scroll-margin-top: 25vh; }` (`src/app/globals.css:107-110`) already makes `block:'start'` land a note in a comfortable spot ~25% down the viewport — **this is already correctly tuned and must not change.**
- `src/components/TagNavigator.jsx` — the pill UI, driven by props (`tag`, `currentIndex`, `totalMatches`, `onNext`, `onPrev`, `onClose`), colored via `getTagMeta(tag)` from `src/lib/colors.js`, uses `usePresence` (`src/hooks/usePresence.js`) for exit-animation timing.
- `src/lib/colors.js` — `getTagMeta(tagName)` deterministically hashes a tag to one of 8 palette entries `{bg, text, tick}` (e.g. `bg: "bg-yellow-200/50 dark:bg-yellow-900/40"`), already dark-mode aware. Already reused by `TagsRail`, `TagNavigator`, the editor's tag highlight, and `MobileDrawers`.
- **Reusable overlay pattern already exists**: `src/components/MobileDrawers.jsx` is a working backdrop+sheet overlay — `usePresence` + `data-state="open"|"closed"` + `.anim-backdrop`/`.anim-sheet` CSS classes (`src/app/globals.css:112-161`, using `--duration-drawer`/`--duration-base`/`--ease-*` vars, respects `prefers-reduced-motion`). This is the template for the new overlay's mobile layout. There's no desktop equivalent yet (`TagsRail`/`TimelineRail` are permanent rails, not overlays) — this plan introduces one small new CSS pair for that.
- `note.content` is **plain text**, not HTML — confirmed via `TiptapEditor.jsx`, which calls `editor.getText()` before every save. Snippet extraction needs no HTML-stripping, only whitespace/newline collapsing.
- Wired together in `src/components/NoteApp.js:78-84` (hook) and `:221-228` (`TagNavigator` render).

## Approach

### 1. Extend `useTagNavigation.js` (no rename, additive only)

Keep the existing shape and behavior exactly as-is (`tagNav`, `handleTagClick`, `handleNavNext`, `handleNavPrev`, `handleNavClose`) — no speculative generalization to a "mode/query" shape for search, since search isn't being built yet and that rework belongs to the Phase B plan once its actual requirements are known. Add:

- `isOverlayOpen` (boolean, part of `tagNav` state or a sibling `useState`).
- `openOverlay()` / `closeOverlay()`.
- `jumpToMatch(index)` — same scroll/`setActiveNoteId` logic as `handleNavNext`/`handleNavPrev`, but jumps straight to an arbitrary index (from an overlay row click) instead of stepping ±1, and does **not** clear/reset the session — Prev/Next should continue coherently from wherever the user jumped via the overlay.

### 2. `TagNavigator.jsx` — add the "view all" trigger

Make the `n / total` counter a button (or add a small icon, e.g. `List` from `lucide-react`, next to it) that calls a new `onOpenOverlay` prop. No other change to the pill's existing Prev/Next/Close behavior or layout.

### 3. New component: `src/components/NoteResultsOverlay.jsx`

Props: `isOpen`, `tag`, `matches` (note ids, ordered), `notes`, `currentIndex`, `onSelect(index)`, `onClose`.

- Uses `usePresence(isOpen)` exactly like `MobileDrawers`/`TagNavigator`, including snapshotting the last non-null `tag`/`matches` so content doesn't blank during the exit animation.
- **Mobile** (`sm:hidden`): follow `MobileDrawers.jsx`'s structure directly — `fixed inset-0 z-[70]` (above the pill's `z-[60]`), `.anim-backdrop` + `.anim-sheet` (`rounded-t-3xl max-h-[80vh]`), header with `#tag — n notes` + close `X` (reuse `Button variant="ghost" size="icon"`), scrollable row list.
- **Desktop** (`hidden sm:flex`): a panel anchored at the same coordinates as the pill (`fixed bottom-24 right-4 sm:bottom-8 sm:right-8 z-[70] w-[380px] max-h-[60vh]`), so it visually reads as "the pill expanded." No backdrop (matches how `TagsRail`/`TimelineRail` already coexist with the feed as non-modal chrome) — instead, close on outside-click and `Esc`, plus the explicit `X`. Needs one new CSS pair in `globals.css`, `.anim-panel` (`panel-in`/`panel-out` keyframes), modeled directly on the existing `.anim-pill` keyframes and reusing the same duration/ease CSS vars.
- **Row**: colored dot (`meta.tick`), one-line snippet, formatted date (`formatDate` from `src/lib/utils.js`, already used by `MobileNavPill`). Click → `onSelect(index)`, which jumps to that note **and closes the overlay** (pill stays open underneath for further Prev/Next or reopening the overlay).
- **Snippet extraction** — new small helper `src/lib/snippet.js`:
  ```js
  export function extractSnippet(content, query, radius = 60) {
    const flat = content.replace(/\s+/g, ' ').trim();
    const idx = flat.toLowerCase().indexOf(query.toLowerCase());
    if (idx === -1) return flat.slice(0, radius * 2);
    const start = Math.max(0, idx - radius);
    const end = Math.min(flat.length, idx + query.length + radius);
    return (start > 0 ? '…' : '') + flat.slice(start, end) + (end < flat.length ? '…' : '');
  }
  ```
  Called with the bare tag name (no `#`) as `query`, so the snippet centers on the tag occurrence.
- Since the overlay is only ever opened from an already-populated pill (which itself only shows for >1 match), there's no empty-results state to design for in Phase A.

### 4. Persistent match wash — `NoteApp.js` + `NotebookFeed.jsx`

In `NoteApp.js`, derive from `tagNav`:
```js
const activeMatchIds = useMemo(
  () => new Set(tagNav.matches),
  [tagNav.matches]
);
const matchWashClass = tagNav.tag ? getTagMeta(tagNav.tag).bg : '';
```
Pass both as new props to `NotebookFeed`. In `NotebookFeed.jsx`, apply to the existing `.entry-block` div (`NotebookFeed.jsx:121`) via `cn()`:
```jsx
<div
  className={cn(
    "entry-block rounded-xl transition-colors duration-300",
    activeMatchIds.has(note.id) && matchWashClass
  )}
  data-note-id={note.id}
>
```
Purely additive — `scroll-margin-top: 25vh` and all existing behavior on `.entry-block` are untouched. The wash persists for as long as `tagNav.tag` is set (i.e., until `handleNavClose`), matching every note in `matches`, not just the current index — so it stays legible while stepping with Prev/Next or scrolling manually, not just at the instant of arrival. `transition-colors duration-300` gives it a soft fade rather than a hard cut; this is a plain state-driven CSS transition, not a decorative animation, so it doesn't need design-skill sign-off the way a one-off "arrival flash" would (explicitly out of scope for this phase — flagged in the original brainstorm as a nice-to-have that needs `emil-design-eng`/`animate` input on timing if pursued later).

### 5. Wiring in `NoteApp.js`

Destructure the new `isOverlayOpen`, `openOverlay`, `closeOverlay`, `jumpToMatch` from the hook; pass `onOpenOverlay={openOverlay}` to `TagNavigator`; render `NoteResultsOverlay` alongside it with `isOpen={isOverlayOpen}`, `tag={tagNav.tag}`, `matches={tagNav.matches}`, `notes`, `currentIndex={tagNav.currentIndex}`, `onSelect={jumpToMatch}`, `onClose={closeOverlay}`; pass `activeMatchIds`/`matchWashClass` to `NotebookFeed`.

### 6. Update CONTEXT.md

Per this repo's own rule, update `src/CONTEXT.md` with the new overlay component/pattern and the `useTagNavigation` additions before considering the task done.

## Critical Files

- `src/hooks/useTagNavigation.js` — add `isOverlayOpen`, `openOverlay`, `closeOverlay`, `jumpToMatch`
- `src/components/TagNavigator.jsx` — counter becomes a button, new `onOpenOverlay` prop
- `src/components/NoteResultsOverlay.jsx` — new file, mobile sheet + desktop panel
- `src/lib/snippet.js` — new file, `extractSnippet`
- `src/components/NotebookFeed.jsx` — match-wash on `.entry-block`
- `src/components/NoteApp.js` — wiring, `activeMatchIds`/`matchWashClass` derivation
- `src/app/globals.css` — new `.anim-panel` keyframe pair (modeled on `.anim-pill`)
- `src/CONTEXT.md` — document the new pattern per project rules

## Design Skills

Per this project's CLAUDE.md, all four UI skills apply to this work: `emil-design-eng` (the overlay's open/close motion, the wash's fade), `impeccable` (panel/row visual treatment, spacing), `interface-design` (run an audit once built), `ui-skills` (final compliance pass before calling it done).

## Decisions made without re-asking (flag if any should change)

- Selecting a result row closes the overlay (both mobile and desktop) — the pill stays open underneath.
- Desktop panel closes on outside-click, `Esc`, or the `X` — no backdrop/dimming (consistent with `TagsRail`/`TimelineRail` already being non-modal).
- Snippet radius: 60 chars each side, single line, ellipsis on truncation — tune visually once built.
- No rename/generalization of `useTagNavigation` to a `mode`/`query` shape now — deferred until Phase B (search) actually needs it, to avoid speculative rework.

## Verification

1. Run the dev server, open a note set with a tag that has >2 matches.
2. Click the tag in `TagsRail` — confirm the existing pill (Prev/Next/Close) still works unchanged.
3. Click the new "view all" affordance on the pill — confirm the overlay opens: full-sheet on a mobile viewport, anchored panel (growing from the pill) on desktop.
4. Confirm each row shows a snippet centered on the tag occurrence and a correct date.
5. Click a row — confirm it scrolls/jumps to that note, closes the overlay, and the pill's Prev/Next now continues from that note's position.
6. Confirm every matching note in the feed has the tag-colored background wash for the whole session (scroll around, step with Prev/Next) — and that it clears when the pill is closed.
7. Check light and dark mode for the wash and the new desktop panel.
8. On desktop, confirm outside-click and `Esc` close the panel; confirm `Esc`/backdrop-click close the mobile sheet too.
9. Confirm `.entry-block`'s scroll positioning (`scroll-margin-top: 25vh`) is unchanged — jumping still lands notes in the same spot as before this change.

## Phase B (follow-up, not in this plan)

Free-text search: search icon next to the avatar in the bottom-left stack (`NoteApp.js:177`) + `Cmd/Ctrl+K` global shortcut on desktop, an entry in `MobileNavPill`'s icon row on mobile, opening the same `NoteResultsOverlay` directly (skipping the pill) with a text input at the top and live-filtered results. Needs its own round of product decisions (debounce, minimum query length, zero-match empty state, whether typing `#tag` should behave like a tag click) before planning implementation.
