import React, { useState, useCallback, useRef, useEffect } from 'react';
import { debounce } from 'lodash';
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { ScrollArea } from "./ui/scroll-area";
import { initDB, saveNote, getNotes, syncPendingNotes, deleteNote, updateNote } from '../lib/db';
import { supabase } from '../lib/supabase';
import { useTheme } from "./ThemeProvider";
import { Moon, Sun, ChevronRight, ChevronLeft, Search, LogOut } from "lucide-react";
import BottomSheet from './BottomSheet';
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger, DropdownMenuItem, DropdownMenuSeparator } from "./ui/dropdown";

const NoteApp = ({ user }) => {
  const { theme, setTheme } = useTheme();
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
  const [showSidebar, setShowSidebar] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

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
      if (user.isGuest) {
        // Load notes from localStorage for guest users
        const guestNotes = JSON.parse(localStorage.getItem('guestNotes') || '[]');
        setNotes(guestNotes);
        return;
      }
      
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
    // Show/hide placeholder based on content
    if (!text.trim()) {
      e.target.removeAttribute('data-content');
    } else {
      e.target.setAttribute('data-content', 'true');
    }
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
    if (user.isGuest) {
      localStorage.removeItem('guestUser');
      localStorage.removeItem('guestNotes');
      window.location.reload();
      return;
    }
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
      
      if (user.isGuest) {
        const guestNotes = JSON.parse(localStorage.getItem('guestNotes') || '[]');
        const noteWithId = { ...newNote, id: Date.now() };
        guestNotes.unshift(noteWithId);
        localStorage.setItem('guestNotes', JSON.stringify(guestNotes));
        setNotes([noteWithId, ...notes]);
      } else {
        const id = await saveNote(db, user.id, newNote);
        setNotes(prev => [{ ...newNote, id }, ...prev]);
      }
      
      setCurrentNote('');
      setShowSaveButton(false);
      // Open right panel after saving
      if (!showSidebar) {
        setShowSidebar(true);
      }
      // Reset input placeholder
      if (editableRef.current) {
        editableRef.current.removeAttribute('data-content');
      }
      
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

  const filteredNotes = notes.filter(note => {
    const matchesSearch = note.content.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesTag = !selectedTag || (note.tags && note.tags.includes(selectedTag));
    return matchesSearch && matchesTag;
  });

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

  const UserAvatar = ({ user }) => {
    if (user.user_metadata.avatar_url) {
      return (
        <img 
          src={user.user_metadata.avatar_url} 
          alt={user.user_metadata.full_name}
          className="w-8 h-8 rounded-full"
        />
      );
    }
    
    return (
      <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-sm font-medium">
        {user.user_metadata.initials}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex flex-col">
      {/* Full-width Header */}
      <div className="w-full bg-background border-b">
        <div className="max-w-[1600px] mx-auto px-8 py-4">
          <div className="flex justify-between items-center gap-4">
            <div className="flex items-center gap-2">
              <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M3 5H21V19H3V5Z" className="stroke-foreground" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M7 9L12 13L17 9" className="stroke-foreground" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <span className="font-semibold">Notes</span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                className="h-8 w-8"
              >
                {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger className="focus:outline-none">
                  <UserAvatar user={user} />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <div className="px-2 py-1.5">
                    <div className="font-medium">{user.user_metadata?.full_name}</div>
                    <div className="text-xs text-muted-foreground">
                      {notes.length} note{notes.length !== 1 ? 's' : ''} saved
                    </div>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleSignOut} className="text-destructive">
                    <LogOut className="w-4 h-4 mr-2" />
                    Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row h-[calc(100vh-128px)]">
        {/* Main Content */}
        <div className="flex-1 bg-background p-4 sm:p-8 flex items-center justify-center">
          {/* Note Input */}
          <Card className="border-0 shadow-none relative w-full max-w-[580px] flex flex-col aspect-square sm:aspect-auto">
            <div 
              ref={editableRef}
              contentEditable 
              onInput={handleKeyDown}
              className="min-h-[24px] max-h-fit focus:outline-none text-lg overflow-x-hidden text-center empty:before:content-[attr(data-placeholder)] empty:before:text-muted-foreground/50"
              role="textbox"
              aria-label="Note input"
              data-placeholder="What are you thinking... (use # for tags)"
            />
            
            {/* Tag Suggestions */}
            {showSuggestions && (
              <div 
                className="fixed bg-background border rounded-md shadow-lg p-0.5 z-50"
                style={{
                  top: cursorPosition.y,
                  left: cursorPosition.x,
                  transform: 'translateY(-100%)',
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
                    className="block w-full text-left px-1.5 py-0.5 hover:bg-accent rounded text-xs whitespace-nowrap"
                  >
                    #{tag}
                  </button>
                ))}
              </div>
            )}
            
            {showSaveButton && (
              <div className="mt-6 flex justify-center">
                <Button onClick={saveNoteToDb}>
                  Save Note
                </Button>
              </div>
            )}
          </Card>
        </div>

        {/* Desktop Sidebar */}
        <div className={`hidden sm:block border-l relative transition-all duration-300 bg-background ${showSidebar ? 'w-[400px]' : 'w-0'}`}>
          <Button
            variant="ghost"
            size="icon"
            className="absolute -left-4 top-8 h-8 w-8 rounded-full bg-background shadow-md border"
            onClick={() => setShowSidebar(!showSidebar)}
          >
            {showSidebar ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </Button>

          {showSidebar && (
            <div className="flex flex-col h-full">
              {/* Tags filter */}
              {getRecentTags().length > 0 && (
                <div className="p-4 bg-background/50">
                  <div className="flex gap-2 flex-wrap">
                    {getRecentTags().map(tag => (
                      <Button
                        key={tag}
                        variant={selectedTag === tag ? "default" : "secondary"}
                        size="sm"
                        onClick={() => setSelectedTag(tag === selectedTag ? null : tag)}
                      >
                        {tag}
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              {/* Notes List */}
              <div className="flex-1 overflow-auto">
                <div className="px-6 py-4 space-y-4">
                  {filteredNotes.map((note, index) => (
                    <>
                      <Card key={note.id} className="border-0 shadow-none bg-background/50">
                        <div className="text-foreground">
                          <div className="text-[12px] text-muted-foreground mb-1">
                            {formatDate(note.createdAt)}
                          </div>
                          <div className="text-[12px]">
                            {note.content.split(' ').map((word, i) => 
                              word.startsWith('#') ? (
                                <span 
                                  key={i} 
                                  className="cursor-pointer text-muted-foreground hover:text-primary border-b border-dashed border-muted-foreground mx-1" 
                                  onClick={() => setSelectedTag(word.slice(1))}
                                >
                                  {word.slice(1)}
                                </span>
                              ) : (
                                word + ' '
                              )
                            )}
                          </div>
                          <div className="flex items-center mt-2">
                            <div className="flex gap-4">
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
                        <div className="border-t border-border/50 my-4 opacity-100" />
                      )}
                    </>
                  ))}
                </div>
              </div>

              {/* Search Bar */}
              <div className="p-4 border-t bg-background">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Search notes..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 text-sm rounded-md border border-input bg-background"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Mobile Bottom Sheet */}
      <BottomSheet
        notes={filteredNotes}
        onDeleteNote={handleDeleteNote}
        onEditNote={handleEditNote}
        formatDate={formatDate}
        setSelectedTag={setSelectedTag}
      />

      {/* Footer */}
      <div className="hidden sm:flex border-t bg-background">
        <div className="w-full max-w-[1600px] mx-auto px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M3 5H21V19H3V5Z" className="stroke-foreground" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M7 9L12 13L17 9" className="stroke-foreground" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span className="font-semibold">Notes</span>
          </div>
          <div className="text-sm text-muted-foreground hover:text-foreground">
            Designed and developed by{' '}
            <a 
              href="https://www.shakeb.in" 
              target="_blank" 
              rel="noopener noreferrer"
              className="underline underline-offset-4"
            >
              Shakeb
            </a>
          </div>
        </div>
      </div>
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