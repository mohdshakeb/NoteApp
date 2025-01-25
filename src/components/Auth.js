import React from 'react';
import { supabase } from '../lib/supabase';
import { Button } from './ui/button';

export function Auth({ onLogin }) {
  const signInWithGoogle = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/`,
          scopes: 'email profile',
        }
      });
      if (error) throw error;
    } catch (error) {
      console.error('Auth error:', error);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen">
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-8">Notes App</h1>
        <Button onClick={signInWithGoogle}>
          Sign in with Google
        </Button>
      </div>
    </div>
  );
} 