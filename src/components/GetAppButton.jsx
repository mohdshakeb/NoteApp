"use client";
import React, { useEffect, useState } from 'react';
import { ArrowUpRight, Smartphone } from 'lucide-react';
import { Button } from './ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuTrigger
} from './ui/dropdown';
import { PLAY_STORE_URL_HEADER } from '../lib/constants';
import { cn } from '../lib/utils';
import { PLAY_STORE_QR_PATH, PLAY_STORE_QR_SIZE } from '../lib/playStoreQr';

// Same `rounded-full` as the Search/theme buttons beside it — a deliberate exception to system.md's
// "no pill shape on text-labeled buttons" rule, so the header cluster reads as one family of
// shapes. Tighter padding under 360px so it still clears the logo on 320px-wide phones.
const SHAPE_CLASS = "h-10 gap-2 px-3.5 max-[359px]:gap-1.5 max-[359px]:px-2.5 rounded-full active:scale-95 transition-transform";

// Guests get the same frosted shell as Search/theme. Signed in, the bottom-left Login button is gone
// (UserDropdown takes its slot), so Get app inherits its filled `primary` look as the one solid
// call-to-action on screen — minus Login's shadow, since the header cluster stays flat.
const GUEST_PROPS = {
    variant: 'ghost',
    className: cn(SHAPE_CLASS, "bg-background/80 backdrop-blur-md border border-border/50 can-hover:hover:bg-muted"),
};
const SIGNED_IN_PROPS = {
    variant: 'default',
    className: cn(SHAPE_CLASS, "border border-primary shadow-none"),
};

// iPadOS 13+ Safari reports a desktop Mac user agent; multi-touch support is what gives it away.
function detectPlatform() {
    const ua = window.navigator.userAgent || '';
    if (/Android/i.test(ua)) return 'android';
    if (/iPhone|iPad|iPod/i.test(ua) || (/Macintosh/i.test(ua) && window.navigator.maxTouchPoints > 1)) return 'ios';
    return 'desktop';
}

function ButtonContent() {
    return (
        <>
            <Smartphone className="h-4 w-4" aria-hidden="true" />
            Get app
        </>
    );
}

export function GetAppButton({ isSignedIn }) {
    // Platform is only knowable client-side, so render nothing until mount — otherwise iOS
    // visitors (no iOS app exists) would see the button flash in and then vanish.
    const [platform, setPlatform] = useState(null);

    useEffect(() => {
        setPlatform(detectPlatform());
    }, []);

    if (platform === null || platform === 'ios') return null;

    const buttonProps = isSignedIn ? SIGNED_IN_PROPS : GUEST_PROPS;

    // Same-tab on purpose: Chrome on Android hands play.google.com links straight to the Play
    // Store app, and a target="_blank" would leave an empty tab behind.
    if (platform === 'android') {
        return (
            <Button asChild {...buttonProps}>
                <a href={PLAY_STORE_URL_HEADER}>
                    <ButtonContent />
                </a>
            </Button>
        );
    }

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button {...buttonProps}>
                    <ButtonContent />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" sideOffset={8} className="w-56 p-4">
                <DropdownMenuLabel className="p-0 font-normal">
                    <p className="text-sm font-medium leading-none">Get the Android app</p>
                    <p className="mt-1.5 text-xs text-muted-foreground text-pretty">
                        Scan with your phone.
                    </p>
                </DropdownMenuLabel>

                {/* Light tile in both themes: a dark-on-light code scans reliably everywhere,
                    while an inverted one trips up some phone camera apps. */}
                <svg
                    viewBox={`0 0 ${PLAY_STORE_QR_SIZE} ${PLAY_STORE_QR_SIZE}`}
                    shapeRendering="crispEdges"
                    role="img"
                    aria-label="QR code for the app on Google Play"
                    className="mt-3 size-48 rounded-sm bg-zinc-50 text-zinc-900"
                >
                    <path stroke="currentColor" d={PLAY_STORE_QR_PATH} />
                </svg>

                <DropdownMenuItem asChild className="mt-3 justify-center gap-1.5 cursor-pointer">
                    <a href={PLAY_STORE_URL_HEADER} target="_blank" rel="noopener noreferrer">
                        Open Google Play
                        <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                    </a>
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
