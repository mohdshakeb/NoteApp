import { Extension } from '@tiptap/core';
import { PluginKey } from '@tiptap/pm/state';
import Suggestion, { exitSuggestion } from '@tiptap/suggestion';
import { ReactRenderer } from '@tiptap/react';
import { TagSuggestionList } from '../TagSuggestionList';

const pluginKey = new PluginKey('tagSuggestion');

// Tag-autocomplete-while-typing. Trigger char '#' with the library's default
// `allowedPrefixes: [' ']` — a match only starts at the beginning of a text
// node or right after a space, the same start-or-whitespace anchor
// `lib/tags.js` uses for "what counts as a tag", so this won't offer
// suggestions inside a glued `foo#bar`.
export const TagSuggestion = Extension.create({
    name: 'tagSuggestion',

    addOptions() {
        return {
            // (query: string) => string[]. Wired up by TiptapEditor to
            // useTags.js's `getSuggestions` via a ref, so this always reads
            // the current tag list without forcing the editor to re-init.
            getSuggestions: () => [],
        };
    },

    addProseMirrorPlugins() {
        const extension = this;

        return [
            Suggestion({
                editor: this.editor,
                char: '#',
                pluginKey,
                items: ({ query }) => extension.options.getSuggestions(query),
                command: ({ editor, range, props: tag }) => {
                    // getSuggestions (useTags.js) returns bare tag names —
                    // findTagMatches strips the leading '#' when building
                    // allTags — so it has to be restored here.
                    editor.chain().focus().deleteRange(range).insertContent(`#${tag} `).run();
                },
                render: () => {
                    let component;
                    let unmount;

                    return {
                        onStart: (props) => {
                            component = new ReactRenderer(TagSuggestionList, {
                                props,
                                editor: props.editor,
                            });
                            unmount = props.mount(component.element);
                        },
                        onUpdate: (props) => {
                            component.updateProps(props);
                        },
                        onKeyDown: (props) => {
                            if (props.event.key === 'Escape') {
                                exitSuggestion(props.view, pluginKey);
                                return true;
                            }
                            return component.ref?.onKeyDown(props) ?? false;
                        },
                        onExit: () => {
                            unmount?.();
                            component.destroy();
                        },
                    };
                },
            }),
        ];
    },
});
