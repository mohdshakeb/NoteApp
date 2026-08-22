import { Poppins } from 'next/font/google';
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

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={poppins.variable}>
      <body className="font-sans text-sm antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
