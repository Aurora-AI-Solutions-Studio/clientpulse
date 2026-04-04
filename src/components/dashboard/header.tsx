'use client';

import { usePathname, useRouter } from 'next/navigation';
import { Menu, Bell, LogOut } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { createClient } from '@/lib/supabase/client';

interface User {
  id: string;
  email?: string;
  user_metadata?: {
    full_name?: string;
    avatar_url?: string;
  };
}

interface HeaderProps {
  user: User;
  onMenuClick: () => void;
}

const pageNames: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/dashboard/clients': 'Clients',
  '/dashboard/meetings': 'Meetings',
  '/dashboard/brief': 'Monday Brief',
  '/dashboard/health': 'Health Scores',
  '/dashboard/settings': 'Settings',
};

export default function Header({ user, onMenuClick }: HeaderProps) {
  const pathname = usePathname();
  const router = useRouter();

  const pageTitle = pageNames[pathname] || 'Dashboard';

  const getInitials = (email: string) => {
    const parts = email.split('@')[0].split('.');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return email.substring(0, 2).toUpperCase();
  };

  const handleSignOut = async () => {
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
      router.push('/auth/login');
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  const userInitials = user?.email ? getInitials(user.email) : 'U';
  const userEmail = user?.email || 'User';

  return (
    <header className="h-16 bg-[#0d1422] border-b border-[#1a2540] px-4 md:px-8 flex items-center justify-between sticky top-0 z-40">
      {/* Left side: Menu button + Page Title */}
      <div className="flex items-center gap-4">
        <button
          onClick={onMenuClick}
          className="md:hidden p-2 hover:bg-[#1a2540] rounded-lg transition-colors text-[#7a88a8] hover:text-white"
        >
          <Menu className="w-5 h-5" />
        </button>
        <h1 className="text-lg font-semibold text-white">{pageTitle}</h1>
      </div>

      {/* Right side: Search + Notifications + User Menu */}
      <div className="flex items-center gap-4">
        {/* Search Bar - Hidden on mobile */}
        <div className="hidden md:flex items-center gap-2 bg-[#1a2540] rounded-lg px-3 py-2 flex-1 max-w-xs ml-8">
          <input
            type="text"
            placeholder="Search..."
            className="bg-transparent outline-none text-sm text-white placeholder-[#7a88a8] w-full"
          />
        </div>

        {/* Notification Bell */}
        <button className="p-2 hover:bg-[#1a2540] rounded-lg transition-colors text-[#7a88a8] hover:text-white relative">
          <Bell className="w-5 h-5" />
          <span className="absolute top-1 right-1 w-2 h-2 bg-[#e74c3c] rounded-full"></span>
        </button>

        {/* User Dropdown Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 p-1 hover:bg-[#1a2540] rounded-lg transition-colors focus:outline-none">
              <Avatar className="h-8 w-8">
                <AvatarImage
                  src={
                    user?.user_metadata?.avatar_url ||
                    `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.email}`
                  }
                  alt={user?.email || 'User'}
                />
                <AvatarFallback className="bg-[#e74c3c]/20 text-[#e74c3c] text-xs font-bold">
                  {userInitials}
                </AvatarFallback>
              </Avatar>
              <div className="hidden md:block text-left">
                <p className="text-xs text-[#7a88a8]">Welcome back</p>
                <p className="text-sm font-medium text-white truncate max-w-[150px]">
                  {user?.user_metadata?.full_name ||
                    user?.email?.split('@')[0] ||
                    'User'}
                </p>
              </div>
            </button>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" className="w-56 bg-[#0d1422] border-[#1a2540]">
            {/* User Info */}
            <div className="px-4 py-3">
              <p className="text-xs text-[#7a88a8] uppercase tracking-wide">
                Account
              </p>
              <p className="text-sm font-medium text-white mt-1">{userEmail}</p>
            </div>

            <DropdownMenuSeparator className="bg-[#1a2540]" />

            {/* Settings Link */}
            <DropdownMenuItem className="cursor-pointer text-[#7a88a8] hover:text-white hover:bg-[#1a2540] focus:bg-[#1a2540] focus:text-white">
              Settings
            </DropdownMenuItem>

            <DropdownMenuSeparator className="bg-[#1a2540]" />

            {/* Sign Out */}
            <DropdownMenuItem
              onClick={handleSignOut}
              className="cursor-pointer text-[#e74c3c] hover:text-[#ff6b5b] hover:bg-[#1a2540]/50 focus:bg-[#1a2540]/50 focus:text-[#ff6b5b]"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
