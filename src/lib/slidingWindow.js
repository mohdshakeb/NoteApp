// Shared "windowed list centered on active item" logic, used by TimelineRail
// and TagsRail so the side rails don't render every date/tag when there are
// many — only a window of WINDOW_SIZE items centered on whatever is active.

const WINDOW_SIZE = 25;
const WINDOW_BEFORE = 12; // items kept before the active index (window is 12 + 1 + 12 = 25)

export function getSlidingWindow(items, activeIndex) {
    if (items.length <= WINDOW_SIZE) return items;
    if (activeIndex === -1) return items.slice(0, WINDOW_SIZE);

    let start = activeIndex - WINDOW_BEFORE;
    let end = activeIndex + (WINDOW_SIZE - WINDOW_BEFORE);

    if (start < 0) {
        start = 0;
        end = WINDOW_SIZE;
    }
    if (end > items.length) {
        end = items.length;
        start = Math.max(0, end - WINDOW_SIZE);
    }

    return items.slice(start, end);
}
