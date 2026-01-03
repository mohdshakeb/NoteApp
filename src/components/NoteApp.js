"use client";
import React, { useState, useEffect } from 'react';

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
import { useTagNavigation } from '../hooks/useTagNavigation';
import { useMobileNav } from '../hooks/useMobileNav';

// Lib
import { deleteAccount } from '../lib/db';
import { supabase } from '../lib/supabase';
import logo from '../assets/logo.svg';

const NoteApp = ({ user }) => {
  const { theme, setTheme } = useTheme();

  // Core Data Hooks
  const { notes, isLoading, db, addNote, editNote, removeNote } = useNotes(user);
  const { allTags } = useTags(notes);

  // Active Note State
  const [activeNoteId, setActiveNoteId] = useState(null);

  // Custom Navigation Hooks
  const {
    tagNav,
    handleTagClick,
    handleNavNext,
    handleNavPrev,
    handleNavClose
  } = useTagNavigation(notes, setActiveNoteId);

  const {
    mobileDrawer,
    isEditorFocused,
    setIsEditorFocused,
    handleMobileDateClick,
    handleMobileTagsClick,
    closeMobileDrawer,
    handleMobileDateSelect,
    handleMobileTagSelect
  } = useMobileNav(notes, setActiveNoteId, handleTagClick);

  // Initialize active note to the last one (newest) on load
  useEffect(() => {
    if (notes.length > 0 && !activeNoteId) {
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

      {/* Bottom Left Stack: Toggle above Avatar - HIDDEN ON MOBILE */}
      <div className="fixed bottom-8 left-8 z-50 hidden sm:flex flex-col items-center gap-6">
        <Button
          variant="ghost"
          size="icon"
          className="rounded-full shadow-sm bg-background/50 hover:bg-background border"
          onClick={() => setTheme(theme === "light" ? "dark" : "light")}
        >
          {theme === "light" ? <MoonIcon className="h-4 w-4" /> : <SunIcon className="h-4 w-4" />}
        </Button>

        <UserDropdown
          user={user}
          onSignOut={handleSignOut}
          onDeleteAccount={handleDeleteAccount}
        />
      </div>

      {/* Main Content Area */}
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
            if (note) setActiveNoteId(note.id);
          }}
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