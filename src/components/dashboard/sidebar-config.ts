// Unified-suite sidebar IA — pure data module (no JSX), so it can be
// imported from React components AND from vitest (node env) without
// dragging in TSX parsing.
//
// Tested by tests/components/sidebar-ia.test.ts.

import type React from 'react';
import {
  Plug,
  Search,
  CheckSquare,
  Zap,
  TrendingUp,
  Users,
  Mail,
  ShieldCheck,
  MessageSquare,
  Video,
  ArrowUpRight,
  FileText,
  Brain,
  Sparkles,
} from 'lucide-react';

export interface NavItem {
  label: string;
  icon: React.ElementType;
  href: string;
  badge?: 'new' | 'soon';
}

export interface Workspace {
  id: 'connect' | 'discover' | 'decide' | 'act' | 'learn';
  label: string;
  icon: React.ElementType;
  /** Per-workspace accent — the 5 stops of the Aurora suite gradient.
   *  Active label, marker bar and glow halo all key off this. Switching
   *  workspaces feels like moving along the suite gradient. */
  accent: string;
  /** Soft glow + inner-ring color (rgba with low alpha). */
  glow: string;
  items: NavItem[];
}

export const WORKSPACES: Workspace[] = [
  {
    id: 'connect',
    label: 'Connect',
    icon: Plug,
    accent: '#4cc9f0',
    glow: 'rgba(76,201,240,0.35)',
    items: [
      { label: 'Integrations', icon: Plug, href: '/dashboard/settings' },
    ],
  },
  {
    id: 'discover',
    label: 'Discover',
    icon: Search,
    accent: '#38e8c8',
    glow: 'rgba(56,232,200,0.35)',
    items: [{ label: 'Clients', icon: Users, href: '/dashboard/clients' }],
  },
  {
    id: 'decide',
    label: 'Decide',
    icon: CheckSquare,
    accent: '#b388eb',
    glow: 'rgba(179,136,235,0.35)',
    items: [
      { label: 'Monday Brief', icon: Mail, href: '/dashboard/brief' },
      { label: 'Proposals', icon: Sparkles, href: '/dashboard/proposals' },
      { label: 'Approvals', icon: ShieldCheck, href: '/dashboard/approvals' },
    ],
  },
  {
    id: 'act',
    label: 'Act',
    icon: Zap,
    accent: '#e87fa5',
    glow: 'rgba(232,127,165,0.35)',
    items: [
      { label: 'Check-ins', icon: MessageSquare, href: '/dashboard/check-ins' },
      { label: 'Upsell', icon: ArrowUpRight, href: '/dashboard/upsell' },
      { label: 'Meetings', icon: Video, href: '/dashboard/meetings' },
    ],
  },
  {
    id: 'learn',
    label: 'Learn',
    icon: TrendingUp,
    accent: '#f0c84c',
    glow: 'rgba(240,200,76,0.35)',
    items: [
      { label: 'Reports', icon: FileText, href: '/dashboard/reports' },
      { label: 'Outcomes', icon: TrendingUp, href: '/dashboard/outcomes' },
      { label: 'Learning', icon: Brain, href: '/dashboard/learning' },
    ],
  },
];

export function isItemActive(pathname: string, href: string): boolean {
  if (href === '/dashboard') return pathname === '/dashboard';
  return pathname === href || pathname.startsWith(href + '/');
}
