import React, { useState, useCallback, useRef, useEffect } from 'react';
import { debounce } from 'lodash';
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { ScrollArea } from "./ui/scroll-area";
import { initDB, saveNote, getNotes, syncPendingNotes } from '../lib/db';
import { supabase } from '../lib/supabase';

const NoteApp = ({ user }) => {
  // State management
  const [notes, setNotes] = useState([]);
  const [currentNote, setCurrentNote] = useState('');
  const [showSaveButton, setShowSaveButton] = useState(false);
  const [db, setDb] = useState(null);
  const editableRef = useRef(null);

  // Auto-focus on mount
  useEffect(() => {
    if (editableRef.current) {
      editableRef.current.focus();
    }
  }, []);

  // Initialize DB when user logs in
  useEffect(() => {
    if (user) {
      initDB(user.id).then(setDb);
    }
  }, [user]);

  // Load notes when DB is ready
  useEffect(() => {
    if (db && user) {
      console.log('Loading notes for user:', user.id);
      getNotes(db, user.id).then(fetchedNotes => {
        console.log('Loaded notes:', fetchedNotes);
        setNotes(fetchedNotes || []);
      });
    }
  }, [db, user]);

  // Debounced function to show save button
  const debouncedShowSaveButton = useCallback(
    debounce(() => {
      setShowSaveButton(true);
    }, 1000),
    [setShowSaveButton]
  );

  // Clean up debounce on unmount
  useEffect(() => {
    return () => {
      debouncedShowSaveButton.cancel();
    };
  }, [debouncedShowSaveButton]);

  // Add sync on network status change
  useEffect(() => {
    const handleOnline = () => {
      if (db && user) {
        syncPendingNotes(db, user.id);
      }
    };

    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [db, user]);

  // Event handlers
  const handleKeyDown = (e) => {
    setCurrentNote(e.target.innerText);
    setShowSaveButton(false);
    debouncedShowSaveButton();
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  const saveNoteToDb = async () => {
    if (currentNote.trim() && db && user) {
      const newNote = {
        content: currentNote,
        createdAt: new Date(),
        updatedAt: new Date(),
        userId: user.id
      };
      
      const id = await saveNote(db, user.id, newNote);
      setNotes(prev => [...prev, { ...newNote, id }]);
      setCurrentNote('');
      setShowSaveButton(false);
      
      if (editableRef.current) {
        editableRef.current.innerText = '';
        editableRef.current.focus();
      }
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-2xl">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-4">
          <img 
            src={user.user_metadata?.avatar_url} 
            alt={user.user_metadata?.full_name}
            className="w-8 h-8 rounded-full"
          />
          <span>{user.user_metadata?.full_name}</span>
        </div>
        <Button variant="outline" onClick={handleSignOut}>
          Sign Out
        </Button>
      </div>

      {/* Note Input Card */}
      <Card className="border-0 shadow-none">
        <div 
          ref={editableRef}
          contentEditable 
          onInput={handleKeyDown}
          className="min-h-[40px] focus:outline-none text-lg"
          role="textbox"
          aria-label="Note input"
          data-placeholder="What are you thinking..."
        />
        
        {showSaveButton && (
          <div className="mt-2">
            <Button onClick={saveNoteToDb}>
              Save Note
            </Button>
          </div>
        )}
      </Card>
      
      {/* Notes List */}
      <ScrollArea className="mt-6 h-[500px]">
        {notes?.map((note, index) => note && (
          <div key={note.id}>
            <Card className="border-0 shadow-none">
              <div className="text-foreground">
                {note.content}
                <div className="text-xs text-muted-foreground mt-2">
                  {note.createdAt ? new Date(note.createdAt).toLocaleString() : 'Just now'}
                </div>
              </div>
            </Card>
            {index < (notes?.length || 0) - 1 && (
              <div className="my-4 border-t border-border/40" />
            )}
          </div>
        ))}
      </ScrollArea>
    </div>
  );
};

export default NoteApp;