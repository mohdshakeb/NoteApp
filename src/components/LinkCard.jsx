import { useState } from 'react';

// Favicon + hostname + URL, derived purely at render time from note.content
// (never stored) — same "derived, never stored" principle as tags. The
// favicon endpoint is an unofficial, undocumented Google service, widely
// used in production for exactly this, but with no SLA — the onError
// fallback is required, not optional polish.
export function LinkCard({ url }) {
    const [faviconFailed, setFaviconFailed] = useState(false);

    const href = /^https?:\/\//i.test(url) ? url : `https://${url}`;
    let hostname = url;
    try {
        hostname = new URL(href).hostname.replace(/^www\./, '');
    } catch {
        // Malformed URL text somehow slipped past findLinkMatches — fall
        // back to showing the raw matched text as the label.
    }
    const faviconSrc = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(hostname)}&sz=32`;

    return (
        <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            // Stops the click from bubbling into whatever click-to-edit /
            // click-to-focus handler the parent note row has — this card is
            // rendered inside that row in both TiptapEditor and
            // StaticNotePreview, and without this, clicking it would also
            // activate/focus the note underneath it.
            onClick={(e) => e.stopPropagation()}
            className="flex min-h-11 max-w-full items-center gap-2 rounded-md border border-border px-2.5 py-2 text-sm transition-colors hover:bg-accent/50"
        >
            {!faviconFailed ? (
                <img
                    src={faviconSrc}
                    alt=""
                    width={16}
                    height={16}
                    className="shrink-0 rounded-sm"
                    onError={() => setFaviconFailed(true)}
                />
            ) : (
                <span className="h-4 w-4 shrink-0 rounded-sm bg-muted" aria-hidden="true" />
            )}
            <span className="truncate font-medium">{hostname}</span>
            <span className="truncate text-xs text-muted-foreground">{url}</span>
        </a>
    );
}
