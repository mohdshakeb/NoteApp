import { Poppins } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';

// Weights match the sibling Android app's bundled set (ui/theme/Type.kt) —
// Regular/Medium/SemiBold/Bold are the only weights any typography role
// actually requests on either platform.
const poppins = Poppins({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
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
