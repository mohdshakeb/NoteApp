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
    hasNotes = await hasExistingNotes(db, userId);

    const { data: supabaseNotes, error } = await supabase
      .from('notes')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    if (!hasNotes && (!supabaseNotes || supabaseNotes.length === 0)) {
      return [];
    }

    return supabaseNotes.map(note => ({
      id: note.id,
      content: note.content,
      userId: note.user_id,
      syncStatus: 'synced',
      tags: note.tags || [],
      createdAt: new Date(note.created_at),
      updatedAt: new Date(note.updated_at)
    }));
  } catch (error) {
    console.error('Error fetching notes:', error);
    return hasNotes ? [] : null;
  }
}

// Delete note from both Supabase and IndexedDB
export async function deleteNote(db, userId, noteId) {
  try {
    // Delete from Supabase
    const { data, error } = await supabase
      .from('notes')
      .select()
      .eq('id', noteId)
      .eq('user_id', userId)
      .single();

    if (error) {
      throw new Error('Note not found or unauthorized');
    }

    // Delete from Supabase
    const { error: deleteError } = await supabase
      .from('notes')
      .delete()
      .eq('id', noteId)
      .eq('user_id', userId);

    if (deleteError) throw deleteError;

    // Delete from IndexedDB if it exists
    const note = await db.get('notes', noteId);
    if (note) {
      await db.delete('notes', noteId);
    }

    return true;
  } catch (error) {
    console.error('Error deleting note:', error);
    throw error;
  }
}

// Update note in both Supabase and IndexedDB
export async function updateNote(db, userId, note) {
  console.log('updateNote called with:', { userId, note });
  try {
    // First check if note exists in Supabase
    const { data: existingNote, error: checkError } = await supabase
      .from('notes')
      .select()
      .eq('id', note.id)
      .eq('user_id', userId)
      .single();

    console.log('Existing note check:', { existingNote, checkError });
    if (checkError) {
      throw new Error('Note not found or unauthorized');
    }

    // Update in Supabase
    const { data: updatedNote, error: updateError } = await supabase
      .from('notes')
      .update({
        content: note.content,
        updated_at: new Date().toISOString()
      })
      .eq('id', note.id)
      .eq('user_id', userId)
      .select()
      .single();

    console.log('Update result:', { updatedNote, updateError });
    if (updateError) throw updateError;

    // Update in IndexedDB
    const tx = db.transaction('notes', 'readwrite');
    const updatedNoteForDB = {
      id: updatedNote.id,
      content: updatedNote.content,
      userId: existingNote.user_id,
      syncStatus: 'synced',
      createdAt: new Date(existingNote.created_at),
      updatedAt: new Date(updatedNote.updated_at)
    };
    console.log('Updating IndexedDB with:', updatedNoteForDB);
    await tx.store.put(updatedNoteForDB);
    await tx.done;

    // Return the updated note so UI can be updated
    return updatedNoteForDB;
  } catch (error) {
    console.error('Error updating note:', error);
    throw error;
  }
}

// Sync pending notes to Supabase
export async function syncPendingNotes(db, userId) {
  try {
    const tx = db.transaction('notes', 'readwrite');
    const pendingNotes = await tx.store.index('syncStatus').getAll('pending');

    if (pendingNotes.length === 0) return;

    await Promise.all(pendingNotes.map(async (note) => {
      try {
        // Try to update first
        const { error: updateError } = await supabase
          .from('notes')
          .update({
            content: note.content,
            updated_at: new Date().toISOString()
          })
          .eq('id', note.id)
          .eq('user_id', userId);

        if (!updateError) {
          await tx.store.put({
            ...note,
            syncStatus: 'synced'
          });
          return;
        }

        // If update fails, try to insert
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

    const defaultNotes = getDefaultNotes();

    // Clear any existing data
    await clearExistingNotes(db, userId);

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
        userId: note.user_id,
        syncStatus: 'synced',
        createdAt: new Date(note.created_at),
        updatedAt: new Date(note.updated_at)
      })
    ));
    await tx.done;

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

  await supabase
    .from('notes')
    .delete()
    .eq('user_id', userId);
}

// Delete account and all associated data
export async function deleteAccount(db, userId) {
  try {
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

    return true;
  } catch (error) {
    console.error('Error deleting account:', error);
    throw error;
  }
} 