'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, Edit2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import HealthScoreBadge from '@/components/clients/health-score-badge';
import HealthBreakdownComponent from '@/components/clients/health-breakdown';
import { Client } from '@/types/client';
import { format } from 'date-fns';

// Mock client data (in production, this would come from the API)
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
      breakdown: {
        financial: 90,
        relationship: 82,
        delivery: 88,
        engagement: 78,
      },
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
      breakdown: {
        financial: 70,
        relationship: 60,
        delivery: 68,
        engagement: 58,
      },
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
      breakdown: {
        financial: 75,
        relationship: 70,
        delivery: 74,
        engagement: 68,
      },
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

// Mock signals
const MOCK_SIGNALS: Array<{ id: string; type: 'positive' | 'negative' | 'neutral'; title: string; description: string; date: string }> = [
  {
    id: '1',
    type: 'positive',
    title: 'Positive Engagement',
    description: 'Client attended all scheduled meetings this month',
    date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: '2',
    type: 'negative',
    title: 'Overdue Invoice',
    description: 'Invoice #1042 is 14 days overdue — payment follow-up needed',
    date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: '3',
    type: 'positive',
    title: 'Revenue Growth',
    description: 'Monthly revenue increased by 15%',
    date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: '4',
    type: 'neutral',
    title: 'Status Update',
    description: 'Received quarterly review feedback',
    date: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
  },
];

// Mock activity events
const MOCK_ACTIVITY = [
  {
    date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    title: 'Meeting Conducted',
    description: 'Quarterly business review',
  },
  {
    date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    title: 'Invoice Sent',
    description: 'Monthly retainer invoice',
  },
  {
    date: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
    title: 'Deliverable Completed',
    description: 'Q1 strategy document delivered',
  },
  {
    date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    title: 'Contract Renewed',
    description: 'Annual contract renewal signed',
  },
];

export default function ClientDetailPage() {
  const router = useRouter();
  const params = useParams();
  const clientId = params.id as string;

  const [client, setClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simulate API fetch
    const mockClient = MOCK_CLIENTS[clientId];
    setClient(mockClient || null);
    setLoading(false);
  }, [clientId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-[#e74c3c] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-[#7a88a8]">Loading...</p>
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
          <p className="text-[#7a88a8]">The client you&apos;re looking for doesn&apos;t exist.</p>
        </Card>
      </div>
    );
  }

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

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <Button
        variant="ghost"
        onClick={() => router.back()}
        className="gap-2 text-[#7a88a8] hover:text-white"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Clients
      </Button>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-white">{client.name}</h1>
          <p className="text-[#7a88a8]">{client.company}</p>
        </div>
        <Button className="bg-[#e74c3c] hover:bg-[#d43d2d] gap-2">
          <Edit2 className="w-4 h-4" />
          Edit Client
        </Button>
      </div>

      {/* Client Summary Card */}
      <Card className="p-6 bg-[#0d1422] border-[#1a2540]">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {/* Health Score */}
          <div className="flex flex-col items-center">
            <HealthScoreBadge score={client.healthScore.overall} size="lg" />
          </div>

          {/* Key Metrics */}
          <div className="space-y-4">
            <div>
              <p className="text-sm text-[#7a88a8] mb-1">Status</p>
              <Badge className={getStatusBadgeColor(client.status)}>
                {client.status.charAt(0).toUpperCase() + client.status.slice(1)}
              </Badge>
            </div>
            <div>
              <p className="text-sm text-[#7a88a8] mb-1">Service Type</p>
              <Badge variant="outline" className="text-xs">
                {client.serviceType}
              </Badge>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <p className="text-sm text-[#7a88a8] mb-1">Monthly Revenue</p>
              <p className="text-xl font-semibold text-white">
                ${((client.monthlyRetainer ?? 0) / 100).toFixed(0)}
              </p>
            </div>
            <div>
              <p className="text-sm text-[#7a88a8] mb-1">Contact Email</p>
              <p className="text-sm text-white">{client.contactEmail}</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <p className="text-sm text-[#7a88a8] mb-1">Last Meeting</p>
              <p className="text-sm text-white">
                {client.lastMeetingDate
                  ? format(new Date(client.lastMeetingDate), 'MMM dd, yyyy')
                  : 'No meeting'}
              </p>
            </div>
            <div>
              <p className="text-sm text-[#7a88a8] mb-1">Client Since</p>
              <p className="text-sm text-white">
                {format(new Date(client.createdAt), 'MMM dd, yyyy')}
              </p>
            </div>
          </div>
        </div>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="bg-[#0d1422] border border-[#1a2540]">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="meetings">Meetings</TabsTrigger>
          <TabsTrigger value="financial">Financial</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          {/* Health Score Breakdown */}
          <Card className="p-6 bg-[#0d1422] border-[#1a2540]">
            <h3 className="text-lg font-semibold text-white mb-6">
              Health Score Breakdown
            </h3>
            <HealthBreakdownComponent breakdown={client.healthScore.breakdown} />
          </Card>

          {/* Recent Signals */}
          <Card className="p-6 bg-[#0d1422] border-[#1a2540]">
            <h3 className="text-lg font-semibold text-white mb-6">Recent Signals</h3>
            <div className="space-y-4">
              {MOCK_SIGNALS.map((signal) => (
                <div
                  key={signal.id}
                  className="flex items-start gap-4 pb-4 border-b border-[#1a2540] last:border-b-0"
                >
                  <div
                    className={`w-3 h-3 rounded-full mt-2 flex-shrink-0 ${
                      signal.type === 'positive'
                        ? 'bg-green-400'
                        : signal.type === 'negative'
                        ? 'bg-red-400'
                        : 'bg-gray-400'
                    }`}
                  />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-white">{signal.title}</p>
                    <p className="text-xs text-[#7a88a8]">{signal.description}</p>
                    <p className="text-xs text-[#7a88a8] mt-1">
                      {format(new Date(signal.date), 'MMM dd, yyyy')}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </TabsContent>

        {/* Meetings Tab */}
        <TabsContent value="meetings">
          <Card className="p-6 bg-[#0d1422] border-[#1a2540]">
            <p className="text-[#7a88a8]">Meeting history coming soon...</p>
          </Card>
        </TabsContent>

        {/* Financial Tab */}
        <TabsContent value="financial">
          <Card className="p-6 bg-[#0d1422] border-[#1a2540]">
            <div className="space-y-4">
              <div>
                <h4 className="text-sm text-[#7a88a8] mb-2">Monthly Revenue</h4>
                <p className="text-2xl font-bold text-white">
                  ${((client.monthlyRetainer ?? 0) / 100).toFixed(0)}
                </p>
              </div>
              <div>
                <h4 className="text-sm text-[#7a88a8] mb-2">Annual Value</h4>
                <p className="text-2xl font-bold text-white">
                  ${(((client.monthlyRetainer ?? 0) * 12) / 100).toFixed(0)}
                </p>
              </div>
              <p className="text-[#7a88a8] text-sm">Revenue trends coming soon...</p>
            </div>
          </Card>
        </TabsContent>

        {/* Activity Tab */}
        <TabsContent value="activity">
          <Card className="p-6 bg-[#0d1422] border-[#1a2540]">
            <div className="space-y-4">
              {MOCK_ACTIVITY.map((event, index) => (
                <div
                  key={index}
                  className="flex items-start gap-4 pb-4 border-b border-[#1a2540] last:border-b-0"
                >
                  <div className="w-2 h-2 rounded-full bg-[#e74c3c] mt-2" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-white">{event.title}</p>
                    <p className="text-xs text-[#7a88a8]">{event.description}</p>
                    <p className="text-xs text-[#7a88a8] mt-1">
                      {format(new Date(event.date), 'MMM dd, yyyy')}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
