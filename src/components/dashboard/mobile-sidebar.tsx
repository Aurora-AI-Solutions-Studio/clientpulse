'use client';

// Mobile mirror of the unified-suite Sidebar.

import { X } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Settings as SettingsIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { isItemActive, WORKSPACES } from '@/components/dashboard/sidebar-config';

interface User {
  id: string;
  email?: string;
  user_metadata?: { full_name?: string; avatar_url?: string };
}

interface MobileSidebarProps {
  user: User;
  isOpen: boolean;
  onClose: () => void;
  tierLabel?: string | null;
}

const ACCENT = '#e74c3c';

const TIER_COLOR: Record<string, string> = {
  Free: 'bg-[#1a2540] text-[#7a88a8]',
  Solo: 'bg-blue-500/10 text-blue-400',
  Pro: 'bg-purple-500/10 text-purple-400',
  Agency: 'bg-[#e74c3c]/10 text-[#e74c3c]',
};

export default function MobileSidebar({ isOpen, onClose, tierLabel }: MobileSidebarProps) {
  const pathname = usePathname() ?? '';
  const tier = tierLabel ?? 'Free';
  if (!isOpen) return null;

  return (
    <>
      <div
        className="md:hidden fixed inset-0 bg-black/60 z-50"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="md:hidden fixed left-0 top-0 bottom-0 w-[280px] bg-[#0a0f1a] z-50 flex flex-col">
        {/* Header */}
        <div className="px-6 pt-5 pb-4 flex items-center justify-between">
          <Link
            href="/dashboard"
            onClick={onClose}
            className="flex items-center gap-2.5 text-lg font-semibold text-white"
          >
            <div className="w-8 h-8 rounded-md bg-[#e74c3c] flex items-center justify-center">
              <span className="text-white text-xs font-bold tracking-wide">CP</span>
            </div>
            <span>ClientPulse</span>
          </Link>
          <button
            onClick={onClose}
            className="p-2 -m-2 rounded-md text-[#7a88a8] hover:text-white hover:bg-[#1a2540]"
            aria-label="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Workspaces */}
        <nav className="flex-1 px-3 pb-4 overflow-y-auto">
          {WORKSPACES.map((ws) => (
            <div key={ws.id} className="mt-4 first:mt-0">
              <div className="flex items-center gap-2 px-3 mb-1.5">
                <ws.icon className="w-3.5 h-3.5 text-[#5a6580]" />
                <span className="text-[10px] font-semibold text-[#5a6580] uppercase tracking-[0.12em]">
                  {ws.label}
                </span>
              </div>
              <div className="space-y-0.5">
                {ws.items.map((item) => {
                  const active = isItemActive(pathname, item.href);
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={onClose}
                      className={`group flex items-center gap-2.5 pl-3 pr-2 py-2 rounded-md text-[13px] transition-colors relative ${
                        active
                          ? 'text-white bg-[#11192a]'
                          : 'text-[#9aa6c0] hover:text-white hover:bg-[#0f1420]'
                      }`}
                    >
                      {active && (
                        <span
                          aria-hidden="true"
                          className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-full"
                          style={{ background: ACCENT }}
                        />
                      )}
                      <Icon className={`w-4 h-4 flex-shrink-0 ${active ? 'text-[#e74c3c]' : 'text-[#5a6580]'}`} />
                      <span className="flex-1 truncate">{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}

          <div className="mt-3 pt-3 border-t border-[#1a2540]">
            <Link
              href="/dashboard/settings"
              onClick={onClose}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-[13px] transition-colors ${
                isItemActive(pathname, '/dashboard/settings')
                  ? 'text-white bg-[#11192a]'
                  : 'text-[#7a88a8] hover:text-white hover:bg-[#0f1420]'
              }`}
            >
              <SettingsIcon className="w-4 h-4" />
              Settings
            </Link>
          </div>
        </nav>

        {/* Footer */}
        <div className="border-t border-[#1a2540] p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-[#5a6580] uppercase tracking-[0.12em]">Plan</span>
            <Badge className={TIER_COLOR[tier] ?? TIER_COLOR.Free}>{tier}</Badge>
          </div>
          <Link
            href="/dashboard/upgrade"
            onClick={onClose}
            className="block text-center text-xs text-[#9aa6c0] hover:text-white px-3 py-2 rounded-md bg-[#0f1420] border border-[#1a2540] hover:border-[#e74c3c]/40 transition-colors"
          >
            View plans &amp; upgrade
          </Link>
        </div>
      </div>
    </>
  );
}
