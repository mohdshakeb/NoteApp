import { useMemo } from 'react';
import { extractUniqueTags } from '../lib/tags';

export function useTags(notes) {
  // Extract all unique tags
  const allTags = useMemo(() => {
    const tags = new Set();
    notes.forEach(note => {
      extractUniqueTags(note.content).forEach(tag => tags.add(tag));
    });
    return Array.from(tags).sort();
  }, [notes]);

  const getSuggestions = (partialTag) => {
    if (!partialTag) return [];

    // exact match check? No, startsWith.
    const term = partialTag.toLowerCase();

    // Logic from NoteApp:
    // .filter(tag => tag.toLowerCase().startsWith(partialTag)).slice(0, 5);

    return allTags
      .filter(tag => tag.toLowerCase().startsWith(term))
      .slice(0, 5);
  };

  return {
    allTags,
    getSuggestions
  };
}