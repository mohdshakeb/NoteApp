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

### 2026-07-28 — Lazy-hydrated editors for NotebookFeed scale (1000+ notes, ahead of NoteAppAndroid)
**Decision:** Instead of virtualizing the note list (unmounting off-screen rows entirely, à la react-virtuoso/react-window), keep every note's outer row permanently mounted and only swap what renders *inside* it: a live `TiptapEditor` for the last note plus at most one other (`editingNoteId`, set on click), a cheap read-only `StaticNotePreview` for everything else. See [[src-context]]'s "Lazy-hydrated editors" pattern entry for the mechanism.
**Rationale:** A full trace found the "click a tag/date, feed scrolls to the matching note" interaction is actually four independent, undocumented, timing-sensitive implementations (`useNoteFinder.js`, `TimelineRail.jsx`, `useMobileNav.js`, `NotebookFeed.jsx`'s jump-to-latest), all built on the assumption that every note has a permanently-mounted DOM row with a stable `id`/`.entry-block` class. True virtualization would require rewriting all four with high risk of regressing fragile, undocumented behavior. Targeting the actual cost driver (live ProseMirror instances, not DOM node count) avoids that risk entirely, verified by re-running all four scroll paths against a note that was currently rendered as static and confirming the wash/scroll/`activeNoteId` behavior was unaffected. Full plan and verification checklist: `Planning/NOTEBOOKFEED_SCALE_PLAN.md`.

### 2026-07-20 — Retrofit CONTEXT.md scaffold onto existing project
**Decision:** Reorganized the single monolithic `CLAUDE.md` into the standard `Planning/ src/ docs/ ops/` CONTEXT.md structure used across other projects in this workspace, with root `CLAUDE.md` reduced to a router.
**Rationale:** NoteApp had grown a large, single CLAUDE.md that mixed architecture, dev commands, and task recipes. During the split it was cross-checked against the actual source and several inaccuracies were caught and corrected (see [[src-context]] for details) rather than carried forward.

### (pending) — Mac desktop companion app
**Decision:** Parked. A full implementation plan for a native Swift/SwiftUI Mac app was drafted and then removed at the user's request; decision on Electron vs. Tauri vs. Swift is deferred.
**Rationale:** Not a current priority; revisit when desktop is actually greenlit. If revisited, the strongest argument is for Electron/Tauri (reuse existing `db.js`/tag/color logic verbatim) over Swift (full reimplementation of the sync/tag logic in a second language, doubling maintenance).
