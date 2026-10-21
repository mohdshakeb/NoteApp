// Matches the Android app's two placeholder copies exactly (NoteFeedScreen.kt's
// `isOnlyNote` branch) — the pre-first-note state reads as a reply to
// FeedHeader's tagline above it, every other blank note needs to stand on
// its own, but both teach the same #-tag mechanic with the same closing clause.
export const NOTE_PLACEHOLDER_TEXT = 'Half-formed is fine — type it, tag it with #.';
export const NOTE_PLACEHOLDER_TEXT_ONLY_NOTE = 'Whatever it is — type it, tag it with #.';

// Android app's Play Store listing. Same package as layout.js's ANDROID_HANDOFF_SCRIPT, which
// has to inline its own copy (beforeInteractive scripts can't import). `referrer` carries the UTM
// params Play Console's acquisition reports attribute installs by — the header link and the
// desktop QR get different campaigns so the two entry points can be compared. Changing
// PLAY_STORE_URL_QR means regenerating lib/playStoreQr.js.
const PLAY_STORE_LISTING_URL = 'https://play.google.com/store/apps/details?id=in.mostlyuseful.bnb';
export const PLAY_STORE_URL_HEADER = `${PLAY_STORE_LISTING_URL}&referrer=utm_source%3Dweb%26utm_campaign%3Dheader_button`;
export const PLAY_STORE_URL_QR = `${PLAY_STORE_LISTING_URL}&referrer=utm_source%3Dweb%26utm_campaign%3Ddesktop_qr`;
