import { openDB } from 'idb';
import { supabase } from './supabase';

// Initialize IndexedDB
export async function initDB(userId) {
  const db = await openDB('notes-app', 1, {
    upgrade(db) {
      const store = db.createObjectStore('notes', {
        keyPath: 'id',
      });
      store.createIndex('userId', 'userId');
      store.createIndex('syncStatus', 'syncStatus');
    },
  });
  return db;
}

// Save note to both IndexedDB and Supabase
export async function saveNote(db, userId, note) {
  try {
    if (userId.startsWith('guest-')) {
      const noteId = note.id || crypto.randomUUID();
      const newNote = {
        ...note,
        id: noteId,
        userId,
        syncStatus: 'local',
        createdAt: note.createdAt || new Date(),
        updatedAt: new Date()
      };
      await db.put('notes', newNote);
      
      const allNotes = await db.getAllFromIndex('notes', 'userId', userId);
      
      if (allNotes && allNotes.length > 0) {
        localStorage.setItem(`guest-notes-${userId}`, JSON.stringify(allNotes));
      }
      
      return noteId;
    }

    // First save to Supabase
    const { data, error } = await supabase
      .from('notes')
      .insert([{
        content: note.content,
        user_id: userId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }])
      .select()
      .single();

    if (error) {
      const tempId = note.id || crypto.randomUUID();
      const newNote = {
        ...note,
        id: tempId,
        userId,
        syncStatus: 'pending',
        createdAt: new Date(),
        updatedAt: new Date()
      };
      const tx = db.transaction('notes', 'readwrite');
      await tx.store.put(newNote);
      await tx.done;
      return tempId;
    }

    // Then save to IndexedDB
    const newNote = {
      ...note,
      id: data.id,
      userId,
      syncStatus: 'synced',
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at)
    };
    const tx = db.transaction('notes', 'readwrite');
    await tx.store.put(newNote);
    await tx.done;

    return data.id;
  } catch (error) {
    console.error('Error saving note:', error);
    throw error;
  }
}

// Get notes from Supabase and sync with IndexedDB
export async function getNotes(db, userId) {
  try {
    if (userId.startsWith('guest-')) {
      // First try to get notes from localStorage
      const savedNotes = localStorage.getItem(`guest-notes-${userId}`);
      let notes = [];
      
      if (savedNotes) {
        const parsedNotes = JSON.parse(savedNotes);
        
        // Restore notes to IndexedDB
        await Promise.all(
          parsedNotes.map(note => db.put('notes', note))
        );
        notes = parsedNotes;
      } else {
        // If no localStorage data, get from IndexedDB
        notes = await db.getAllFromIndex('notes', 'userId', userId);
      }
      
      // Sort notes by creation date (newest first)
      notes.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      
      return notes;
    }

    // Get notes from Supabase
    const { data: supabaseNotes, error } = await supabase
      .from('notes')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const formattedNotes = supabaseNotes.map(note => ({
      id: note.id,
      content: note.content,
      userId: note.user_id,
      syncStatus: 'synced',
      tags: note.tags || [],
      createdAt: new Date(note.created_at),
      updatedAt: new Date(note.updated_at)
    }));

    // Update IndexedDB with Supabase data
    const tx = db.transaction('notes', 'readwrite');
    await Promise.all([
      ...formattedNotes.map(note => tx.store.put(note)),
      tx.done
    ]);

    return formattedNotes;
  } catch (error) {
    console.error('Error fetching notes:', error);
    return db.getAllFromIndex('notes', 'userId', userId);
  }
}

// Delete note from both Supabase and IndexedDB
export async function deleteNote(db, userId, noteId) {
  try {
    if (userId.startsWith('guest-')) {
      const note = await db.get('notes', noteId);
      if (!note || note.userId !== userId) {
        throw new Error('Note not found or unauthorized');
      }
      await db.delete('notes', noteId);
      // Update localStorage
      const remainingNotes = await db.getAllFromIndex('notes', 'userId', userId);
      localStorage.setItem(`guest-notes-${userId}`, JSON.stringify(remainingNotes));
      return true;
    }

    // Delete from Supabase
    const { error } = await supabase
      .from('notes')
      .delete()
      .eq('id', noteId)
      .eq('user_id', userId);

    if (error) throw error;

    // Delete from IndexedDB
    const note = await db.get('notes', noteId);
    // Only delete if note exists and belongs to this user
    if (!note || note.userId !== userId) {
      throw new Error('Note not found or unauthorized');
    }
    await db.delete('notes', noteId);

    return true;
  } catch (error) {
    console.error('Error deleting note:', error);
    throw error;
  }
}

// Update note in both Supabase and IndexedDB
export async function updateNote(db, userId, note) {
  try {
    // Check if note exists and belongs to user
    const existingNote = await db.get('notes', note.id);
    if (!existingNote || existingNote.userId !== userId) {
      throw new Error('Note not found or unauthorized');
    }

    if (userId.startsWith('guest-')) {
      await db.put('notes', {
        ...existingNote,
        ...note,
        userId,
        syncStatus: 'local',
        updatedAt: new Date()
      });
      return true;
    }

    // Update in Supabase
    const { error } = await supabase
      .from('notes')
      .update({
        content: note.content,
        tags: note.tags,
        updated_at: new Date().toISOString()
      })
      .eq('id', note.id)
      .eq('user_id', userId);

    if (error) throw error;

    // Update in IndexedDB
    await db.put('notes', {
      ...existingNote,
      ...note,
      userId,
      syncStatus: 'synced',
      updatedAt: new Date()
    });

    return true;
  } catch (error) {
    console.error('Error updating note:', error);
    throw error;
  }
}

// Sync pending notes to Supabase
export async function syncPendingNotes(db, userId) {
  try {
    // Skip for guest users
    if (userId.startsWith('guest-')) return;

    const tx = db.transaction('notes', 'readwrite');
    const pendingNotes = await tx.store.index('syncStatus').getAll('pending');

    if (pendingNotes.length === 0) return;

    await Promise.all(pendingNotes.map(async (note) => {
      try {
        const { data, error } = await supabase
          .from('notes')
          .insert([{
            content: note.content,
            user_id: userId,
            created_at: note.createdAt.toISOString(),
            updated_at: new Date().toISOString()
          }])
          .select()
          .single();

        if (error) throw error;

        await tx.store.put({
          ...note,
          id: data.id,
          syncStatus: 'synced'
        });
      } catch (error) {
        console.error('Error syncing note:', error);
      }
    }));

    await tx.done;
  } catch (error) {
    console.error('Error in syncPendingNotes:', error);
  }
}

// Default notes for new users
const getDefaultNotes = () => [
  {
    id: 'welcome-1',
    content: "Welcome to Notes! 👋 This is a sample note to help you get started. #welcome #notes",
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: 'welcome-2',
    content: "You can add tags to your notes using hashtags like this: #tips",
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: 'welcome-3',
    content: "Click on any tag to filter notes. Try clicking on #welcome or #tips to see how it works!",
    createdAt: new Date(),
    updatedAt: new Date()
  }
];

// Create default notes for new users
export async function createDefaultNotes(db, userId) {
  try {
    const isGuest = userId.startsWith('guest-');
    const defaultNotes = getDefaultNotes();

    if (isGuest) {
      // Save locally for guest users
      for (const note of defaultNotes) {
        const existingNote = await db.get('notes', note.id).catch(() => null);
        if (!existingNote) {
          await db.put('notes', {
            ...note,
            userId,
            syncStatus: 'local'
          });
        }
      }
      // Save all notes to localStorage after creating defaults
      const allNotes = await db.getAllFromIndex('notes', 'userId', userId);
      localStorage.setItem(`guest-notes-${userId}`, JSON.stringify(allNotes));
    } else {
      // Save to Supabase for authenticated users
      // Check for existing notes first
      const { data: existingNotes } = await supabase
        .from('notes')
        .select('id')
        .eq('user_id', userId);
      
      const existingIds = new Set(existingNotes?.map(n => n.id) || []);
      const notesToCreate = defaultNotes.filter(note => !existingIds.has(note.id));
      
      if (notesToCreate.length === 0) return true;

      const { data, error } = await supabase
        .from('notes')
        .insert(
          notesToCreate.map(note => ({
            id: note.id,
            content: note.content,
            user_id: userId,
            created_at: note.createdAt.toISOString(),
            updated_at: note.updatedAt.toISOString()
          }))
        )
        .select();

      if (error) throw error;

      // Save to IndexedDB as well
      await Promise.all(data.map(note => 
        db.put('notes', {
          id: note.id,
          content: note.content,
          userId,
          syncStatus: 'synced',
          createdAt: new Date(note.created_at),
          updatedAt: new Date(note.updated_at)
        })
      ));
    }

    return true;
  } catch (error) {
    console.error('Error creating default notes:', error);
    throw error;
  }
} 