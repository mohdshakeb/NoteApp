import React, { useRef, useEffect } from 'react';
import { cn } from '../lib/utils';
import { Button } from "./ui/button";
import { getTagColor } from '../lib/colors';

// Helper to render content with highlighted tags
const renderHighlightedContent = (text) => {
    if (!text) return null;

    // Split by tags
    // Regex matches: (#tag)
    const parts = text.split(/(#[\w-]+)/g);

    return parts.map((part, i) => {
        if (part.startsWith('#')) {
            const colorClass = getTagColor(part.substring(1)); // Remove # for hash
            return (
                <span key={i} className={cn("rounded px-0.5 -mx-0.5", colorClass)}>
                    {part}
                </span>
            );
        }
        return part;
    });
};

export const EntryBlock = ({
    note,
    onSave,
    onInput,
    onFocus,
    autoFocus = false,
    isLast = false
}) => {
    const contentRef = useRef(null);

    useEffect(() => {
        if (autoFocus && contentRef.current) {
            contentRef.current.focus();
            const range = document.createRange();
            range.selectNodeContents(contentRef.current);
            range.collapse(false);
            const sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(range);
        }
    }, [autoFocus]);

    const handleInput = (e) => {
        if (onInput) {
            onInput(note.id, e.target.innerText);
        }
    };

    const handleBlur = (e) => {
        if (onSave) {
            onSave(note.id, e.target.innerText);
        }
    };

    return (
        <div id={note.id} className="group relative w-full max-w-3xl mx-auto py-4">
            {/* 
               Highlight Overlay (Backdrop) 
               - Positioned absolutely behind the input
               - Must match font/size/spacing EXACTLY
               - Text color is transparent so only bg colors of spans show? 
                 Actually, we want the text to be visible in front (from the input).
                 So the backdrop should have transparent text? 
                 Yes, 'text-transparent' for the base text, but the SPANS inside might define text color.
                 Wait, if we use 'text-transparent' on the backdrop, the non-tag text is invisible.
                 The tag text inside the spans will be visible if we set a color.
                 BUT the input is on TOP. If the input has opaque text, it will cover the backdrop.
                 
                 Standard Backdrop Pattern:
                 1. Front (Input): text-transparent (caret color visible), bg-transparent.
                 2. Back (Highlight): text-foreground, has the colors.
                 
                 Issue: Caret color in a transparent text div is tricky in some browsers.
                 
                 Alternative: 
                 1. Front (Input): Text Visible (Normal). bg-transparent. 
                 2. Back (Highlight): Text Transparent. Spans have Background Color.
                 This way the color shows behind the black text of the input.
            */}
            <div className="absolute inset-0 pointer-events-none whitespace-pre-wrap leading-relaxed text-sm font-mono overflow-hidden" aria-hidden="true">
                {/* Backdrop renders ALL text. Normal text matches foreground. Tags are colored. */}
                {renderHighlightedContent(note.content)}
            </div>

            {/* Content Input */}
            <div
                ref={contentRef}
                contentEditable
                suppressContentEditableWarning
                onInput={handleInput}
                onBlur={handleBlur}
                onFocus={() => onFocus && onFocus(note)}
                className="relative z-10 w-full min-h-[1.5em] outline-none text-sm font-mono text-transparent caret-foreground whitespace-pre-wrap leading-relaxed bg-transparent empty:before:content-[attr(data-placeholder)] empty:before:text-muted-foreground/40"
                data-placeholder={isLast ? "Write something..." : ""}
            >
                {note.content}
            </div>

            {/* Hover Controls (Delete, etc - Minimalist) */}
            <div className="absolute -right-12 top-4 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={() => {
                        // Trigger deletion by saving empty content or passing a specific delete prop?
                        // The parent handles delete if content is empty. So we can clear content and blur?
                        // Or better to pass onDelete prop.
                        if (contentRef.current) {
                            contentRef.current.innerText = "";
                            contentRef.current.blur(); // Triggers onSave with empty string -> Delete
                        }
                    }}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                    </svg>
                </Button>
            </div>
        </div>
    );
};
