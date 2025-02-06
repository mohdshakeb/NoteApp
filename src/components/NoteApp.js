import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { debounce } from 'lodash';
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { ScrollArea } from "./ui/scroll-area";
import { initDB, saveNote, getNotes, deleteNote, updateNote, syncPendingNotes, createDefaultNotes } from '../lib/db';
import { supabase } from '../lib/supabase';
import { useTheme } from "./ThemeProvider";
import { 
  MoonIcon, 
  SunIcon, 
  ChevronLeftIcon, 
  ChevronRightIcon, 
  ChevronUpIcon, 
  ChevronDownIcon,
  MagnifyingGlassIcon as SearchIcon,
  ArrowRightOnRectangleIcon as LogOutIcon
} from '@heroicons/react/24/outline';
import BottomSheet from './BottomSheet';
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger, DropdownMenuItem, DropdownMenuSeparator } from "./ui/dropdown";
import logo from '../assets/logo.svg';

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
  const [isMobile, setIsMobile] = useState(window.innerWidth < 640);
  const [expandedMobile, setExpandedMobile] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const defaultNotes = [
    {
      id: crypto.randomUUID(),
      content: "Welcome to Notes! 👋 This is a sample note to help you get started. #welcome #notes",
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: crypto.randomUUID(),
      content: "You can add tags to your notes using hashtags like this: #tips",
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: crypto.randomUUID(),
      content: "Click on any tag to filter notes. Try clicking on #welcome or #tips to see how it works!",
      createdAt: new Date(),
      updatedAt: new Date(),
    }
  ];

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
    
    // Save on Ctrl+Enter
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      saveNoteToDb();
      return;
    }

    // Show/hide save button based on content
    if (!text.trim()) {
      setShowSaveButton(false);
    } else {
      setShowSaveButton(true);
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
    try {
      // Clear IndexedDB data first
      if (db) {
        const tx = db.transaction('notes', 'readwrite');
        const store = tx.objectStore('notes');
        await store.clear();
        await tx.done;
      }

      // Handle both guest and Google sign out
      if (user.isGuest) {
        localStorage.removeItem('guestUser');
      } else {
        // Sign out from Supabase
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
        
        // Clear Supabase session
        await supabase.auth.clearSession();
      }

      // Clear all local storage
      localStorage.removeItem(`defaultNotes-${user.id}`);
      localStorage.removeItem('sb-yzgyhdrughpwaqgcgqeu-auth-token');

    } catch (error) {
      console.error('Error signing out:', error);
    } finally {
      // Clear any remaining auth state
      if (typeof window !== 'undefined') {
        window.sessionStorage.clear();
        window.localStorage.clear();
      }
      // Force reload to clear any remaining state
      window.location.href = '/';
    }
  };

  // Handle note deletion
  const handleDeleteNote = useCallback(async (noteId) => {
    try {
      setIsLoading(true);
      await deleteNote(db, user.id, noteId);
      // Fetch fresh notes after deletion
      const updatedNotes = await getNotes(db, user.id);
      setNotes(updatedNotes);
    } catch (error) {
      console.error('Error deleting note:', error);
    } finally {
      setIsLoading(false);
    }
  }, [db, user.id]);

  // Handle note edit
  const handleEditNote = useCallback(async (updatedNote) => {
    try {
      await updateNote(db, user.id, updatedNote);
      setNotes(prevNotes =>
        prevNotes.map(note =>
          note.id === updatedNote.id ? updatedNote : note
        )
      );
    } catch (error) {
      console.error('Error updating note:', error);
    }
  }, [db, user.id]);

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

  const filteredNotes = useMemo(() => {
    return notes.filter(note => {
      const matchesSearch = note.content.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesTag = !selectedTag || note.content.includes(`#${selectedTag}`);
      return matchesSearch && matchesTag;
    });
  }, [notes, searchQuery, selectedTag]);

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

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 640);
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const initializeApp = async () => {
      try {
        setIsLoading(true);
        const db = await initDB(user.id);
        setDb(db);
        const fetchedNotes = await getNotes(db, user.id);

        // Create default notes if user has no notes
        if (fetchedNotes.length === 0) {
          await createDefaultNotes(db, user.id);
          const initialNotes = await getNotes(db, user.id);
          setNotes(initialNotes);
        } else {
          setNotes(fetchedNotes);
        }

        setIsLoading(false);
      } catch (error) {
        console.error('Error initializing app:', error);
        setIsLoading(false);
      }
    };

    initializeApp();
  }, [user.id]);

  const handleTagClick = useCallback((tag) => {
    if (selectedTag === tag) {
      setSelectedTag(null);
    } else {
      setSelectedTag(tag);
    }
  }, [selectedTag]);

  // Function to get unique tags from notes
  const getUniqueTags = () => {
    const allTags = notes.flatMap(note => 
      note.content.split(' ')
        .filter(word => word.startsWith('#'))
        .map(tag => tag.slice(1))
    );
    return [...new Set(allTags)];
  };

  // Function to render note content with clickable tags
  const renderNoteContent = (content) => {
    return content.split(' ').map((word, i) => 
      word.startsWith('#') ? (
        <span 
          key={`tag-${i}-${word}`}
          className="cursor-pointer text-muted-foreground hover:text-primary border-b border-dashed border-muted-foreground mx-1"
          onClick={() => handleTagClick(word.slice(1))}
        >
          {word}
        </span>
      ) : (
        <span key={`word-${i}`}>{word}{' '}</span>
      )
    );
  };

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex flex-col">
      {/* Header */}
      <header className={`
        border-b bg-background 
        transition-[padding] duration-500 cubic-bezier(0.34, 1.56, 0.64, 1)
        ${showSidebar ? 'sm:pr-[400px]' : 'sm:pr-0'}
      `}>
        <div className="flex items-center justify-between px-4 h-16">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <img 
              src={logo} 
              alt="Notes" 
              className="w-28 h-6 [filter:invert(0)_sepia(0)_saturate(1)_hue-rotate(0deg)_brightness(0.96)] dark:[filter:invert(1)_sepia(0)_saturate(1)_hue-rotate(0deg)_brightness(1)] text-accent-foreground"
            />
          </div>

          {/* Theme and User Menu */}
          <div className="relative">
            <div className={`
              flex items-center gap-2
              transition-all duration-500 cubic-bezier(0.34, 1.56, 0.64, 1)
              ${showSidebar ? 'translate-x-[calc(100%-6.5rem)]' : 'translate-x-0'}
              mr-4 sm:mr-0
            `}
            style={{ transform: showSidebar ? 'translateX(calc(100% - 5rem))' : 'translateX(0)' }}>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setTheme(theme === "light" ? "dark" : "light")}
              >
                {theme === "light" ? <MoonIcon className="h-4 w-4" /> : <SunIcon className="h-4 w-4" />}
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="icon"
                    className="focus-visible:ring-0 focus-visible:ring-offset-0"
                  >
                    {user?.isGuest ? (
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium">
                        {user.user_metadata.initials}
                      </div>
                    ) : user?.user_metadata?.avatar_url ? (
                      <img 
                        src={user.user_metadata.avatar_url} 
                        alt={user.email}
                        className="w-8 h-8 rounded-full"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium">
                        {(user?.user_metadata?.full_name?.charAt(0) || user?.email?.charAt(0) || 'U').toUpperCase()}
                      </div>
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-56">
                  <div className="px-2 py-1.5">
                    <div className="font-medium">{user.user_metadata?.full_name}</div>
                    <div className="text-xs text-muted-foreground">
                      {notes.length} note{notes.length !== 1 ? 's' : ''} saved
                    </div>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleSignOut} className="text-destructive">
                    <LogOutIcon className="w-4 h-4 mr-2" />
                    Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <Button
                variant="outline"
                onClick={() => setShowSidebar(true)}
                className={`
                  hidden sm:flex items-center gap-2 pl-1 pr-2 ml-1
                  transition-all duration-500 cubic-bezier(0.34, 1.56, 0.64, 1)
                  ${showSidebar 
                    ? 'translate-x-[200%] opacity-0' 
                    : 'translate-x-0 opacity-100'
                  }
                `}
              >
                <ChevronLeftIcon className="h-4 w-4" />
                <span>Read</span>
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className={`
        flex flex-col sm:flex-row sm:h-[calc(100vh-128px)]
        transition-[padding] duration-500 cubic-bezier(0.34, 1.56, 0.64, 1)
        ${showSidebar ? 'sm:pr-[400px]' : 'sm:pr-0'}
      `}>
        {/* Main Content */}
        <div className={`
          h-[45vh] sm:h-[calc(100vh-64px)] 
          bg-background p-4 sm:p-8 
          flex items-center justify-center w-full
          transition-all duration-500 cubic-bezier(0.34, 1.56, 0.64, 1)
        `}>
          <Card className="border-0 shadow-none relative w-full max-w-[580px] flex flex-col">
      <div 
        ref={editableRef}
        contentEditable 
        onInput={handleKeyDown}
              className="min-h-[24px] focus:outline-none text-lg overflow-x-hidden text-center empty:before:content-[attr(data-placeholder)] empty:before:text-muted-foreground/50"
        role="textbox"
              aria-label="Note input"
              data-placeholder="What are you thinking... (use # for tags)"
      />
      
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
        <div className={`
          border-t sm:border-l bg-background
          h-[100vh] sm:h-screen
          w-full sm:w-[400px]
          flex flex-col
          relative
          transition-all duration-500 cubic-bezier(0.34, 1.56, 0.64, 1)
          ${!showSidebar && 'sm:translate-x-[420px] sm:border-l-0'}
          hidden sm:flex
          sm:fixed sm:right-0 sm:top-0
        `}>
          {/* Collapse button */}
          <Button
            variant="ghost"
            size="icon"
            className={`
              h-8 w-8 rounded-full bg-background border
              absolute left-1/2 -top-4 -translate-x-1/2
              sm:left-0 sm:top-[88px] sm:translate-x-[-50%]
              transition-transform duration-500 cubic-bezier(0.34, 1.56, 0.64, 1)
              ${!showSidebar ? 'opacity-0' : 'opacity-100'}
            `}
            onClick={() => {
              if (window.innerWidth >= 640) {
                setShowSidebar(!showSidebar);
              } else {
                setExpandedMobile(!expandedMobile);
              }
            }}
          >
            {window.innerWidth >= 640 ? (
              <ChevronRightIcon className="h-4 w-4" />
            ) : (
              expandedMobile ? <ChevronDownIcon className="h-4 w-4" /> : <ChevronUpIcon className="h-4 w-4" />
            )}
          </Button>

          {/* Sidebar Header - Only show on desktop */}
          <div className="hidden sm:block px-6 pt-3 pd-2">
            <h2 className="text-md font-medium">My Notes</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              {notes.length} {notes.length === 1 ? 'note' : 'notes'}
            </p>
          </div>

          {(showSidebar || window.innerWidth < 640) && (
            <div className="flex flex-col h-full">
              {/* Tags filter */}
              <div className="px-6 pt-8 pb-2 bg-background/50">
                <div className="flex gap-2 flex-wrap">
                  {getUniqueTags().map(tag => (
                    <button
                      key={tag}
                      onClick={() => handleTagClick(tag)}
                      className={`px-3 py-1 text-xs rounded border ${
                        selectedTag === tag 
                        ? 'bg-primary text-primary-foreground border-primary' 
                        : 'bg-muted border-input hover:bg-accent'
                      }`}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>

              {/* Notes List */}
              <div className="flex-1 overflow-auto min-h-0">
                <div className="px-6 py-4 space-y-4">
                  {filteredNotes.map((note, index) => (
                    <>
                      <Card key={note.id} className="border-0 shadow-none bg-background/50">
                        <div className="text-foreground">
                          <div className="text-[12px] text-muted-foreground mb-1">
                            {formatDate(note.createdAt)}
                          </div>
                          <div className="text-[12px]">
                            {renderNoteContent(note.content)}
                          </div>
                          <div className="flex items-center mt-3">
                            <div className="flex gap-4">
                              <button
                                onClick={() => handleEditNote(note)}
                                className="text-xs text-muted-foreground hover:text-primary"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => handleDeleteNote(note.id)}
                                className="text-xs text-muted-foreground hover:text-destructive"
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
                  <div className="h-16" />
                </div>
              </div>

              {/* Search Bar */}
              <div className="px-6 pt-3 pb-8 bg-background sticky bottom-0">
                <div className="relative">
                  <SearchIcon className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Search notes..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-8 pr-4 py-2 text-sm border bg-background rounded-md focus:outline-slate-300"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className={`
        hidden sm:flex bg-background
        transition-[padding] duration-500 cubic-bezier(0.34, 1.56, 0.64, 1)
        ${showSidebar ? 'sm:pr-[400px]' : 'sm:pr-0'}
      `}>
        <div className="w-full max-w-[1600px] mx-auto px-8 py-4 flex items-center justify-center">
         
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">Designed and developed</span>
          <a 
            href="https://www.shakeb.in" 
            target="_blank" 
            rel="noopener noreferrer"
            className="font-medium hover:text-primary transition-colors"
          >
            Shakeb
          </a>
        </div>
        </div>
      </div>

      {/* Tag Suggestions */}
      {showSuggestions && (
        <div 
          className="fixed bg-background border rounded-md shadow-lg p-0.5 z-[60]"
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
          {tagSuggestions.map((tag, index) => (
            <Button
              key={index}
              variant="secondary"
              size="sm"
              onClick={() => handleTagSelect(tag)}
            >
              {tag}
            </Button>
          ))}
        </div>
      )}

      {/* Mobile Bottom Sheet */}
      <div className="sm:hidden">
        <BottomSheet 
          notes={notes}
          onDeleteNote={handleDeleteNote}
          onEditNote={handleEditNote}
          formatDate={formatDate}
          selectedTag={selectedTag}
          setSelectedTag={setSelectedTag}
          expandedMobile={expandedMobile}
          setExpandedMobile={setExpandedMobile}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
        />
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