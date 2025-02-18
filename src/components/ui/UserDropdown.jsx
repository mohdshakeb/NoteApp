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

export function UserDropdown({ user, onSignOut, onDeleteAccount }) {
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [alertOpen, setAlertOpen] = useState(false)

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
            className="focus-visible:ring-0 focus-visible:ring-offset-0 relative"
          >
            {user?.user_metadata?.avatar_url ? (
              <img 
                src={user.user_metadata.avatar_url} 
                alt={user.email}
                className="w-8 h-8 rounded-full"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium">
                {(user?.user_metadata?.full_name?.charAt(0) || user?.email?.charAt(0) || 'U').toUpperCase()}
              </div>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent 
          align="end"
          alignOffset={0}  // This ensures exact alignment
          sideOffset={8}
          className="w-56"
          forceMount
        >
          <div className="px-2 py-1.5">
            <div className="font-medium">{user.user_metadata?.full_name}</div>
            <div className="text-xs text-muted-foreground">
              {user.email}
            </div>
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuItem 
            onClick={onSignOut}
            className="text-muted-foreground focus:text-muted-foreground"
          >
            Sign out
          </DropdownMenuItem>
          {!user.isGuest && (
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
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

