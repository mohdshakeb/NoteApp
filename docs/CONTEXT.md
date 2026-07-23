# Documentation Context — NoteApp

## Documentation Standards

- Write in plain, concise language. No jargon unless the audience expects it.
- Use present tense ("The app displays..." not "The app will display...").
- Include visuals (screenshots, GIFs) for interaction-heavy features.
- Keep docs in sync with the code — update docs in the same PR as code changes.

## Current State

**`README.md` at the project root exists but is empty (0 bytes).** No user-facing or contributor docs currently exist anywhere in the repo — this `docs/` workspace is new as of the CONTEXT.md scaffold retrofit (2026-07-20) and has no content yet.

## Document Types and Audiences

### User Guide
- **Audience:** End users of the note app (not developers)
- **Tone:** Friendly, task-oriented. Show, don't tell.
- **Structure:** Organized by task, not by feature (e.g. "Tagging your notes," "Using guest mode," "Syncing across devices")
- **Location:** `docs/user-guide/` (not yet created)

### API / Technical Reference
- **Audience:** Contributors and future developers (currently: future-you)
- **Tone:** Technical, precise
- **Structure:** TBD — likely mirrors `src/CONTEXT.md`'s code structure once there's enough surface area to warrant a separate reference from the CONTEXT files
- **Location:** `docs/reference/` (not yet created)

### Changelog
- **Audience:** Users and contributors
- **Format:** Keep a Changelog (keepachangelog.com) format
- **Group by:** Added, Changed, Fixed, Removed
- **Location:** `docs/CHANGELOG.md` (not yet created — git log is currently the only changelog)

## How Docs Relate to Code

- Nothing is currently enforced — no docs exist to drift out of sync yet. When a `README.md` or user guide is written, prioritize keeping the **sync/merge behavior** and **guest mode semantics** accurate, since those are the parts most likely to confuse users if undocumented (e.g. "why did my guest notes disappear" → merge/discard dialog explanation).

## Skills

Skills relevant when working on documentation in this workspace.

- **`doc-authoring-skill`** — Invoke when writing or updating user-facing documentation
