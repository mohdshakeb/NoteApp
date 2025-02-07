import { useRef, useMemo } from 'react';
import { Search, X, XCircle } from 'lucide-react';
import { Button } from './ui/button';
import { ChevronUpIcon, ChevronDownIcon } from '@heroicons/react/24/outline';

const BottomSheet = ({ 
  notes, 
  onDeleteNote, 
  onEditNote, 
  formatDate, 
  selectedTag, 
  setSelectedTag,
  expandedMobile,
  setExpandedMobile,
  searchQuery,
  setSearchQuery
}) => {
  const sheetRef = useRef(null);

  const uniqueTags = useMemo(() => 
    Array.from(new Set(notes.flatMap(note => 
      note.content.split(' ')
        .filter(word => word.startsWith('#'))
        .map(tag => tag.slice(1))
    )))
  , [notes]);

  const filteredNotes = notes.filter(note => {
    const matchesSearch = 
      note.content.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesTag = 
      !selectedTag || 
      note.content
        .split(' ')
        .filter(word => word.startsWith('#'))
        .map(tag => tag.slice(1))
        .includes(selectedTag);
    
    return matchesSearch && matchesTag;
  });

  return (
    <div 
      ref={sheetRef}
      className={`
        fixed bottom-0 left-0 right-0 
        bg-background shadow-lg 
        transition-all duration-500 cubic-bezier(0.34, 1.56, 0.64, 1)
        border-t
        ${expandedMobile ? 'h-[calc(100vh-64px)]' : 'h-[50vh]'}
      `}
    >
      {/* Collapse Button */}
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setExpandedMobile(!expandedMobile)}
        className="absolute left-1/2 -top-4 -translate-x-1/2 h-8 w-8 rounded-full bg-background border"
      >
        {expandedMobile ? (
          <ChevronDownIcon className="h-4 w-4" />
        ) : (
          <ChevronUpIcon className="h-4 w-4" />
        )}
      </Button>

      <div className="h-full flex flex-col">
        {/* Tags Filter */}
        {notes.length > 0 && (
          <div className="px-4 pt-6 pb-3 bg-background/50">
            <div className="flex gap-2 flex-wrap">
              {uniqueTags.map(tag => (
                <button
                  key={tag}
                  onClick={() => setSelectedTag(tag === selectedTag ? null : tag)}
                  className={`px-3 py-1 text-xs rounded border ${
                    selectedTag === tag 
                    ? 'bg-primary text-primary-foreground border-primary' 
                    : 'bg-muted border-input hover:bg-accent'
                  }`}
                >
                  {tag}
                  {selectedTag === tag }
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Notes List */}
        <div className="flex-1 overflow-auto min-h-0">
          <div className="divide-y">
            {filteredNotes.map((note, index) => (
              <div key={note.id}>
                <div 
                  className="px-4 py-3"
                >
                  <div className="text-xs text-muted-foreground">
                    {formatDate(note.createdAt)}
                  </div>
                  <div className="mt-1 text-sm">
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
                  <div className="flex items-center gap-3 mt-3">
                    <button
                      onClick={() => onEditNote(note)}
                      className="text-xs text-muted-foreground"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => onDeleteNote(note.id)}
                      className="text-xs text-muted-foreground"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Search Bar */}
        <div className="px-4 pt-3 pb-4 border-t bg-background sticky bottom-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search notes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-10 py-2 text-sm rounded-full border border-input bg-background focus:border-input focus:outline-none focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default BottomSheet; 