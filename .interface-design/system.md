# Design System — NoteApp (web)

Established 2026-08-21. This system was not built from scratch — web is the *original* source the
sibling Android app (`NoteAppAndroid/.interface-design/system.md`) ported from. This file exists to
close the loop: it formalizes the *feel* and *rationale* layer for web itself, cross-checks Android's
port claims against web's actual current code (two were wrong — see Corrections below), and brings
back genuine Android refinements where they apply. Treat this file as rationale, not values — the
real numbers live in `src/app/globals.css`, `tailwind.config.js`, and `src/lib/colors.js`; don't
duplicate them here, they will drift.

## Intent

A personal notebook, not a productivity app. Calm, low-friction, gets out of the way. The
oldest→newest scroll order is itself part of the feel — fills forward like a physical notebook,
doesn't compete for attention like a reverse-chron feed. Shared verbatim with Android; this is one
product on two platforms, not two products that happen to look similar.

## Corrections to Android's port claims

Android's `Color.kt`/`TagColors.kt` comments were verified bit-for-bit accurate (every hex constant
recomputed from web's current HSL values and diffed — exact match, both themes). Two other claims in
Android's system/token files were **not** accurate against web's actual current code, not just stale
docs:

- **Typography.** `Type.kt` claimed Poppins was already "the app-wide typeface on web," citing
  `tailwind.config.js`'s `fontFamily.sans`. That value was declared but never consumed — `font-sans`
  had zero usages anywhere in `src/`; the real root layout (`src/app/layout.js`) set `font-mono` on
  `<body>`, and every component reapplied `font-mono` explicitly, with no custom font loaded (no
  `next/font`, no `@font-face`) — just Tailwind's bare system-mono fallback. Resolved 2026-08-21:
  web now actually loads Poppins via `next/font/google` (`src/app/layout.js`, weights
  400/500/600/700 matching Android's bundled set) and every former `font-mono` call site was swapped
  to `font-sans`. Poppins is now genuinely the shared typeface on both platforms.
- **Depth.** Android's system.md summarizes "Borders-only. No shadow system." Web's actual code
  disagrees: `shadow-sm/md/lg/xl/2xl` appear ~16 times, consistently on *floating chrome* — bottom
  sheets, the search/tag overlay panel, floating pills (nav pill, jump-to-latest, tag navigator,
  merge toast), popovers/dropdowns, alert dialogs. See Depth below for the real pattern; Android's
  own `FloatingChip.kt` (component patterns) independently arrived at a bordered floating shell
  without the shadow, so this is a genuine, not-yet-reconciled cross-platform gap, not a doc typo.

## Palette

shadcn/ui Zinc neutrals (`globals.css` `:root`/`.dark` HSL custom properties) — deliberately
near-monochrome so the 8-color tag palette (`src/lib/colors.js`) is the only source of color in the
app. Color always means "this is a tag," never decoration. Same palette Android ported (verified
exact), same rule: don't add a second accent color. One exception, added 2026-08-22:
`--illustration-line/fill/highlight` (`globals.css`) for `DaveIllustration.jsx` — three more neutral
tones (zinc-900/100/50 in light, zinc-950/800/50 in dark), not derived from
`--foreground`/`--background`/`--secondary` because the dark variant is a hand-recolored asset rather
than a mechanical inversion of those tokens. Still monochrome, still not a second accent — just can't
be expressed as aliases of the existing semantic tokens.

## Depth

Two distinct treatments, not one uniform strategy:

- **Content plane** (the note feed itself): flat. No card wrapping per note, no borders, no shadow.
  State is communicated entirely through background-color washes (tag/search/select highlight — see
  `NoteApp.js`'s `matchWashClass`), never elevation. This part genuinely matches Android's
  "borders-only" framing.
- **Floating chrome** (anything that sits *above* the content plane — sheets, the search/tag panel,
  pills, dropdowns, dialogs): a consistent four-part recipe — `bg-background/80` (or `/95` for the
  denser search panel) + `backdrop-blur-md` + `border border-border/50` + a shadow scaled to how
  "lifted" the element is (`shadow-lg` for pills/panels, `shadow-2xl` for full-height bottom sheets).
  This is the one deliberate glass-like elevation system in the app — see `TagNavigator.jsx`,
  `JumpToLatestPill.jsx`, `MobileNavPill.jsx`, `MergeToast.jsx`, `NoteResultsOverlay.jsx` for the
  reference implementations. Open item: Android's `FloatingChip.kt` currently ports the border half
  of this recipe but not the shadow — worth revisiting there for full parity, not changing here.

## Surfaces

One elevation step beyond the two-plane split above: `background` → `card`/`popover` (dropdown/menu
surfaces, `ui/dropdown.jsx`, `ui/alert-dialog.jsx`). Dark mode keeps `background` and `card` visually
close (`3.9%` vs implied near-equal), ported as-is — matches Android's explicit choice not to invent
a lighter dark surface that doesn't exist in web's source.

## Typography

Poppins (`next/font/google`, weights 400/500/600 — `src/app/layout.js`), applied via `font-sans`
everywhere; `font-mono` no longer appears anywhere in `src/`. Weight set trimmed to exactly what's
used (verified via grep, 2026-08-22) — 700/Bold is *not* bundled here even though Android's `Type.kt`
reserves it "for any future call site"; that's a real, deliberate difference in shipped weights
between the two apps, not an oversight. Add 700 if a web component ever actually needs it. Real scale
in actual use (verified via grep, 2026-08-21 — only roles with real call sites are listed, nothing
speculative):

- `text-xs` (12px) — meta/counter text: result counts, date labels, tag-navigator's "i / N".
- `text-sm` (14px) — the base UI/chrome size, and the note body itself (`TiptapEditor`/
  `StaticNotePreview`). The dominant role by far.
- `text-lg font-semibold` (18px) — full sheet titles only (`MobileDrawers`' "Timeline"/"Tags"
  header). Not used for anything smaller/incidental — don't reach for this role for a dropdown or
  inline header, see Android's `Type.kt` `titleMedium` comment for the same "genuine full sheet
  titles only" boundary it drew for the same role.
- `text-2xl sm:text-3xl font-semibold` (24px/30px) — added 2026-08-22 for `NotebookFeed.jsx`'s
  `FeedHeader`, the permanent tagline above the oldest note (ported from Android's `displayMedium`
  role on the same element). One call site, deliberately: a genuine hero moment, not a reusable
  heading style — don't reach for this size for section headers or anything else that isn't this
  specific one-off.

No `text-base`+ role exists yet beyond the two above — don't invent further sizes speculatively (same
"don't spec what isn't built" principle Android's Shape/Motion sections already state).

## Shape

Resolved 2026-08-22 — web now has a real, non-zero scale, matching Android's tiers exactly:
`--radius-sm: 0.5rem` (8px — inputs, chips, small buttons), `--radius-md: 0.75rem` (12px — cards,
note action sheets, dialogs), `--radius-lg: 1rem` (16px — bottom sheets' top corners, larger panels)
in `globals.css`, wired into `tailwind.config.js`'s `borderRadius.sm/md/lg`. No sharp/flat corners
anywhere on web now — the old single `--radius: 0rem` (a confirmed-accidental `calc()` clamp
artifact) is gone, along with the hardcoded `rounded-xl`/`rounded-2xl`/`rounded-t-3xl` utilities that
used to bypass it (`NotebookFeed`'s entry rows, the search panel, all three bottom sheets) — those now
read off the real `rounded-md`/`rounded-lg` tiers per the tier guide above, so their curvature
actually means something instead of being an arbitrary Tailwind stock value.

**Pill shape is reserved for full-round elements, never text-label buttons.** Circular icon buttons
(equal width/height — copy/delete/close controls), decorative dots/ticks, and floating chrome shells
(`JumpToLatestPill`, `TagNavigator`, `MobileNavPill`, `MergeToast`'s outer capsule, tag chips) keep
`rounded-full` — matches Android's own explicit choice ("full-round elements... still use CircleShape,
matching web's `rounded-full` usage — that part web already gets right," `Shape.kt`). But a
text-labeled `<Button>` rendered as an oblong capsule reads as a pill, not a button — those three
call sites (`MergeToast`'s Merge/Discard, the Login button in `NoteApp.js`) were moved to `rounded-md`.
The distinguishing test: is it a circle (equal w/h) or container shell, or is it a rectangle-with-text
stretched into a capsule? Only the latter un-pills.

## Motion

Named tokens already exist and are actively used (`globals.css` `:root`): `--ease-out`,
`--ease-in-out`, `--ease-drawer`; `--duration-fast` (150ms), `--duration-base` (200ms),
`--duration-drawer` (300ms). This is the real source Android's `Motion.kt` ported from — confirmed
still accurate, still the one set every `anim-*` class in `globals.css` draws from. Don't invent new
durations/eases inline in a component; add to this set if a genuinely new timing is needed.

## Key patterns established

- **Neutral wash for non-tag highlights** (`NoteApp.js`'s `matchWashClass`, `'select'` session mode):
  `bg-muted/90` — near-opaque, *not* a low-alpha tint like the tag/search washes. `muted` is already
  so close to `background` that diluting it further washes it out to nothing. Ported directly from
  Android's `neutralWash()` (`TagColors.kt`), which documents the identical reasoning independently.
  Use this pattern (near-full-opacity of the closest neutral token, not a diluted accent) any time a
  new "this happened, no color to key off of" state needs a background treatment.
- **Session as a single discriminated union**, not parallel booleans (`useNoteFinder.js`'s
  `session: { mode, query, matches, currentIndex }`, modes `'tag' | 'search' | 'select' | null`).
  Mutually-exclusive UI states get one state slot with a mode discriminant, not N independent flags
  that need manual cross-clearing — setting any mode wholesale-replaces whatever was active before.
- **Floating chrome recipe** — see Depth above. Reuse the four-part recipe verbatim for any new
  floating element rather than inventing a new elevation treatment.

## Component patterns

Not yet extracted on web — Android's equivalent section (`SheetActions.kt`'s
`rememberSheetCloseThen()`, `FloatingChip.kt`) was pulled from real, already-duplicated code once
enough surfaces existed to compare. Web's floating-chrome recipe above is heading the same direction
(five-plus call sites already share it) but hasn't been consolidated into a shared component yet —
worth revisiting once a sixth call site needs it, not speculatively now.
