import { openDB } from 'idb';
import { supabase } from './supabase';

const DB_NAME = 'notes-app';
const STORE_NAME = 'notes';

// Initialize IndexedDB
export async function initDB(userId) {
  // Bump version to 2 to ensure indices are created if they were missing
  const db = await openDB(DB_NAME, 2, {
    upgrade(db, oldVersion, newVersion, transaction) {
      const store = (!db.objectStoreNames.contains(STORE_NAME))
        ? db.createObjectStore(STORE_NAME, { keyPath: 'id' })
        : transaction.objectStore(STORE_NAME);

      if (!store.indexNames.contains('userId')) {
        store.createIndex('userId', 'userId');
      }
      if (!store.indexNames.contains('syncStatus')) {
        store.createIndex('syncStatus', 'syncStatus');
      }
    },
  });
  return db;
}

// Save note (Guest: IDB Only, User: Supabase + IDB)
export async function saveNote(db, userId, note) {
  try {
    // console.log(`[db] saveNote called for ${userId}`);
    // GUEST MODE
    if (userId === 'guest') {
      const tempId = note.id || crypto.randomUUID();
      const newNote = {
        ...note,
        id: tempId,
        userId,
        syncStatus: 'synced', // Local is source of truth
        createdAt: note.createdAt || new Date(),
        updatedAt: note.updatedAt || new Date()
      };
      const tx = db.transaction(STORE_NAME, 'readwrite');
      await tx.store.put(newNote);
      await tx.done;
      // console.log(`[db] Guest note saved: ${tempId}`);
      return tempId;
    }

    // AUTHENTICATED MODE
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
      console.warn('[db] Supabase save failed, falling back to local:', error);
      // Offline fallback
      const tempId = note.id || crypto.randomUUID();
      const newNote = {
        ...note,
        id: tempId,
        userId,
        syncStatus: 'pending',
        createdAt: new Date(),
        updatedAt: new Date()
      };
      const tx = db.transaction(STORE_NAME, 'readwrite');
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
    const tx = db.transaction(STORE_NAME, 'readwrite');
    await tx.store.put(newNote);
    await tx.done;

    return data.id;
  } catch (error) {
    console.error('Error saving note:', error);
    throw error;
  }
}

// Get notes
export async function getNotes(db, userId) {
  // console.log(`[db] getNotes called for ${userId}`);
  let hasNotes = false;
  try {
    // GUEST MODE
    if (userId === 'guest') {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const index = tx.store.index('userId');
      const notes = await index.getAll('guest');
      // console.log(`[db] Fetched ${notes.length} guest notes.`);

      if (notes.length === 0) return [];

      return notes.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }

    // AUTHENTICATED MODE
    // 1. Fetch Remote Notes (Supabase)
    const { data: supabaseNotes, error } = await supabase
      .from('notes')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // 2. Fetch ALL Local Notes (IndexedDB)
    // Reliance on 'syncStatus' can be brittle if state gets desynced.
    // Safest bet: Fetch all local notes for this user.
    const tx = db.transaction(STORE_NAME, 'readonly');
    const localNotes = await tx.store.index('userId').getAll(userId);

    // 3. Merge Results
    // Start with Supabase notes
    const remoteMapped = (supabaseNotes || []).map(note => ({
      id: note.id,
      content: note.content,
      userId: note.user_id,
      syncStatus: 'synced',
      tags: note.tags || [],
      createdAt: new Date(note.created_at),
      updatedAt: new Date(note.updated_at)
    }));

    const noteMap = new Map();
    remoteMapped.forEach(note => noteMap.set(note.id, note));

    // Overlay Local Notes
    // If local exists, it might be newer (pending) or same (synced).
    // If it's pending, we definitely want it.
    // If it's synced, it should match remote (or be slightly ahead if just edited offline).
    // We trust Local for 'pending' notes. For 'synced', we can trust Remote or Local (usually same).
    // To solve "Missing Note": If it's in Local but not Remote, we ADD it.
    localNotes.forEach(note => {
      if (note.syncStatus === 'pending') {
        noteMap.set(note.id, note);
      } else if (!noteMap.has(note.id)) {
        // If local says synced but remote doesn't have it (e.g. sync failed but marked synced? unlikely)
        // Or remote delete?
        // Safer to show it if we have it locally.
        noteMap.set(note.id, note);
      }
      // If noteMap has it (Remote) and local is 'synced', we theoretically ignore local
      // assuming Remote is truth. But we could check timestamps if we wanted deep merge.
    });

    const combinedNotes = Array.from(noteMap.values());
    // console.log(`[db] Fetched ${combinedNotes.length} user notes (Merged).`);

    // Sort
    return combinedNotes.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  } catch (error) {
    console.error('Error fetching notes:', error);
    // Return local notes if offline/error and not guest
    if (userId !== 'guest') {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const notes = await tx.store.index('userId').getAll(userId);
      return notes.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }
    return [];
  }
}

// Delete note
export async function deleteNote(db, userId, noteId) {
  try {
    // console.log(`[db] deleteNote ${noteId} for ${userId}`);
    // GUEST MODE
    if (userId === 'guest') {
      await db.delete(STORE_NAME, noteId);
      return true;
    }

    // AUTHENTICATED MODE
    // Delete from Supabase
    const { error: deleteError } = await supabase
      .from('notes')
      .delete()
      .eq('id', noteId)
      .eq('user_id', userId);

    if (deleteError) throw deleteError;

    // Delete from IndexedDB if it exists
    const note = await db.get(STORE_NAME, noteId);
    if (note) {
      await db.delete(STORE_NAME, noteId);
    }

    return true;
  } catch (error) {
    console.error('Error deleting note:', error);
    // Optimistic delete from IDB if offline? 
    // For now, let's keep it simple and assume online for delete or handle error upstream
    throw error;
  }
}

// Update note
export async function updateNote(db, userId, note) {
  try {
    // console.log(`[db] updateNote ${note.id} for ${userId}`); // Too noisy?
    // GUEST MODE
    if (userId === 'guest') {
      const updatedNote = {
        ...note,
        updatedAt: new Date()
      };
      const tx = db.transaction(STORE_NAME, 'readwrite');
      await tx.store.put(updatedNote);
      await tx.done;
      return updatedNote;
    }

    // AUTHENTICATED MODE
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
      .maybeSingle(); // Use maybeSingle to prevent error if note was just deleted (race condition)

    if (updateError) throw updateError;

    // If no note found (deleted concurrently), return null or original
    if (!updatedNote) return null;

    // Update in IndexedDB
    const tx = db.transaction(STORE_NAME, 'readwrite');
    // Fetch original to preserve createdAt if needed, or trust passed note
    const updatedNoteForDB = {
      ...note,
      content: updatedNote.content,
      updatedAt: new Date(updatedNote.updated_at),
      syncStatus: 'synced'
    };

    await tx.store.put(updatedNoteForDB);
    await tx.done;

    return updatedNoteForDB;
  } catch (error) {
    // Ignore "Row not found" if it somehow still got here
    if (error?.code === 'PGRST116') return null;
    console.error('Error updating note:', JSON.stringify(error, null, 2));
    throw error;
  }
}

// Sync pending notes (Authenticated only)
export async function syncPendingNotes(db, userId) {
  if (userId === 'guest') return;

  try {
    // 1. Fetch pending notes (ReadOnly)
    // We cannot keep a transaction open across network calls (Supabase),
    // so we fetch first, then process.
    let pendingNotes = [];
    {
      const tx = db.transaction(STORE_NAME, 'readonly');
      pendingNotes = await tx.store.index('syncStatus').getAll('pending');
      await tx.done;
    }

    if (pendingNotes.length === 0) return;

    // 2. Process each note
    await Promise.all(pendingNotes.map(async (note) => {
      try {
        // Try to update first
        const { data: updatedData, error: updateError } = await supabase
          .from('notes')
          .update({
            content: note.content,
            updated_at: new Date().toISOString()
          })
          .eq('id', note.id)
          .eq('user_id', userId)
          .select()
          .maybeSingle();

        // If update succeeded and returned data, we are done
        if (!updateError && updatedData) {
          // Open NEW transaction for write
          const tx = db.transaction(STORE_NAME, 'readwrite');
          await tx.store.put({
            ...note,
            syncStatus: 'synced'
          });
          await tx.done;
          return;
        }

        // If update failed or returned no data (row doesn't exist), try to insert
        const { data, error } = await supabase
          .from('notes')
          .insert([{
            // REMOVED 'id': Let Supabase generate it (BigInt)
            // id: note.id, 
            content: note.content,
            user_id: userId,
            created_at: note.createdAt.toISOString(),
            updated_at: new Date().toISOString()
          }])
          .select()
          .single();

        if (error) throw error;

        // Open NEW transaction for write
        const tx = db.transaction(STORE_NAME, 'readwrite');

        // Delete the old 'pending' note with temp ID if ID changed
        if (data.id !== note.id) {
          await tx.store.delete(note.id);
        }

        await tx.store.put({
          ...note,
          id: data.id,
          syncStatus: 'synced'
        });
        await tx.done;

      } catch (error) {
        console.error('Error syncing note:', JSON.stringify(error, null, 2));
      }
    }));

  } catch (error) {
    console.error('Error in syncPendingNotes:', error);
  }
}

// Create Default Notes
export async function createDefaultNotes(db, userId) {
  try {
    // If Guest, just write to IDB
    if (userId === 'guest') {
      const defaultNotes = getDefaultNotes();
      const tx = db.transaction(STORE_NAME, 'readwrite');
      for (const note of defaultNotes) {
        await tx.store.put({
          id: crypto.randomUUID(),
          content: note.content,
          userId: 'guest',
          syncStatus: 'synced',
          createdAt: note.createdAt,
          updatedAt: note.updatedAt
        });
      }
      await tx.done;
      return true;
    }

    // Authenticated logic...
    const hasNotes = await hasExistingNotes(db, userId);
    if (hasNotes) return true;

    const defaultNotes = getDefaultNotes();
    await clearExistingNotes(db, userId);

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

    const tx = db.transaction(STORE_NAME, 'readwrite');
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

// Check for Guest Notes
export async function checkForGuestNotes(db) {
  try {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const index = tx.store.index('userId');
    const count = await index.count('guest');
    return count;
  } catch (e) {
    console.error("Error checking guest notes:", e);
    return 0;
  }
}

// Clear Guest Notes (Discard)
export async function clearGuestData(db) {
  try {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const index = tx.store.index('userId');
    let cursor = await index.openCursor('guest');

    while (cursor) {
      await cursor.delete();
      cursor = await cursor.continue();
    }
    await tx.done;
    return true;
  } catch (e) {
    console.error("Error clearing guest data:", e);
    return false;
  }
}

// MIGRATE GUEST DATA to Real User
export async function migrateGuestData(db, realUserId) {
  try {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const index = tx.store.index('userId');
    const guestNotes = await index.getAll('guest');

    if (guestNotes.length === 0) return false;

    console.log(`Migrating ${guestNotes.length} guest notes to user ${realUserId}`);

    console.log(`Migrating ${guestNotes.length} guest notes to user ${realUserId}`);


    await Promise.all(guestNotes.map(async (note) => {
      // Update local note to new user and set as pending
      await tx.store.put({
        ...note,
        userId: realUserId,
        syncStatus: 'pending',
        // Keep original ID if using UUIDs, usually safe
      });
    }));

    await tx.done;

    // Trigger sync to push these 'pending' notes to Supabase
    await syncPendingNotes(db, realUserId);
    return true;
  } catch (e) {
    console.error("Error migrating guest data:", e);
    return false;
  }
}


// --- HELPERS ---

async function hasExistingNotes(db, userId) {
  try {
    // 1. Check IndexedDB (Local)
    const tx = db.transaction(STORE_NAME, 'readonly');
    const index = tx.store.index('userId');
    const localCount = await index.count(userId);
    if (localCount > 0) return true;

    // 2. Check Supabase (Remote)
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

async function clearExistingNotes(db, userId) {
  // ... (Same as before)
  // skipped for brevity in this task rewrite, assuming it is rarely used or identical
  const tx = db.transaction(STORE_NAME, 'readwrite');
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

export async function deleteAccount(db, userId) {
  // ... (Same as before)
  // Delete all notes from Supabase
  const { error: notesError } = await supabase
    .from('notes')
    .delete()
    .eq('user_id', userId);

  if (notesError) throw notesError;

  const { error: userError } = await supabase.rpc('delete_user');
  if (userError) throw userError;

  const tx = db.transaction(STORE_NAME, 'readwrite');
  await tx.store.index('userId').openCursor(userId).then(function deleteNote(cursor) {
    if (!cursor) return;
    cursor.delete();
    return cursor.continue().then(deleteNote);
  });
  await tx.done;
  return true;
}

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