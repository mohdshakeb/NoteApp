import React from 'react';
import { supabase } from './lib/supabase';
import NoteApp from './components/NoteApp';
import { Auth } from './components/Auth';
import { ThemeProvider } from './components/ThemeProvider';
import { AuthProvider } from './contexts/AuthContext';
import { useAuth } from './contexts/AuthContext';

function AppContent() {
  const { user, loading, isGuest } = useAuth();

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  return (user || isGuest) ? <NoteApp user={user} /> : <Auth />;
}

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;