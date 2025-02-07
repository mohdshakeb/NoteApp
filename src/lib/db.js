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
        created_at: (note.createdAt || new Date()).toISOString(),
        updated_at: (note.updatedAt || new Date()).toISOString()
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

// Helper function to check if user has any notes
async function hasExistingNotes(db, userId) {
  try {
    if (userId.startsWith('guest-')) {
      const existingNotes = await db.getAllFromIndex('notes', 'userId', userId);
      return existingNotes.length > 0;
    }

    // Check Supabase for existing notes
    const { data, error } = await supabase
      .from('notes')
      .select('id')
      .eq('user_id', userId)
      .limit(1);

    if (error) throw error;
    return data && data.length > 0;
  } catch (error) {
    console.error('Error checking existing notes:', error);
    return false;
  }
}

// Get notes from Supabase and sync with IndexedDB
export async function getNotes(db, userId) {
  let hasNotes = false;
  try {
    // First check if user already has notes
    hasNotes = await hasExistingNotes(db, userId);

    if (userId.startsWith('guest-')) {
      // First try to get notes from localStorage
      const savedNotes = localStorage.getItem(`guest-notes-${userId}`);
      let notes = [];
      
      if (savedNotes) {
        notes = JSON.parse(savedNotes);
      } else {
        notes = await db.getAllFromIndex('notes', 'userId', userId);
      }
      
      // Only return empty array if no notes exist
      if (!hasNotes && notes.length === 0) {
        return [];
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

    // Only return empty array if no notes exist anywhere
    if (!hasNotes && (!supabaseNotes || supabaseNotes.length === 0)) {
      return [];
    }

    return formatSupabaseNotes(supabaseNotes);
  } catch (error) {
    console.error('Error fetching notes:', error);
    return hasNotes ? [] : null;
  }
}

// Helper function to format Supabase notes
function formatSupabaseNotes(supabaseNotes) {
  return supabaseNotes.map(note => ({
    id: note.id,
    content: note.content,
    userId: note.user_id,
    syncStatus: 'synced',
    tags: note.tags || [],
    createdAt: new Date(note.created_at),
    updatedAt: new Date(note.updated_at)
  }));
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
    content: "Welcome to Notes! 👋 This is a sample note to help you get started. #welcome #notes",
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    content: "You can add tags to your notes using hashtags like this: #tips",
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    content: "Click on any tag to filter notes. Try clicking on #welcome or #tips to see how it works!",
    createdAt: new Date(),
    updatedAt: new Date()
  }
];

// Create default notes for new users
export async function createDefaultNotes(db, userId) {
  try {
    // Double-check that user doesn't have notes
    const hasNotes = await hasExistingNotes(db, userId);
    if (hasNotes) {
      return true;
    }

    const isGuest = userId.startsWith('guest-');
    const defaultNotes = getDefaultNotes();

    // Clear any existing data
    await clearExistingNotes(db, userId);

    if (isGuest) {
      // Create all notes in a single transaction
      const tx = db.transaction('notes', 'readwrite');
      await Promise.all(defaultNotes.map(note => 
        tx.store.put({
          ...note,
          id: crypto.randomUUID(),
          userId,
          syncStatus: 'local'
        })
      ));
      await tx.done;

      // Save to localStorage after successful creation
      const allNotes = await db.getAllFromIndex('notes', 'userId', userId);
      localStorage.setItem(`guest-notes-${userId}`, JSON.stringify(allNotes));
    } else {
      // Create notes in Supabase first
      const { data, error: insertError } = await supabase
        .from('notes')
        .insert(defaultNotes.map(note => ({
          content: note.content,
          user_id: userId,
          created_at: note.createdAt.toISOString(),
          updated_at: note.updatedAt.toISOString()
        })))
        .select();

      if (insertError) throw insertError;

      // Then save to IndexedDB in a single transaction
      const tx = db.transaction('notes', 'readwrite');
      await Promise.all(data.map(note => 
        tx.store.put({
          id: note.id,
          content: note.content,
          userId,
          syncStatus: 'synced',
          createdAt: new Date(note.created_at),
          updatedAt: new Date(note.updated_at)
        })
      ));
      await tx.done;
    }

    return true;
  } catch (error) {
    console.error('Error creating default notes:', error);
    throw error;
  }
}

// Helper function to clear existing notes
async function clearExistingNotes(db, userId) {
  // Clear IndexedDB
  const tx = db.transaction('notes', 'readwrite');
  await tx.store.index('userId').openCursor(userId).then(function deleteNote(cursor) {
    if (!cursor) return;
    cursor.delete();
    return cursor.continue().then(deleteNote);
  });
  await tx.done;

  // Clear Supabase if not guest
  if (!userId.startsWith('guest-')) {
    await supabase
      .from('notes')
      .delete()
      .eq('user_id', userId);
  }

  // Clear localStorage for guest users
  if (userId.startsWith('guest-')) {
    localStorage.removeItem(`guest-notes-${userId}`);
  }
}

// Delete account and all associated data
export async function deleteAccount(db, userId) {
  try {
    if (userId.startsWith('guest-')) {
      throw new Error('Cannot delete guest account');
    }

    // Delete all notes from Supabase
    const { error: notesError } = await supabase
      .from('notes')
      .delete()
      .eq('user_id', userId);

    if (notesError) throw notesError;

    // Delete user's own account using the user API
    const { error: userError } = await supabase.rpc('delete_user');

    if (userError) throw userError;

    // Clear IndexedDB
    const tx = db.transaction('notes', 'readwrite');
    await tx.store.index('userId').openCursor(userId).then(function deleteNote(cursor) {
      if (!cursor) return;
      cursor.delete();
      return cursor.continue().then(deleteNote);
    });
    await tx.done;

    // Clear any local storage
    localStorage.removeItem(`guest-notes-${userId}`);
    localStorage.clear();

    return true;
  } catch (error) {
    console.error('Error deleting account:', error);
    throw error;
  }
} 