// Single canonical source for URL extraction from raw note text.
// Mirrors lib/tags.js's conventions: fresh RegExp per call (never a shared
// module-level `/g` instance — lastIndex state would silently corrupt
// results across repeated calls), pure/stateless, {url, start, end} matches.
//
// Only http://, https://, and www. prefixes match — deliberately no
// bare-domain matching (e.g. "example.com"), which would false-positive on
// version strings and filenames.

const LINK_PATTERN_SOURCE = '(?:https?://|www\\.)\\S+';
const TRAILING_TRIM_CHARS = ".,;:!?)]}'\"";
const CLOSERS = { ')': '(', ']': '[', '}': '{' };

export function findLinkMatches(text) {
    const regex = new RegExp(LINK_PATTERN_SOURCE, 'gi');
    const matches = [];
    let match;
    while ((match = regex.exec(text)) !== null) {
        const start = match.index;
        let end = start + match[0].length;

        // Trim trailing punctuation not meant to be part of the URL (e.g.
        // "see https://x.com." shouldn't swallow the period). Closing
        // brackets/parens are only trimmed if unbalanced within the match,
        // so URLs with parens in the path (Wikipedia-style) survive.
        while (end > start && TRAILING_TRIM_CHARS.includes(text[end - 1])) {
            const ch = text[end - 1];
            const opener = CLOSERS[ch];
            if (opener) {
                const soFar = text.slice(start, end - 1);
                const opens = soFar.split(opener).length - 1;
                const closes = soFar.split(ch).length - 1;
                if (opens > closes) break;
            }
            end -= 1;
        }

        if (end <= start) continue;
        matches.push({ url: text.slice(start, end), start, end });
    }
    return matches;
}
