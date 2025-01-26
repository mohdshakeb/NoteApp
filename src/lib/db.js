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
    const tempId = Date.now().toString();
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