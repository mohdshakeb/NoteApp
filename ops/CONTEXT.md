# Operations Context — NoteApp

## Infrastructure

- **Platform:** Vercel (Next.js Node.js runtime — static export is NOT used, so this only works if/when server-side routes are added; currently the app is 100% client components, but the runtime choice keeps that door open)
- **Backend:** Supabase — Postgres (`notes` table) + Auth (Google OAuth, magic-link email). Row Level Security (RLS) enforced at the database level: users can only access rows where `user_id` matches their own id.
- **Build system:** Next.js built-in build (`next build`), no custom webpack/turbopack config
- **CI/CD:** None configured currently — deploys are presumably manual via Vercel's git integration or `vercel` CLI (not verified in-repo; `vercel.json` exists but contains no CI pipeline definition)
- **Signing:** N/A (web app, not native)

## Security Posture (`next.config.js`)

- **CSP:** `default-src 'self'`; scripts/styles allow `'unsafe-inline'` + `'unsafe-eval'` (needed for current tooling — tighten if possible later); `connect-src` whitelists `https://*.supabase.co` and `wss://*.supabase.co`
- **HSTS:** `max-age=63072000; includeSubDomains; preload`
- **X-Frame-Options:** `DENY` (clickjacking protection)
- **X-Content-Type-Options:** `nosniff`
- **Referrer-Policy:** `strict-origin-when-cross-origin`

## Deploy Process

### Development
1. `npm run dev` — starts Next.js dev server on `http://localhost:3000`
2. Requires `.env.local` with `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. IndexedDB state is per-browser-profile — clear via DevTools → Application → IndexedDB → `notes-app` if testing migration/merge flows from a clean slate

### Release Build
1. `npm run build` — production build
2. `npm start` — serve the production build locally to sanity-check before pushing
3. Push to the branch Vercel is tracking (git-integration deploy) — no separate manual deploy step observed in-repo

### Pre-release Checklist
- All tests pass — **N/A currently, no test suite exists** (see `src/CONTEXT.md` Testing Requirements). Manual QA is load-bearing until that changes.
- Manual test of core user flow: create note as guest → sign in → merge dialog → verify sync → sign out → verify guest/local state is clean
- Test offline → online transition (airplane mode or DevTools network throttling) to confirm `pending` notes sync correctly
- No debug flags or stray `console.log` left in sync-critical paths (`db.js` has several commented-out `console.log` calls already — keep them commented or remove, don't reintroduce active ones in hot paths)
- Update `docs/CHANGELOG.md` (once it exists — currently no changelog is maintained)

## Runbook Conventions

- Runbooks go in `ops/runbooks/`
- Each runbook covers one operational task
- Format: numbered steps, no ambiguity, copy-pasteable commands
- Include a "Verify" step at the end of every runbook

### Existing Runbooks

- [`seed-scale-test-notes.md`](runbooks/seed-scale-test-notes.md) — seeds ~100 demo
  notes across two years into `shakebdesign@gmail.com` (a real, permanent account
  used for scale-testing `TimelineRail`/`TagsRail`/`NotebookFeed`, not a throwaway).
  Script: `ops/seed-notes.mjs`. Auths as the real user via a captured magic-link
  session — no service-role key involved, inserts go through normal RLS.

## Monitoring

- **None currently configured** — no error tracking (Sentry etc.), no analytics, no uptime monitoring observed in the repo. If sync failures or auth errors happen in production today, the only visibility is whatever `console.error`/`console.warn` calls in `db.js` and `AuthContext.js` produce, which nobody is watching.
- Worth prioritizing before the app has meaningful user count, given how easy it'd be for a sync bug to silently drop notes.

## Skills

Skills relevant when working on operations in this workspace.

- **`vercel:deployments-cicd`** — deploy, promote, rollback, inspect deployments
- **`vercel:env-vars`** — managing `NEXT_PUBLIC_SUPABASE_*` env vars across environments
