'use client';

import { useState } from 'react';
import { ChevronDown, Check, X } from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface Approval {
  id: string;
  type: 'monday-brief' | 'churn-alert' | 'save-plan' | 'check-in';
  clientName: string;
  description: string;
  preview: string;
  timestamp: string;
  status: 'pending' | 'approved' | 'dismissed';
  expanded: boolean;
}

const MOCK_APPROVALS: Approval[] = [
  {
    id: '1',
    type: 'monday-brief',
    clientName: 'Acme Corporation',
    description: 'Monday Brief - Weekly client summary',
    preview:
      'Dear [Client Name], Here is your weekly brief for the week of April 14-20, 2026. This week we focused on campaign optimization and performance review.',
    timestamp: '10 minutes ago',
    status: 'pending',
    expanded: false,
  },
  {
    id: '2',
    type: 'churn-alert',
    clientName: 'TechStart Solutions',
    description: 'Churn Risk Alert - Health dropped 25 points',
    preview:
      'Alert: We detected a significant drop in engagement metrics for TechStart Solutions. Recommended immediate action: Schedule a QBR to discuss concerns and opportunities.',
    timestamp: '2 hours ago',
    status: 'pending',
    expanded: false,
  },
  {
    id: '3',
    type: 'save-plan',
    clientName: 'Social First Media',
    description: 'Save Plan - Proposal to re-engage client',
    preview:
      'Subject: Proposal to Strengthen Our Partnership\n\nDear [Contact], we would like to discuss how we can better serve your needs through an expanded service offering.',
    timestamp: '1 day ago',
    status: 'pending',
    expanded: false,
  },
  {
    id: '4',
    type: 'check-in',
    clientName: 'Design Hub',
    description: 'Check-in Invite - Quarterly business review',
    preview:
      'You are invited to a Quarterly Business Review scheduled for April 25, 2026 at 2:00 PM PT. We will review key metrics, successes, and opportunities for the next quarter.',
    timestamp: '2 days ago',
    status: 'approved',
    expanded: false,
  },
];

const TYPE_BADGES = {
  'monday-brief': { label: 'Monday Brief', color: 'bg-blue-500/15 text-blue-300' },
  'churn-alert': { label: 'Churn Alert', color: 'bg-[#e74c3c]/15 text-[#e74c3c]' },
  'save-plan': { label: 'Save Plan', color: 'bg-amber-500/15 text-amber-300' },
  'check-in': { label: 'Check-in Invite', color: 'bg-green-500/15 text-green-300' },
};

export default function ApprovalsPage() {
  const [approvals, setApprovals] = useState<Approval[]>(MOCK_APPROVALS);
  const [filter, setFilter] = useState<'pending' | 'approved' | 'dismissed' | 'all'>('pending');
  const [autoApprove, setAutoApprove] = useState<Record<string, boolean>>({
    'monday-brief': false,
    'churn-alert': false,
    'save-plan': false,
    'check-in': false,
  });

  const filteredApprovals = approvals.filter((a) => {
    if (filter === 'all') return true;
    return a.status === filter;
  });

  const pendingCount = approvals.filter((a) => a.status === 'pending').length;

  const handleApprove = (id: string) => {
    setApprovals(
      approvals.map((a) => (a.id === id ? { ...a, status: 'approved' } : a))
    );
  };

  const handleDismiss = (id: string) => {
    setApprovals(
      approvals.map((a) => (a.id === id ? { ...a, status: 'dismissed' } : a))
    );
  };

  const handleToggleExpand = (id: string) => {
    setApprovals(
      approvals.map((a) => (a.id === id ? { ...a, expanded: !a.expanded } : a))
    );
  };

  const handleToggleAutoApprove = (type: string) => {
    setAutoApprove((prev) => ({
      ...prev,
      [type]: !prev[type],
    }));
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-3xl font-bold text-white font-playfair mb-2">
            Approval Queue
          </h2>
          <p className="text-[#7a88a8]">
            {pendingCount === 0
              ? 'All caught up! No pending approvals.'
              : `${pendingCount} pending approval${pendingCount !== 1 ? 's' : ''}`}
          </p>
        </div>
      </div>

      {/* Auto-approve settings */}
      <Card className="bg-[#0d1422] border-[#1a2540]">
        <CardHeader>
          <CardTitle className="text-base">Auto-Approve Settings</CardTitle>
          <CardDescription>
            Automatically approve certain action types without manual review
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Object.entries(TYPE_BADGES).map(([key, { label }]) => (
              <label
                key={key}
                className="flex items-center gap-3 p-3 rounded-lg bg-[#06090f] border border-[#1a2540] hover:border-[#2a3550] cursor-pointer transition"
              >
                <input
                  type="checkbox"
                  checked={autoApprove[key] || false}
                  onChange={() => handleToggleAutoApprove(key)}
                  className="w-4 h-4 rounded border-[#1a2540] bg-[#1a2540] text-[#e74c3c] cursor-pointer"
                />
                <span className="text-sm font-medium text-[#7a88a8]">{label}</span>
              </label>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Filter tabs */}
      <div className="flex gap-2 flex-wrap">
        {(['pending', 'approved', 'dismissed', 'all'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition ${
              filter === f
                ? 'bg-[#e74c3c] text-white'
                : 'bg-[#0d1422] text-[#7a88a8] border border-[#1a2540] hover:text-white hover:border-[#2a3550]'
            }`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* Approval cards */}
      {filteredApprovals.length > 0 ? (
        <div className="space-y-4">
          {filteredApprovals.map((approval) => (
            <Card
              key={approval.id}
              className="bg-[#0d1422] border-[#1a2540] hover:border-[#2a3550] transition"
            >
              <CardContent className="p-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    {/* Type badge */}
                    <div className="flex items-center gap-3 mb-3">
                      <span
                        className={`text-xs font-semibold px-2 py-1 rounded border ${
                          TYPE_BADGES[approval.type].color
                        }`}
                      >
                        {TYPE_BADGES[approval.type].label}
                      </span>
                      {approval.status === 'approved' && (
                        <span className="text-xs font-semibold px-2 py-1 rounded bg-green-500/15 text-green-300 flex items-center gap-1">
                          <Check className="w-3 h-3" />
                          Approved
                        </span>
                      )}
                      {approval.status === 'dismissed' && (
                        <span className="text-xs font-semibold px-2 py-1 rounded bg-[#7a88a8]/15 text-[#7a88a8] flex items-center gap-1">
                          <X className="w-3 h-3" />
                          Dismissed
                        </span>
                      )}
                    </div>

                    {/* Title and description */}
                    <h3 className="text-lg font-semibold text-white mb-2">
                      {approval.clientName}
                    </h3>
                    <p className="text-sm text-[#7a88a8] mb-3">
                      {approval.description}
                    </p>

                    {/* Preview section */}
                    <div
                      className={`bg-[#06090f] border border-[#1a2540] rounded-lg p-4 overflow-hidden transition-all ${
                        approval.expanded ? 'max-h-96' : 'max-h-20'
                      }`}
                    >
                      <p className="text-xs text-[#7a88a8] font-mono whitespace-pre-wrap">
                        {approval.preview}
                      </p>
                    </div>

                    {/* Expand button */}
                    {approval.preview.length > 100 && (
                      <button
                        onClick={() => handleToggleExpand(approval.id)}
                        className="mt-2 text-xs text-[#4cc9f0] hover:text-[#38e8c8] transition flex items-center gap-1"
                      >
                        <ChevronDown
                          className={`w-3 h-3 transition-transform ${
                            approval.expanded ? 'rotate-180' : ''
                          }`}
                        />
                        {approval.expanded ? 'Show less' : 'Show more'}
                      </button>
                    )}

                    {/* Timestamp */}
                    <p className="text-xs text-[#7a88a8] mt-3">{approval.timestamp}</p>
                  </div>

                  {/* Action buttons */}
                  {approval.status === 'pending' && (
                    <div className="flex gap-2 flex-shrink-0">
                      <Button
                        onClick={() => handleApprove(approval.id)}
                        className="bg-green-600 hover:bg-green-700 text-white"
                        size="sm"
                      >
                        <Check className="w-4 h-4 mr-1" />
                        Approve
                      </Button>
                      <Button
                        onClick={() => handleDismiss(approval.id)}
                        variant="outline"
                        className="border-[#1a2540] text-[#7a88a8] hover:bg-[#1a2540]"
                        size="sm"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="bg-[#0d1422] border-[#1a2540]">
          <CardContent className="p-12 text-center">
            <div className="space-y-4">
              <div className="text-4xl">✨</div>
              <h3 className="text-lg font-semibold text-white">
                {filter === 'pending'
                  ? 'All caught up!'
                  : filter === 'all'
                    ? 'No approvals'
                    : `No ${filter} approvals`}
              </h3>
              <p className="text-[#7a88a8]">
                {filter === 'pending'
                  ? 'No pending approvals.'
                  : 'Try adjusting your filter'}
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
