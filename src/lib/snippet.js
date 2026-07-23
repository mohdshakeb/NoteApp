// Extracts a single-line snippet centered on the first occurrence of `query`
// within `content` (plain text, per TiptapEditor's getText() save format).
export function extractSnippet(content, query, radius = 60) {
    const flat = content.replace(/\s+/g, ' ').trim();
    const idx = flat.toLowerCase().indexOf(query.toLowerCase());

    if (idx === -1) return flat.slice(0, radius * 2);

    const start = Math.max(0, idx - radius);
    const end = Math.min(flat.length, idx + query.length + radius);

    return (start > 0 ? '…' : '') + flat.slice(start, end) + (end < flat.length ? '…' : '');
}
