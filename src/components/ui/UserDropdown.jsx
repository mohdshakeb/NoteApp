"use client"
import { Button } from "./button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./dropdown"

export function UserDropdown({ user, onSignOut }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="ghost" 
          size="icon"
          className="focus-visible:ring-0 focus-visible:ring-offset-0"
        >
          {user?.isGuest ? (
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium">
              {user.user_metadata.initials}
            </div>
          ) : user?.user_metadata?.avatar_url ? (
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
        className="w-56"
        sideOffset={5}
      >
        <div className="px-2 py-1.5">
          <div className="font-medium">{user.user_metadata?.full_name}</div>
          <div className="text-xs text-muted-foreground">
            {user.email || 'Guest User'}
          </div>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem 
          onClick={onSignOut}
          className="text-destructive focus:text-destructive"
        >
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

