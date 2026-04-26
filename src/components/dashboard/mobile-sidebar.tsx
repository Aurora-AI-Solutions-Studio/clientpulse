'use client';

// Mobile mirror of the unified-suite Sidebar — same visual language.

import { X } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Settings as SettingsIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ClientPulseMark, AuroraWordmark } from '@/components/brand/brand-mark';
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

const TIER_STYLE: Record<string, { className: string; gradient?: string }> = {
  Free: { className: 'bg-[#141e33] text-[#a0adc4] border border-[#1a2540]' },
  Solo: {
    className: 'text-white border-0',
    gradient: 'linear-gradient(135deg, #4cc9f0 0%, #7b8ff0 100%)',
  },
  Pro: {
    className: 'text-white border-0',
    gradient: 'linear-gradient(135deg, #7b8ff0 0%, #b388eb 100%)',
  },
  Agency: {
    className: 'text-white border-0',
    gradient: 'linear-gradient(135deg, #b388eb 0%, #e87fa5 50%, #e74c3c 100%)',
  },
};

export default function MobileSidebar({
  isOpen,
  onClose,
  tierLabel,
}: MobileSidebarProps) {
  const pathname = usePathname() ?? '';
  const tier = tierLabel ?? 'Free';
  const tierStyle = TIER_STYLE[tier] ?? TIER_STYLE.Free;
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
        <div className="px-5 pt-5 pb-4 flex items-center justify-between">
          <ClientPulseMark href="/dashboard" size="md" />
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
          {WORKSPACES.map((ws) => {
            const groupActive = ws.items.some((i) => isItemActive(pathname, i.href));
            return (
              <div key={ws.id} className="mt-5 first:mt-0">
                <div className="flex items-center gap-2 px-3 mb-1.5">
                  <ws.icon
                    className={`w-3.5 h-3.5 transition-colors ${
                      groupActive ? 'text-[#38e8c8]' : 'text-[#5a6580]'
                    }`}
                  />
                  <span
                    className={`text-[10px] font-semibold uppercase tracking-[0.14em] transition-colors ${
                      groupActive ? 'text-[#38e8c8]' : 'text-[#5a6580]'
                    }`}
                  >
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
                        className={`group relative flex items-center gap-2.5 pl-3.5 pr-2 py-2 rounded-md text-[13px] transition-all ${
                          active
                            ? 'text-white bg-[#11192a] shadow-[inset_0_0_0_1px_rgba(56,232,200,0.18),0_0_22px_-6px_rgba(56,232,200,0.35)]'
                            : 'text-[#a0adc4] hover:text-white hover:bg-[#0f1420]'
                        }`}
                      >
                        {active && (
                          <span
                            aria-hidden="true"
                            className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-full"
                            style={{
                              background:
                                'linear-gradient(180deg, #38e8c8 0%, #4cc9f0 50%, #b388eb 100%)',
                            }}
                          />
                        )}
                        <Icon
                          className={`w-4 h-4 flex-shrink-0 transition-colors ${
                            active
                              ? 'text-[#38e8c8]'
                              : 'text-[#5a6580]'
                          }`}
                        />
                        <span className="flex-1 truncate">{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}

          <div className="mt-4 pt-3 border-t border-[#141e33]">
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
        <div className="border-t border-[#141e33] p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-[#5a6580] uppercase tracking-[0.14em]">Plan</span>
            <Badge
              className={`px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${tierStyle.className}`}
              style={tierStyle.gradient ? { background: tierStyle.gradient } : undefined}
            >
              {tier}
            </Badge>
          </div>
          <Link
            href="/dashboard/upgrade"
            onClick={onClose}
            className="block text-center text-xs text-[#a0adc4] hover:text-white px-3 py-2 rounded-md bg-[#0f1420] border border-[#1a2540] hover:border-[#38e8c8]/40 transition-colors"
          >
            View plans &amp; upgrade
          </Link>
          <div className="text-center text-[10px] tracking-[0.14em]">
            <AuroraWordmark className="text-[10px]" />
          </div>
        </div>
      </div>
    </>
  );
}
