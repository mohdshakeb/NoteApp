import { Poppins } from 'next/font/google';
import Script from 'next/script';
import './globals.css';
import { Providers } from './providers';

// Weights verified against actual usage (grep for font-* across src/,
// 2026-08-22): font-normal/medium/semibold are the only ones any component
// requests. Android's Type.kt also bundles 700/Bold "for any future call
// site" — that's a real weight difference between the two apps' shipped
// bundles, not a divergence to silently paper over by copying it here
// unused; add 700 back if/when a web component actually needs it.
const poppins = Poppins({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-poppins',
});

export const metadata = {
  title: 'Notes',
  description: 'Offline-first Note Application',
}

// Android magic-link handoff (2026-09-29 — see NoteAppAndroid/Planning/DECISIONS.md and this
// repo's own DECISIONS.md for the full writeup). bnb.mostlyuseful.in is a verified Android App
// Link, so tapping a magic link SHOULD open the native app directly without this page ever
// loading — but whether that actually happens also depends on a per-device Android "Open by
// default" setting the app can't force on, so on some devices the tap still lands here in the
// browser instead. This is a best-effort fallback for exactly that case: hand off to the native
// app via an intent:// URL (same mechanism Twitter/Medium/etc. use), so the user isn't silently
// left signed into the web version only.
//
// Why this has to be a beforeInteractive script, not a normal component effect: magic-link
// tokens are single-use. AuthContext.js calls supabase.auth.getSession() inside a useEffect,
// which is what actually exchanges the token — if that runs first, the token is spent and
// relaunching the app afterward would NOT sign it in, just open it to its existing (logged-out)
// state. beforeInteractive runs before hydration, before AuthContext's effect can fire, so this
// has a comfortable head start on that race rather than a photo-finish one.
//
// Scoped strictly to bnb.mostlyuseful.in: LoginDropdown.jsx's own magic-link flow uses
// `emailRedirectTo: window.location.origin`, so a sign-in requested FROM the web app always
// redirects back to whatever web origin requested it — never to this domain. Only the Android
// app's own AuthManager.signInWithEmail (AppContainer.kt: scheme=https, host=bnb.mostlyuseful.in)
// sends anyone here. So by construction, nobody reaches this domain with real auth params unless
// they already initiated sign-in from the Android app — this can never hijack someone who
// deliberately wants the web version.
//
// No visible UI, no polling/waiting loop: this either fires a single fire-and-forget navigation
// or does nothing. That matters for in-app WebViews (Gmail/Instagram, etc.) that sometimes block
// intent:// app-switches outright — if blocked, nothing happens and the page just renders
// normally, same as if this script didn't exist. There's no stuck-loading state to fall out of
// because none is ever shown.
//
// The one part of this that's genuinely uncertain from source-reading alone: Chrome's intent://
// syntax reserves a bare "#" to introduce the "#Intent;...;end" extras block, so the auth hash
// (itself a URL fragment, e.g. "#access_token=...") has to be percent-encoded as %23 to survive
// inside the intent's data segment instead of being misread as that boundary — this is the
// documented workaround, but it needs a real on-device check (tap a real magic link with "Open
// by default" off, confirm the app opens AND is actually signed in, not just that it opened).
const ANDROID_HANDOFF_SCRIPT = `
(function () {
  try {
    var HOST = 'bnb.mostlyuseful.in';
    var PACKAGE = 'in.mostlyuseful.bnb';
    if (window.location.hostname !== HOST) return;
    if (!/Android/i.test(window.navigator.userAgent || '')) return;
    var hash = window.location.hash || '';
    var search = window.location.search || '';
    var hasAuthParams = hash.indexOf('access_token=') !== -1 || search.indexOf('code=') !== -1;
    if (!hasAuthParams) return;
    var encodedFragment = hash ? '%23' + hash.slice(1) : '';
    var playStoreUrl = 'https://play.google.com/store/apps/details?id=' + PACKAGE;
    var intentUrl =
      'intent://' + HOST + '/' + search + encodedFragment +
      '#Intent;action=android.intent.action.VIEW;scheme=https;package=' + PACKAGE +
      ';S.browser_fallback_url=' + encodeURIComponent(playStoreUrl) + ';end';
    window.location.href = intentUrl;
  } catch (e) {
    // Never let a handoff failure block normal sign-in — worst case, the page just renders
    // the normal web sign-in flow, exactly as it did before this existed.
  }
})();
`;

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={poppins.variable}>
      <body className="font-sans text-sm antialiased">
        <Script id="android-app-handoff" strategy="beforeInteractive">
          {ANDROID_HANDOFF_SCRIPT}
        </Script>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
