// Deterministic color assignment for tags
const PALETTE = [
    {
        bg: "bg-yellow-200/50 dark:bg-yellow-900/40",
        text: "text-yellow-900 dark:text-yellow-100",
        tick: "bg-yellow-500 dark:bg-yellow-400"
    },
    {
        bg: "bg-green-200/50 dark:bg-green-900/40",
        text: "text-green-900 dark:text-green-100",
        tick: "bg-green-600 dark:bg-green-400"
    },
    {
        bg: "bg-blue-200/50 dark:bg-blue-900/40",
        text: "text-blue-900 dark:text-blue-100",
        tick: "bg-blue-600 dark:bg-blue-400"
    },
    {
        bg: "bg-pink-200/50 dark:bg-pink-900/40",
        text: "text-pink-900 dark:text-pink-100",
        tick: "bg-pink-500 dark:bg-pink-400"
    },
    {
        bg: "bg-purple-200/50 dark:bg-purple-900/40",
        text: "text-purple-900 dark:text-purple-100",
        tick: "bg-purple-600 dark:bg-purple-400"
    },
    {
        bg: "bg-orange-200/50 dark:bg-orange-900/40",
        text: "text-orange-900 dark:text-orange-100",
        tick: "bg-orange-500 dark:bg-orange-400"
    },
    {
        bg: "bg-teal-200/50 dark:bg-teal-900/40",
        text: "text-teal-900 dark:text-teal-100",
        tick: "bg-teal-600 dark:bg-teal-400"
    },
    {
        bg: "bg-rose-200/50 dark:bg-rose-900/40",
        text: "text-rose-900 dark:text-rose-100",
        tick: "bg-rose-500 dark:bg-rose-400"
    },
];

export const getTagMeta = (tagName) => {
    if (!tagName) return PALETTE[0];
    let hash = 0;
    for (let i = 0; i < tagName.length; i++) {
        hash = tagName.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % PALETTE.length;
    return PALETTE[index];
};

export const getTagColor = (tagName) => {
    const meta = getTagMeta(tagName);
    return `${meta.bg} ${meta.text}`;
};
