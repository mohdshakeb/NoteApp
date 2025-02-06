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
    // For guest users, only save to IndexedDB
    if (userId.startsWith('guest-')) {
      const noteId = note.id || Date.now().toString();
      // Check if note exists first
      try {
        await db.get('notes', noteId);
        // If note exists, update it instead
        await db.put('notes', {
          ...note,
          id: noteId,
          userId,
          syncStatus: 'local',
          createdAt: note.createdAt || new Date(),
          updatedAt: new Date()
        });
      } catch {
        // If note doesn't exist, add it
        await db.add('notes', {
          ...note,
          id: noteId,
          userId,
          syncStatus: 'local',
          createdAt: note.createdAt || new Date(),
          updatedAt: new Date()
        });
      }
      return noteId;
    }

    // First save to Supabase
    const { data, error } = await supabase
      .from('notes')
      .insert([{
        id: note.id || undefined,
        content: note.content,
        user_id: userId,
        tags: note.tags,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }])
      .select()
      .single();

    if (error) throw error;

    // Then save to IndexedDB
    await db.add('notes', {
      ...note,
      id: data.id,
      userId,
      syncStatus: 'synced',
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at)
    });

    return data.id;
  } catch (error) {
    // If Supabase fails, save to IndexedDB with pending sync
    const tempId = note.id || Date.now().toString();
    await db.add('notes', {
      ...note,
      id: tempId,
      userId,
      syncStatus: 'pending',
      createdAt: new Date(),
      updatedAt: new Date()
    });
    return tempId;
  }
}

// Get notes from Supabase and sync with IndexedDB
export async function getNotes(db, userId) {
  try {
    // For guest users, only use IndexedDB
    if (userId.startsWith('guest-')) {
      return db.getAllFromIndex('notes', 'userId', userId);
    }

    // Get notes from Supabase
    console.log('Fetching notes for user:', userId);
    const { data: supabaseNotes, error } = await supabase
      .from('notes')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Supabase fetch error:', error);
      throw error;
    }

    console.log('Fetched notes:', supabaseNotes);

    const formattedNotes = supabaseNotes.map(note => ({
      id: note.id,
      content: note.content,
      userId: note.user_id,
      syncStatus: 'synced',
      tags: note.tags || [],
      createdAt: new Date(note.created_at),
      updatedAt: new Date(note.updated_at)
    }));

    console.log('Formatted notes:', formattedNotes);

    // Update IndexedDB with Supabase data
    const tx = db.transaction('notes', 'readwrite');
    await Promise.all([
      ...formattedNotes.map(note => tx.store.put(note)),
      tx.done
    ]);

    return formattedNotes;
  } catch (error) {
    console.error('Error fetching from Supabase:', error);
    return db.getAllFromIndex('notes', 'userId', userId);
  }
}

// Sync pending notes to Supabase
export async function syncPendingNotes(db, userId) {
  const tx = db.transaction('notes', 'readwrite');
  const pendingNotes = await tx.store.index('syncStatus').getAll('pending');

  for (const note of pendingNotes) {
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
  }
}

// Delete note from both Supabase and IndexedDB
export async function deleteNote(db, userId, noteId) {
  try {
    // For guest users, only delete from IndexedDB
    if (userId.startsWith('guest-')) {
      await db.delete('notes', noteId);
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
      ...note,
      syncStatus: 'synced',
      updatedAt: new Date()
    });

    return true;
  } catch (error) {
    console.error('Error updating note:', error);
    throw error;
  }
} 