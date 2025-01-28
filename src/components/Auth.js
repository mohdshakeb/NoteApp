import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Button } from './ui/button';
import { Card } from './ui/card';

export function Auth() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [guestName, setGuestName] = useState('');
  const [showGuestForm, setShowGuestForm] = useState(false);

  const getInitials = (name) => {
    return name
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase();
  };

  const handleEmailSignIn = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: window.location.origin,
        },
      });
      
      if (error) throw error;
      
      setMessage('Check your email for the login link!');
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGuestMode = (e) => {
    e.preventDefault();
    if (!guestName.trim()) return;
    
    const initials = getInitials(guestName);
    const guestUser = {
      id: 'guest-' + Date.now(),
      user_metadata: {
        full_name: guestName,
        initials: initials
      },
      isGuest: true
    };
    
    localStorage.setItem('guestUser', JSON.stringify(guestUser));
    window.location.reload();
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header Logo */}
      <div className="p-6">
        <svg className="w-24 h-8" viewBox="0 0 100 40" fill="currentColor">
          <text x="10" y="30" className="text-2xl font-bold">Notes</text>
        </svg>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md space-y-8">
          <div className="text-center">
            <h2 className="text-3xl font-bold tracking-tight">
              Welcome to Notes
            </h2>
            <p className="mt-2 text-muted-foreground">
              Note taking app designed for teams and individuals
            </p>
          </div>

          <Card className="p-6 space-y-4">
            <Button 
              variant="outline" 
              className="w-full flex items-center justify-center gap-2"
              onClick={() => supabase.auth.signInWithOAuth({ provider: 'google' })}
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              Continue with Google
            </Button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">
                  OR
                </span>
              </div>
            </div>

            <div className="space-y-4">
              <form onSubmit={handleEmailSignIn} className="space-y-4">
                <div>
                  <label className="text-sm font-medium" htmlFor="email">
                    Email
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    placeholder="Type your email"
                    required
                  />
                </div>
                <Button 
                  type="submit" 
                  className="w-full"
                  disabled={loading}
                >
                  {loading ? 'Sending...' : 'Continue with email'}
                </Button>
                {message && (
                  <p className={`text-sm ${message.includes('error') ? 'text-destructive' : 'text-primary'}`}>
                    {message}
                  </p>
                )}
              </form>

              {!showGuestForm ? (
                <Button 
                  variant="outline" 
                  className="w-full"
                  onClick={() => setShowGuestForm(true)}
                >
                  Continue as Guest
                </Button>
              ) : (
                <form onSubmit={handleGuestMode} className="space-y-4">
                  <div>
                    <label className="text-sm font-medium" htmlFor="guestName">
                      Your Name
                    </label>
                    <input
                      id="guestName"
                      type="text"
                      value={guestName}
                      onChange={(e) => setGuestName(e.target.value)}
                      className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      placeholder="Enter your name"
                      required
                    />
                  </div>
                  <Button type="submit" variant="outline" className="w-full">
                    Start as Guest
                  </Button>
                </form>
              )}
            </div>
          </Card>

          <p className="text-center text-sm text-muted-foreground">
            By clicking "Continue" you agree to our{' '}
            <a href="#" className="underline hover:text-primary">
              Terms of Service
            </a>{' '}
            and{' '}
            <a href="#" className="underline hover:text-primary">
              Privacy Policy
            </a>
          </p>
        </div>
      </div>

      {/* Footer */}
      <div className="border-t p-6 flex items-center justify-between bg-muted/40">
        <div className="flex items-center gap-2">
          <svg className="w-8 h-8" viewBox="0 0 40 40" fill="currentColor">
            <text x="8" y="25" className="text-xl font-bold">N</text>
          </svg>
          <span className="text-lg font-semibold">Notes</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">curated by</span>
          <span className="font-semibold">Your Brand</span>
        </div>
      </div>
    </div>
  );
} 