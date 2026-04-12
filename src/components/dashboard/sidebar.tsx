'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  Video,
  Mail,
  Activity,
  Settings,
  Bell,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  MessageSquare,
  UserPlus,
  Brain,
  FileText,
  Hash,
  Mic,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';

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
}

const navItems = [
  {
    label: 'Dashboard',
    icon: LayoutDashboard,
    href: '/dashboard',
  },
  {
    label: 'Clients',
    icon: Users,
    href: '/dashboard/clients',
  },
  {
    label: 'Meetings',
    icon: Video,
    href: '/dashboard/meetings',
  },
  {
    label: 'Monday Brief',
    icon: Mail,
    href: '/dashboard/brief',
  },
  {
    label: 'Health Scores',
    icon: Activity,
    href: '/dashboard/health',
  },
  {
    label: 'Alerts',
    icon: Bell,
    href: '/dashboard/alerts',
  },
  {
    label: 'Approvals',
    icon: ShieldCheck,
    href: '/dashboard/approvals',
  },
  {
    label: 'Predictions',
    icon: TrendingDown,
    href: '/dashboard/predictions',
  },
  {
    label: 'Upsell',
    icon: TrendingUp,
    href: '/dashboard/upsell',
  },
  {
    label: 'Check-ins',
    icon: MessageSquare,
    href: '/dashboard/check-ins',
  },
  {
    label: 'Team',
    icon: UserPlus,
    href: '/dashboard/team',
  },
  {
    label: 'Outcomes',
    icon: FileText,
    href: '/dashboard/outcomes',
  },
  {
    label: 'Learning',
    icon: Brain,
    href: '/dashboard/learning',
  },
  {
    label: 'Reports',
    icon: FileText,
    href: '/dashboard/reports',
  },
  {
    label: 'Slack',
    icon: Hash,
    href: '/dashboard/integrations/slack',
  },
  {
    label: 'Transcription',
    icon: Mic,
    href: '/dashboard/integrations/whisper',
  },
  {
    label: 'Settings',
    icon: Settings,
    href: '/dashboard/settings',
  },
];

export default function Sidebar({ }: SidebarProps) {
  const pathname = usePathname();

  const getSubscriptionTier = () => {
    // TODO: Fetch actual subscription tier from user metadata or database
    return 'Free';
  };

  const isActive = (href: string) => {
    return pathname === href || pathname.startsWith(href + '/');
  };

  const subscriptionTier = getSubscriptionTier();
  const tierColor = {
    Free: 'bg-[#1a2540] text-[#7a88a8]',
    Starter: 'bg-blue-500/10 text-blue-400',
    Pro: 'bg-purple-500/10 text-purple-400',
    Agency: 'bg-[#e74c3c]/10 text-[#e74c3c]',
  } as Record<string, string>;

  return (
    <div className="flex flex-col h-full bg-[#0a0f1a] border-r border-[#1a2540]">
      {/* Logo Section */}
      <div className="p-6 border-b border-[#1a2540]">
        <Link
          href="/dashboard"
          className="flex items-center gap-2 text-xl font-bold text-white hover:opacity-80 transition-opacity"
        >
          <div className="w-8 h-8 rounded bg-gradient-to-br from-[#e74c3c] to-[#c0392b] flex items-center justify-center">
            <span className="text-white">📊</span>
          </div>
          <span className="text-[#e74c3c]">ClientPulse</span>
        </Link>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 p-6 space-y-2 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);
          const showBadge = item.label === 'Alerts';

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all group ${
                active
                  ? 'bg-[#1a2540] text-[#e74c3c] border-l-2 border-[#e74c3c]'
                  : 'text-[#7a88a8] hover:bg-[#0f1420] hover:text-white border-l-2 border-transparent'
              }`}
            >
              <div className="relative flex-shrink-0">
                <Icon className="w-5 h-5" />
                {showBadge && (
                  <div className="absolute -top-1 -right-1 w-2 h-2 bg-[#e74c3c] rounded-full"></div>
                )}
              </div>
              <span className="font-medium">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Footer Section */}
      <div className="border-t border-[#1a2540] p-6 space-y-4">
        {/* Subscription Tier Badge */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-[#7a88a8] uppercase tracking-wider">
            Plan
          </span>
          <Badge className={`${tierColor[subscriptionTier as keyof typeof tierColor]}`}>
            {subscriptionTier}
          </Badge>
        </div>

        {/* Aurora Footer */}
        <div className="text-xs text-[#7a88a8] text-center pt-2 border-t border-[#1a2540]">
          by Aurora
        </div>
      </div>
    </div>
  );
}
