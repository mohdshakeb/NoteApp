import React, { useState, useCallback, useRef, useEffect } from 'react';
import { debounce } from 'lodash';
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { ScrollArea } from "./ui/scroll-area";
import { initDB, saveNote, getNotes, syncPendingNotes, deleteNote, updateNote } from '../lib/db';
import { supabase } from '../lib/supabase';

const NoteApp = ({ user }) => {
  // State management
  const [notes, setNotes] = useState([]);
  const [currentNote, setCurrentNote] = useState('');
  const [showSaveButton, setShowSaveButton] = useState(false);
  const [db, setDb] = useState(null);
  const [selectedTag, setSelectedTag] = useState(null);
  const [allTags, setAllTags] = useState(new Set());
  const [editingNote, setEditingNote] = useState(null);
  const [tagSuggestions, setTagSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const editableRef = useRef(null);
  const [cursorPosition, setCursorPosition] = useState({ x: 0, y: 0 });

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

  // Get notes from Supabase and sync with IndexedDB
  useEffect(() => {
    if (db && user) {
      getNotes(db, user.id).then(fetchedNotes => {
        // Sort notes by creation date (newest first)
        const sortedNotes = fetchedNotes.sort((a, b) => 
          new Date(b.createdAt) - new Date(a.createdAt)
        );
        setNotes(sortedNotes || []);
        // Extract all tags from existing notes
        const tags = new Set();
        fetchedNotes?.forEach(note => {
          note.tags?.forEach(tag => tags.add(tag));
        });
        setAllTags(tags);
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

  // Extract tags from text
  const extractTags = (text) => {
    const tagRegex = /#[\w\u0590-\u05ff]+/g;
    // Remove duplicates and get unique tags
    return [...new Set((text.match(tagRegex) || []).map(tag => tag.slice(1)))];
  };

  // Clean up unused tags
  const cleanupUnusedTags = (currentNotes) => {
    const usedTags = new Set();
    currentNotes.forEach(note => {
      note.tags?.forEach(tag => usedTags.add(tag));
    });
    setAllTags(usedTags);
  };

  // Helper function for formatting dates
  const formatDate = (date) => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    date = new Date(date);

    if (date >= today) {
      return 'Today';
    } else if (date >= yesterday) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString('en-US', {
        weekday: 'short',
        day: 'numeric',
        month: 'short'
      });
    }
  };

  // Handle input changes
  const handleKeyDown = (e) => {
    const text = e.target.innerText;
    setCurrentNote(text);
    if (!showSaveButton && text.trim()) {
      setShowSaveButton(true);
    } else if (showSaveButton && !text.trim()) {
      setShowSaveButton(false);
    }

    // Get cursor position from selection
    const selection = window.getSelection();
    const range = selection.getRangeAt(0);
    
    // Get cursor position for suggestion box
    if (range.getClientRects().length > 0) {
      const rect = range.getClientRects()[0];
      setCursorPosition({
        x: rect.left,
        y: rect.top
      });
    }

    // Find the word being typed
    const currentWord = getCurrentWord(range.startContainer, range.startOffset);
    console.log('Current word:', currentWord);

    if (currentWord.startsWith('#')) {
      const partialTag = currentWord.slice(1).toLowerCase();
      console.log('Partial tag:', partialTag);

      if (partialTag) {
        const suggestions = Array.from(allTags)
          .filter(tag => tag.toLowerCase().startsWith(partialTag))
          .slice(0, 5);
        console.log('Suggestions:', suggestions);
        setTagSuggestions(suggestions);
        setShowSuggestions(suggestions.length > 0);
      } else {
        setShowSuggestions(false);
      }
    } else {
      setShowSuggestions(false);
    }
  };

  // Helper function to get the current word being typed
  const getCurrentWord = (node, offset) => {
    if (node.nodeType !== Node.TEXT_NODE) return '';
    
    const text = node.textContent;
    let start = offset;
    let end = offset;
    
    // Find word boundaries
    while (start > 0 && !/\s/.test(text[start - 1])) {
      start--;
    }
    while (end < text.length && !/\s/.test(text[end])) {
      end++;
    }
    
    return text.slice(start, end);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  // Handle note deletion
  const handleDeleteNote = async (noteId) => {
    try {
      await deleteNote(db, user.id, noteId);
      const updatedNotes = notes.filter(note => note.id !== noteId);
      setNotes(updatedNotes);
      // Cleanup unused tags
      cleanupUnusedTags(updatedNotes);
    } catch (error) {
      console.error('Error deleting note:', error);
    }
  };

  // Handle note edit
  const handleEditNote = (note) => {
    setEditingNote(note);
    editableRef.current.innerText = note.content;
    editableRef.current.focus();
    setCurrentNote(note.content);
    setShowSaveButton(true);
  };

  // Update saveNoteToDb to maintain sort order
  const saveNoteToDb = async () => {
    if (currentNote.trim() && db && user) {
      const tags = extractTags(currentNote);
      const newNote = {
        content: currentNote,
        createdAt: new Date(),
        updatedAt: new Date(),
        userId: user.id,
        tags
      };
      
      const id = await saveNote(db, user.id, newNote);
      setNotes(prev => [{ ...newNote, id }, ...prev]); // Add new note at the beginning
      setCurrentNote('');
      setShowSaveButton(false);
      
      // Update all tags
      setAllTags(prev => {
        const newTags = new Set(prev);
        tags.forEach(tag => newTags.add(tag));
        return newTags;
      });
      
      if (editableRef.current) {
        editableRef.current.innerText = '';
        editableRef.current.focus();
      }
    }
  };

  // Get recent tags
  const getRecentTags = () => {
    const tagsArray = Array.from(allTags);
    console.log('All tags:', tagsArray);
    const recentTags = tagsArray.slice(-5).reverse();
    console.log('Recent tags:', recentTags);
    return recentTags;
  };

  // Filter notes by tag
  const filteredNotes = selectedTag
    ? notes.filter(note => note.tags?.includes(selectedTag))
    : notes;

  // Handle tag suggestion selection
  const handleTagSelect = (tag) => {
    const selection = window.getSelection();
    const range = selection.getRangeAt(0);
    const textNode = range.startContainer;

    if (textNode.nodeType === Node.TEXT_NODE) {
      const text = textNode.textContent;
      const offset = range.startOffset;
      
      // Add debug logging
      console.log('Text content:', text);
      console.log('Current offset:', offset);
      
      // Find the start and end of the current tag
      let start = offset;
      while (start > 0 && text[start - 1] !== '#') {
        start--;
      }
      let end = offset;
      while (end < text.length && !/\s/.test(text[end])) {
        end++;
      }
      
      console.log('Tag boundaries - start:', start, 'end:', end);
      
      // Replace the partial tag with the selected tag
      const beforeTag = text.substring(0, Math.max(0, start - 1)); // -1 to include the #
      const afterTag = text.substring(end);
      const newText = `${beforeTag}#${tag} ${afterTag}`;
      
      console.log('New text:', newText);
      
      // Update the text node
      textNode.textContent = newText;
      
      // Set cursor position after the tag
      const newPosition = Math.min(
        start + tag.length + 2, // +2 for # and space
        newText.length
      );
      
      console.log('New cursor position:', newPosition, 'Text length:', newText.length);
      
      const newRange = document.createRange();
      newRange.setStart(textNode, newPosition);
      newRange.collapse(true);
      selection.removeAllRanges();
      selection.addRange(newRange);
      
      // Update note content
      setCurrentNote(editableRef.current.innerText);
    }
    
    setShowSuggestions(false);
  };

  return (
    <div className="container mx-auto p-6 max-w-2xl">
      {/* User info and sign out */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-4">
          <img 
            src={user.user_metadata?.avatar_url} 
            alt={user.user_metadata?.full_name}
            className="w-8 h-8 rounded-full"
          />
          <span>{user.user_metadata?.full_name}</span>
        </div>
        <Button variant="outline" onClick={() => supabase.auth.signOut()}>
          Sign Out
        </Button>
      </div>

      {/* Note Input Card */}
      <Card className="border-0 shadow-none relative">
        <div 
          ref={editableRef}
          contentEditable 
          onInput={handleKeyDown}
          className="min-h-[40px] focus:outline-none text-lg [&>span]:text-primary overflow-x-hidden"
          role="textbox"
          aria-label="Note input"
          data-placeholder="What are you thinking... (use # for tags)"
        />
        
        {/* Tag Suggestions */}
        {showSuggestions && (
          <div 
            className="fixed bg-background border rounded-md shadow-lg p-0.5 z-50"
            style={{
              top: Math.max(cursorPosition.y - 5, 10) + 'px', // Just slightly above cursor
              left: cursorPosition.x + 'px',
              transform: 'translateY(-100%)', // Move up by its own height
              maxHeight: '100px',
              width: 'fit-content',
              minWidth: '60px',
              fontSize: '0.75rem'
            }}
          >
            {tagSuggestions.map(tag => (
              <button
                key={tag}
                onClick={() => handleTagSelect(tag)}
                className="block w-full text-left px-1.5 py-0.5 hover:bg-accent rounded text-xs whitespace-nowrap hover:text-accent-foreground"
              >
                #{tag}
              </button>
            ))}
          </div>
        )}
        
        {showSaveButton && (
          <div className="mt-3">
            <Button onClick={saveNoteToDb}>
              Save Note
            </Button>
          </div>
        )}
      </Card>
      
      {/* Tags filter */}
      {getRecentTags().length > 0 && (
        <div className="flex gap-2 mt-6 mb-4 flex-wrap">
          {getRecentTags().map(tag => (
            <Button
              key={tag}
              variant={selectedTag === tag ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedTag(tag === selectedTag ? null : tag)}
            >
              {tag}
            </Button>
          ))}
        </div>
      )}

      {/* Notes List */}
      <ScrollArea 
        className="mt-6 h-[500px] overflow-hidden no-scrollbar" 
        scrollHideDelay={0}
        style={{ scrollbarWidth: 'none' }}
      >
        {filteredNotes.map((note, index) => (
          <div key={note.id}>
            <Card className="border-0 shadow-none">
              <div className="text-foreground">
                <div className="text-xs text-muted-foreground mb-2">
                  {formatDate(note.createdAt)}
                </div>
                <div className="[&>span]:text-primary">
                  {note.content.split(' ').map((word, i) => 
                    word.startsWith('#') ? 
                      <span key={i} className="cursor-pointer" onClick={() => setSelectedTag(word.slice(1))}>
                        {word}
                      </span> : 
                      word + ' '
                  )}
                </div>
                <div className="flex items-center mt-2">
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEditNote(note)}
                      className="text-xs text-primary hover:underline"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeleteNote(note.id)}
                      className="text-xs text-destructive hover:underline"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            </Card>
            {index < filteredNotes.length - 1 && (
              <div className="my-4 border-t border-border/40" />
            )}
          </div>
        ))}
      </ScrollArea>
    </div>
  );
};

// Add global function for tag clicking
window.selectTag = (tag) => {
  // Remove # from tag
  const tagName = tag.slice(1);
  // Find the React component instance
  const event = new CustomEvent('selectTag', { detail: tagName });
  window.dispatchEvent(event);
};

export default NoteApp;