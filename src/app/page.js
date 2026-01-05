'use client';

import React from 'react';
import NoteApp from '../components/NoteApp';
import { useAuth } from '../contexts/AuthContext';

export default function Home() {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen bg-background text-muted-foreground animate-pulse">Loading Notes...</div>;
  }

  return <NoteApp user={user} />;
}
