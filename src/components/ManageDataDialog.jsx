"use client";
import { useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from './ui/dialog';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from './ui/alert-dialog';
import { Button } from './ui/button';
import { deleteAllNotes, deleteNotesByTag } from '../lib/db';
import { noteHasTag } from '../lib/tagMatch';
import {
  sortNotesAscending,
  notesToMarkdown,
  notesToCsv,
  buildExportFilename,
  downloadTextFile,
} from '../lib/export';

export function ManageDataDialog({ open, onOpenChange, notes, db, user, refreshNotes, allTags }) {
  const [exportFormat, setExportFormat] = useState('markdown');
  const [exportScope, setExportScope] = useState('all');
  const [exportTag, setExportTag] = useState('');

  const [deleteScope, setDeleteScope] = useState('all');
  const [deleteTag, setDeleteTag] = useState('');
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(null);

  // ManageDataDialog is mounted once (only `open` toggles visibility), so
  // exportTag/deleteTag can't just be seeded from allTags[0] at useState-init
  // time — allTags may still be empty then and update later. Fall back to
  // allTags[0] here on every render instead, so switching scope to "tag"
  // never silently no-ops back to "all" just because nothing's been
  // explicitly picked yet.
  const effectiveExportTag = exportTag || allTags[0] || '';
  const effectiveDeleteTag = deleteTag || allTags[0] || '';

  const notesForExport = useMemo(() => {
    const base = exportScope === 'tag' && effectiveExportTag
      ? notes.filter(n => noteHasTag(n, effectiveExportTag))
      : notes;
    return sortNotesAscending(base);
  }, [notes, exportScope, effectiveExportTag]);

  const notesForDelete = useMemo(() => (
    deleteScope === 'tag' && effectiveDeleteTag
      ? notes.filter(n => noteHasTag(n, effectiveDeleteTag))
      : notes
  ), [notes, deleteScope, effectiveDeleteTag]);

  const handleExport = () => {
    if (notesForExport.length === 0) return;
    const scopeTag = exportScope === 'tag' ? effectiveExportTag : null;
    const filename = buildExportFilename({ format: exportFormat, scope: exportScope, tag: scopeTag });
    if (exportFormat === 'csv') {
      downloadTextFile(filename, notesToCsv(notesForExport), 'text/csv;charset=utf-8');
    } else {
      downloadTextFile(filename, notesToMarkdown(notesForExport), 'text/markdown;charset=utf-8');
    }
  };

  const handleConfirmDelete = async () => {
    setIsDeleting(true);
    setDeleteError(null);
    try {
      if (deleteScope === 'all') {
        await deleteAllNotes(db, user.id);
      } else {
        await deleteNotesByTag(db, user.id, notesForDelete);
      }
      setConfirmDeleteOpen(false);
      // Re-triggers useNotes.js's blank-last-note bootstrap if this emptied
      // the notes array — no separate bootstrap call needed here.
      await refreshNotes();
      onOpenChange(false);
    } catch (error) {
      console.error('Bulk delete failed:', error);
      // Fail-fast: nothing was touched locally, so state is still accurate —
      // just surface the error and let the user retry.
      setDeleteError('Something went wrong deleting your notes. Check your connection and try again.');
      setConfirmDeleteOpen(false);
    } finally {
      setIsDeleting(false);
    }
  };

  const deleteButtonLabel = deleteScope === 'all'
    ? `Delete all ${notes.length} note${notes.length === 1 ? '' : 's'}`
    : `Delete notes tagged #${effectiveDeleteTag || '...'}`;

  const deleteConfirmDescription = deleteScope === 'all'
    ? `Delete all ${notes.length} note${notes.length === 1 ? '' : 's'}? This cannot be undone.`
    : `Delete the ${notesForDelete.length} note${notesForDelete.length === 1 ? '' : 's'} tagged #${effectiveDeleteTag}? This cannot be undone.`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Manage Data</DialogTitle>
          <DialogDescription>Export or delete your notes.</DialogDescription>
        </DialogHeader>

        {/* Export */}
        <section className="space-y-3 border-t pt-4">
          <h3 className="text-sm font-semibold">Export</h3>

          <div className="flex gap-2">
            <Button
              type="button"
              variant={exportFormat === 'markdown' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setExportFormat('markdown')}
            >
              Markdown
            </Button>
            <Button
              type="button"
              variant={exportFormat === 'csv' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setExportFormat('csv')}
            >
              CSV
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <select
              className="h-9 rounded-md border border-input bg-background px-2 text-sm"
              value={exportScope}
              onChange={(e) => setExportScope(e.target.value)}
            >
              <option value="all">All notes</option>
              <option value="tag" disabled={allTags.length === 0}>Notes tagged...</option>
            </select>
            {exportScope === 'tag' && (
              <select
                className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                value={effectiveExportTag}
                onChange={(e) => setExportTag(e.target.value)}
              >
                {allTags.map(tag => (
                  <option key={tag} value={tag}>#{tag}</option>
                ))}
              </select>
            )}
          </div>

          <Button
            type="button"
            size="sm"
            onClick={handleExport}
            disabled={notesForExport.length === 0}
          >
            Export {notesForExport.length} note{notesForExport.length === 1 ? '' : 's'}
          </Button>
        </section>

        {/* Delete */}
        <section className="space-y-3 border-t pt-4">
          <h3 className="text-sm font-semibold text-destructive">Delete</h3>

          <div className="flex items-center gap-2">
            <select
              className="h-9 rounded-md border border-input bg-background px-2 text-sm"
              value={deleteScope}
              onChange={(e) => setDeleteScope(e.target.value)}
            >
              <option value="all">All notes</option>
              <option value="tag" disabled={allTags.length === 0}>Notes tagged...</option>
            </select>
            {deleteScope === 'tag' && (
              <select
                className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                value={effectiveDeleteTag}
                onChange={(e) => setDeleteTag(e.target.value)}
              >
                {allTags.map(tag => (
                  <option key={tag} value={tag}>#{tag}</option>
                ))}
              </select>
            )}
          </div>

          {deleteError && (
            <p className="text-sm text-destructive">{deleteError}</p>
          )}

          <Button
            type="button"
            variant="destructive"
            size="sm"
            disabled={deleteScope === 'tag' && !effectiveDeleteTag}
            onClick={() => setConfirmDeleteOpen(true)}
          >
            {deleteButtonLabel}
          </Button>
        </section>
      </DialogContent>

      <AlertDialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>{deleteConfirmDescription}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting} onClick={() => setConfirmDeleteOpen(false)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={isDeleting}
              onClick={(e) => { e.preventDefault(); handleConfirmDelete(); }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}
