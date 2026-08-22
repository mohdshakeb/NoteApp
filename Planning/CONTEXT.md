# Planning Context — NoteApp

## What Is NoteApp

NoteApp is an offline-first, real-time note-taking app. You type into an always-present blank entry at the end of a scrolling "notebook" feed; hashtags (`#tag`) in note content are auto-extracted into a tag cloud and timeline for navigation — no separate tagging UI. Works fully offline as a guest (IndexedDB only); signing in adds Supabase-backed cloud sync across devices.

## Tech Stack

- **Framework:** Next.js (App Router), all components are client-side (`'use client'`) — no SSR, due to IndexedDB/localStorage dependence
- **Target:** Web app, deployed on Vercel (Node.js runtime, not static export)
- **Local storage:** IndexedDB via the `idb` library — source of truth for guest users, cache + offline queue for authenticated users
- **Cloud storage:** Supabase (Postgres + Auth) — source of truth for authenticated users once synced
- **Editor:** Tiptap / ProseMirror (`NSTextView`-style rich text with a custom tag-highlighting ProseMirror plugin)
- **Styling:** Tailwind CSS + Radix UI primitives

## Current Priorities

TBD — this project was retrofitted onto the CONTEXT.md scaffold after already shipping; no forward-looking priority list has been captured yet. Recent commit history (`git log`) suggests the active focus has been: security hardening (headers, auth logs), sign-out/token-clearing robustness, and mobile visual polish (blur-on-scroll, consistency, dates). Fill this in with what's actually being worked on next.

## Architectural Principles

- **Local-first, optimistic UI** — all mutations update local state immediately; network sync happens in the background. The app must stay fully usable offline.
- **Guest mode is a first-class citizen, not a demo mode** — `userId: 'guest'` is a real, permanent storage mode, not a trial. Guest data persists indefinitely in IndexedDB until the user explicitly signs in and merges/discards it.
- **Remote is truth for synced data, local wins for pending data** — see the merge strategy detail in [[src-context]]. This is the single most sensitive piece of logic in the app; changes here risk silent data loss.
- **Tags are derived, never stored** — no tags table or tags column is the system of record; tags are computed from note content via regex at read/render time. (Note: two different regexes currently do this in two different places — see [[src-context]] Known Issues.)
- **One perpetual blank note** — the feed always keeps exactly one empty note at the end for immediate input; this is auto-managed, not user-created.

## MVP Features (Shipped)

1. **Offline-capable note feed** — scrolling "notebook" of auto-saving rich-text entries, one always-blank at the end
2. **Hashtag tagging** — `#tag` in content is extracted live into a tag cloud (`TagsRail`) and floating tag navigator (Prev/Next through matches)
3. **Timeline navigation** — left-rail date-based jump list
4. **Guest mode + merge-on-login** — guest notes prompt a merge/discard dialog when the user signs in
5. **Auth** — Google OAuth + magic-link email via Supabase Auth (no GitHub, despite what older docs claimed)
6. **Mobile layout** — bottom nav pill + drawers replacing the desktop two-rail layout
7. **Note delete & copy** — desktop: copy/delete icons below a note while it's being edited; mobile: long-press opens a bottom sheet with the same actions. Delete is confirmed via `AlertDialog` and has an offline pending-delete queue (see [[src-context]])

## User Flow

```
Guest lands on app
  → IndexedDB initialized, blank note ready
  → Types notes, uses #tags to organize
  → (optional) Signs in via Google OAuth or magic-link email
      → MergeToast: "You have N guest notes — merge or discard?"
      → Merge: guest notes reassigned to userId, marked 'pending', synced to Supabase
      → Discard: guest notes deleted from IndexedDB
  → Authenticated: writes go to Supabase first, cached to IndexedDB
  → Offline while authenticated: writes marked 'pending', synced on 'online' event
```

## Feature Specs

_None captured yet — add here as new features are scoped._

## Architecture Decisions

### 2026-08-22 — Scroll glide jank root-caused; empty-state entrance added
**Decision:** Fixed the initial-load scroll glide (`NotebookFeed.jsx`) actually being janky in practice, root-caused via a live scrollTop trace (Playwright, headless Chromium) rather than guessed at: the feed container's `scroll-smooth` class (`scroll-behavior: smooth`) was intercepting the glide's own plain `container.scrollTop = ...` writes — Chromium applies computed `scroll-behavior` to direct property assignment, not just `scrollTo()`/`scrollIntoView()` — so the JS rAF loop and the browser's native smooth-scroll were retargeting against each other every ~16ms, producing direction-reversals and a multi-hundred-ms freeze. Fix: `container.style.scrollBehavior = 'auto'` for the duration of the glide only, restored on completion/cleanup so `scroll-smooth` still governs the deliberate smooth scrolls elsewhere in the file. Also fixed a secondary, smaller contributor: the lazy-loaded `TiptapEditor`'s loading placeholder was `h-24` (96px) against a real blank editor's measured ~55px, so the chunk resolving mid-glide caused a real `scrollHeight` shift; placeholder is now `h-14` (56px), measured directly rather than guessed. Verified with a before/after trace: chaotic (direction-reversals, ~90px snap-back) → single clean monotonic ease-out curve, layout-shift blip down from -41px to -1px.
Separately, added a staggered entrance animation for the true empty state (just the perpetual blank note, no other notes yet): `FeedHeader` (Dave illustration + tagline) fades/slides in first, the blank note follows 80ms later — both via `@starting-style` on the existing `--duration-base`/`--ease-out` tokens (same mechanism as `.note-enter`), gated by a `playEmptyEntrance` ref in `NotebookFeed.jsx` that locks in once real data loads (not the transient `notes=[]` pre-fetch render, which would otherwise misfire this for every user). Confirmed via DOM inspection that it does not fire for users who already have notes.
**Rationale:** The user reported "not smooth" and suggested extending the glide's fixed 240px backoff distance — profiling first (rather than taking the suggested fix) showed distance was never the issue; two independent, confirmed mechanisms were. Followed `emil-design-eng`: opacity+`translateY(8px)` (never `scale(0)`), `--ease-out` for entrances, both durations under 300ms (200ms + 80ms stagger, within the 30-80ms stagger-gap guidance), `prefers-reduced-motion` strips movement but keeps opacity, matching the existing `.note-enter` reduced-motion pattern.

### 2026-08-22 — Initial-load scroll glide, reviewed against 5 requirements
**Decision:** Rewrote `NotebookFeed.jsx`'s initial-load scroll effect (`useEffect` → `useLayoutEffect`, required so the glide doesn't flash before animating) to: (1) skip entirely when only the perpetual blank note exists (`sortedNotes.length > 1` gate — the true empty state has nothing above the fold to reveal); (2) land at the exact final position instantly via native `scrollIntoView({behavior:'instant', block:'start'})` (reusing the browser's own `scroll-margin-top: 25vh` handling); (3) back off a small fixed distance (240px, clamped to never pass the top) and animate only that short return via `requestAnimationFrame`, eased with a small hand-rolled cubic-bezier evaluator matching `--ease-out` — mirrors the Android app's `glideToTarget`/`SCROLL_GLIDE_DISTANCE` pattern, so the visible glide never scales with note count. Skips the glide (stays at the instant landing) under `prefers-reduced-motion: reduce`. Also added `{ scrollIntoView: false }` to `TiptapEditor.jsx`'s `autoFocus` effect, matching its sibling `focus()` method, so ProseMirror's own default focus-scroll (which fires on the bootstrap `isNew` note, including true first launch) can't override the glide a frame later.
**Rationale:** Reviewed the previous instant-jump implementation against 5 explicit requirements (visible-but-bounded scroll, no scroll on empty state, smooth per emil-design-eng). Two things only surfaced by checking the actual running code/CSS rather than comments: the container already had Tailwind's `scroll-smooth` class, so the old "instant" scrollIntoView was — accidentally, unboundedly — already animating; and the empty state, once `FeedHeader`'s illustration was added above the notes, genuinely became scrollable (`pt-[25vh]` + `min-h-[50vh]` alone total 75vh), so the naive `length > 0` gate was producing a real unwanted scroll, not a theoretical one. Native `scroll-behavior: smooth` was kept nowhere in the fix because its easing curve can't be set to this project's own `--ease-out` token — no browser API allows that.
**No test tooling available:** chromium-cli isn't installed and Puppeteer install was declined this session — dev server left running for manual verification instead of an automated screenshot pass.

### 2026-08-22 — Feed header illustration, ported from Android
**Decision:** Added a permanent leading item above the oldest note in `NotebookFeed.jsx` — the "Dave" illustration (`DaveIllustration.jsx`, inlined SVG from `references/dave.svg`/`dave_dark.svg`) plus the same four-line tagline Android uses, sharing the feed's normal inter-note spacing. Two deliberate departures from Android's version: (1) the SVG is inlined once with its three fills driven by new `--illustration-line/fill/highlight` CSS custom properties that flip with the `.dark` class, rather than swapping two separate assets — safe here because, unlike Android's `ic_dave.xml`/`ic_dave_dark.xml`, the light/dark SVGs turned out to be pixel-identical path data with only fill colors differing; (2) no scroll-linked fade — Android's fade exists to smooth its keyboard-avoidance auto-scroll, which web's feed doesn't do, so porting the fade would be motion without a problem to solve.
**Rationale:** Full discussion (asset choice, dark-mode strategy, fade fidelity) happened before implementation — see chat history 2026-08-22. Also required one new typography role (`text-2xl sm:text-3xl font-semibold`, logged in `.interface-design/system.md`) since the existing scale topped out at `text-lg` and had none large enough for a hero tagline.

### 2026-07-29 — Note delete & copy actions
**Decision:** Desktop shows a copy/delete icon row below a note only while it's the actively-edited one (`editingNoteId`, not the scroll-driven `activeNoteId`); mobile uses a long-press bottom sheet instead. The perpetual last note never gets an action row. Delete always requires an `AlertDialog` confirmation and now has a real offline fallback — a `pending-delete` queue in `db.js`, retried on `window.online`, mirroring the existing pending-save mechanism — instead of the previous silent `throw`.
**Rationale:** Delete previously only happened implicitly (auto-delete on empty blur); making it a deliberate, one-tap user action meant its lack of an offline path (a pre-existing gap, tolerable when unreachable) would become a frequently-hit failure mode. Explicitly scoped out: cross-device tombstone reconciliation — a note hard-deleted online by one device can still be resurrected on another device that was offline at delete time and held a stale local copy. That's a pre-existing gap in `getNotes()`'s merge logic, not solved by this feature; would need a durable server-side tombstone (e.g. a `deleted_notes` table) to fix properly.

### 2026-07-28 — Lazy-hydrated editors for NotebookFeed scale (1000+ notes, ahead of NoteAppAndroid)
**Decision:** Instead of virtualizing the note list (unmounting off-screen rows entirely, à la react-virtuoso/react-window), keep every note's outer row permanently mounted and only swap what renders *inside* it: a live `TiptapEditor` for the last note plus at most one other (`editingNoteId`, set on click), a cheap read-only `StaticNotePreview` for everything else. See [[src-context]]'s "Lazy-hydrated editors" pattern entry for the mechanism.
**Rationale:** A full trace found the "click a tag/date, feed scrolls to the matching note" interaction is actually four independent, undocumented, timing-sensitive implementations (`useNoteFinder.js`, `TimelineRail.jsx`, `useMobileNav.js`, `NotebookFeed.jsx`'s jump-to-latest), all built on the assumption that every note has a permanently-mounted DOM row with a stable `id`/`.entry-block` class. True virtualization would require rewriting all four with high risk of regressing fragile, undocumented behavior. Targeting the actual cost driver (live ProseMirror instances, not DOM node count) avoids that risk entirely, verified by re-running all four scroll paths against a note that was currently rendered as static and confirming the wash/scroll/`activeNoteId` behavior was unaffected. Full plan and verification checklist: `Planning/NOTEBOOKFEED_SCALE_PLAN.md`.

### 2026-07-20 — Retrofit CONTEXT.md scaffold onto existing project
**Decision:** Reorganized the single monolithic `CLAUDE.md` into the standard `Planning/ src/ docs/ ops/` CONTEXT.md structure used across other projects in this workspace, with root `CLAUDE.md` reduced to a router.
**Rationale:** NoteApp had grown a large, single CLAUDE.md that mixed architecture, dev commands, and task recipes. During the split it was cross-checked against the actual source and several inaccuracies were caught and corrected (see [[src-context]] for details) rather than carried forward.

### (pending) — Mac desktop companion app
**Decision:** Parked. A full implementation plan for a native Swift/SwiftUI Mac app was drafted and then removed at the user's request; decision on Electron vs. Tauri vs. Swift is deferred.
**Rationale:** Not a current priority; revisit when desktop is actually greenlit. If revisited, the strongest argument is for Electron/Tauri (reuse existing `db.js`/tag/color logic verbatim) over Swift (full reimplementation of the sync/tag logic in a second language, doubling maintenance).
