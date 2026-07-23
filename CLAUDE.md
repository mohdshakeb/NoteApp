# NoteApp

NoteApp — an offline-first, real-time note-taking app with hashtag-based tagging, timeline navigation, guest mode, and Supabase-backed cloud sync for authenticated users.

## Tech Stack
- Frontend: Next.js (App Router, all client components), React 18
- Editor: Tiptap / ProseMirror (custom `TagHighlight` decoration plugin)
- Storage: IndexedDB (`idb`) local-first + Supabase (Postgres) cloud sync
- Auth: Supabase Auth — Google OAuth + magic-link email
- Styling: Tailwind CSS + Radix UI (shadcn-style components)
- Deploy: Vercel

## Workspaces
- /Planning — What the app is, priorities, architecture principles, decisions log
- /src — Application code, patterns, known issues, dev task recipes
- /docs — User-facing & reference documentation (currently empty — see docs/CONTEXT.md)
- /ops — Infra, security posture, deploy process, monitoring

## Routing
| Task | Go to | Read | Skills |
|------|-------|------|--------|
| Spec a feature | /Planning | CONTEXT.md | — |
| Write code | /src | CONTEXT.md | testing-skill |
| Build UI / frontend | /src | CONTEXT.md | emil-design-eng, impeccable, interface-design, ui-skills |
| Write docs | /docs | CONTEXT.md | doc-authoring-skill |
| Deploy or debug | /ops | CONTEXT.md | — |

## Rules
- CONTEXT.md files are living documents. Always update the relevant CONTEXT.md when making decisions, adding features, changing patterns, or shifting priorities. Do this before finishing the task.
- When doing any UI work, load and apply all four UI design skills: `emil-design-eng`, `impeccable`, `interface-design`, and `ui-skills`.
- Before trusting an architectural claim in any CONTEXT.md, spot-check it against the actual source — this repo's docs drifted from the code once already (tag regex, OAuth providers, sort order — see `src/CONTEXT.md` Known Issues) before being caught and corrected on 2026-07-20.
