import React, { useState, useEffect } from 'react';
import { supabase, testSupabaseConnection } from './lib/supabase';
import NoteApp from './components/NoteApp';
import { Auth } from './components/Auth';

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Test Supabase connection
    testSupabaseConnection();

    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-background">
      {user ? <NoteApp user={user} /> : <Auth onLogin={setUser} />}
    </div>
  );
}

export default App;