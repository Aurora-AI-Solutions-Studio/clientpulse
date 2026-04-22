'use client';

import { X, ChevronDown } from 'lucide-react';
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
  Brain,
  FileText,
  Hash,
  Mic,
  Link2,
  Eye,
  Zap,
  BarChart3,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useState } from 'react';

interface User {
  id: string;
  email?: string;
  user_metadata?: {
    full_name?: string;
    avatar_url?: string;
  };
}

interface MobileSidebarProps {
  user: User;
  isOpen: boolean;
  onClose: () => void;
}

interface NavGroup {
  label: string;
  icon: React.ElementType;
  description: string;
  color: string;
  items: {
    label: string;
    icon: React.ElementType;
    href: string;
  }[];
}

const workflowGroups: NavGroup[] = [
  {
    label: 'Connect',
    icon: Link2,
    description: 'Data sources',
    color: '#4cc9f0',
    items: [
      { label: 'Integrations', icon: Link2, href: '/dashboard/settings' },
      { label: 'Slack', icon: Hash, href: '/dashboard/integrations/slack' },
      { label: 'Transcription', icon: Mic, href: '/dashboard/integrations/whisper' },
    ],
  },
  {
    label: 'Monitor',
    icon: Eye,
    description: 'Health & alerts',
    color: '#38e8c8',
    items: [
      { label: 'Dashboard', icon: LayoutDashboard, href: '/dashboard' },
      { label: 'Clients', icon: Users, href: '/dashboard/clients' },
      { label: 'Health Scores', icon: Activity, href: '/dashboard/health' },
      { label: 'Monday Brief', icon: Mail, href: '/dashboard/brief' },
      { label: 'Alerts', icon: Bell, href: '/dashboard/alerts' },
      { label: 'Predictions', icon: TrendingDown, href: '/dashboard/predictions' },
    ],
  },
  {
    label: 'Act',
    icon: Zap,
    description: 'Take action',
    color: '#e74c3c',
    items: [
      { label: 'Approvals', icon: ShieldCheck, href: '/dashboard/approvals' },
      { label: 'Check-ins', icon: MessageSquare, href: '/dashboard/check-ins' },
      { label: 'Upsell', icon: TrendingUp, href: '/dashboard/upsell' },
      { label: 'Meetings', icon: Video, href: '/dashboard/meetings' },
    ],
  },
  {
    label: 'Review',
    icon: BarChart3,
    description: 'Trends & insights',
    color: '#b388eb',
    items: [
      { label: 'Reports', icon: FileText, href: '/dashboard/reports' },
      { label: 'Outcomes', icon: FileText, href: '/dashboard/outcomes' },
      { label: 'Learning', icon: Brain, href: '/dashboard/learning' },
    ],
  },
];

export default function MobileSidebar({
  isOpen,
  onClose,
}: MobileSidebarProps) {
  const pathname = usePathname();
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    Connect: true,
    Monitor: true,
    Act: true,
    Review: true,
  });

  const getSubscriptionTier = () => {
    return 'Free';
  };

  const isActive = (href: string) => {
    if (href === '/dashboard') return pathname === '/dashboard';
    return pathname === href || pathname.startsWith(href + '/');
  };

  const isGroupActive = (group: NavGroup) => {
    return group.items.some((item) => isActive(item.href));
  };

  const toggleGroup = (label: string) => {
    setExpandedGroups((prev) => ({ ...prev, [label]: !prev[label] }));
  };

  const subscriptionTier = getSubscriptionTier();
  const tierColor = {
    Free: 'bg-[#1a2540] text-[#7a88a8]',
    Solo: 'bg-blue-500/10 text-blue-400',
    Pro: 'bg-purple-500/10 text-purple-400',
    Agency: 'bg-[#e74c3c]/10 text-[#e74c3c]',
  } as Record<string, string>;

  return (
    <>
      {/* Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 md:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <div
        className={`fixed left-0 top-0 h-screen w-[280px] bg-[#0a0f1a] border-r border-[#1a2540] z-40 flex flex-col transition-transform duration-300 md:hidden ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Header with Close Button */}
        <div className="flex items-center justify-between p-6 border-b border-[#1a2540]">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 text-xl font-bold text-white hover:opacity-80 transition-opacity"
          >
            <div className="w-8 h-8 rounded bg-gradient-to-br from-[#e74c3c] to-[#c0392b] flex items-center justify-center">
              <span className="text-white text-sm">CP</span>
            </div>
            <span className="text-[#e74c3c]">ClientPulse</span>
          </Link>

          <button
            onClick={onClose}
            className="p-2 hover:bg-[#1a2540] rounded-lg transition-colors text-[#7a88a8] hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Workflow Navigation */}
        <nav className="flex-1 px-4 py-5 space-y-1 overflow-y-auto">
          {workflowGroups.map((group) => {
            const GroupIcon = group.icon;
            const expanded = expandedGroups[group.label];
            const groupActive = isGroupActive(group);

            return (
              <div key={group.label} className="mb-1">
                <button
                  onClick={() => toggleGroup(group.label)}
                  className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg transition-all group"
                  style={{
                    background: groupActive ? `${group.color}08` : 'transparent',
                  }}
                >
                  <div className="flex items-center gap-2.5">
                    <div
                      className="w-7 h-7 rounded-md flex items-center justify-center"
                      style={{ background: `${group.color}15` }}
                    >
                      <GroupIcon className="w-4 h-4" style={{ color: group.color }} />
                    </div>
                    <div className="text-left">
                      <span
                        className="text-sm font-semibold block leading-tight"
                        style={{ color: groupActive ? group.color : '#c8d0e0' }}
                      >
                        {group.label}
                      </span>
                      <span className="text-[10px] text-[#5a6580] leading-tight">
                        {group.description}
                      </span>
                    </div>
                  </div>
                  <ChevronDown
                    className={`w-4 h-4 text-[#5a6580] transition-transform duration-200 ${
                      expanded ? 'rotate-0' : '-rotate-90'
                    }`}
                  />
                </button>

                {expanded && (
                  <div className="ml-[18px] pl-[14px] border-l border-[#1a2540] mt-1 space-y-0.5">
                    {group.items.map((item) => {
                      const Icon = item.icon;
                      const active = isActive(item.href);

                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={onClose}
                          className={`flex items-center gap-2.5 px-3 py-2 rounded-md transition-all text-[13px] ${
                            active
                              ? 'text-white font-medium'
                              : 'text-[#7a88a8] hover:bg-[#0f1420] hover:text-[#c8d0e0]'
                          }`}
                          style={active ? { background: `${group.color}12`, color: group.color } : {}}
                        >
                          <Icon className="w-4 h-4 flex-shrink-0" />
                          <span>{item.label}</span>
                          {item.label === 'Alerts' && (
                            <div className="w-1.5 h-1.5 bg-[#e74c3c] rounded-full ml-auto" />
                          )}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

          <div className="pt-3 mt-3 border-t border-[#1a2540]">
            <Link
              href="/dashboard/settings"
              onClick={onClose}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-md transition-all text-[13px] ${
                isActive('/dashboard/settings')
                  ? 'text-[#7a88a8] bg-[#0f1420]'
                  : 'text-[#5a6580] hover:bg-[#0f1420] hover:text-[#7a88a8]'
              }`}
            >
              <Settings className="w-4 h-4 flex-shrink-0" />
              <span>Settings</span>
            </Link>
          </div>
        </nav>

        {/* Footer Section */}
        <div className="border-t border-[#1a2540] p-4 space-y-3">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs text-[#7a88a8] uppercase tracking-wider">
              Plan
            </span>
            <Badge className={`${tierColor[subscriptionTier as keyof typeof tierColor]}`}>
              {subscriptionTier}
            </Badge>
          </div>

          <div className="text-xs text-[#7a88a8] text-center pt-2 border-t border-[#1a2540]">
            by Aurora
          </div>
        </div>
      </div>
    </>
  );
}
