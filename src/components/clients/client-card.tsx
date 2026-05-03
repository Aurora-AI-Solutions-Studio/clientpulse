'use client';

// Sprint 7.8 visibility hotfix: Edit + Delete were previously hidden behind
// a 16px MoreVertical kebab in subtle grey next to the HealthScoreBadge —
// effectively invisible to a non-technical agency owner doing a 30-second
// scan of /dashboard/clients. The dropdown shipped in PR #86, the routes
// work, but Sasa reported "no way to change or delete a client". So this
// pulls Edit + Delete out of the overflow menu and onto the card itself
// as always-visible, labeled icon buttons in a footer row, mirroring the
// affordance pattern of the page-level "+ Add client" / "Mass-upload"
// buttons. No more discoverability gap.

import { Client } from '@/types/client';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import HealthScoreBadge from './health-score-badge';
import { format } from 'date-fns';
import { Pencil, Trash2 } from 'lucide-react';

interface ClientCardProps {
  client: Client;
  onClick?: () => void;
  onEdit?: (client: Client) => void;
  onDelete?: (client: Client) => void;
}

export default function ClientCard({
  client,
  onClick,
  onEdit,
  onDelete,
}: ClientCardProps) {
  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-500/10 text-green-400 border-green-500/20';
      case 'paused':
        return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20';
      case 'churned':
        return 'bg-red-500/10 text-red-400 border-red-500/20';
      default:
        return 'bg-[#1a2540] text-[#7a88a8]';
    }
  };

  const lastMeetingDate = client.lastMeetingDate
    ? format(new Date(client.lastMeetingDate), 'MMM dd, yyyy')
    : 'No meeting';

  const showActions = Boolean(onEdit || onDelete);

  const stop = (e: React.MouseEvent) => {
    // Card has its own onClick (navigate to detail). Action buttons must not
    // bubble — clicking Edit should not also navigate away from the list.
    e.stopPropagation();
  };

  return (
    <Card
      className="group p-5 cursor-pointer transition-all hover:border-[#38e8c8]/40 hover:shadow-[0_2px_28px_-8px_rgba(56,232,200,0.18)]"
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-semibold text-white truncate">
            {client.company || client.name}
          </h3>
          <p className="text-xs text-[#9aa6c0] mt-0.5 truncate">{client.name}</p>
        </div>
        <HealthScoreBadge score={client.healthScore?.overall ?? 0} size="md" />
      </div>

      <div className="space-y-2.5 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-[#7a88a8] text-xs uppercase tracking-wider">Monthly</span>
          <span className="text-white font-medium">
            ${((client.monthlyRetainer ?? 0) / 100).toLocaleString()}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[#7a88a8] text-xs uppercase tracking-wider">Last meeting</span>
          <span className="text-[#c8d0e0] text-xs">{lastMeetingDate}</span>
        </div>
        <div className="flex items-center gap-2 pt-2 flex-wrap">
          {client.serviceType && (
            <Badge variant="outline" className="text-[10px] uppercase tracking-wider border-[#1a2540] text-[#9aa6c0]">
              {client.serviceType}
            </Badge>
          )}
          <Badge className={`text-[10px] uppercase tracking-wider ${getStatusBadgeColor(client.status)}`}>
            {client.status}
          </Badge>
        </div>
      </div>

      {showActions && (
        <div
          className="mt-4 pt-3 border-t border-[#1a2540] flex items-center justify-end gap-2"
          onClick={stop}
        >
          {onEdit && (
            <button
              type="button"
              aria-label={`Edit ${client.company || client.name}`}
              onClick={(e) => {
                stop(e);
                onEdit(client);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-[#c8d0e0] bg-[#0d1422] border border-[#1a2540] hover:text-white hover:border-[#38e8c8]/40 hover:bg-[#1a2540]/50 transition-colors"
            >
              <Pencil className="w-3.5 h-3.5" />
              Edit
            </button>
          )}
          {onDelete && (
            <button
              type="button"
              aria-label={`Delete ${client.company || client.name}`}
              onClick={(e) => {
                stop(e);
                onDelete(client);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-red-400 bg-red-500/5 border border-red-500/20 hover:text-red-300 hover:bg-red-500/10 hover:border-red-500/40 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Delete
            </button>
          )}
        </div>
      )}
    </Card>
  );
}
