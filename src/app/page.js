'use client';

import React from 'react';
import NoteApp from '../components/NoteApp';
import { Auth } from '../components/Auth';
import { useAuth } from '../contexts/AuthContext';

export default function Home() {
  const { user, loading, isGuest } = useAuth();

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  return (user || isGuest) ? <NoteApp user={user} /> : <Auth />;
}
