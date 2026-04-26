'use client';

// Unified Suite Shell — CP sidebar.
//
// 5 workspaces (Connect / Discover / Decide / Act / Learn) — each with its
// own accent (the 5 stops of the Aurora gradient). Active workspace label
// + icon + active item all key off the workspace's accent, so switching
// workspaces feels like moving along the suite gradient.

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Settings as SettingsIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ClientPulseMark, AuroraWordmark } from '@/components/brand/brand-mark';
import {
  isItemActive,
  WORKSPACES,
  type Workspace,
} from '@/components/dashboard/sidebar-config';

export { WORKSPACES } from '@/components/dashboard/sidebar-config';

interface User {
  id: string;
  email?: string;
  user_metadata?: {
    full_name?: string;
    avatar_url?: string;
  };
}

interface SidebarProps {
  user: User;
  tierLabel?: string | null;
}

const TIER_STYLE: Record<
  string,
  { className: string; gradient?: string }
> = {
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
  // Suite — the cross-product bundle. Full Aurora gradient (all 5
  // stops) so the badge visually echoes the suite framing in the
  // sidebar workspaces.
  Suite: {
    className: 'text-white border-0',
    gradient:
      'linear-gradient(135deg, #4cc9f0 0%, #38e8c8 25%, #b388eb 50%, #e87fa5 75%, #f0c84c 100%)',
  },
};

export default function Sidebar({ tierLabel }: SidebarProps) {
  const pathname = usePathname() ?? '';
  const tier = tierLabel ?? 'Free';
  const tierStyle = TIER_STYLE[tier] ?? TIER_STYLE.Free;
  const settingsActive =
    isItemActive(pathname, '/dashboard/settings') &&
    !isItemActive(pathname, '/dashboard/integrations');

  return (
    <div className="flex flex-col h-full bg-[#0a0f1a] border-r border-[#1a2540] relative">
      {/* Subtle Aurora-gradient sheen on the leading edge — adds depth */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 left-0 w-[3px]"
        style={{
          background:
            'linear-gradient(180deg, #4cc9f0 0%, #38e8c8 25%, #b388eb 50%, #e87fa5 75%, #f0c84c 100%)',
          opacity: 0.4,
        }}
      />

      {/* Logo */}
      <div className="px-5 pt-6 pb-5 relative">
        <ClientPulseMark href="/dashboard" size="md" />
        <div className="mt-1.5 ml-[42px] text-[10px] text-[#5a6580] uppercase tracking-[0.16em] font-medium">
          Aurora Suite
        </div>
      </div>

      {/* Workspaces */}
      <nav className="flex-1 px-3 pb-4 overflow-y-auto relative">
        {WORKSPACES.map((ws, idx) => (
          <WorkspaceBlock
            key={ws.id}
            workspace={ws}
            pathname={pathname}
            isFirst={idx === 0}
          />
        ))}

        {/* Settings (standalone) */}
        <div className="mt-4 pt-3 border-t border-[#141e33]">
          <Link
            href="/dashboard/settings"
            className={`group flex items-center gap-2.5 px-3 py-2 rounded-md text-[13px] transition-all ${
              settingsActive
                ? 'text-white bg-[#11192a] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]'
                : 'text-[#9aa6c0] hover:text-white hover:bg-[#0f1420]'
            }`}
          >
            <SettingsIcon className="w-4 h-4" />
            Settings
          </Link>
        </div>
      </nav>

      {/* Plan footer */}
      <div className="border-t border-[#141e33] p-4 space-y-3 relative">
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-[#5a6580] uppercase tracking-[0.16em] font-medium">
            Plan
          </span>
          <Badge
            className={`px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${tierStyle.className}`}
            style={tierStyle.gradient ? { background: tierStyle.gradient } : undefined}
          >
            {tier}
          </Badge>
        </div>
        <Link
          href="/dashboard/upgrade"
          className="block text-center text-xs text-[#c8d0e0] hover:text-white px-3 py-2 rounded-md bg-[#0f1420] border border-[#1a2540] hover:border-[#38e8c8]/40 hover:shadow-[0_0_0_1px_rgba(56,232,200,0.15)] transition-all"
        >
          View plans &amp; upgrade
        </Link>
        <div className="text-center text-[10px] tracking-[0.16em]">
          <AuroraWordmark className="text-[10px]" />
        </div>
      </div>
    </div>
  );
}

function WorkspaceBlock({
  workspace,
  pathname,
  isFirst,
}: {
  workspace: Workspace;
  pathname: string;
  isFirst: boolean;
}) {
  const groupActive = workspace.items.some((i) => isItemActive(pathname, i.href));
  const accent = workspace.accent;
  const glow = workspace.glow;

  return (
    <div className={isFirst ? '' : 'mt-5'}>
      {/* Workspace label — always visible, picks up its accent when active */}
      <div className="flex items-center gap-2 px-3 mb-2">
        <workspace.icon
          className="w-3.5 h-3.5 transition-colors"
          style={{ color: groupActive ? accent : '#5a6580' }}
        />
        <span
          className="text-[11px] font-semibold uppercase tracking-[0.16em] transition-colors"
          style={{ color: groupActive ? accent : '#7a88a8' }}
        >
          {workspace.label}
        </span>
        {groupActive && (
          <span
            aria-hidden="true"
            className="flex-1 h-px ml-1 opacity-30"
            style={{
              background: `linear-gradient(90deg, ${accent} 0%, transparent 100%)`,
            }}
          />
        )}
      </div>

      <div className="space-y-0.5">
        {workspace.items.map((item) => {
          const active = isItemActive(pathname, item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`group relative flex items-center gap-2.5 pl-3.5 pr-2 py-2 rounded-md text-[13px] transition-all ${
                active
                  ? 'text-white bg-[#11192a]'
                  : 'text-[#c8d0e0] hover:text-white hover:bg-[#0f1420]'
              }`}
              style={
                active
                  ? {
                      boxShadow: `inset 0 0 0 1px ${glow.replace('0.35', '0.18')}, 0 0 22px -6px ${glow}`,
                    }
                  : undefined
              }
            >
              {active && (
                <span
                  aria-hidden="true"
                  className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-full"
                  style={{
                    background: `linear-gradient(180deg, ${accent} 0%, ${accent}80 100%)`,
                    boxShadow: `0 0 8px ${glow}`,
                  }}
                />
              )}
              <Icon
                className="w-4 h-4 flex-shrink-0 transition-colors"
                style={
                  active
                    ? { color: accent }
                    : undefined
                }
              />
              <span className="flex-1 truncate">{item.label}</span>
              {item.badge === 'new' && (
                <span className="text-[9px] uppercase tracking-wide text-[#38e8c8] bg-[#38e8c8]/10 px-1.5 py-0.5 rounded">
                  New
                </span>
              )}
              {item.badge === 'soon' && (
                <span className="text-[9px] uppercase tracking-wide text-[#5a6580] bg-[#1a2540] px-1.5 py-0.5 rounded">
                  Soon
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
