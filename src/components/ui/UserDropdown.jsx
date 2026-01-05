"use client"
import { Button } from "./button"
import { useState } from "react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./dropdown"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "./alert-dialog"

import { useTheme } from "../ThemeProvider"; // [NEW] import
import { MoonIcon, SunIcon } from '@heroicons/react/24/outline'; // [NEW] import

export function UserDropdown({ user, onSignOut, onDeleteAccount }) {
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [alertOpen, setAlertOpen] = useState(false)
  const { theme, setTheme } = useTheme();
  const [imageError, setImageError] = useState(false); // [NEW] Track broken images

  const handleDeleteClick = () => {
    setDropdownOpen(false)
    setAlertOpen(true)
  }

  const handleConfirmDelete = async () => {
    try {
      await onDeleteAccount()
    } catch (error) {
      console.error('Error deleting account:', error)
    } finally {
      setAlertOpen(false)
    }
  }

  return (
    <>
      <DropdownMenu open={dropdownOpen} onOpenChange={setDropdownOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="focus-visible:ring-0 focus-visible:ring-offset-0 relative rounded-full h-8 w-8 overflow-hidden"
          >
            {user?.user_metadata?.avatar_url && !imageError ? (
              <img
                src={user.user_metadata.avatar_url}
                alt={user.email}
                className="w-full h-full object-cover"
                onError={() => setImageError(true)} // [NEW] Fallback on error
              />
            ) : (
              <div className="w-full h-full bg-primary/10 flex items-center justify-center text-sm font-medium">
                {(user?.user_metadata?.full_name?.charAt(0) || user?.email?.charAt(0) || 'U').toUpperCase()}
              </div>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          alignOffset={0}
          sideOffset={8}
          className="w-56"
          forceMount
        >
          <div className="px-2 py-1.5">
            <div className="font-medium truncate">{user.user_metadata?.full_name || 'User'}</div>
            <div className="text-xs text-muted-foreground truncate">
              {user.email}
            </div>
          </div>
          <DropdownMenuSeparator />

          {/* Theme Toggle Item */}
          <DropdownMenuItem
            onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
            className="cursor-pointer"
          >
            <div className="flex items-center gap-2 w-full">
              {theme === 'light' ? <MoonIcon className="w-4 h-4" /> : <SunIcon className="w-4 h-4" />}
              <span>{theme === 'light' ? 'Dark Mode' : 'Light Mode'}</span>
            </div>
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <DropdownMenuItem
            onClick={onSignOut}
            className="text-muted-foreground focus:text-muted-foreground cursor-pointer"
          >
            Sign out
          </DropdownMenuItem>
          {!user.isGuest && (
            <DropdownMenuItem
              className="text-destructive focus:text-destructive cursor-pointer"
              onSelect={(e) => {
                e.preventDefault()
                handleDeleteClick()
              }}
            >
              Delete Account
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={alertOpen} onOpenChange={setAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete your
              account and remove all your data from our servers.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setAlertOpen(false)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete Account
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

