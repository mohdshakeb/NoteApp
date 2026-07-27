# NoteApp

An offline-first, real-time note-taking app with hashtag-based tagging, timeline navigation, guest mode, and Supabase-backed cloud sync for authenticated users.

## Tech Stack

- Next.js (App Router) + React 18
- Tiptap / ProseMirror editor with a custom inline `#tag` highlight plugin
- IndexedDB (local-first) + Supabase (Postgres) cloud sync
- Supabase Auth — Google OAuth + magic-link email
- Tailwind CSS + Radix UI

## Getting Started

Install dependencies:

```bash
npm install
```

Create a `.env.local` file in the project root with your Supabase project credentials:

```bash
NEXT_PUBLIC_SUPABASE_URL=your-supabase-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
```

Run the dev server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Scripts

- `npm run dev` — start the dev server
- `npm run build` — production build
- `npm run start` — run the production build
- `npm run lint` — lint the codebase

See `src/CONTEXT.md` for codebase structure, patterns, and known issues; `Planning/CONTEXT.md` for product context and architecture decisions.
