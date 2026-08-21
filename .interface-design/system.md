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
exact), same rule: don't add a second accent color.

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

Poppins (`next/font/google`, weights 400/500/600/700 — `src/app/layout.js`), applied via `font-sans`
everywhere; `font-mono` no longer appears anywhere in `src/`. Real scale in actual use (verified via
grep, 2026-08-21 — only roles with real call sites are listed, nothing speculative):

- `text-xs` (12px) — meta/counter text: result counts, date labels, tag-navigator's "i / N".
- `text-sm` (14px) — the base UI/chrome size, and the note body itself (`TiptapEditor`/
  `StaticNotePreview`). The dominant role by far.
- `text-lg font-semibold` (18px) — full sheet titles only (`MobileDrawers`' "Timeline"/"Tags"
  header). Not used for anything smaller/incidental — don't reach for this role for a dropdown or
  inline header, see Android's `Type.kt` `titleMedium` comment for the same "genuine full sheet
  titles only" boundary it drew for the same role.

No `text-base`/`text-xl`+ roles exist yet in either app's real usage — don't invent them speculatively
(same "don't spec what isn't built" principle Android's Shape/Motion sections already state).

## Shape

`--radius: 0rem` (`globals.css`). Android's system.md independently confirmed this was accidental (a
`calc()` clamp artifact, not a decision) and deliberately did not port it, building a real 8/12/16dp
scale instead. Web has not yet made the same call — `rounded-md`/`rounded-lg`/`rounded-sm` utilities
(`--radius`-driven) currently render as flat/sharp everywhere they're used, while `rounded-full`
(pills, unaffected by the variable) and the handful of hardcoded `rounded-xl`/`rounded-2xl`/
`rounded-t-3xl` usages (entry rows, the search panel, bottom sheets — not wired to `--radius` at all)
render their real curvature. This is a live, undecided divergence, not resolved by this pass — flag
before touching radius broadly; it's a visual-identity call of similar weight to the typography one
above, not a mechanical fix.

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
