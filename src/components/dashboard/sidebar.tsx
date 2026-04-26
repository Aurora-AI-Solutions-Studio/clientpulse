'use client';

// Unified Suite Shell — CP sidebar.
//
// 5 workspaces (Connect / Discover / Decide / Act / Learn), same shape and
// position as the RF sidebar will use after step 3. The product switcher
// in the header lets the user flip between CP and RF; the workspace
// grammar stays identical, only the inner items change per product.
//
// Visual refresh vs the old sidebar: single accent (CP red) for the
// active item only — no per-group colors, no expanded/collapsed group
// state, less border noise. Health / Predictions / Alerts are no longer
// standalone destinations — they're tabs inside the per-client page.

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Settings as SettingsIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { isItemActive, WORKSPACES, type Workspace } from '@/components/dashboard/sidebar-config';

// Re-export for any consumer that was already importing WORKSPACES from
// the component file (kept thin since the data lives in sidebar-config).
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

const ACCENT = '#e74c3c';

const TIER_COLOR: Record<string, string> = {
  Free: 'bg-[#1a2540] text-[#7a88a8]',
  Solo: 'bg-blue-500/10 text-blue-400',
  Pro: 'bg-purple-500/10 text-purple-400',
  Agency: 'bg-[#e74c3c]/10 text-[#e74c3c]',
};

export default function Sidebar({ tierLabel }: SidebarProps) {
  const pathname = usePathname() ?? '';
  const tier = tierLabel ?? 'Free';
  const settingsActive = isItemActive(pathname, '/dashboard/settings') && !isItemActive(pathname, '/dashboard/integrations');

  return (
    <div className="flex flex-col h-full bg-[#0a0f1a] border-r border-[#1a2540]">
      {/* Logo */}
      <div className="px-6 pt-6 pb-5">
        <Link
          href="/dashboard"
          className="flex items-center gap-2.5 text-lg font-semibold text-white hover:opacity-90 transition-opacity"
        >
          <div className="w-8 h-8 rounded-md bg-[#e74c3c] flex items-center justify-center">
            <span className="text-white text-xs font-bold tracking-wide">CP</span>
          </div>
          <span>ClientPulse</span>
        </Link>
        <div className="mt-1 ml-[42px] text-[10px] text-[#5a6580] uppercase tracking-[0.12em]">
          Aurora Suite
        </div>
      </div>

      {/* Workspaces */}
      <nav className="flex-1 px-3 pb-4 overflow-y-auto">
        {WORKSPACES.map((ws) => (
          <WorkspaceBlock key={ws.id} workspace={ws} pathname={pathname} />
        ))}

        {/* Settings (standalone) */}
        <div className="mt-3 pt-3 border-t border-[#1a2540]">
          <Link
            href="/dashboard/settings"
            className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-[13px] transition-colors ${
              settingsActive
                ? 'text-white bg-[#11192a]'
                : 'text-[#7a88a8] hover:text-white hover:bg-[#0f1420]'
            }`}
          >
            <SettingsIcon className="w-4 h-4" />
            Settings
          </Link>
        </div>
      </nav>

      {/* Plan footer */}
      <div className="border-t border-[#1a2540] p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-[#5a6580] uppercase tracking-[0.12em]">Plan</span>
          <Badge className={TIER_COLOR[tier] ?? TIER_COLOR.Free}>{tier}</Badge>
        </div>
        <Link
          href="/dashboard/upgrade"
          className="block text-center text-xs text-[#9aa6c0] hover:text-white px-3 py-2 rounded-md bg-[#0f1420] border border-[#1a2540] hover:border-[#e74c3c]/40 transition-colors"
        >
          View plans &amp; upgrade
        </Link>
        <div className="text-center text-[10px] text-[#5a6580] tracking-wider">by Aurora</div>
      </div>
    </div>
  );
}

function WorkspaceBlock({
  workspace,
  pathname,
}: {
  workspace: Workspace;
  pathname: string;
}) {
  return (
    <div className="mt-4 first:mt-0">
      <div className="flex items-center gap-2 px-3 mb-1.5">
        <workspace.icon className="w-3.5 h-3.5 text-[#5a6580]" />
        <span className="text-[10px] font-semibold text-[#5a6580] uppercase tracking-[0.12em]">
          {workspace.label}
        </span>
      </div>
      <div className="space-y-0.5">
        {workspace.items.map((item) => {
          const active = isItemActive(pathname, item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
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
              <Icon className={`w-4 h-4 flex-shrink-0 ${active ? 'text-[#e74c3c]' : 'text-[#5a6580] group-hover:text-[#9aa6c0]'}`} />
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
