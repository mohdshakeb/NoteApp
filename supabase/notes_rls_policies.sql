-- Row Level Security policies for the `notes` table (Supabase/Postgres)
--
-- Purpose: this file is a versioned, reviewable record of the access-control
-- policies that are supposed to be enforced on the shared Supabase project
-- backing both NoteApp (web) and NoteAppAndroid. Until now these policies
-- existed only inside the Supabase dashboard/SQL editor, with no copy in
-- either repo -- nobody could diff, review, or restore them from source
-- control. `ops/CONTEXT.md` documents the intended behavior as: "users can
-- only access rows where `user_id` matches their own id." This file encodes
-- that as actual SQL.
--
-- IMPORTANT -- before relying on this file:
-- It was written from that documentation, not by reading the live policies --
-- no Supabase credentials were available in the session that authored it.
-- Before treating this as authoritative:
--   1. Open the Supabase dashboard -> Authentication -> Policies (or run
--      `select * from pg_policies where tablename = 'notes';` in the SQL
--      editor) and compare against what's below.
--   2. If they already match: you're done, and this file is now the source
--      of truth for future review -- keep it in sync going forward instead
--      of editing policies only in the dashboard.
--   3. If they differ: update THIS file to match production first. Don't
--      run this against a database that already has differently-named
--      policies on `notes` -- you'll get duplicate-policy errors, or
--      silently change behavior if names happen to collide.
--
-- Assumes: `notes.user_id` is a uuid column referencing `auth.users.id`, and
-- every row belongs to exactly one user (no shared/collaborative notes as of
-- this writing).

alter table public.notes enable row level security;

create policy "Users can view their own notes"
  on public.notes for select
  using (auth.uid() = user_id);

create policy "Users can insert their own notes"
  on public.notes for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own notes"
  on public.notes for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their own notes"
  on public.notes for delete
  using (auth.uid() = user_id);
