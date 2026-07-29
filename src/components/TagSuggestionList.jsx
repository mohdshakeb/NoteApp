import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import { cn } from '../lib/utils';
import { getTagMeta } from '../lib/colors';

// Rendered by TagSuggestion.js via ReactRenderer + Suggestion's floating-ui
// `mount()` — this component only owns list state (selection, keyboard nav)
// and appearance; positioning/dismissal/lifecycle live in the extension.
export const TagSuggestionList = forwardRef(({ items, command }, ref) => {
    const [selectedIndex, setSelectedIndex] = useState(0);

    useEffect(() => {
        setSelectedIndex(0);
    }, [items]);

    const selectItem = (index) => {
        const tag = items[index];
        if (tag) command(tag);
    };

    useImperativeHandle(ref, () => ({
        onKeyDown: ({ event }) => {
            if (!items.length) return false;

            if (event.key === 'ArrowUp') {
                setSelectedIndex((selectedIndex + items.length - 1) % items.length);
                return true;
            }
            if (event.key === 'ArrowDown') {
                setSelectedIndex((selectedIndex + 1) % items.length);
                return true;
            }
            if (event.key === 'Enter') {
                selectItem(selectedIndex);
                return true;
            }
            return false;
        },
    }), [selectedIndex, items]);

    if (!items.length) return null;

    return (
        <div className="z-50 min-w-[10rem] max-w-[16rem] origin-top-left overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95 duration-150">
            {items.map((tag, index) => {
                const meta = getTagMeta(tag);
                const isSelected = index === selectedIndex;

                return (
                    <button
                        key={tag}
                        type="button"
                        onMouseEnter={() => setSelectedIndex(index)}
                        onClick={() => selectItem(index)}
                        className={cn(
                            "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm font-mono transition-colors",
                            isSelected ? "bg-accent text-accent-foreground" : "text-foreground"
                        )}
                    >
                        <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", meta.tick)} />
                        <span className={cn("truncate", meta.text)}>#{tag}</span>
                    </button>
                );
            })}
        </div>
    );
});

TagSuggestionList.displayName = 'TagSuggestionList';
