"use client";
import React from 'react';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { AlertCircle } from 'lucide-react';

export function MergeDialog({ isOpen, guestNoteCount, onMerge, onDiscard }) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <Card className="w-full max-w-sm p-6 relative shadow-lg animate-in zoom-in-95 duration-200 border-border/50">

                <div className="flex flex-col items-center text-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-yellow-100 text-yellow-600 flex items-center justify-center dark:bg-yellow-900/30 dark:text-yellow-400">
                        <AlertCircle className="w-6 h-6" />
                    </div>

                    <div>
                        <h2 className="text-xl font-bold tracking-tight">
                            Found Existing Notes
                        </h2>
                        <p className="mt-2 text-sm text-muted-foreground">
                            We found <strong>{guestNoteCount} notes</strong> on this device from before you logged in. What would you like to do?
                        </p>
                    </div>
                </div>

                <div className="flex flex-col gap-3 mt-8">
                    <Button
                        onClick={onMerge}
                        className="w-full font-semibold"
                    >
                        Merge with my account
                    </Button>

                    <Button
                        variant="outline"
                        onClick={onDiscard}
                        className="w-full text-destructive hover:text-destructive hover:bg-destructive/10"
                    >
                        Delete from device
                    </Button>
                </div>
            </Card>
        </div>
    );
}
