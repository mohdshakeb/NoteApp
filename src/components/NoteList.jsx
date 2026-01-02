import React from 'react';
import { Card } from "./ui/card";
import { formatDate } from '../lib/utils';

export const NoteList = ({
    notes,
    onTagClick,
    onEdit,
    onDelete
}) => {
    const renderNoteContent = (content) => {
        return content.split(' ').map((word, i) =>
            word.startsWith('#') ? (
                <span
                    key={`tag-${i}-${word}`}
                    className="cursor-pointer text-muted-foreground hover:text-primary border-b border-dashed border-muted-foreground mx-1"
                    onClick={() => onTagClick(word.slice(1))}
                >
                    {word}
                </span>
            ) : (
                <span key={`word-${i}`}>{word}{' '}</span>
            )
        );
    };

    return (
        <div className="flex-1 overflow-auto min-h-0">
            <div className="px-6 py-4 space-y-4">
                {notes.map((note, index) => (
                    <React.Fragment key={note.id}>
                        <Card className="border-0 shadow-none bg-background/50">
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
                                            onClick={() => onEdit(note)}
                                            className="text-xs text-muted-foreground hover:text-primary"
                                        >
                                            Edit
                                        </button>
                                        <button
                                            onClick={() => onDelete(note.id)}
                                            className="text-xs text-muted-foreground hover:text-destructive"
                                        >
                                            Delete
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </Card>
                        {index < notes.length - 1 && (
                            <div className="border-t border-border/50 my-4 opacity-100" />
                        )}
                    </React.Fragment>
                ))}
                <div className="h-16" />
            </div>
        </div>
    );
};
