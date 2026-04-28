'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, Video, DollarSign, Activity, Bell, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Client } from '@/types/client';
import { format } from 'date-fns';

const MOCK_CLIENTS: Record<string, Client> = {
  '1': {
    id: '1',
    name: 'Acme Corporation',
    company: 'Acme Inc.',
    contactEmail: 'contact@acme.com',
    monthlyRetainer: 500000,
    serviceType: 'Full Service',
    status: 'active',
    healthScore: {
      overall: 85,
      breakdown: { financial: 90, relationship: 82, delivery: 88, engagement: 78 },
      lastUpdated: new Date().toISOString(),
      status: 'healthy',
    },
    lastMeetingDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    notes: 'Long-term partner, excellent collaboration',
    createdAt: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date().toISOString(),
    agencyId: 'agency-1',
  },
  '2': {
    id: '2',
    name: 'TechStart Solutions',
    company: 'TechStart Labs',
    contactEmail: 'hello@techstart.io',
    monthlyRetainer: 350000,
    serviceType: 'SEO',
    status: 'active',
    healthScore: {
      overall: 65,
      breakdown: { financial: 70, relationship: 60, delivery: 68, engagement: 58 },
      lastUpdated: new Date().toISOString(),
      status: 'at-risk',
    },
    lastMeetingDate: new Date(Date.now() - 21 * 24 * 60 * 60 * 1000).toISOString(),
    notes: 'Recently requesting fewer deliverables',
    createdAt: new Date(Date.now() - 120 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date().toISOString(),
    agencyId: 'agency-1',
  },
  '3': {
    id: '3',
    name: 'Design Hub',
    company: 'Creative Design Co.',
    contactEmail: 'team@designhub.com',
    monthlyRetainer: 250000,
    serviceType: 'Design',
    status: 'active',
    healthScore: {
      overall: 72,
      breakdown: { financial: 75, relationship: 70, delivery: 74, engagement: 68 },
      lastUpdated: new Date().toISOString(),
      status: 'healthy',
    },
    lastMeetingDate: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
    notes: 'Growing partnership, expanding service scope',
    createdAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date().toISOString(),
    agencyId: 'agency-1',
  },
};

interface TimelineEvent {
  id: string;
  type: 'meeting' | 'invoice' | 'health_score' | 'alert' | 'action_item';
  title: string;
  description: string;
  date: string;
  category: string;
  sentiment?: number;
  amount?: number;
  amountType?: 'received' | 'overdue';
  scoreChange?: { from: number; to: number };
  severity?: 'critical' | 'high' | 'medium' | 'low';
  status?: 'created' | 'completed' | 'overdue';
}

const MOCK_TIMELINE_EVENTS: TimelineEvent[] = [
  {
    id: '1',
    type: 'meeting',
    title: 'Q2 Strategic Planning Call',
    description: 'Discussed Q2 initiatives, content strategy refresh, and budget allocation for paid media expansion',
    date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    category: 'Meeting',
    sentiment: 82,
  },
  {
    id: '2',
    type: 'invoice',
    title: 'Monthly Retainer Invoice',
    description: 'Invoice #2024-04-001 for $50,000 — April services',
    date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    category: 'Payment',
    amount: 50000,
    amountType: 'received',
  },
  {
    id: '3',
    type: 'health_score',
    title: 'Health Score Improvement',
    description: 'Overall health score increased due to improved engagement metrics and positive meeting outcomes',
    date: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
    category: 'Health Score',
    scoreChange: { from: 82, to: 85 },
  },
  {
    id: '4',
    type: 'action_item',
    title: 'Action Item Completed',
    description: 'Deliverable: Content calendar for Q2 campaigns — delivered on schedule',
    date: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(),
    category: 'Action Item',
    status: 'completed',
  },
  {
    id: '5',
    type: 'meeting',
    title: 'Monthly Performance Review',
    description: 'Reviewed March performance metrics, engagement rates up 15%, discussed optimization opportunities',
    date: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(),
    category: 'Meeting',
    sentiment: 76,
  },
  {
    id: '6',
    type: 'invoice',
    title: 'Monthly Retainer Invoice',
    description: 'Invoice #2024-03-001 for $50,000 — March services',
    date: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    category: 'Payment',
    amount: 50000,
    amountType: 'received',
  },
  {
    id: '7',
    type: 'health_score',
    title: 'Health Score Decline',
    description: 'Health score dropped slightly due to delayed response to stakeholder feedback',
    date: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000).toISOString(),
    category: 'Health Score',
    scoreChange: { from: 85, to: 82 },
  },
  {
    id: '8',
    type: 'action_item',
    title: 'Action Item Created',
    description: 'Follow-up: Prepare budget proposal for H2 expanded services',
    date: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
    category: 'Action Item',
    status: 'created',
  },
  {
    id: '9',
    type: 'meeting',
    title: 'Quarterly Business Review',
    description: 'Q1 QBR — comprehensive review of performance, ROI analysis, and strategic direction for Q2',
    date: new Date(Date.now() - 16 * 24 * 60 * 60 * 1000).toISOString(),
    category: 'Meeting',
    sentiment: 88,
  },
  {
    id: '10',
    type: 'alert',
    title: 'Churn Risk Alert',
    description: 'Health score threshold breach detected (below 70) — engagement declining',
    date: new Date(Date.now() - 18 * 24 * 60 * 60 * 1000).toISOString(),
    category: 'Alert',
    severity: 'high',
  },
  {
    id: '11',
    type: 'invoice',
    title: 'Monthly Retainer Invoice',
    description: 'Invoice #2024-02-001 for $50,000 — February services',
    date: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(),
    category: 'Payment',
    amount: 50000,
    amountType: 'received',
  },
  {
    id: '12',
    type: 'meeting',
    title: 'Executive Stakeholder Meeting',
    description: 'Met with C-suite to discuss partnership expansion and long-term strategic goals',
    date: new Date(Date.now() - 22 * 24 * 60 * 60 * 1000).toISOString(),
    category: 'Meeting',
    sentiment: 85,
  },
  {
    id: '13',
    type: 'action_item',
    title: 'Action Item Overdue',
    description: 'Deliverable: Competitive analysis report — overdue by 3 days',
    date: new Date(Date.now() - 24 * 24 * 60 * 60 * 1000).toISOString(),
    category: 'Action Item',
    status: 'overdue',
  },
  {
    id: '14',
    type: 'invoice',
    title: 'Monthly Retainer Invoice',
    description: 'Invoice #2024-01-001 for $50,000 — January services',
    date: new Date(Date.now() - 26 * 24 * 60 * 60 * 1000).toISOString(),
    category: 'Payment',
    amount: 50000,
    amountType: 'received',
  },
  {
    id: '15',
    type: 'health_score',
    title: 'Health Score Update',
    description: 'Health score increased to 82 following Q1 planning initiatives and renewed engagement',
    date: new Date(Date.now() - 28 * 24 * 60 * 60 * 1000).toISOString(),
    category: 'Health Score',
    scoreChange: { from: 78, to: 82 },
  },
  {
    id: '16',
    type: 'meeting',
    title: 'Onboarding Call',
    description: 'Initial onboarding call — discussed goals, deliverables, and communication cadence',
    date: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
    category: 'Meeting',
    sentiment: 80,
  },
];

const getEventIcon = (
  type: string
): React.ComponentType<React.SVGProps<SVGSVGElement>> => {
  switch (type) {
    case 'meeting':
      return Video;
    case 'invoice':
      return DollarSign;
    case 'health_score':
      return Activity;
    case 'alert':
      return Bell;
    case 'action_item':
      return CheckCircle;
    default:
      return Activity;
  }
};

const getEventColor = (type: string): string => {
  switch (type) {
    case 'meeting':
      return 'text-[#4cc9f0] bg-[#4cc9f0]/10';
    case 'invoice':
      return 'text-green-400 bg-green-500/10';
    case 'health_score':
      return 'text-[#7b8ff0] bg-[#7b8ff0]/10';
    case 'alert':
      return 'text-[#e74c3c] bg-[#e74c3c]/10';
    case 'action_item':
      return 'text-[#b388eb] bg-[#b388eb]/10';
    default:
      return 'text-[#7a88a8] bg-[#7a88a8]/10';
  }
};

export default function ClientTimelinePage() {
  const router = useRouter();
  const params = useParams();
  const clientId = params.id as string;

  const [client, setClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedEventTypes, setSelectedEventTypes] = useState<Set<string>>(
    new Set(['meeting', 'invoice', 'health_score', 'alert', 'action_item'])
  );
  const [dateRange, setDateRange] = useState<'all' | '30' | '60' | '90'>('all');

  useEffect(() => {
    const mockClient = MOCK_CLIENTS[clientId];
    setClient(mockClient || null);
    setLoading(false);
  }, [clientId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-[#e74c3c] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-[#7a88a8]">Loading timeline...</p>
        </div>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="space-y-4">
        <Button
          variant="ghost"
          onClick={() => router.back()}
          className="gap-2 text-[#7a88a8] hover:text-white"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </Button>
        <Card className="p-12 text-center bg-[#0d1422] border-[#1a2540]">
          <h3 className="text-lg font-semibold text-white mb-2">Client not found</h3>
          <p className="text-[#7a88a8]">The client you are looking for does not exist.</p>
        </Card>
      </div>
    );
  }

  const toggleEventType = (type: string) => {
    const newTypes = new Set(selectedEventTypes);
    if (newTypes.has(type)) {
      newTypes.delete(type);
    } else {
      newTypes.add(type);
    }
    setSelectedEventTypes(newTypes);
  };

  const cutoffDate = new Date();
  if (dateRange !== 'all') {
    cutoffDate.setDate(cutoffDate.getDate() - parseInt(dateRange));
  }

  const filteredEvents = MOCK_TIMELINE_EVENTS.filter((event) => {
    if (!selectedEventTypes.has(event.type)) {
      return false;
    }
    if (dateRange !== 'all' && new Date(event.date) < cutoffDate) {
      return false;
    }
    return true;
  }).sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <Button
        variant="ghost"
        onClick={() => router.back()}
        className="gap-2 text-[#7a88a8] hover:text-white"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Client
      </Button>

      {/* Header */}
      <div>
        <h1 className="text-3xl text-white mb-2">
          Client Timeline — {client.name}
        </h1>
        <p className="text-[#7a88a8]">
          Chronological history of all signals and activities
        </p>
      </div>

      {/* Filters */}
      <Card className="p-6 bg-[#0c1220] border-[#1a2540]">
        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-white mb-3">Event Types</h3>
            <div className="flex flex-wrap gap-2">
              {[
                { id: 'meeting', label: 'Meetings' },
                { id: 'invoice', label: 'Invoices' },
                { id: 'health_score', label: 'Health Score' },
                { id: 'alert', label: 'Alerts' },
                { id: 'action_item', label: 'Action Items' },
              ].map((type) => (
                <button
                  key={type.id}
                  onClick={() => toggleEventType(type.id)}
                  className={`px-3 py-1 rounded text-sm font-medium transition ${
                    selectedEventTypes.has(type.id)
                      ? 'bg-[#38e8c8] text-[#06090f]'
                      : 'bg-[#1a2540] text-[#7a88a8] hover:bg-[#2a3550]'
                  }`}
                >
                  {type.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-white mb-3">Date Range</h3>
            <div className="flex gap-2">
              {[
                { value: 'all', label: 'All Time' },
                { value: '30', label: 'Last 30 Days' },
                { value: '60', label: 'Last 60 Days' },
                { value: '90', label: 'Last 90 Days' },
              ].map((range) => (
                <button
                  key={range.value}
                  onClick={() => setDateRange(range.value as typeof dateRange)}
                  className={`px-3 py-1 rounded text-sm font-medium transition ${
                    dateRange === range.value
                      ? 'bg-[#4cc9f0] text-[#06090f]'
                      : 'bg-[#1a2540] text-[#7a88a8] hover:bg-[#2a3550]'
                  }`}
                >
                  {range.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </Card>

      {/* Timeline */}
      {filteredEvents.length === 0 ? (
        <Card className="p-12 text-center bg-[#0d1422] border-[#1a2540]">
          <Activity className="w-8 h-8 text-[#7a88a8] mx-auto mb-3 opacity-50" />
          <h3 className="text-lg font-semibold text-white mb-2">
            No events found
          </h3>
          <p className="text-[#7a88a8]">
            Try adjusting your filters to see more timeline events
          </p>
        </Card>
      ) : (
        <div className="space-y-0">
          {filteredEvents.map((event, index) => {
            const IconComponent = getEventIcon(event.type);
            const colorClasses = getEventColor(event.type);
            const isAlternate = index % 2 === 0;

            return (
              <div
                key={event.id}
                className="relative pb-8 last:pb-0"
              >
                {/* Vertical line connector */}
                {index < filteredEvents.length - 1 && (
                  <div className="absolute left-[22px] top-12 w-0.5 h-12 bg-[#1a2540]" />
                )}

                <div className={`flex gap-6 ${isAlternate ? 'flex-row' : 'flex-row-reverse'}`}>
                  {/* Timeline dot and icon */}
                  <div className="flex flex-col items-center pt-1">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center ${colorClasses} border border-[#1a2540] flex-shrink-0`}>
                      <IconComponent className="w-5 h-5" />
                    </div>
                  </div>

                  {/* Event content */}
                  <div className={`flex-1 pt-1 ${isAlternate ? '' : ''}`}>
                    <Card className="bg-[#0c1220] border-[#1a2540] hover:border-[#2a3550] transition">
                      <div className="p-5">
                        {/* Header with title and date */}
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <h4 className="font-semibold text-white">
                              {event.title}
                            </h4>
                            <p className="text-xs text-[#7a88a8] mt-1">
                              {format(new Date(event.date), 'MMM dd, yyyy • h:mm a')}
                            </p>
                          </div>
                          <Badge
                            className={`ml-4 flex-shrink-0 ${
                              event.type === 'meeting'
                                ? 'bg-[#4cc9f0]/20 text-[#4cc9f0] border-[#4cc9f0]/30'
                                : event.type === 'invoice'
                                ? 'bg-green-500/20 text-green-400 border-green-500/30'
                                : event.type === 'health_score'
                                ? 'bg-[#7b8ff0]/20 text-[#7b8ff0] border-[#7b8ff0]/30'
                                : event.type === 'alert'
                                ? 'bg-[#e74c3c]/20 text-[#e74c3c] border-[#e74c3c]/30'
                                : 'bg-[#b388eb]/20 text-[#b388eb] border-[#b388eb]/30'
                            }`}
                          >
                            {event.category}
                          </Badge>
                        </div>

                        {/* Description */}
                        <p className="text-sm text-[#7a88a8] mb-3">
                          {event.description}
                        </p>

                        {/* Event-specific details */}
                        <div className="flex flex-wrap gap-4 text-xs">
                          {event.sentiment !== undefined && (
                            <div>
                              <p className="text-[#7a88a8] mb-1">Sentiment Score</p>
                              <div className="flex items-center gap-2">
                                <div className="w-16 h-2 bg-[#1a2540] rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-gradient-to-r from-[#38e8c8] to-[#4cc9f0]"
                                    style={{ width: `${event.sentiment}%` }}
                                  />
                                </div>
                                <span className="text-[#7a88a8]">
                                  {event.sentiment}%
                                </span>
                              </div>
                            </div>
                          )}

                          {event.amount !== undefined && (
                            <div>
                              <p className="text-[#7a88a8] mb-1">Amount</p>
                              <p
                                className={
                                  event.amountType === 'received'
                                    ? 'text-green-400 font-semibold'
                                    : 'text-[#e74c3c] font-semibold'
                                }
                              >
                                {event.amountType === 'overdue' ? '-' : '+'}$
                                {event.amount.toLocaleString()}
                              </p>
                            </div>
                          )}

                          {event.scoreChange && (
                            <div>
                              <p className="text-[#7a88a8] mb-1">Score Change</p>
                              <p className="font-semibold text-white">
                                {event.scoreChange.from} →{' '}
                                <span
                                  className={
                                    event.scoreChange.to > event.scoreChange.from
                                      ? 'text-green-400'
                                      : 'text-[#e74c3c]'
                                  }
                                >
                                  {event.scoreChange.to}
                                </span>
                              </p>
                            </div>
                          )}

                          {event.status && (
                            <div>
                              <p className="text-[#7a88a8] mb-1">Status</p>
                              <Badge
                                className={
                                  event.status === 'completed'
                                    ? 'bg-green-500/20 text-green-400 border-green-500/30'
                                    : event.status === 'overdue'
                                    ? 'bg-[#e74c3c]/20 text-[#e74c3c] border-[#e74c3c]/30'
                                    : 'bg-[#7b8ff0]/20 text-[#7b8ff0] border-[#7b8ff0]/30'
                                }
                              >
                                {event.status.charAt(0).toUpperCase() +
                                  event.status.slice(1)}
                              </Badge>
                            </div>
                          )}

                          {event.severity && (
                            <div>
                              <p className="text-[#7a88a8] mb-1">Severity</p>
                              <Badge
                                className={
                                  event.severity === 'critical'
                                    ? 'bg-[#e74c3c]/20 text-[#e74c3c] border-[#e74c3c]/30'
                                    : event.severity === 'high'
                                    ? 'bg-[#f59e0b]/20 text-[#f59e0b] border-[#f59e0b]/30'
                                    : 'bg-[#7b8ff0]/20 text-[#7b8ff0] border-[#7b8ff0]/30'
                                }
                              >
                                {event.severity.charAt(0).toUpperCase() +
                                  event.severity.slice(1)}
                              </Badge>
                            </div>
                          )}
                        </div>
                      </div>
                    </Card>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
