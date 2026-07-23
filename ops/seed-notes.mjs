// One-off scale-test seed script — inserts ~100 demo notes across the last two years
// into a real Supabase account (shakebdesign@gmail.com), through the same authenticated
// insert path the app itself uses (so RLS applies normally, nothing bypasses it).
//
// Usage:
//   1. Sign in to the app as shakebdesign@gmail.com via the magic-link email.
//   2. In the browser, open DevTools -> Application -> Local Storage -> your app's origin,
//      find the key like `sb-<project-ref>-auth-token`, and copy `access_token` + `refresh_token`
//      out of its JSON value.
//   3. Run:
//        SEED_ACCESS_TOKEN=<access_token> SEED_REFRESH_TOKEN=<refresh_token> \
//        node --env-file=.env.local ops/seed-notes.mjs
//
// Safety: the script verifies the authenticated session's email matches EXPECTED_EMAIL
// before inserting anything, and aborts otherwise.

import { createClient } from '@supabase/supabase-js';

const EXPECTED_EMAIL = 'shakebdesign@gmail.com';
const NOTE_COUNT = 100;
const YEARS_BACK = 2;
const BATCH_SIZE = 20;

const SHORT_QUOTES = [
  ['"Design is not just what it looks like and feels like. Design is how it works." — Steve Jobs', ['design']],
  ['"Simplicity is the ultimate sophistication." — Leonardo da Vinci', ['design']],
  ['"Good design is as little design as possible." — Dieter Rams', ['craft']],
  ['"Less, but better." — Dieter Rams', ['design']],
  ['"The details are not the details. They make the design." — Charles Eames', ['craft']],
  ['"Design is intelligence made visible." — Alina Wheeler', ['design']],
  ['"Design creates culture. Culture shapes values. Values determine the future." — Robert L. Peters', ['design']],
  ['"Good design is obvious. Great design is transparent." — Joe Sparano', ['craft']],
  ['"Design is a plan for arranging elements to accomplish a purpose in the best possible way." — Charles Eames', ['process']],
  ['"Design is thinking made visual." — Saul Bass', ['design']],
  ['"Style is a simple way of saying complicated things." — Jean Cocteau', ['inspiration']],
  ['"Design is the silent ambassador of your brand." — Paul Rand', ['design']],
  ['"Whatever is well conceived is clearly said." — Nicolas Boileau', ['craft']],
];

const SHORT_ORIGINAL = [
  ["Whitespace is not empty — it's doing work.", ['design', 'craft']],
  ['The best interface is the one you stop noticing after a week.', ['ux']],
  ["Constraints aren't the enemy of creativity, they're the shape of it.", ['ideas']],
  ['A good tag system disappears into the background until you need it.', ['design', 'ux']],
  ['Every deleted line is a decision, not a loss.', ['craft']],
  ['Naming things is still the hardest part.', ['naming']],
  ['Ship the small thing, learn, then ship the next small thing.', ['process']],
  ["Dark mode isn't a palette swap, it's a whole second design pass.", ['design']],
  ['Todo: fewer options, better defaults.', ['productivity']],
  ["The first draft's only job is to exist.", ['writing']],
  ["Good typography is invisible until it's wrong.", ['typography']],
  ["Most 'quick fixes' are just debt with a due date.", ['reminder']],
];

const MEDIUM = [
  ['Been thinking about the onboarding flow — maybe the very first note IS the tutorial, instead of a separate walkthrough screen.', ['onboarding', 'ideas']],
  ['Meeting notes: walked through the new tag color system, landed on reusing the existing 8-hue palette instead of introducing new colors.', ['meeting', 'design']],
  ["Reminder to revisit the timeline rail — it starts to feel cramped once there's more than a year of notes in it.", ['reminder', 'ux']],
  ['Reading through old sketches today. Funny how the very first version of this app had no tags at all, just a flat list.', ['reflection']],
  ['Idea: what if a keyboard shortcut jumped straight to today\'s note instead of scrolling the whole feed? Worth prototyping.', ['ideas', 'productivity', 'shortcuts']],
  ['Quick reading note: a good interface is one you stop noticing after the first week. That\'s the actual bar to hit.', ['reading', 'craft']],
  ["Todo: check contrast ratio on the dark theme tag pills, a couple of the muted colors feel too close to the background.", ['todo', 'accessibility']],
  ["Catching up on notes from the last two weeks — there's a clear pattern of writing more on Sunday nights than any other day.", ['reflection']],
  ['Idea for the tag cloud: size by recency-weighted frequency, not just raw count, so stale tags fade instead of dominating.', ['ideas', 'design']],
  ['Meeting recap: decided against a settings page for now — every setting on the list was solving a problem fewer than five people would hit.', ['meeting', 'process']],
  ['Reading notes from a talk on craft: the gap between "good" and "great" is almost entirely in the parts nobody asked for.', ['reading', 'craft']],
  ["Idea: a 'quiet mode' that just hides the tag rail and timeline for a day when you want zero navigation, only writing.", ['ideas', 'ux']],
  ['Todo: write a proper empty state for the tag filter — right now it just shows a blank feed with no explanation.', ['todo', 'ux']],
  ["Reflection: most of this month's changes were removals, not additions. That felt better than it should have.", ['reflection', 'craft']],
  ['Meeting notes: agreed the merge-on-sign-in flow needs a preview step before committing guest notes to the account.', ['meeting', 'process']],
  ['Idea: let tags have optional colors you set yourself, falling back to the deterministic hash palette otherwise.', ['ideas', 'design']],
  ['Reading note: "the notebook is the thinking, not a record of it" — worth keeping in mind for how this app frames itself.', ['reading', 'reflection']],
  ['Todo: audit every place a date gets formatted, there were at least two different formats floating around last time I checked.', ['todo', 'process']],
  ['Idea: a lightweight weekly digest — just a count of notes and top tags, nothing fancier than that.', ['ideas', 'productivity']],
  ['Meeting recap: shipped the new mobile drawer, but the animation timing still feels a beat too slow on older phones.', ['meeting', 'ux']],
  ['Reflection: the hardest bugs this year were never in the editor, they were always in the sync merge logic.', ['reflection', 'process']],
  ['Todo: add a proper loading skeleton for the tag rail instead of the current blank flash.', ['todo', 'ux']],
  ['Idea: let the timeline rail collapse by year once there are more than a couple years of history in it.', ['ideas', 'design']],
  ['Reading note: constraints-first design keeps producing better defaults than feature-first design ever has here.', ['reading', 'design']],
  ['Meeting notes: discussed dropping the second onboarding note entirely — one welcome note plus a tag tip covers it.', ['meeting', 'onboarding']],
  ['Todo: double check tag extraction handles emoji-adjacent hashtags without breaking the regex.', ['todo', 'craft']],
  ['Reflection: writing this app has quietly become the best argument for keeping tools small and personal.', ['reflection'], ],
  ['Idea: a "today" jump button pinned near the compose area, separate from the general timeline scroll.', ['ideas', 'shortcuts']],
  ['Reading notes: revisited an old talk on progressive disclosure — most of it still applies directly to the tag navigator.', ['reading', 'ux']],
  ['Meeting recap: agreed to leave the merge toast copy alone for now, it tested fine and nobody had a strong opinion either way.', ['meeting', 'feedback']],
];

const LONG = [
  ['Spent the afternoon thinking through the local-first sync model again. The core idea still holds up: mutate local state optimistically, let the network catch up in the background, and treat IndexedDB as the source of truth when offline. What keeps tripping people up is the merge step — deciding what happens when a "synced" local note and a remote note disagree. The current answer (trust pending local, trust remote otherwise, keep orphaned local notes rather than assume a delete) feels conservative in the right direction. Losing a note silently is so much worse than showing a stale one.', ['reflection', 'process', 'craft']],
  ['Long reading session on typography today. The chapter on optical sizing stuck with me most — the idea that the "same" typeface needs different proportions at different sizes to read as consistent, not just scaled versions of one master. It\'s a good reminder that a lot of "consistency" in interfaces is actually a felt consistency, not a literal one.\n\nWorth revisiting when the note editor\'s font sizing comes up again.', ['reading', 'typography', 'design']],
  ["Retro on this quarter: the biggest win wasn't a feature, it was deleting three dead components (Auth.js, LoginModal.jsx, MergeDialog.jsx) that had quietly been sitting unused for months. Nobody remembered why they were kept around. The lesson isn't really about those specific files, it's that unused code has a real cost even when it's not running — it's extra surface area every time someone tries to understand how auth actually works.", ['reflection', 'process']],
  ['Brainstorm dump, unfiltered: a command palette for jumping between tags, a way to pin a note to the top regardless of date, an export-to-markdown button, a "on this day" surface that resurfaces notes from exactly a year ago, read-only public share links for a single note. Not all of these are good ideas. Some of them are probably bad ideas. But writing them all down in one place beats losing them in five different half-remembered conversations.', ['ideas', 'productivity']],
  ["Today's bug was a good one. Notes were occasionally showing up twice after coming back online — turned out the merge logic in getNotes() was keying by note id, but a note that failed its first sync attempt and got retried had picked up a new id from Supabase while the old temp id was still sitting in IndexedDB. Two ids, same note, both surviving the merge. Fixed by making sure the old temp-id row gets deleted the moment the real id comes back from the insert, not just updated in place.", ['craft', 'reflection']],
  ['Been sketching what a "two years in" version of this app should feel like, assuming people actually stick around that long. The timeline rail is the part that worries me most at that scale — it currently renders as one continuous list, and two years of daily notes is a lot of DOM nodes for a sidebar that\'s supposed to be lightweight. Grouping by year with collapsible sections seems like the obvious first move, but I want to see it actually get slow before adding that complexity.', ['reflection', 'ux', 'design']],
  ["Notes from a longer conversation about onboarding: the instinct is always to add more explanation, more tooltips, more first-run walkthroughs. But every one of those is one more thing standing between someone opening the app and actually writing something. The current three-note welcome sequence might already be one note too many. Worth testing a version with just a single note that demonstrates a tag inline, nothing else.", ['meeting', 'onboarding', 'ux']],
  ['Reading through some very old notes from early on in this project. The tone is noticeably more uncertain — a lot of "maybe try" and "not sure if this is right" that mostly disappeared later. Not sure if that means more confidence now or just less self-awareness. Possibly both. Either way it was a nice reminder that the early, messy version of an idea is usually worth keeping around somewhere, even after it\'s been replaced.', ['reflection', 'writing']],
  ["Spent some time today just reading about deliberately constrained tools — text editors that refuse to add a sidebar, note apps that cap you at one font. There's something to the idea that a tool's limitations are part of what gives it a personality, not just a list of missing features. Doesn't mean every constraint is a good one, but it's a useful lens before adding the next toggle or setting.", ['reading', 'design', 'craft']],
  ['Project retrospective on the auth rework: moving from a single LoginModal to the LoginDropdown with both Google OAuth and magic-link email took longer than expected, mostly because of edge cases around guest data migration. What made it worth it: users who start as guests and later sign in no longer lose their notes in the handoff, which was quietly the most common support-shaped complaint before the change.', ['reflection', 'process', 'craft']],
  ["Thinking about the difference between a note-taking app and a journal. This one keeps drifting toward journal territory — dated entries, no folders, no titles — and that's probably fine, maybe even the right instinct, since forcing structure onto every fragment of thought was never really the goal here.", ['reflection', 'design']],
  ["Went back through the tag regex split-brain issue today. useTags.js and TagHighlight.js disagree on what counts as a tag — one allows hyphens, the other doesn't, and neither handles a hashtag glued directly to another word the same way. Small inconsistency, but the kind that quietly erodes trust in a tagging feature once someone hits it.", ['craft', 'process']],
  ["Long overdue thought: the merge toast that appears after signing in with existing guest notes is doing a lot of quiet, important work. It's the one moment where someone could lose data if the logic gets it wrong, and also the one moment almost nobody will ever screenshot or complain about if it goes right.", ['reflection', 'ux']],
  ["Reading notes from a chapter on 'boring technology' — the argument that picking unglamorous, well-understood tools for the unglamorous 80% of a system frees up your actual innovation budget for the 20% that matters. IndexedDB plus Postgres is about as boring as local-first sync gets, and that's exactly the point.", ['reading', 'process']],
  ["Retro on the timeline rail: it started as a simple list of dates, then grew month grouping, then a scrollbar affordance, then hover states. None of those additions were wrong on their own, but stacked together the component is heavier than it looks from the outside. Worth a pass just to simplify, not to add anything.", ['reflection', 'craft']],
  ["Idea dump from a walk: a way to pin exactly one note per day as the 'main' one, a compact view that only shows first lines instead of full text, an optional streak counter that stays out of the way unless you ask for it. Probably shipping none of these soon, but good to have written down.", ['ideas']],
  ["Notes from debugging a stubborn sync issue: the fix ended up being one line, but finding it took most of an afternoon of adding console logs, removing them, adding them back in a different order, and finally just reading the merge function slowly, out loud, line by line. Slow reading beats clever debugging more often than it should.", ['craft', 'reflection']],
  ["Project update: guest mode has quietly become one of the most-used entry points into the app, more than sign-in-first ever was. Makes sense in hindsight — nobody wants to create an account before they've even decided if a tool is worth using. Worth protecting that path as carefully as the authenticated one.", ['reflection', 'process']],
  ["Reading through an old design crit thread from a few months back. A lot of the feedback that felt harsh in the moment turned out to be exactly right in retrospect, and a lot of the feedback that felt validating at the time didn't age as well. Not a clean pattern, but a useful reminder to sit with critique before reacting to it.", ['reading', 'reflection']],
  ["Thinking through what 'done' means for a note-taking app that's meant to be used for years, not finished and shipped once. There's no version 1.0 moment here, just a long series of small corrections. That's a different kind of craft than shipping a fixed feature — closer to maintaining a garden than building a house.", ['reflection', 'craft', 'design']],
  ["Meeting recap from the security pass: added the CSP headers, tightened the referrer policy, made sign-out actually clear tokens instead of just redirecting. None of it is visible to a user in the normal flow, which is exactly how good security work usually looks — invisible until the day it isn't.", ['meeting', 'process']],
  ["Idea: what if empty states across the app all shared one small, consistent illustration style instead of each being designed ad hoc? Right now every blank state — no notes, no tags, no results — looks like it was made by a slightly different person on a slightly different day.", ['ideas', 'design']],
  ["Reading notes on progressive disclosure again, this time thinking specifically about the tag navigator's prev/next controls. They only appear once you're filtering by a tag, which is the right call, but the transition in and out could be smoother than the current instant show/hide.", ['reading', 'ux']],
  ["Retro on choosing Tiptap over a plain textarea: the custom TagHighlight decoration plugin took longer to get right than expected, especially reconciling it with the placeholder extension, but plain inline highlighting without a full rich-text editor would have been its own kind of complexity, just hidden instead of visible.", ['reflection', 'craft']],
  ["Brainstorm: a 'quiet Sunday' feature that surfaces a few random old notes from at least six months ago, no algorithm beyond that, just resurfacing forgotten fragments on a low-stakes day. Feels more in line with this app's spirit than anything algorithmic or engagement-driven.", ['ideas', 'reflection']],
  ["Notes from reading about deterministic hashing for color assignment — the exact approach used for tag colors here, which is nice because it means the same tag always gets the same color without storing it anywhere, but it also means a bad hash distribution could cluster too many tags into the same one or two hues.", ['reading', 'craft', 'design']],
  ["Project update: two years of notes now exist for the test account, spanning gaps of a few quiet weeks and a couple of unusually dense stretches. It's a much better way to sanity check the timeline and tag rail than staring at three sample notes ever was.", ['reflection', 'process']],
  ["Meeting notes: discussed whether to add folders or notebooks as an organizing layer above tags. Landed on no, at least for now — the entire pitch of this app is that a flat list plus tags is enough structure, and folders would be the first real step away from that. Revisit if tags alone start failing at scale.", ['meeting', 'design', 'process']],
  ["Reading through some early user feedback again. The single most repeated request wasn't a feature at all, it was 'make the first load faster' — a good reminder that performance work rarely feels as exciting to build as a new feature, but it's often the thing people actually notice most.", ['reading', 'reflection']],
  ["Idea: a small, optional 'on this day' surface showing notes from exactly one year and exactly two years ago, tucked away rather than pushed to the front. Could be a nice quiet payoff for exactly the kind of long-term use this seed data is meant to simulate.", ['ideas', 'reflection']],
];

const VERY_SHORT = [
  'Ship it.',
  "Ugh, naming things.",
  'New tag milestone: #launch 🎉',
  'Note to self: sleep on this before deciding.',
  'Check dark mode contrast.',
  "That's the whole idea, really.",
  'Coffee first, then code.',
  'Revisit this in a month.',
  'Good enough for v1.',
  'Small win today.',
  'Still thinking about this one.',
  'Worth a second look tomorrow.',
  'Not today.',
  'Filed under: later.',
  'Simple beats clever, again.',
];

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function withTags(text, tags) {
  if (!tags || tags.length === 0) return text;
  return `${text} ${tags.map((t) => `#${t}`).join(' ')}`;
}

function buildContentBank() {
  const shortEntries = [...SHORT_QUOTES, ...SHORT_ORIGINAL].map(([text, tags]) => withTags(text, tags));
  const mediumEntries = MEDIUM.map(([text, tags]) => withTags(text, tags));
  const longEntries = LONG.map(([text, tags]) => withTags(text, tags));
  // A couple of very-short fragments get an extra rare tag for texture; rest stay bare.
  const veryShortEntries = VERY_SHORT.map((text, i) => (i % 5 === 0 ? withTags(text, ['reminder']) : text));

  const bank = [...shortEntries, ...mediumEntries, ...longEntries, ...veryShortEntries];
  if (bank.length !== NOTE_COUNT) {
    throw new Error(`Content bank has ${bank.length} entries, expected ${NOTE_COUNT}`);
  }
  return shuffle(bank);
}

function generateBurstyDates(count, startDate, endDate) {
  const totalDays = (endDate.getTime() - startDate.getTime()) / 86400000;
  const numSegments = 16;
  const segmentSize = totalDays / numSegments;

  const clusterCenters = [];
  for (let i = 0; i < numSegments; i++) {
    if (Math.random() < 0.25) continue; // leave some segments empty -> real gaps
    const segStart = i * segmentSize;
    clusterCenters.push(segStart + Math.random() * segmentSize);
  }
  if (clusterCenters.length === 0) clusterCenters.push(totalDays / 2);

  const weights = clusterCenters.map(() => 0.3 + Math.random());
  const weightSum = weights.reduce((a, b) => a + b, 0);
  const counts = weights.map((w) => Math.max(1, Math.round((w / weightSum) * count)));

  let diff = count - counts.reduce((a, b) => a + b, 0);
  let idx = 0;
  while (diff !== 0) {
    counts[idx % counts.length] += diff > 0 ? 1 : -1;
    diff += diff > 0 ? -1 : 1;
    idx++;
  }

  const dates = [];
  clusterCenters.forEach((center, i) => {
    const spread = 1 + Math.random() * 6;
    for (let j = 0; j < counts[i]; j++) {
      const dayOffset = Math.min(Math.max(center + (Math.random() - 0.5) * 2 * spread, 0), totalDays - 0.001);
      const date = new Date(startDate.getTime() + dayOffset * 86400000);
      date.setHours(Math.floor(Math.random() * 24), Math.floor(Math.random() * 60), Math.floor(Math.random() * 60), 0);
      dates.push(date);
    }
  });

  return dates.sort((a, b) => a - b);
}

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const accessToken = process.env.SEED_ACCESS_TOKEN;
  const refreshToken = process.env.SEED_REFRESH_TOKEN;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY — run with `node --env-file=.env.local ops/seed-notes.mjs`');
  }
  if (!accessToken || !refreshToken) {
    throw new Error('Missing SEED_ACCESS_TOKEN / SEED_REFRESH_TOKEN env vars — copy these from the browser session after signing in as ' + EXPECTED_EMAIL);
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  const { error: sessionError } = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });
  if (sessionError) throw sessionError;

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;

  if (userData.user.email !== EXPECTED_EMAIL) {
    throw new Error(`Refusing to seed: session belongs to "${userData.user.email}", expected "${EXPECTED_EMAIL}".`);
  }

  console.log(`Authenticated as ${userData.user.email} (${userData.user.id})`);

  const endDate = new Date();
  const startDate = new Date(endDate);
  startDate.setFullYear(startDate.getFullYear() - YEARS_BACK);

  const contentBank = buildContentBank();
  const dates = generateBurstyDates(NOTE_COUNT, startDate, endDate);

  const notes = contentBank.map((content, i) => ({
    content,
    user_id: userData.user.id,
    created_at: dates[i].toISOString(),
    updated_at: dates[i].toISOString(),
  }));

  console.log(`Prepared ${notes.length} notes spanning ${dates[0].toDateString()} -> ${dates[dates.length - 1].toDateString()}`);

  let inserted = 0;
  for (let i = 0; i < notes.length; i += BATCH_SIZE) {
    const batch = notes.slice(i, i + BATCH_SIZE);
    const { error } = await supabase.from('notes').insert(batch);
    if (error) {
      console.error(`Batch ${i / BATCH_SIZE + 1} failed:`, error);
      throw error;
    }
    inserted += batch.length;
    console.log(`Inserted ${inserted}/${notes.length}`);
    await new Promise((r) => setTimeout(r, 250));
  }

  const { count, error: countError } = await supabase
    .from('notes')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userData.user.id);

  if (countError) throw countError;

  console.log(`Done. ${count} total notes now exist for ${userData.user.email}.`);
}

main().catch((err) => {
  console.error('Seed script failed:', err);
  process.exit(1);
});
