# Note Formatting: Paragraph-Break Bug + Minimal Formatting (Lists, Links)

## Context

Notes copy-pasted from external sources (Word, PDFs, web pages, Google Docs) show extra blank lines between what should be a single flowing paragraph — most visible on the Android app, which renders `note.content` completely literally. Investigating the root cause on web surfaced three compounding bugs, all stemming from the same underlying issue: nothing enforces a single agreed meaning for `\n` in `note.content` between the two places that read/write it.

This doc also captures the requirements for the minimal-formatting follow-up (paragraph breaks, lists, links) discussed alongside the fix, since the paragraph-break bug fix and the paragraph-break *feature* are the same mechanism.

## Part 1 — Bug: paragraph breaks don't survive a save/reload round trip

Three compounding bugs, found by tracing `@tiptap/core` and `prosemirror-model` source directly (not just app code):

**Bug A — loading a note into the live editor collapses all whitespace to single spaces.**
`TiptapEditor.jsx:60` passes `content: note.content` straight into `useEditor`. A plain string is treated as **HTML**, parsed via `elementFromString()` → ProseMirror's `DOMParser`. Per `prosemirror-model/src/to_dom` (`addTextNode`), any text node without `preserveWhitespace` gets `value.replace(/[ \t\r\n]+/g, " ")` applied — every `\n` (or `\n\n`) becomes one space the instant a multi-line note is activated for editing. Not paste-specific — happens to every multi-line note.

**Bug B — a blur unconditionally re-saves, baking the loss in.**
`TiptapEditor.jsx:85-97` — `onBlur` always calls `editor.getText()` and saves, whether or not anything was typed. Tapping into a multi-line note and tapping back out with zero edits permanently flattens its line breaks in storage.

**Bug C — save doubles every paragraph break, and paste multiplies the damage.**
`editor.getText()`'s default `blockSeparator` is `"\n\n"` (confirmed in `@tiptap/core`'s `dist/index.js`). Content pasted from Word/Docs/PDFs/many sites typically arrives as one HTML block per visual line, so ProseMirror creates one paragraph node per line — and on save those get joined with `\n\n`, baking a blank line between every original line into `note.content` permanently.

**Why it looks fine on web but not mobile:** `StaticNotePreview.jsx:88` renders raw `note.content` with `white-space: pre-wrap` — same literal convention Android's `BasicTextField` uses. A corrupted note *would* show gaps there too — but the moment it's tapped into edit mode (Bug A), the gaps collapse to spaces and often get re-saved that way (Bug B), so on web the corruption is self-masking. Android has no such collapsing step, so it shows the raw stored string exactly as-is.

### Fix direction

1. **Pick one convention everywhere:** one `\n` == one paragraph break. This is already what Android and `StaticNotePreview` assume — fix web to match rather than the reverse.
2. **Save:** pass `blockSeparator: '\n'` explicitly to every `getText()` call (kills Bug C's doubling).
3. **Load:** stop feeding the raw string through HTML parsing. Build the ProseMirror doc directly (JSON content, one `paragraph` node per `\n`-split line) instead of an HTML string — avoids escaping pitfalls and kills Bug A.
4. **Paste:** normalize pasted content to plain text before it hits the doc (`editorProps.transformPastedHTML`/`transformPastedText`), letting our own line-splitting re-derive paragraph structure instead of preserving the source's per-line block structure. Prevents *future* paste corruption, not just today's masking of it.
5. **Bug B stops mattering** once A and C are fixed — blur-saving unedited content is no longer lossy.
6. **Existing corrupted notes:** no auto-repair planned. No reliable way to distinguish "paste artifact" from "intentional blank line," so leave old notes as-is — they self-normalize the next time they're actually edited under the fixed pipeline. Revisit only if this proves insufficient in practice.

## Part 2 — Related finding on Android (no code bug, but a real interaction)

Traced the Android save/render path (`NoteFeedScreen.kt`'s `BasicTextField`, `NotesRepository.kt`) — content flows through untouched (no `.trim()`, no whitespace normalization anywhere in the write path), so Android does not independently reproduce this bug. It simply displays whatever is stored, literally.

However: the long-note collapse feature that just landed (`COLLAPSE_MAX_LINES = 6` in `NoteFeedScreen.kt`) counts **raw rendered lines** via `maxLines`. A paste-corrupted note with extra blank lines hits that 6-line threshold earlier than a genuinely short note would, and "View More" truncation can end mid-gap. This resolves automatically once the web fix lands and affected notes get re-saved — no Android code change needed for the bug itself, but worth knowing this is now a live, user-visible downstream symptom, not just a cosmetic oddity.

## Part 3 — Minimal formatting requirements (new)

No toolbar/buttons — everything below is typing-driven or automatic.

### Paragraph breaks
Enter → new paragraph. Falls directly out of the Part 1 fix — same mechanism, nothing additional to build.

### Lists
- **Trigger:** typing `- ` at the start of a line converts it into a list item.
- **Storage stays plain text** — no schema/sync change. A list item is defined as: a line whose canonical text begins with `- `. Same "detect via convention, decorate, don't restructure storage" pattern already used for `#tags`.
- **Web:** use StarterKit's real `bulletList`/`listItem` nodes for the *live* editing surface — native hanging indent (free from `<ul>`/`<li>` CSS), native Enter-to-continue / empty-Enter-to-exit (`splitListItem`/`liftListItem`, already in `prosemirror-schema-list`). Serialize to/from plain text with `- `-prefixed lines on save/load — the same line-based round trip as the paragraph fix, one level deeper.
- **Android:** no structural editor, so this needs to be hand-built:
  - *Rendering:* real bullet glyph (not the literal `-`) via hanging indent — `AnnotatedString`'s `ParagraphStyle(textIndent = TextIndent(firstLine = 0, restLine = <bullet width>))` with a `•` glyph. Compose has no `BulletSpan` equivalent (that's classic View-system only), so this has to be built directly — mirrors the existing tag-highlight decoration pattern (detect at render time, decorate, storage untouched).
  - *Behavior:* Enter within a `- `-prefixed line auto-inserts `- ` on the next line; Enter on an empty `- ` line exits the list. Implemented via interception in `BasicTextField`'s `onValueChange` — same "mirror the behavior, not the mechanism" split already used elsewhere between these two codebases.
- **Out of scope, confirm before building:** nested/multi-level lists, numbered lists, indent/outdent.

### Links
- **Trigger:** recognized automatically as typed or pasted. Match `http://`, `https://`, `www.` prefixes only — no bare-domain matching (avoids false positives like version strings or filenames).
- **Storage stays plain text**, zero schema impact — decoration-only, same architecture as `#tags` (`findTagMatches` equivalent: new `findLinkMatches`, ported to both platforms from one canonical implementation).
- **Interaction model:** reuse the Live/Static split that already exists for every note row on both platforms:
  - *Live/focused:* link shown decorated (underline/color) but **not** tappable — a tap places the cursor like normal text, so editing is never interrupted.
  - *Static/blurred:* link renders as a real tappable/clickable element (`LinkAnnotation.Url` on Android's `Text`, a real click handler in web's `StaticNotePreview`) that opens externally.
  - *Optional desktop-only enhancement:* Cmd/Ctrl-click opens the link even while focused (desktop has a spare modifier; touch doesn't). Not required for v1 — mobile gets no equivalent, by necessity, and that's fine since it already gets click-to-open the instant it blurs to static.
- **Link preview cards (fetch OG metadata on paste) — discussed, NOT included in this pass:**
  - Needs a server-side fetch endpoint — client-side `fetch()` to arbitrary third-party origins is CORS-blocked, so scraping `<title>`/OG tags requires a backend proxy (e.g. a Next.js API route) fetching server-side. Needs SSRF-safe fetching (block private/internal IP ranges and unsafe redirect targets) since it fetches user-supplied URLs.
  - Needs persisted metadata (title/description/image) somewhere. Recommend treating it as a **locally-cached, best-effort, derived** artifact — same principle as `#tags` ("derived, never stored" per `NoteAppAndroid/Planning/CONTEXT.md`) — refetched independently per device, never part of `note.content`, with graceful fallback to plain link text when offline or on fetch failure (required by the local-first offline principle both apps already commit to).
  - Meaningfully bigger than "minimal formatting": new network dependency, new failure modes, real visual weight of an unfurled card. Recommend scoping as an explicit separate/future phase, after plain link detection ships and is validated.

## Open questions

- Lists: bullet-only for v1 (no numbered/nested) — confirm.
- Desktop Cmd/Ctrl-click-while-focused for links: in scope for v1, or skip for platform symmetry — confirm.
- Link preview cards: separate future phase, or pull into this pass despite the "minimal" framing — confirm.
- Existing paste-corrupted notes: leave as-is (self-heals on next edit), or a one-time best-effort cleanup pass — confirm.
