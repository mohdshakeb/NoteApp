import { useState, useEffect, useCallback, useRef } from 'react';
import { initDB, getNotes, saveNote, updateNote, deleteNote, syncPendingNotes, createDefaultNotes } from '../lib/db';

export function useNotes(user) {
  const [notes, setNotes] = useState([]);
  const [db, setDb] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Initialize DB and Fetch Notes
  const initializedUserRef = useRef(null);

  const fetchNotesData = useCallback(async (forced = false) => {
    // Prevent double init for the SAME user, but allow if user CHANGED
    const currentUserId = user ? user.id : 'guest';

    // If forced is true, we bypass the ref check (e.g. for manual refresh)
    if (!forced && initializedUserRef.current === currentUserId) return;
    initializedUserRef.current = currentUserId;

    try {
      setIsLoading(true);
      // Ensure DB is init (idempotent)
      const dbInstance = await initDB(currentUserId);
      setDb(dbInstance);

      const fetchedNotes = await getNotes(dbInstance, currentUserId);
      let finalNotes = fetchedNotes || [];

      // Logic: "One empty and active note should be displayed after the two notes."
      // First, sort strictly ASCENDING (Oldest first) so we check the VISUAL last note.
      // (getNotes returns Descending/Newest first by default)
      const sortedForCheck = [...finalNotes].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
      const lastNote = sortedForCheck[sortedForCheck.length - 1];

      // Only create new blank note if the last one has content
      if (!lastNote || (lastNote.content && lastNote.content.trim())) {
        const initialNote = {
          content: '',
          createdAt: new Date(),
          updatedAt: new Date()
        };
        const id = await saveNote(dbInstance, currentUserId, initialNote);
        const newBlankNote = { ...initialNote, id, isNew: true };
        finalNotes = [...finalNotes, newBlankNote];
      } else {
        // If last note is empty, ensure we don't have duplicates?
        // Actually, if last is empty, we do nothing. The existing empty note will be displayed.
      }

      setNotes(finalNotes);
      setIsLoading(false);
    } catch (error) {
      console.error('Error initializing app:', error);
      setIsLoading(false);
      setNotes([]);
    }
  }, [user]);

  useEffect(() => {
    fetchNotesData();
  }, [fetchNotesData]);

  const refreshNotes = useCallback(() => {
    fetchNotesData(true);
  }, [fetchNotesData]);

  // Sync Listener
  useEffect(() => {
    const handleOnline = () => {
      if (db && user) {
        syncPendingNotes(db, user.id);
      }
    };

    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [db, user]);

  const addNote = async (content) => {
    try {
      if (!db) throw new Error("Database not initialized");
      const currentUserId = user ? user.id : 'guest';

      const noteId = await saveNote(db, currentUserId, {
        content,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      const newNote = {
        id: noteId,
        content,
        userId: currentUserId, // Critical: Missing this caused index drop on update
        createdAt: new Date(),
        updatedAt: new Date()
      };

      setNotes(prev => [newNote, ...prev]);
      return newNote;
    } catch (error) {
      console.error('Error adding note:', error);
      throw error;
    }
  };

  const editNote = async (originalNote, newContent) => {
    try {
      if (!db) throw new Error("Database not initialized");
      const currentUserId = user ? user.id : 'guest';

      const updatedNote = {
        ...originalNote,
        content: newContent,
        updatedAt: new Date()
      };

      const result = await updateNote(db, currentUserId, updatedNote);
      setNotes(prev => prev.map(n => n.id === originalNote.id ? result : n));
      return result;
    } catch (error) {
      console.error('Error updating note:', error);
      throw error;
    }
  };

  const removeNote = useCallback(async (noteId) => {
    if (!db) return;
    const currentUserId = user ? user.id : 'guest';

    try {
      setIsLoading(true);
      await deleteNote(db, currentUserId, noteId);
      setNotes(prev => prev.filter(n => n.id !== noteId));
      setIsLoading(false);
    } catch (error) {
      console.error('Error deleting note:', error);
      setIsLoading(false);
      throw error;
    }
  }, [db, user]);

  return {
    notes,
    isLoading,
    db,
    addNote,
    editNote,
    removeNote,
    refreshNotes
  };
}