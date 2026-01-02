'use client'

import { ThemeProvider } from '../components/ThemeProvider';
import { AuthProvider } from '../contexts/AuthContext';

export function Providers({ children }) {
  return (
    <ThemeProvider>
      <AuthProvider>
        {children}
      </AuthProvider>
    </ThemeProvider>
  );
}
