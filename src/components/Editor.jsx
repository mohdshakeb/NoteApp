import React from 'react';
import { Card } from "./ui/card";
import { Button } from "./ui/button";

export const Editor = ({
    editableRef,
    onInput,
    showSaveButton,
    onSave,
    editingNote,
    showSuggestions,
    tagSuggestions,
    cursorPosition,
    onTagSelect
}) => {
    return (
        <>
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
                        onInput={onInput}
                        className="min-h-[24px] focus:outline-none text-lg overflow-x-hidden text-center empty:before:content-[attr(data-placeholder)] empty:before:text-muted-foreground/50"
                        role="textbox"
                        aria-label="Note input"
                        data-placeholder="What are you thinking... (use # for tags)"
                    />

                    {showSaveButton && (
                        <div className="mt-6 flex justify-center">
                            <Button onClick={onSave}>
                                {editingNote ? 'Update Note' : 'Save Note'}
                            </Button>
                        </div>
                    )}
                </Card>
            </div>

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
                            onClick={() => onTagSelect(tag)}
                        >
                            {tag}
                        </Button>
                    ))}
                </div>
            )}
        </>
    );
};
