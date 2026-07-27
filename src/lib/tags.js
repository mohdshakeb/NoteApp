// Single canonical source for "#tag" extraction from raw note text.
// Canonical rule (matches TagHighlight.js's original inline-highlight regex —
// chosen because it's what the user visually sees highlighted while typing,
// so it already defines their mental model of "what counts as a tag"):
//   '#' + word chars/hyphens, anchored to start-of-text or preceding
//   whitespace (so "foo#bar" is NOT a tag, but "#to-do" is).
//
// Do not add a 4th extraction regex — see lib/tagMatch.js's header comment,
// a deliberately separate concern this file is the fix for.

const TAG_PATTERN_SOURCE = '(?:^|\\s)(#[\\w-]+)';

// Fresh RegExp per call, NOT a shared module-level instance — a `/g` regex
// carries `lastIndex` state across calls, which would silently corrupt
// results when this is called repeatedly in a loop (e.g. once per note in
// useTags.js). This is the single highest-risk detail in this file.
export function findTagMatches(text) {
  const regex = new RegExp(TAG_PATTERN_SOURCE, 'g');
  const matches = [];
  let match;
  while ((match = regex.exec(text)) !== null) {
    const matchText = match[1];
    const start = match.index + match[0].indexOf(matchText);
    const end = start + matchText.length;
    matches.push({ tag: matchText.slice(1), start, end });
  }
  return matches;
}

export function extractUniqueTags(text) {
  const seen = new Set();
  for (const { tag } of findTagMatches(text)) seen.add(tag);
  return Array.from(seen);
}
