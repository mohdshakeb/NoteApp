// Client-side note export: Markdown/CSV generation + file download.
// Pure transforms over an already-loaded `notes` array — no DB access here.
import { extractUniqueTags } from './tags';

// Absolute, unambiguous timestamp for export use. Deliberately NOT
// lib/utils.js's formatDate (which returns relative "Today"/"Yesterday" —
// fine for the UI, meaningless once read back later from a downloaded file).
export function formatExportDate(date) {
  return new Date(date).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

// Oldest-first, matching the order NotebookFeed.jsx displays notes in (see
// its own `sortedNotes` memo). Kept as a separate copy since NotebookFeed.jsx
// is a component, not a lib module — if that comparator ever changes, update
// this one too so exports stay visually consistent with the on-screen feed.
export function sortNotesAscending(notes) {
  return [...notes].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
}

// Applied to every CSV cell uniformly — note content is freeform, multi-line,
// and may contain commas/quotes, so there's no "safe" column to skip escaping.
export function csvField(value) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

export function notesToMarkdown(notes) {
  const header = `# Notes Export\n\n${notes.length} note${notes.length === 1 ? '' : 's'} • exported ${formatExportDate(new Date())}\n\n---\n\n`;
  const body = notes
    .map((note) => `### ${formatExportDate(note.createdAt)}\n\n${note.content}`)
    .join('\n\n---\n\n');
  return header + body;
}

export function notesToCsv(notes) {
  const rows = [['Content', 'Tags', 'Created', 'Updated'].map(csvField).join(',')];
  for (const note of notes) {
    const tags = extractUniqueTags(note.content).join(', ');
    rows.push([
      csvField(note.content),
      csvField(tags),
      csvField(formatExportDate(note.createdAt)),
      csvField(formatExportDate(note.updatedAt)),
    ].join(','));
  }
  // Leading BOM so Excel correctly detects UTF-8 (accented characters, emoji in content).
  return '﻿' + rows.join('\r\n');
}

export function buildExportFilename({ format, scope, tag }) {
  const date = new Date().toISOString().slice(0, 10);
  const scopePart = scope === 'tag' && tag ? tag : 'all';
  const ext = format === 'csv' ? 'csv' : 'md';
  return `notes-export-${scopePart}-${date}.${ext}`;
}

export function downloadTextFile(filename, content, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
