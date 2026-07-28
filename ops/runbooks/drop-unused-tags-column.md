# Runbook: Drop Unused `tags` Column

**Executed 2026-07-28.** The `tags` column no longer exists on `notes`.
Kept below for reference/audit trail.

Removed the dead `tags` column from the Supabase `notes` table. Confirmed
dead 2026-07-27 while scoping NoteAppAndroid: no write path (`saveNote`,
`updateNote`, `syncPendingNotes`, `createDefaultNotes`) ever wrote to it, and
the one client-side read (`db.js` `getNotes()`) was removed on 2026-07-28.
Tags are computed from `content` at read time via `src/lib/tags.js` — see
`Planning/CONTEXT.md`'s "Tags are derived, never stored" principle. This
column contradicted that from day one.

Run via the Supabase Management API (`api.supabase.com`), authenticated with
a one-off Personal Access Token generated for this task and revoked
immediately after — not the SQL editor as originally planned below, but
equivalent (same two SQL statements, same safety-check-first order). The
token was never written to any tracked file.

## Steps taken

1. Safety check — did NOT return 0 as expected:
   ```sql
   select count(*) from notes where tags is not null and tags <> '{}';
   ```
   Returned `1`. Per the "stop if nonzero" rule below, this was investigated
   before proceeding: the one row was manual test data the project owner
   had entered directly (Table Editor or SQL Editor) from another account,
   very early on, before the "derive tags from content, never store them"
   design was settled — not evidence of a live write path (confirmed no
   app code path writes to this column). Owner confirmed it was safe to
   discard, so the drop proceeded.
2. Dropped the column:
   ```sql
   alter table notes drop column tags;
   ```
3. Verified via `select column_name from information_schema.columns where
   table_name = 'notes';` — result: `id, content, user_id, created_at,
   updated_at`. No `tags`.

## Original steps (for re-running this pattern on a future similar cleanup)

1. Open the Supabase dashboard for this project → SQL Editor (or use the
   Management API as done above).
2. Confirm the column is actually empty before dropping anything:
   ```sql
   select count(*) from notes where tags is not null and tags <> '{}';
   ```
   If this returns 0, proceed. If it returns anything else, stop and
   investigate what's actually in those rows before deciding — a nonzero
   count doesn't necessarily mean "don't drop," but it means the "purely
   dead" assumption needs to be confirmed against the real data first, not
   just against application code paths.
3. Drop the column:
   ```sql
   alter table notes drop column tags;
   ```

## Verify

- `select column_name from information_schema.columns where table_name = 'notes';`
  no longer lists `tags`. (Confirmed above.)
- In the app: sign in, create/edit a note with a `#tag`, confirm it still
  appears in the tag cloud, rail, and inline highlight as before (all three
  are derived from `content`, not the dropped column, so this should be a
  no-op for behavior).
