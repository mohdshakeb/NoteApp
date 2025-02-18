import { useMemo } from 'react';

export function useTags(notes) {
  const tags = useMemo(() => {
    // ... tag extraction logic
  }, [notes]);

  return {
    tags,
    hasTag: (note, tag) => note.content.includes(`#${tag}`),
    // ... other tag operations
  };
} 