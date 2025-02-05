import { useState } from 'react';
import { X, Share2, Trash2 } from 'lucide-react';
import { Button } from './ui/button';

const NoteModal = ({ note, onClose, onDelete, onEdit }) => {
  const [editedContent, setEditedContent] = useState(note.content);
  const [isEditing, setIsEditing] = useState(false);

  const handleSave = () => {
    onEdit({ ...note, content: editedContent });
    setIsEditing(false);
  };

  const handleShare = async () => {
    try {
      await navigator.share({
        text: note.content,
      });
    } catch (error) {
      console.log('Error sharing:', error);
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-background/80 backdrop-blur-sm z-[100]"
      onClick={onClose}
    >
      <div 
        className="fixed left-[50%] top-[50%] z-[101] grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg duration-200 sm:rounded-lg"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex flex-col space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              {note.createdAt && new Date(note.createdAt).toLocaleDateString()}
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Content */}
          {isEditing ? (
            <textarea
              value={editedContent}
              onChange={(e) => setEditedContent(e.target.value)}
              className="min-h-[100px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm focus:outline-none"
              autoFocus
            />
          ) : (
            <div 
              className="text-sm"
              onClick={() => setIsEditing(true)}
            >
              {note.content}
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2">
            {isEditing ? (
              <>
                <Button 
                  variant="outline" 
                  onClick={() => setIsEditing(false)}
                >
                  Cancel
                </Button>
                <Button onClick={handleSave}>
                  Save
                </Button>
              </>
            ) : (
              <>
                <Button 
                  variant="outline" 
                  size="icon"
                  onClick={handleShare}
                >
                  <Share2 className="h-4 w-4" />
                </Button>
                <Button 
                  variant="destructive" 
                  size="icon"
                  onClick={() => onDelete(note.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default NoteModal; 