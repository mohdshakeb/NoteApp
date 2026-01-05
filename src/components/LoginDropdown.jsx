"use client";
import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Button } from './ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger
} from './ui/dropdown';

export function LoginDropdown({ children }) {
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');
    const [isOpen, setIsOpen] = useState(false);

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

            setMessage('Check email for link!');
        } catch (error) {
            setMessage(error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
            <DropdownMenuTrigger asChild>
                {children}
            </DropdownMenuTrigger>
            <DropdownMenuContent
                align="start"
                side="top"
                sideOffset={12}
                className="w-80 p-4 origin-bottom-left"
                forceMount
            >
                <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                        <p className="text-sm font-medium leading-none">Sign in to Sync</p>
                        <p className="text-xs leading-none text-muted-foreground">
                            Save your notes to the cloud.
                        </p>
                    </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />

                <div className="flex flex-col gap-4 mt-2">
                    <Button
                        variant="outline"
                        className="w-full flex items-center justify-center gap-2 h-10"
                        onClick={() => supabase.auth.signInWithOAuth({
                            provider: 'google',
                            options: {
                                redirectTo: window.location.origin
                            }
                        })}
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
                        Google
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

                    <form onSubmit={handleEmailSignIn} className="space-y-3">
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            // Prevent closing on interaction
                            onKeyDown={(e) => e.stopPropagation()}
                            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                            placeholder="name@example.com"
                            required
                        />
                        <Button
                            type="submit"
                            className="w-full h-9"
                            disabled={loading}
                        >
                            {loading ? 'Sending...' : 'Email Login'}
                        </Button>
                        {message && (
                            <p className={`text-xs text-center ${message.includes('error') ? 'text-destructive' : 'text-primary'}`}>
                                {message}
                            </p>
                        )}
                    </form>

                    <div className="text-[10px] text-center text-muted-foreground leading-tight">
                        By continuing you agree to Terms & Privacy.
                    </div>
                </div>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
