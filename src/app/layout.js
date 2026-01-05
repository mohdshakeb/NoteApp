import './globals.css';
import { Providers } from './providers';

export const metadata = {
  title: 'Notes',
  description: 'Offline-first Note Application',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="font-mono text-sm antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
