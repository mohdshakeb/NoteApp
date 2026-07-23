// Single shared source for "does this note have this tag" matching, used by
// both tag-click nav (useNoteFinder's handleTagClick) and free-text search's
// exact-#tag detection. Do not add a third tag regex — see src/CONTEXT.md
// Known Issues for the existing useTags.js / TagHighlight.js split-brain this
// is meant to avoid growing further.
const EXACT_TAG_QUERY = /^#([\w-]+)$/;

export function tagTokenRegex(tag) {
    return new RegExp(`#${tag}\\b`, 'i');
}

export function noteHasTag(note, tag) {
    return tagTokenRegex(tag).test(note.content);
}

// Returns the bare tag name (no leading #) if `query` is an exact "#tagname"
// search — e.g. typing "#work" in search should behave like clicking the
// #work tag — otherwise null.
export function exactTagFromQuery(query) {
    const match = query.match(EXACT_TAG_QUERY);
    return match ? match[1] : null;
}
