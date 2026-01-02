"use client";
import React, { useState, useCallback, useRef, useEffect } from 'react';
import debounce from 'lodash.debounce';

// Components
import { TimelineRail } from './TimelineRail';
import { TagsRail } from './TagsRail';
import { TagNavigator } from './TagNavigator';
import { MobileNavPill } from './MobileNavPill';
import { MobileDrawers } from './MobileDrawers';
import { NotebookFeed } from './NotebookFeed';
import { UserDropdown } from './ui/UserDropdown';
import { Button } from "./ui/button";
import { useTheme } from "./ThemeProvider";
import { MoonIcon, SunIcon } from '@heroicons/react/24/outline';

// Hooks
import { useNotes } from '../hooks/useNotes';
import { useTags } from '../hooks/useTags';

// Lib
import { deleteAccount } from '../lib/db';
import { supabase } from '../lib/supabase';
import logo from '../assets/logo.svg';

const NoteApp = ({ user }) => {
  const { theme, setTheme } = useTheme();

  // Custom Hooks
  const { notes, isLoading, db, addNote, editNote, removeNote } = useNotes(user);
  const { allTags, getSuggestions } = useTags(notes);

  // We mostly rely on NotebookFeed's internal state + useNotes now.
  // But we need to track active note for TimelineRail highlight.
  const [activeNoteId, setActiveNoteId] = useState(null);

  // Tag Navigation State
  const [tagNav, setTagNav] = useState({
    tag: null,
    matches: [],
    currentIndex: 0
  });

  // Mobile Drawer State
  const [mobileDrawer, setMobileDrawer] = useState({
    isOpen: false,
    type: null // 'date' | 'tags'
  });

  // Track editor focus to hide generic floating UI on mobile
  const [isEditorFocused, setIsEditorFocused] = useState(false);

  // Initialize active note to the last one (newest) on load
  useEffect(() => {
    if (notes.length > 0 && !activeNoteId) {
      // Sort similar to Feed to ensure we pick the visual "last" one
      const sorted = [...notes].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
      setActiveNoteId(sorted[sorted.length - 1].id);
    }
  }, [notes]);

  const handleSignOut = async () => {
    try {
      if (db) {
        const tx = db.transaction('notes', 'readwrite');
        const store = tx.objectStore('notes');
        await store.clear();
        await tx.done;
      }

      if (user.isGuest) {
        localStorage.removeItem('guestUser');
      } else {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
        await supabase.auth.clearSession();
      }

      localStorage.removeItem(`defaultNotes-${user.id}`);
      localStorage.removeItem('sb-yzgyhdrughpwaqgcgqeu-auth-token');

    } catch (error) {
      console.error('Error signing out:', error);
    } finally {
      if (typeof window !== 'undefined') {
        window.sessionStorage.clear();
        window.localStorage.clear();
      }
      window.location.href = '/';
    }
  };

  const handleDeleteAccount = async () => {
    try {
      await deleteAccount(db, user.id);
      window.location.replace('/');
    } catch (error) {
      console.error('Error deleting account:', error);
      alert('Failed to delete account. Please try again.');
    }
  };

  const handleTagClick = useCallback((tag) => {
    // 1. Find all notes with this tag
    const regex = new RegExp(`#${tag}\\b`, 'i');
    const matches = notes
      .filter(n => regex.test(n.content))
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
      .map(n => n.id);

    if (matches.length === 0) return;

    // 2. Set State (Only if > 1 match)
    if (matches.length > 1) {
      setTagNav({
        tag,
        matches,
        currentIndex: 0
      });
    } else {
      // Clear nav if we were open on another tag
      setTagNav({ tag: null, matches: [], currentIndex: 0 });
    }

    // 3. Scroll to first
    const element = document.getElementById(matches[0]);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setActiveNoteId(matches[0]);
    }
  }, [notes]);

  const handleNavNext = () => {
    if (!tagNav.tag || tagNav.matches.length === 0) return;

    const nextIndex = (tagNav.currentIndex + 1) % tagNav.matches.length;

    setTagNav(prev => ({ ...prev, currentIndex: nextIndex }));

    const id = tagNav.matches[nextIndex];
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setActiveNoteId(id);
    }
  };

  const handleNavPrev = () => {
    if (!tagNav.tag || tagNav.matches.length === 0) return;

    // Wrap around correctly
    const prevIndex = (tagNav.currentIndex - 1 + tagNav.matches.length) % tagNav.matches.length;

    setTagNav(prev => ({ ...prev, currentIndex: prevIndex }));

    const id = tagNav.matches[prevIndex];
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setActiveNoteId(id);
    }
  };

  const handleNavClose = () => {
    setTagNav({ tag: null, matches: [], currentIndex: 0 });
  };


  // Mobile Navigation Handlers
  const handleMobileDateClick = () => {
    setMobileDrawer({ isOpen: true, type: 'date' });
  };

  const handleMobileTagsClick = () => {
    setMobileDrawer({ isOpen: true, type: 'tags' });
  };

  const closeMobileDrawer = () => {
    setMobileDrawer({ isOpen: false, type: null });
  };

  const handleMobileDateSelect = (date) => {
    // Find first note for this date
    const target = notes.find(n => {
      const d = new Date(n.createdAt);
      return d.getFullYear() === date.getFullYear() &&
        d.getMonth() === date.getMonth() &&
        d.getDate() === date.getDate();
    });

    if (target) {
      const el = document.getElementById(target.id);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setActiveNoteId(target.id);
    }
    closeMobileDrawer();
  };

  const handleMobileTagSelect = (tag) => {
    handleTagClick(tag);
    closeMobileDrawer();
  };

  return (
    <div className="h-screen bg-background overflow-hidden flex flex-col">
      {/* Logo: Top Left */}
      <div className="fixed top-8 left-8 z-50 pointer-events-none select-none">
        <img
          src={logo.src}
          alt="Notes"
          className="w-24 h-5 [filter:invert(0)_sepia(0)_saturate(1)_hue-rotate(0deg)_brightness(0.96)] dark:[filter:invert(1)_sepia(0)_saturate(1)_hue-rotate(0deg)_brightness(1)] text-accent-foreground opacity-80"
        />
      </div>

      {/* Bottom Left Stack: Toggle above Avatar - HIDDEN ON MOBILE because Avatar is in Pill */}
      <div className="fixed bottom-8 left-8 z-50 hidden sm:flex flex-col items-center gap-6">
        {/* Theme Toggle */}
        <Button
          variant="ghost"
          size="icon"
          className="rounded-full shadow-sm bg-background/50 hover:bg-background border"
          onClick={() => setTheme(theme === "light" ? "dark" : "light")}
        >
          {theme === "light" ? <MoonIcon className="h-4 w-4" /> : <SunIcon className="h-4 w-4" />}
        </Button>

        {/* User Avatar */}
        <UserDropdown
          user={user}
          onSignOut={handleSignOut}
          onDeleteAccount={handleDeleteAccount}
        />
      </div>

      {/* Main Content Area - Notebook Layout */}
      <div className="flex-1 flex overflow-hidden relative">
        <TimelineRail
          notes={notes}
          activeNoteId={activeNoteId}
          tags={allTags}
          onTagClick={handleTagClick}
        />

        <TagsRail
          notes={notes}
          activeNoteId={activeNoteId}
          tags={allTags}
          onTagClick={handleTagClick}
        />

        <NotebookFeed
          notes={notes}
          onUpdateNote={(note, content) => editNote(note, content)}
          onCreateNote={(content) => addNote(content)}
          onDeleteNote={(id) => removeNote(id)}
          onFocusBox={(note) => {
            if (note) {
              setActiveNoteId(note.id);
            }
          }}
          // Pass focus handlers to track keyboard state
          onEditorFocus={() => setIsEditorFocused(true)}
          onEditorBlur={() => setIsEditorFocused(false)}
        />

        <TagNavigator
          tag={tagNav.tag}
          currentIndex={tagNav.currentIndex}
          totalMatches={tagNav.matches.length}
          onNext={handleNavNext}
          onPrev={handleNavPrev}
          onClose={handleNavClose}
        />

        <MobileNavPill
          notes={notes}
          activeNoteId={activeNoteId}
          user={user}
          onSignOut={handleSignOut}
          onDeleteAccount={handleDeleteAccount}
          isVisible={!isEditorFocused && !mobileDrawer.isOpen}
          onDateClick={handleMobileDateClick}
          onTagsClick={handleMobileTagsClick}
        />

        <MobileDrawers
          isOpen={mobileDrawer.isOpen}
          type={mobileDrawer.type}
          notes={notes}
          activeNoteId={activeNoteId}
          tags={allTags}
          onClose={closeMobileDrawer}
          onSelectDate={handleMobileDateSelect}
          onSelectTag={handleMobileTagSelect}
        />
      </div>
    </div>
  );
};

export default NoteApp;