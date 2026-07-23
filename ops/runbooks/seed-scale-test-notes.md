# Runbook: Seed Scale-Test Notes

Populates `shakebdesign@gmail.com` (a real, permanent account — not a throwaway) with
~100 demo notes spread bursty-style across the last two years, for testing
`TimelineRail`, `TagsRail`, and `NotebookFeed` at scale. Uses `ops/seed-notes.mjs`.

The script authenticates as the target user via a real session (magic-link
sign-in), then inserts through the same authenticated code path `saveNote()`
uses in `src/lib/db.js` — so Row Level Security applies exactly as it would
for a real user, nothing is bypassed.

## Steps

1. In the app (local dev or deployed), open the login dropdown and sign in with
   `shakebdesign@gmail.com` via "Email Login" (magic link). Click the link from
   the inbox to complete sign-in in the browser.
2. With that browser tab open and signed in, open DevTools → Application →
   Local Storage → the app's origin. Find the key shaped like
   `sb-<project-ref>-auth-token` and open its JSON value.
3. Copy the `access_token` and `refresh_token` fields out of that JSON.
4. Run the script from the repo root, passing the tokens as env vars alongside
   the existing `.env.local` (which already has the public Supabase URL/anon key):

   ```bash
   SEED_ACCESS_TOKEN=<access_token> SEED_REFRESH_TOKEN=<refresh_token> \
     node --env-file=.env.local ops/seed-notes.mjs
   ```

5. The script logs progress per batch of 20 and aborts immediately if the
   authenticated session's email doesn't match `shakebdesign@gmail.com` —
   this guards against accidentally seeding the wrong account.

## Verify

- Script's final log line reports the total note count for the account
  (should be however many notes existed before the run, plus 100).
- Sign in to the app as `shakebdesign@gmail.com` and confirm:
  - `TimelineRail` shows entries spanning back roughly two years, with visible
    gaps between clusters (not one note every few days uniformly).
  - `TagsRail` shows a mix of frequently reused tags (`#design`, `#craft`,
    `#reflection`, etc.) and several one-off tags.
  - Note lengths in the feed visibly vary from single-line fragments to full
    paragraphs.

## Notes

- Re-running the script inserts another 100 notes on top of whatever already
  exists — it does not check for or clear prior seed data. Only re-run
  intentionally.
- Tokens are only ever passed as ad-hoc env vars on the command line, never
  written to `.env.local` or any tracked file.
