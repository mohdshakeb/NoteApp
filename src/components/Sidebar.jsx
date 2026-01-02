import React from 'react';
import { Button } from "./ui/button";
import {
    ChevronRightIcon,
    ChevronUpIcon,
    ChevronDownIcon,
    MagnifyingGlassIcon as SearchIcon
} from '@heroicons/react/24/outline';
import { NoteList } from './NoteList';

export const Sidebar = ({
    showSidebar,
    setShowSidebar,
    isMobile,
    expandedMobile,
    setExpandedMobile,
    notesCount,
    tags,
    selectedTag,
    onTagClick,
    filteredNotes,
    searchQuery,
    setSearchQuery,
    onEdit,
    onDelete
}) => {
    return (
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
                    if (!isMobile) {
                        setShowSidebar(!showSidebar);
                    } else {
                        setExpandedMobile(!expandedMobile);
                    }
                }}
            >
                {!isMobile ? (
                    <ChevronRightIcon className="h-4 w-4" />
                ) : (
                    expandedMobile ? <ChevronDownIcon className="h-4 w-4" /> : <ChevronUpIcon className="h-4 w-4" />
                )}
            </Button>

            {/* Sidebar Header - Only show on desktop */}
            <div className="hidden sm:block px-6 pt-3 pd-2">
                <h2 className="text-md font-medium">My Notes</h2>
                <p className="text-sm text-muted-foreground mt-0.5">
                    {notesCount} {notesCount === 1 ? 'note' : 'notes'}
                </p>
            </div>

            {(showSidebar || isMobile) && (
                <div className="flex flex-col h-full">
                    {/* Tags filter */}
                    <div className="px-6 pt-8 pb-2 bg-background/50">
                        <div className="flex gap-2 flex-wrap">
                            {tags.map(tag => (
                                <button
                                    key={tag}
                                    onClick={() => onTagClick(tag)}
                                    className={`px-3 py-1 text-xs rounded border ${selectedTag === tag
                                            ? 'bg-primary text-primary-foreground border-primary'
                                            : 'bg-muted border-input hover:bg-accent'
                                        }`}
                                >
                                    {tag}
                                </button>
                            ))}
                        </div>
                    </div>

                    <NoteList
                        notes={filteredNotes}
                        onTagClick={onTagClick}
                        onEdit={onEdit}
                        onDelete={onDelete}
                    />

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
    );
};
