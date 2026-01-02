import { useState, useEffect, useCallback } from 'react';
import { initDB, getNotes, saveNote, updateNote, deleteNote, syncPendingNotes, createDefaultNotes } from '../lib/db';

export function useNotes(user) {
  const [notes, setNotes] = useState([]);
  const [db, setDb] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Initialize DB and Fetch Notes
  useEffect(() => {
    const initializeApp = async () => {
      if (!user) return;

      try {
        setIsLoading(true);
        const dbInstance = await initDB(user.id);
        setDb(dbInstance);

        const fetchedNotes = await getNotes(dbInstance, user.id);

        // Handle default notes creation if empty
        if (Array.isArray(fetchedNotes) && fetchedNotes.length === 0) {
          const created = await createDefaultNotes(dbInstance, user.id);
          if (created) {
            const initialNotes = await getNotes(dbInstance, user.id);
            setNotes(initialNotes);
          } else {
            setNotes([]);
          }
        } else {
          setNotes(fetchedNotes || []);
        }

        setIsLoading(false);
      } catch (error) {
        console.error('Error initializing app:', error);
        setIsLoading(false);
        setNotes([]);
      }
    };

    initializeApp();
  }, [user]);

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
      if (!db || !user) throw new Error("Database or user not initialized");

      const noteId = await saveNote(db, user.id, {
        content,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      const newNote = {
        id: noteId,
        content,
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
      if (!db || !user) throw new Error("Database or user not initialized");

      const updatedNote = {
        ...originalNote,
        content: newContent,
        updatedAt: new Date()
      };

      const result = await updateNote(db, user.id, updatedNote);
      setNotes(prev => prev.map(n => n.id === originalNote.id ? result : n));
      return result;
    } catch (error) {
      console.error('Error updating note:', error);
      throw error;
    }
  };

  const removeNote = useCallback(async (noteId) => {
    if (!db || !user) return;

    try {
      setIsLoading(true); // Optional: global loading state for delete? Maybe not.
      // Actually locally locally loading might be better, but 'isLoading' is usually for initial load.
      // I'll skip setting isLoading for delete to avoid UI flickering entire screen.
      await deleteNote(db, user.id, noteId);
      setNotes(prev => prev.filter(n => n.id !== noteId));
    } catch (error) {
      console.error('Error deleting note:', error);
      throw error;
    }
  }, [db, user]);

  return {
    notes,
    isLoading,
    db,
    addNote,
    editNote,
    removeNote
  };
}