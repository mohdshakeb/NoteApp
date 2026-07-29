"use client";
import React, { useState, useEffect, useMemo } from 'react';

// Components
import { TimelineRail } from './TimelineRail';
import { TagsRail } from './TagsRail';
import { TagNavigator } from './TagNavigator';
import { NoteResultsOverlay } from './NoteResultsOverlay';
import { MobileNavPill } from './MobileNavPill';
import { MobileDrawers } from './MobileDrawers';
import { NotebookFeed } from './NotebookFeed';
import { UserDropdown } from './ui/UserDropdown';
import { Button } from "./ui/button";
import { useTheme } from "./ThemeProvider";
import { LoginDropdown } from './LoginDropdown';
import { MergeToast } from './MergeToast'; // [NEW]
import { MoonIcon, SunIcon } from '@heroicons/react/24/outline';
import { Search } from 'lucide-react';

// Hooks
import { useNotes } from '../hooks/useNotes';
import { useTags } from '../hooks/useTags';
import { useNoteFinder } from '../hooks/useNoteFinder';
import { useMobileNav } from '../hooks/useMobileNav';

// Lib
import { deleteAccount, checkForGuestNotes, migrateGuestData, clearGuestData, cleanupEmptyNotes } from '../lib/db'; // [Updated]
import { supabase } from '../lib/supabase';
import { getTagMeta } from '../lib/colors';
import { exactTagFromQuery } from '../lib/tagMatch';
import { cn } from '../lib/utils';
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
  const { allTags, getSuggestions } = useTags(notes);

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
    session,
    handleTagClick,
    handleSearchQuery,
    handleNavNext,
    handleNavPrev,
    handleNavClose,
    isOverlayOpen,
    openOverlay,
    openSearchOverlay,
    closeOverlay,
    jumpToMatch
  } = useNoteFinder(notes, setActiveNoteId);

  // Persistent match wash on every matching note while a tag-nav or search
  // session is active — tag color for tag mode (and for an exact "#tag"
  // search, which behaves identically to clicking that tag), a neutral
  // fallback for a plain-text search.
  const activeMatchIds = useMemo(() => new Set(session.matches), [session.matches]);
  const matchWashClass = useMemo(() => {
    if (session.mode === 'tag') return getTagMeta(session.query).wash;
    if (session.mode === 'search') {
      const trimmed = session.query.trim();
      const exactTag = exactTagFromQuery(trimmed);
      if (exactTag) return getTagMeta(exactTag).wash;
      if (trimmed.length >= 2) return 'bg-accent/15 dark:bg-accent/25';
    }
    return '';
  }, [session.mode, session.query]);

  // Global Cmd/Ctrl+K — opens search from anywhere, including while a note is
  // focused in the editor. Safe against the current Tiptap extension list
  // (StarterKit + TagHighlight + Placeholder — none bind Cmd+K); re-check if
  // a link extension is ever added, since Cmd+K is a common "insert link" binding.
  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        openSearchOverlay();
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [openSearchOverlay]);

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

      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      await supabase.auth.clearSession();

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

      {/* Top Right Stack: Search / Theme Toggle - aligned with logo - shown on all breakpoints */}
      <div className="fixed top-8 right-4 sm:right-8 z-50 flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={openSearchOverlay}
          title="Search (⌘K)"
          className="h-10 w-10 rounded-full bg-background/80 backdrop-blur-md border border-border/50 can-hover:hover:bg-muted active:scale-95 transition-transform"
        >
          <Search className="h-4 w-4" />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
          title={theme === 'light' ? 'Dark mode' : 'Light mode'}
          className="relative h-10 w-10 rounded-full bg-background/80 backdrop-blur-md border border-border/50 can-hover:hover:bg-muted active:scale-95 transition-transform"
        >
          <SunIcon
            className={cn(
              "h-4 w-4 absolute transition-[transform,opacity] duration-200 ease-out",
              theme === 'light' ? "opacity-100 scale-100 rotate-0" : "opacity-0 scale-50 -rotate-90"
            )}
          />
          <MoonIcon
            className={cn(
              "h-4 w-4 absolute transition-[transform,opacity] duration-200 ease-out",
              theme === 'dark' ? "opacity-100 scale-100 rotate-0" : "opacity-0 scale-50 rotate-90"
            )}
          />
        </Button>
      </div>

      {/* Bottom Left: Login / User Dropdown - HIDDEN ON MOBILE */}
      <div className="fixed bottom-8 left-8 z-50 hidden sm:block">
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
          getSuggestions={getSuggestions}
          onUpdateNote={(note, content) => editNote(note, content)}
          onCreateNote={(content) => addNote(content)}
          onDeleteNote={(id) => removeNote(id)}
          onFocusBox={(note) => {
            if (note) setActiveNoteId(note.id);
          }}
          onEditorFocus={() => setIsEditorFocused(true)}
          onEditorBlur={() => setIsEditorFocused(false)}
          activeMatchIds={activeMatchIds}
          matchWashClass={matchWashClass}
          isTagNavActive={session.mode === 'tag'}
        />

        <TagNavigator
          tag={session.mode === 'tag' && session.matches.length > 1 ? session.query : null}
          currentIndex={session.currentIndex}
          totalMatches={session.matches.length}
          onNext={handleNavNext}
          onPrev={handleNavPrev}
          onClose={handleNavClose}
          onOpenOverlay={openOverlay}
        />

        <NoteResultsOverlay
          isOpen={isOverlayOpen}
          session={session}
          notes={notes}
          onSelect={jumpToMatch}
          onClose={closeOverlay}
          onQueryChange={handleSearchQuery}
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