'use client';

// Agency-workflow strip — a thin horizontal row of the 5 suite workspaces
// (Synchronize / Analyze / Strategize / Execute / Compound) with the current step lit
// up in its workspace accent and the rest as muted, click-to-navigate
// markers. Drops on top of any page that wants to make the agency
// content workflow visible to the user.
//
// Reads its data from the same WORKSPACES module the sidebar uses, so
// drift is a single edit, not a hunt across files. Mirrors the ContentPulse
// version 1:1 — same visual language across both products.

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronRight } from 'lucide-react';
import { isItemActive, WORKSPACES } from '@/components/dashboard/sidebar-config';

interface WorkflowStripProps {
  /** Optional caption shown to the right of the strip. Use to surface a
   *  pipeline hint such as "Briefs land Mondays". */
  hint?: React.ReactNode;
  className?: string;
}

export default function WorkflowStrip({ hint, className = '' }: WorkflowStripProps) {
  const pathname = usePathname() ?? '';

  return (
    <div
      className={`flex items-center gap-1.5 rounded-xl px-3 py-2 ${className}`}
      style={{
        background: 'linear-gradient(180deg, rgba(12,18,32,0.85) 0%, rgba(10,15,26,0.85) 100%)',
        border: '1px solid rgba(232,236,245,0.06)',
        boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.02)',
      }}
      aria-label="Agency workflow"
    >
      {WORKSPACES.map((ws, idx) => {
        const isActive = ws.items.some((i) => isItemActive(pathname, i.href));
        const target = ws.items[0]?.href ?? '/dashboard';
        const Icon = ws.icon;
        return (
          <div key={ws.id} className="flex items-center gap-1.5">
            <Link
              href={target}
              className={`group flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] transition-all ${
                isActive ? '' : 'hover:bg-white/[0.03]'
              }`}
              style={
                isActive
                  ? {
                      color: ws.accent,
                      background: 'rgba(255,255,255,0.02)',
                      boxShadow: `inset 0 0 0 1px ${ws.glow.replace('0.35', '0.22')}, 0 0 16px -6px ${ws.glow}`,
                    }
                  : { color: '#5a6580' }
              }
              title={isActive ? `You are here — ${ws.label}` : ws.label}
            >
              <Icon
                className="w-3 h-3"
                style={{ color: isActive ? ws.accent : '#4a5578' }}
              />
              <span className="hidden sm:inline">{ws.label}</span>
            </Link>
            {idx < WORKSPACES.length - 1 && (
              <ChevronRight className="w-3 h-3 flex-shrink-0" style={{ color: '#2c3654' }} />
            )}
          </div>
        );
      })}

      {hint && (
        <>
          <div className="hidden md:block flex-1" />
          <div className="hidden md:block text-[11px] text-[#7a88a8] truncate max-w-[460px]">
            {hint}
          </div>
        </>
      )}
    </div>
  );
}
