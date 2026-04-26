'use client';

import { Client } from '@/types/client';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import HealthScoreBadge from './health-score-badge';
import { format } from 'date-fns';

interface ClientCardProps {
  client: Client;
  onClick?: () => void;
}

export default function ClientCard({ client, onClick }: ClientCardProps) {
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
    </Card>
  );
}
