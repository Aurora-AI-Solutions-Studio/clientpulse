'use client';

// Unified Suite Shell — CP top header.
//
// Layout, left to right:
//   [mobile menu] · breadcrumb · . . . · product switcher · search · user
//
// The product switcher (CP ⇄ RF) makes the suite framing visible from
// the first second the user lands. RF is "Soon" until step 3 (RF nav
// reshape) ships; the link goes to a simple soon-page so a click doesn't
// 404. Search is a placeholder for cmd-K-style global search; no
// behavior wired yet, but the slot is fixed so future work doesn't move
// chrome around.

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LogOut, Menu, Search } from 'lucide-react';
import { ClientPulseMark, ReForgeMark } from '@/components/brand/brand-mark';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { createClient } from '@/lib/supabase/client';
import { WORKSPACES } from '@/components/dashboard/sidebar-config';

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

interface CrumbInfo {
  workspace: string | null;
  page: string;
}

function buildBreadcrumb(pathname: string): CrumbInfo {
  if (!pathname || pathname === '/dashboard') {
    return { workspace: null, page: 'Home' };
  }
  for (const ws of WORKSPACES) {
    for (const item of ws.items) {
      if (pathname === item.href || pathname.startsWith(item.href + '/')) {
        return { workspace: ws.label, page: item.label };
      }
    }
  }
  if (pathname.startsWith('/dashboard/settings')) return { workspace: null, page: 'Settings' };
  if (pathname.startsWith('/dashboard/upgrade')) return { workspace: null, page: 'Plans &amp; upgrade' };
  if (pathname.startsWith('/dashboard/onboarding')) return { workspace: null, page: 'Onboarding' };
  if (pathname.startsWith('/dashboard/proposals/accepted')) return { workspace: 'Decide', page: 'Accepted' };
  return { workspace: null, page: 'Dashboard' };
}

export default function Header({ user, onMenuClick }: HeaderProps) {
  const pathname = usePathname() ?? '';
  const router = useRouter();
  const { workspace, page } = buildBreadcrumb(pathname);

  const userInitials = (() => {
    const e = user?.email ?? 'User';
    const parts = e.split('@')[0].split('.');
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return e.substring(0, 2).toUpperCase();
  })();

  const handleSignOut = async () => {
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
      router.push('/auth/login');
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  return (
    <header className="h-14 bg-[#0a0f1a]/90 backdrop-blur-sm border-b border-[#141e33] px-3 md:px-6 flex items-center gap-3 sticky top-0 z-40">
      {/* Mobile menu */}
      <button
        onClick={onMenuClick}
        className="md:hidden p-2 -ml-1 rounded-md text-[#7a88a8] hover:text-white hover:bg-[#11192a]"
        aria-label="Open menu"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm min-w-0">
        {workspace && (
          <>
            <span className="text-[#5a6580] truncate">{workspace}</span>
            <span className="text-[#3a4868]">/</span>
          </>
        )}
        <span className="text-white font-medium truncate">{page}</span>
      </div>

      <div className="flex-1" />

      {/* Product switcher */}
      <ProductSwitcher />

      {/* Search (placeholder) */}
      <div className="hidden md:flex items-center gap-2 bg-[#11192a] border border-[#1a2540] rounded-md px-3 py-1.5 w-56">
        <Search className="w-3.5 h-3.5 text-[#5a6580] flex-shrink-0" />
        <input
          type="text"
          placeholder="Search clients, briefs…"
          className="bg-transparent outline-none text-xs text-white placeholder-[#5a6580] w-full"
        />
        <kbd className="text-[10px] text-[#5a6580] bg-[#0a0f1a] px-1.5 py-0.5 rounded border border-[#1a2540]">⌘K</kbd>
      </div>

      {/* User menu */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="flex items-center gap-2 p-1 rounded-md hover:bg-[#11192a] transition-colors focus:outline-none">
            <Avatar className="h-7 w-7">
              <AvatarImage
                src={user?.user_metadata?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.email}`}
                alt={user?.email || 'User'}
              />
              <AvatarFallback className="bg-[#e74c3c]/15 text-[#e74c3c] text-[11px] font-semibold">
                {userInitials}
              </AvatarFallback>
            </Avatar>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56 bg-[#0d1422] border-[#1a2540]">
          <div className="px-3 py-2.5">
            <p className="text-[10px] text-[#5a6580] uppercase tracking-wider">Signed in as</p>
            <p className="text-sm text-white mt-0.5 truncate">{user?.email ?? 'User'}</p>
          </div>
          <DropdownMenuSeparator className="bg-[#1a2540]" />
          <DropdownMenuItem asChild>
            <Link
              href="/dashboard/settings"
              className="cursor-pointer text-[#9aa6c0] hover:text-white hover:bg-[#11192a] focus:bg-[#11192a] focus:text-white"
            >
              Settings
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link
              href="/dashboard/upgrade"
              className="cursor-pointer text-[#9aa6c0] hover:text-white hover:bg-[#11192a] focus:bg-[#11192a] focus:text-white"
            >
              Plans &amp; upgrade
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator className="bg-[#1a2540]" />
          <DropdownMenuItem
            onClick={handleSignOut}
            className="cursor-pointer text-[#e74c3c] hover:text-[#ff6b5b] hover:bg-[#11192a] focus:bg-[#11192a] focus:text-[#ff6b5b]"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}

function ProductSwitcher() {
  return (
    <div className="flex items-center bg-[#0c1220] border border-[#141e33] rounded-lg p-1 gap-1">
      {/* Active: ClientPulse — full mark + soft teal halo so it reads as
          the current product, not just another link in the row. */}
      <div
        className="px-2 py-1 rounded-md inline-flex items-center"
        style={{
          background: 'linear-gradient(135deg, rgba(56,232,200,0.18) 0%, rgba(76,201,240,0.10) 100%)',
          boxShadow: 'inset 0 0 0 1px rgba(56,232,200,0.25), 0 0 18px -6px rgba(56,232,200,0.4)',
        }}
        title="You are here — ClientPulse"
      >
        <ClientPulseMark size="sm" />
      </div>
      {/* Inactive: ReForge — full mark, hover lifts to gold */}
      <a
        href="https://reforge.helloaurora.ai"
        target="_blank"
        rel="noreferrer"
        className="px-2 py-1 rounded-md inline-flex items-center gap-1 opacity-75 hover:opacity-100 hover:bg-white/[0.03] transition-all"
        title="Switch to ReForge — opens in new tab"
      >
        <ReForgeMark size="sm" />
        <span className="text-[9px] uppercase tracking-wider text-[#5a6580] ml-0.5">↗</span>
      </a>
    </div>
  );
}
