import { useState, useEffect, useRef } from 'react';
import { Search, X } from 'lucide-react';

const BottomSheet = ({ notes, onDeleteNote, onEditNote, formatDate, setSelectedTag }) => {
  const sheetRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startY, setStartY] = useState(0);
  const [currentHeight, setCurrentHeight] = useState(45); // Start just below header
  const [searchQuery, setSearchQuery] = useState('');
  const isFullyOpen = currentHeight >= 90;

  const toggleSheet = () => {
    if (currentHeight === 45) {
      setCurrentHeight(92);
    } else if (currentHeight === 92) {
      setCurrentHeight(45);
    }
  };

  const handleTouchStart = (e) => {
    // Prevent toggle when dragging the handle
    e.stopPropagation();
    setIsDragging(true);
    setStartY(e.touches[0].clientY);
  };

  const handleTouchMove = (e) => {
    if (!isDragging) return;
    
    const deltaY = startY - e.touches[0].clientY;
    const screenHeight = window.innerHeight;
    const newHeight = (currentHeight * screenHeight + deltaY) / screenHeight * 100;
    
    // Allow full range of motion
    setCurrentHeight(Math.min(Math.max(newHeight, 0), 95));
    setStartY(e.touches[0].clientY);
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    // Snap to preset positions
    if (currentHeight < 25) {
      setCurrentHeight(0); // Close the sheet completely
    } else if (currentHeight < 65) {
      setCurrentHeight(45); // Snap to just below header
    } else {
      setCurrentHeight(92); // Full height minus header
    }
  };

  const filteredNotes = notes.filter(note => 
    note.content.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div 
      ref={sheetRef}
      className={`fixed bottom-0 left-0 right-0 bg-muted shadow-lg transition-all duration-300 ease-in-out sm:hidden ${
        currentHeight === 0 ? 'translate-y-full' : ''
      }`}
      style={{ 
        height: `${currentHeight}vh`,
        transform: currentHeight === 0 ? 'translateY(100%)' : 'translateY(0)',
      }}
      onClick={toggleSheet}
    >
      {/* Background Overlay */}
      <div 
        className={`fixed inset-0 bg-background transition-opacity duration-300 ${
          currentHeight > 0 ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`} 
        style={{ zIndex: -1 }}
      />

      {/* Drag Handle */}
      <div 
        className="absolute top-0 left-0 right-0 h-12 bg-background flex justify-center items-center cursor-grab"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div className="w-12 h-1.5 bg-muted-foreground/20 rounded-full" />
      </div>

      {/* Notes Container */}
      <div className="h-full pt-12 pb-16 overflow-auto" onClick={(e) => e.stopPropagation()}>
        {/* Tags Filter */}
        {notes.length > 0 && (
          <div className="px-4 mb-4">
            <div className="flex gap-2 flex-wrap">
              {Array.from(new Set(notes.flatMap(note => 
                note.content.split(' ')
                  .filter(word => word.startsWith('#'))
                  .map(tag => tag.slice(1))
              ))).map(tag => (
                <button
                  key={tag}
                  onClick={() => setSelectedTag(tag)}
                  className="px-3 py-1 text-xs rounded bg-muted border-input hover:bg-accent"
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="p-4 space-y-4">
          {filteredNotes.map((note, index) => (
            <>
              <div key={note.id}>
                <div className="text-[12px] text-muted-foreground mb-2">
                  {formatDate(note.createdAt)}
                </div>
                <div className="text-[14px]">
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
                      onClick={() => onEditNote(note)}
                      className="text-xs text-muted-foreground hover:text-foreground"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => onDeleteNote(note.id)}
                      className="text-xs text-muted-foreground hover:text-foreground"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
              {index < filteredNotes.length - 1 && (
                <div className="border-t border-border/50 my-4 opacity-30" />
              )}
            </>
          ))}
        </div>
      </div>

      {/* Fixed Search Bar */}
      {isFullyOpen && (
        <div 
          className="absolute bottom-0 left-0 right-0 p-4 border-t bg-background"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search notes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-10 py-2 text-sm rounded-md border border-input bg-background focus:border-input focus:outline-none focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0"
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
      )}
    </div>
  );
};

export default BottomSheet; 