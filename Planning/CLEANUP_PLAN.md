# NoteApp Cleanup Pass — Implementation Plan

_Drafted 2026-07-27, prior to starting NoteAppAndroid. Not yet executed._

## Context

NoteApp is a live, working Next.js note-taking app that a new Android companion (NoteAppAndroid) is about to be built against. Before starting that new project, a full review of NoteApp surfaced several real discrepancies: stale documentation, dead code left over from a superseded guest-login design, unused dependencies, and a tag-extraction regex that's implemented three different (disagreeing) ways across the codebase. The hard constraint for this pass: **nothing should change functionally or visually**, with exactly one explicitly-approved exception — unifying the tag regex, which has two small, known, accepted edge-case deltas.

Every item below has already been discussed and approved in conversation, including the two points that needed a product decision (dead guest code → delete outright; tag regex → fix via unification, not just document). This plan is execution detail, not open scope.

Repo state at time of writing: git repo on `main`, in sync with `origin/main`, working tree clean except the `src/CONTEXT.md` doc edit already made this session (added the "unused `tags` column" Known Issue entry — unrelated to this plan, leave as-is). No automated test suite exists (no `jest.config.js`, no test files, no `test` script), so manual click-through is the only regression net — the verification steps below are not optional.

## Approach

Four phases, ordered safest-first, **one git commit per phase** (Phase 2 split into two commits — see below) so any surprise is trivially bisectable/revertable without unwinding unrelated work. Run `npm run build` after every phase (catches import/syntax errors immediately) and do the phase's manual click-through before moving to the next phase.

---

## Phase 1 — Doc-only fix

**File:** `src/CONTEXT.md`

Delete line 84 — the "`TiptapEditor.jsx` renders `<EditorContent>` twice" Known Issue. Verified false: the actual file (`src/components/TiptapEditor.jsx:129`) renders it exactly once. This bullet is simply wrong and should go.

Leave lines 83 (tag regex split-brain) and 125-128 (the "Changing Tag Extraction Behavior" recipe) untouched in this phase — both get rewritten once in Phase 3 when they become fully obsolete, rather than patched now and rewritten again later.

**Commit:** `docs: correct stale CONTEXT.md claim about duplicate EditorContent render`

**Verify:** `git diff src/CONTEXT.md` shows only that one line removed. No app behavior to break.

---

## Phase 2 — Dead code removal

### Commit 2.1 — file/dependency deletions (nothing reachable references any of this)

Delete files:
- `src/components/Auth.js`
- `src/components/LoginModal.jsx`
- `src/components/MergeDialog.jsx`
- `src/components/ui/card.jsx` — becomes orphaned once the three above are gone (currently its only importers). Re-run `grep -rln "ui/card" src/` immediately after deleting the three above, in the same step, to confirm zero remaining importers before deleting it.
- `src/components/ui/scroll-area.jsx` — zero importers anywhere in `src/`, confirmed independently via a fresh Explore-agent pass this session.

Remove from `package.json` `dependencies`: `@radix-ui/react-scroll-area`, `@testing-library/react`, `@testing-library/jest-dom`, `@testing-library/user-event`, `iconv-lite`, `lodash.debounce`. All confirmed zero-usage via grep across `src/` and all four config files (`next.config.js`, `tailwind.config.js`, `postcss.config.js`, `vercel.json`). Run `npm install` after editing to update `package-lock.json` in the same commit (mechanical consequence of the dependency removal, not separate scope).

Fill in `README.md` (currently 0 bytes) with a basic project description and dev setup (`npm run dev`, required Supabase env vars).

Also fold into this commit — these `CONTEXT.md` bullets become false the moment this commit lands, same pattern as Phase 1:
- Delete line 85 (stale testing-library dependency mention)
- Delete line 86 (`README.md` empty) — replace with nothing, or a one-liner noting it's now filled in

**Commit:** `chore: remove dead components, unused deps, and fill in README`

### Commit 2.2 — remove vestigial guest-identity system

Confirmed dead: nothing anywhere in the repo ever calls `localStorage.setItem('guestUser', ...)`. Only `getItem` (`AuthContext.js:16`) and `removeItem` (`NoteApp.js:161`) touch that key. The **real** guest mechanism — `user === null` → the `'guest'` string sentinel used throughout `db.js`/`useNotes.js` — is completely separate and stays untouched.

**`src/contexts/AuthContext.js`** — remove the `guestUser` localStorage check block (lines ~15-22) and the `isGuest` state entirely (defined line 12, set lines 19/35, exposed in context value line 44). Confirmed `useAuth()` has exactly one call site in the whole repo (`src/app/page.js`, which only destructures `{ user, loading }`), so `isGuest` has zero consumers anywhere. Resulting hook just does session lookup + auth-state-change listener, no guest branch.

**`src/components/NoteApp.js`** — in `handleSignOut` (lines 147-187), collapse the `if (user?.isGuest) { localStorage.removeItem('guestUser'); } else { ...real signout... }` split (lines 160-162) down to just the real-signout body unconditionally. Leave the DB-clear above it and the token-cleanup below it untouched — only the dead branch and its wrapper go.

**`src/components/ui/UserDropdown.jsx`** — remove the `{!user.isGuest && ( ... )}` wrapper around the "Delete Account" `DropdownMenuItem` (lines 77-87), keep the item itself unconditional. Safe because `UserDropdown` only ever renders when `user` is truthy (`NoteApp.js`: `{user ? <UserDropdown/> : <LoginDropdown/>}`), and a real Supabase user object never carries `.isGuest` — so this guard already evaluates true 100% of the time today. Removing it is a no-op for anyone who can currently see this menu. (Guests never reach `UserDropdown` at all — they get `LoginDropdown` instead — so this isn't "now guests can delete accounts," it's just deleting an unreachable branch.)

**Commit:** `refactor: remove vestigial guest-identity code (dead since guestUser is never set)`

**Verify (covers both 2.1 and 2.2):**
1. `npm install && npm run build` — clean, no missing-import errors.
2. `npm run dev`, then manually:
   - Sign in with a real account (Google OAuth or magic link) → dropdown renders, avatar shows, "Sign out" and "Delete Account" both present (don't confirm delete).
   - Sign out → lands on `/`, local notes cleared, no console errors.
   - As a signed-out guest: create/edit notes, confirm they still save and reload correctly (exercises the *real*, untouched `'guest'` sentinel path — good regression check that the fake guest system's removal didn't collateral-damage the real one).
   - Console has zero errors referencing `card`, `scroll-area`, `Auth`, `LoginModal`, `MergeDialog`, `isGuest`, or `guestUser`.
3. `grep -rn "isGuest\|guestUser" src/` returns nothing.

---

## Phase 3 — Tag-regex unification

Three files each run their own extraction regex on note content and disagree on edge cases:

| File | Regex | Anchor | Hyphens |
|---|---|---|---|
| `src/hooks/useTags.js:8` | `/#(\w+)/g` | none | no |
| `src/components/extensions/TagHighlight.js:13` | `/(?:^|\s)(#[\w-]+)/g` | start-or-whitespace | yes |
| `src/components/TagsRail.jsx:15` | `/#[\w-]+/g` | none | yes |

**Approved fix:** new `src/lib/tags.js`, canonical rule = `TagHighlight.js`'s current regex (most deliberate of the three, and it's what the user visually sees highlighted while typing — already defines their mental model of "what's a tag"). Do **not** touch `src/lib/tagMatch.js` — deliberately separate concern (matching an *already-known* tag name against content, not extracting names from raw text); its own header comment already explains this and is exactly right.

```js
// src/lib/tags.js
//
// Single canonical source for "#tag" extraction from raw note text.
// Canonical rule (matches TagHighlight.js's original inline-highlight regex —
// chosen because it's what the user visually sees highlighted while typing,
// so it already defines their mental model of "what counts as a tag"):
//   '#' + word chars/hyphens, anchored to start-of-text or preceding
//   whitespace (so "foo#bar" is NOT a tag, but "#to-do" is).
//
// Do not add a 4th extraction regex — see lib/tagMatch.js's header comment,
// a deliberately separate concern this file is the fix for.

const TAG_PATTERN_SOURCE = '(?:^|\\s)(#[\\w-]+)';

// Fresh RegExp per call, NOT a shared module-level instance — a `/g` regex
// carries `lastIndex` state across calls, which would silently corrupt
// results when this is called repeatedly in a loop (e.g. once per note in
// useTags.js). This is the single highest-risk detail in this file.
export function findTagMatches(text) {
  const regex = new RegExp(TAG_PATTERN_SOURCE, 'g');
  const matches = [];
  let match;
  while ((match = regex.exec(text)) !== null) {
    const matchText = match[1];
    const start = match.index + match[0].indexOf(matchText);
    const end = start + matchText.length;
    matches.push({ tag: matchText.slice(1), start, end });
  }
  return matches;
}

export function extractUniqueTags(text) {
  const seen = new Set();
  for (const { tag } of findTagMatches(text)) seen.add(tag);
  return Array.from(seen);
}
```

This is a byte-for-byte port of `TagHighlight.js`'s current `findTags` inner loop (same regex source, same `match.index + match[0].indexOf(matchText)` position math) — just returning offsets instead of building decorations directly.

**`TagHighlight.js`** — replace the inline regex loop in `findTags(doc)` with:
```js
import { findTagMatches } from '../../lib/tags';
// inside doc.descendants((node, pos) => { if (node.isText) { ... } }):
findTagMatches(node.text).forEach(({ tag, start, end }) => {
    const from = pos + start;
    const to = pos + end;
    const colorClass = getTagColor(tag);
    decorations.push(Decoration.inline(from, to, { class: `rounded px-0.5 -mx-0.5 ${colorClass}` }));
});
```
`pos + start` / `pos + end` is a direct drop-in for the old `pos + startIndex` / `from + matchText.length` — no translation needed since `findTagMatches` defines `start`/`end` identically to the old inline math. This is the highest-risk file in the whole plan (live-typing UI) — test thoroughly per the verification steps below.

**`useTags.js`** — replace the `note.content.match(/#(\w+)/g)` block with `extractUniqueTags(note.content).forEach(tag => tags.add(tag))`.

**`TagsRail.jsx`** — replace the `note.content.match(/#[\w-]+/g)` block with `new Set(extractUniqueTags(note.content))`.

**Accepted behavior deltas** (approved, must be confirmed during testing, not treated as regressions):
- A `#tag` glued mid-word with no leading space (`foo#bar`) stops appearing in the tag cloud and the active-tags rail (it never highlighted inline either way).
- Hyphenated tags (`#to-do`) start appearing in the tag cloud where they didn't before (they already highlighted inline and in the rail — this brings the cloud in line with those two).

**`src/CONTEXT.md` updates, same commit** (these all become false the moment this lands — same "keep docs honest" spirit as Phase 1, cheaper to do once here than as a separate later pass):
- Line 17: remove "— has its OWN regex, see Known Issues" from the `TagHighlight.js` structure comment
- Line 34: remove the equivalent comment on `useTags.js`
- Line 42: update `tagMatch.js`'s comment to reference `lib/tags.js` instead of "useTags.js/TagHighlight.js's extraction regexes below"
- Add a `lib/tags.js` entry to the file-structure listing
- Line 76: update the "Patterns to Avoid" cross-reference (the Known Issue it points to is being removed)
- Line 83: delete the "Tag regex split-brain" Known Issue, replace with a one-line note recording the two accepted deltas so a future reader doesn't mistake either for a regression
- Lines 125-128: rewrite "Changing Tag Extraction Behavior" to say there's now one file — `src/lib/tags.js` — consumed by all three call sites
- Line 98: optionally reword to name `lib/tags.js` directly (the underlying advice — lock it down with tests once a suite exists — still holds either way)

**Commit:** `refactor: unify tag-extraction regex into src/lib/tags.js`

**Verify — this is the phase to spend the most manual-testing time on:**
1. Before touching code, skim the current tag cloud contents on real existing notes and note anything unusual-looking (mid-word or hyphenated tags), so a before/after diff is possible — not just testing with fresh synthetic strings.
2. `npm run dev`, in the editor test each case explicitly:
   - `#simple` and `hello #simple` → highlights inline, in cloud, in rail (unchanged in all three cases).
   - `#to-do` (hyphenated) → highlights inline (unchanged), **now in cloud** (verify the delta happened), in rail (unchanged).
   - `foo#bar` (glued) → does not highlight inline (unchanged), **now absent from cloud** (verify the delta happened), absent from rail (verify).
   - `#tag1 #tag2 #tag3` on one line → all three extracted, no boundary bleed in the highlight.
   - Tags split across multiple paragraphs/lines → confirms `pos` offset math holds per ProseMirror text node, not just within one.
   - Rapid backspace/retype on a tag → no lag, no stale highlight, no console errors (out-of-range `Decoration.inline(from, to)` throws is the actual ProseMirror failure mode to watch for).
   - **Multi-note test, not just single-note**: create 3+ notes with differing tag counts, confirm the tag cloud is complete and correct — this is the only way to catch the `lastIndex`-state bug class if it were to slip in, since a single-note test won't surface it.
3. Click a tag in the cloud → tag-nav session starts and jumps correctly (exercises `useNoteFinder.js`/`tagMatch.js`, confirms nothing downstream broke from the `allTags`/`activeTags` shape).
4. `grep -rn "#(\\w\|#\[\\w-\]" src/` — should only return `lib/tags.js` and `lib/tagMatch.js` (deliberately untouched), nothing else.

---

## Phase 4 — Documentation-only notes (no logic changes)

**`src/components/NotebookFeed.jsx:68`** — add a comment directly above the loose-equality line:
```jsx
// Intentional loose `==`: noteId comes from a DOM data-note-id attribute
// (always a string), while note.id may be a JS Number for Supabase-
// authenticated notes (bigint) vs. a UUID string for guest notes. Do not
// "fix" to `===` without first normalizing ID types everywhere.
const note = notes.find(n => n.id == noteId);
```

**`src/CONTEXT.md`** — add a Known Issues bullet noting `TimelineRail.jsx` (lines ~56-74) and `TagsRail.jsx` (lines ~27-52) independently implement identical "sliding window of 25 centered on active item" math — confirmed near-identical clamping logic in both, safe to extract to a shared util later, explicitly out of scope for this pass.

**Commit:** `docs: document intentional loose equality in NotebookFeed and flag rail duplication`

**Verify:** `git diff` shows only comments/docs added, zero executable-code lines changed.

---

## Critical files
- `src/lib/tags.js` — new file, canonical tag-extraction module
- `src/components/extensions/TagHighlight.js` — highest-risk consumer (live ProseMirror decoration math)
- `src/hooks/useTags.js`, `src/components/TagsRail.jsx` — other two consumers
- `src/contexts/AuthContext.js`, `src/components/NoteApp.js`, `src/components/ui/UserDropdown.jsx` — dead guest-code removal
- `src/CONTEXT.md` — doc updates across all four phases
- `package.json` / `package-lock.json` — dependency removal

## Out of scope (explicitly excluded)
- The unused Supabase `tags` column (already flagged in `CONTEXT.md`'s Known Issues this session) — a schema decision, not touched here.
- Tag-autocomplete-while-typing (`useTags.js`'s unused `getSuggestions`) — explicitly deferred as a separate follow-up feature, not part of this cleanup.
- Extracting `TimelineRail`/`TagsRail`'s duplicated sliding-window logic — documented in Phase 4, not executed.
