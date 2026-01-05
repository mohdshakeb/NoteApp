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
import { LoginDropdown } from './LoginDropdown';
import { MergeToast } from './MergeToast'; // [NEW]
import { MoonIcon, SunIcon } from '@heroicons/react/24/outline';

// Hooks
import { useNotes } from '../hooks/useNotes';
import { useTags } from '../hooks/useTags';
import { useTagNavigation } from '../hooks/useTagNavigation';
import { useMobileNav } from '../hooks/useMobileNav';

// Lib
import { deleteAccount, checkForGuestNotes, migrateGuestData, clearGuestData, cleanupEmptyNotes } from '../lib/db'; // [Updated]
import { supabase } from '../lib/supabase';
import logo from '../assets/logo.svg';

const NoteApp = ({ user }) => {
  const { theme, setTheme } = useTheme();


  // Merge Dialog State
  const [showMergeDialog, setShowMergeDialog] = useState(false);
  const [guestNoteCount, setGuestNoteCount] = useState(0);

  // Core Data Hooks
  // We need to trigger a re-fetch after merge, so we might need a manual trigger from useNotes
  // For now, let's rely on the fact that modifying DB and triggering state update might be enough, 
  // or we can force a reload.
  const { notes, isLoading, db, addNote, editNote, removeNote, refreshNotes } = useNotes(user);
  const { allTags } = useTags(notes);

  // Active Note State
  const [activeNoteId, setActiveNoteId] = useState(null);

  // Check for guest notes on login
  useEffect(() => {
    const checkGuestData = async () => {
      if (user && db) {
        const count = await checkForGuestNotes(db);
        if (count > 0) {
          setGuestNoteCount(count);
          setShowMergeDialog(true);
        }
      }
    };
    checkGuestData();
  }, [user, db]);

  const handleMergeGuestData = async () => {
    if (!db || !user) return;
    await migrateGuestData(db, user.id);
    await cleanupEmptyNotes(db, user.id); // [NEW] Remove redundant empty notes
    setShowMergeDialog(false);
    // Refresh notes to show merged data without reloading page
    refreshNotes();
  };

  const handleDiscardGuestData = async () => {
    if (!db) return;
    await clearGuestData(db);
    setShowMergeDialog(false);
    window.location.reload();
  };

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
        // Clear local DB on sign out? 
        // Or keep it? The prompt says "Once logged in notes can be synced".
        // But sign out usually means "Leave this device". 
        // For secure apps, we should clear.
        const tx = db.transaction('notes', 'readwrite');
        const store = tx.objectStore('notes');
        await store.clear();
        await tx.done;
      }

      if (user?.isGuest) {
        localStorage.removeItem('guestUser');
      } else {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
        await supabase.auth.clearSession();
      }

      localStorage.removeItem(`defaultNotes-${user?.id}`);

      // Robustly clear Supabase tokens (handling different project IDs)
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith('sb-') && key.endsWith('-auth-token')) {
          localStorage.removeItem(key);
        }
      });

    } catch (error) {
      console.error('Error signing out:', error);
    } finally {
      if (typeof window !== 'undefined') {
        window.sessionStorage.clear();
        // Don't clear EVERYTHING, might break theme etc.
        // window.localStorage.clear(); 
      }
      window.location.href = '/';
    }
  };

  const handleDeleteAccount = async () => {
    try {
      await deleteAccount(db, user?.id);
      window.location.replace('/');
    } catch (error) {
      console.error('Error deleting account:', error);
      alert('Failed to delete account. Please try again.');
    }
  };

  return (
    <div className="h-screen bg-background overflow-hidden flex flex-col">
      {/* Merge Confirmation Toast */}
      <MergeToast
        isOpen={showMergeDialog}
        guestNoteCount={guestNoteCount}
        onMerge={handleMergeGuestData}
        onDiscard={handleDiscardGuestData}
      />

      {/* Logo: Top Left - Aligned with Pill (left-4) */}
      <div className="fixed top-8 left-4 z-50 pointer-events-none select-none bg-background/60 backdrop-blur-md rounded-full px-4 py-2 border border-border/20 support-backdrop-blur:bg-background/60">
        <img
          src={logo.src}
          alt="Notes"
          className="w-24 h-5 [filter:invert(0)_sepia(0)_saturate(1)_hue-rotate(0deg)_brightness(0.96)] dark:[filter:invert(1)_sepia(0)_saturate(1)_hue-rotate(0deg)_brightness(1)] text-accent-foreground"
        />
      </div>

      {/* Bottom Left Stack: Login/User Dropdown - HIDDEN ON MOBILE */}
      <div className="fixed bottom-8 left-8 z-50 hidden sm:flex flex-col items-center gap-6">
        {user ? (
          <UserDropdown
            user={user}
            onSignOut={handleSignOut}
            onDeleteAccount={handleDeleteAccount}
          />
        ) : (
          <LoginDropdown>
            <Button className="rounded-full shadow-lg">
              Login
            </Button>
          </LoginDropdown>
        )}
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