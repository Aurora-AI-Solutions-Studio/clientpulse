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
  Hash,
  Mic,
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
  items: NavItem[];
}

export const WORKSPACES: Workspace[] = [
  {
    id: 'connect',
    label: 'Connect',
    icon: Plug,
    items: [
      { label: 'Integrations', icon: Plug, href: '/dashboard/settings' },
      { label: 'Slack', icon: Hash, href: '/dashboard/integrations/slack' },
      { label: 'Transcription', icon: Mic, href: '/dashboard/integrations/whisper' },
    ],
  },
  {
    id: 'discover',
    label: 'Discover',
    icon: Search,
    items: [{ label: 'Clients', icon: Users, href: '/dashboard/clients' }],
  },
  {
    id: 'decide',
    label: 'Decide',
    icon: CheckSquare,
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
