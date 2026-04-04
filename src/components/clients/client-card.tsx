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
      className="p-6 cursor-pointer hover:bg-[#132240] transition-all border-[#1a2540] hover:border-[#e74c3c]/30"
      onClick={onClick}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-white mb-1">{client.name}</h3>
          <p className="text-sm text-[#7a88a8]">{client.company}</p>
        </div>
        <HealthScoreBadge score={client.healthScore.overall} size="md" />
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-[#7a88a8]">Monthly Revenue</span>
          <span className="text-white font-medium">
            ${((client.monthlyRetainer ?? 0) / 100).toFixed(0)}
          </span>
        </div>

        <div className="flex items-center justify-between text-sm">
          <span className="text-[#7a88a8]">Last Meeting</span>
          <span className="text-[#7a88a8]">{lastMeetingDate}</span>
        </div>

        <div className="flex items-center gap-2 pt-2">
          <Badge variant="outline" className="text-xs">
            {client.serviceType}
          </Badge>
          <Badge className={getStatusBadgeColor(client.status)}>
            {client.status.charAt(0).toUpperCase() + client.status.slice(1)}
          </Badge>
        </div>
      </div>
    </Card>
  );
}
