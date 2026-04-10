'use client';

import { useState } from 'react';
import { ArrowRight, TrendingUp } from 'lucide-react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { UpsellOpportunity } from '@/types/alerts';

const MOCK_UPSELL_OPPORTUNITIES: UpsellOpportunity[] = [
  {
    id: '1',
    clientId: '3',
    clientName: 'Design Hub',
    signal: 'Increased creative project volume significantly (30% up month-over-month)',
    context: 'During the March QBR, client mentioned ramping up production for summer campaigns with expanded creative team',
    currentServices: 'Design',
    suggestedService: 'Video Production Suite',
    estimatedValue: 45000,
    confidence: 'high',
    sourceType: 'meeting_transcript',
    sourceMeetingId: 'mtg-001',
    detectedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: '2',
    clientId: '4',
    clientName: 'PR Innovations',
    signal: 'Expansion into three new international markets announced',
    context: 'Client shared expansion strategy in executive briefing, planning Q3 market entry with full PR support needed',
    currentServices: 'PR',
    suggestedService: 'International PR Services',
    estimatedValue: 65000,
    confidence: 'high',
    sourceType: 'meeting_transcript',
    sourceMeetingId: 'mtg-002',
    detectedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: '3',
    clientId: '5',
    clientName: 'Content Masters',
    signal: 'Planning major product launch for Q3 with significant budget allocation',
    context: 'Client revealed in strategic review that they are launching three new product lines with dedicated marketing budget',
    currentServices: 'Content',
    suggestedService: 'Integrated Launch Campaign',
    estimatedValue: 85000,
    confidence: 'high',
    sourceType: 'meeting_transcript',
    sourceMeetingId: 'mtg-003',
    detectedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: '4',
    clientId: '6',
    clientName: 'TechStart Solutions',
    signal: 'Shift to performance-based marketing model for the year',
    context: 'Client mentioned transition from brand awareness to conversion focus, needs enhanced analytics and reporting',
    currentServices: 'Paid Media',
    suggestedService: 'Advanced Analytics & Attribution Suite',
    estimatedValue: 38000,
    confidence: 'medium',
    sourceType: 'meeting_transcript',
    sourceMeetingId: 'mtg-004',
    detectedAt: new Date(Date.now() - 9 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: '5',
    clientId: '7',
    clientName: 'Social First Media',
    signal: 'Significant growth in TikTok and Instagram engagement metrics',
    context: 'Social channels showing 60% engagement increase, client wanting to scale this with influencer partnerships and creator management',
    currentServices: 'Social',
    suggestedService: 'Creator Management & Influencer Services',
    estimatedValue: 32000,
    confidence: 'medium',
    sourceType: 'usage_pattern',
    detectedAt: new Date(Date.now() - 11 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: '6',
    clientId: '8',
    clientName: 'E-Commerce Plus',
    signal: 'Website traffic increased 40% but conversion rate declining',
    context: 'Client seeing more traffic from SEO efforts but struggling with user experience and checkout flow optimization',
    currentServices: 'SEO',
    suggestedService: 'UX Optimization & Conversion Rate Services',
    estimatedValue: 28000,
    confidence: 'low',
    sourceType: 'usage_pattern',
    detectedAt: new Date(Date.now() - 13 * 24 * 60 * 60 * 1000).toISOString(),
  },
];

interface Filters {
  confidence: 'all' | 'high' | 'medium' | 'low';
  clientId: string;
  serviceType: string;
}

type SortOption = 'value' | 'confidence' | 'date';

const getConfidenceBadgeColor = (confidence: string): string => {
  switch (confidence) {
    case 'high':
      return 'bg-green-500/20 text-green-400 border-green-500/30';
    case 'medium':
      return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
    case 'low':
      return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    default:
      return 'bg-[#1a2540] text-[#7a88a8]';
  }
};

export default function UpsellPage() {
  const [filters, setFilters] = useState<Filters>({
    confidence: 'all',
    clientId: 'all',
    serviceType: 'all',
  });
  const [sortBy, setSortBy] = useState<SortOption>('value');

  const filteredOpportunities = MOCK_UPSELL_OPPORTUNITIES.filter((opp) => {
    if (filters.confidence !== 'all' && opp.confidence !== filters.confidence) {
      return false;
    }
    if (filters.clientId !== 'all' && opp.clientId !== filters.clientId) {
      return false;
    }
    if (filters.serviceType !== 'all' && opp.suggestedService !== filters.serviceType) {
      return false;
    }
    return true;
  });

  const sortedOpportunities = [...filteredOpportunities].sort((a, b) => {
    switch (sortBy) {
      case 'value':
        return (b.estimatedValue ?? 0) - (a.estimatedValue ?? 0);
      case 'confidence':
        return (
          (['high', 'medium', 'low'].indexOf(b.confidence) -
            ['high', 'medium', 'low'].indexOf(a.confidence)) ||
          new Date(b.detectedAt).getTime() - new Date(a.detectedAt).getTime()
        );
      case 'date':
        return new Date(b.detectedAt).getTime() - new Date(a.detectedAt).getTime();
      default:
        return 0;
    }
  });

  const totalValue = filteredOpportunities.reduce((sum, opp) => sum + (opp.estimatedValue ?? 0), 0);
  const avgConfidence =
    filteredOpportunities.length > 0
      ? Math.round(
          (filteredOpportunities.filter((o) => o.confidence === 'high').length /
            filteredOpportunities.length) *
            100
        )
      : 0;

  const uniqueClients = new Set(MOCK_UPSELL_OPPORTUNITIES.map((o) => o.clientId)).size;
  const serviceTypes = Array.from(
    new Set(MOCK_UPSELL_OPPORTUNITIES.map((o) => o.suggestedService))
  ).sort();

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-4xl font-bold text-white font-playfair mb-2">
          Upsell Opportunities
        </h1>
        <p className="text-[#7a88a8]">
          Identified opportunities to expand services and increase client value
        </p>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-[#0c1220] border-[#1a2540]">
          <CardContent className="p-4">
            <p className="text-sm text-[#7a88a8] mb-1">Total Opportunities</p>
            <p className="text-2xl font-bold text-white">
              {filteredOpportunities.length}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-[#0c1220] border-[#1a2540]">
          <CardContent className="p-4">
            <p className="text-sm text-[#7a88a8] mb-1">Total Pipeline Value</p>
            <p className="text-2xl font-bold text-[#38e8c8]">
              ${(totalValue / 1000).toFixed(0)}K
            </p>
          </CardContent>
        </Card>
        <Card className="bg-[#0c1220] border-[#1a2540]">
          <CardContent className="p-4">
            <p className="text-sm text-[#7a88a8] mb-1">High Confidence</p>
            <p className="text-2xl font-bold text-green-400">{avgConfidence}%</p>
          </CardContent>
        </Card>
        <Card className="bg-[#0c1220] border-[#1a2540]">
          <CardContent className="p-4">
            <p className="text-sm text-[#7a88a8] mb-1">Clients Affected</p>
            <p className="text-2xl font-bold text-[#4cc9f0]">{uniqueClients}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters & Sort */}
      <div className="space-y-4">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Confidence Filter */}
          <div className="flex-1">
            <label className="block text-xs font-semibold text-[#7a88a8] uppercase tracking-wider mb-2">
              Confidence
            </label>
            <select
              value={filters.confidence}
              onChange={(e) =>
                setFilters({
                  ...filters,
                  confidence: e.target.value as typeof filters.confidence,
                })
              }
              className="w-full bg-[#0c1220] border border-[#1a2540] rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-[#4cc9f0]"
            >
              <option value="all">All Confidence Levels</option>
              <option value="high">High Confidence</option>
              <option value="medium">Medium Confidence</option>
              <option value="low">Low Confidence</option>
            </select>
          </div>

          {/* Client Filter */}
          <div className="flex-1">
            <label className="block text-xs font-semibold text-[#7a88a8] uppercase tracking-wider mb-2">
              Client
            </label>
            <select
              value={filters.clientId}
              onChange={(e) =>
                setFilters({ ...filters, clientId: e.target.value })
              }
              className="w-full bg-[#0c1220] border border-[#1a2540] rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-[#4cc9f0]"
            >
              <option value="all">All Clients</option>
              {MOCK_UPSELL_OPPORTUNITIES.map((opp) => (
                <option key={opp.clientId} value={opp.clientId}>
                  {opp.clientName}
                </option>
              ))}
            </select>
          </div>

          {/* Service Type Filter */}
          <div className="flex-1">
            <label className="block text-xs font-semibold text-[#7a88a8] uppercase tracking-wider mb-2">
              Service Type
            </label>
            <select
              value={filters.serviceType}
              onChange={(e) =>
                setFilters({ ...filters, serviceType: e.target.value })
              }
              className="w-full bg-[#0c1220] border border-[#1a2540] rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-[#4cc9f0]"
            >
              <option value="all">All Services</option>
              {serviceTypes.map((service) => (
                <option key={service} value={service}>
                  {service}
                </option>
              ))}
            </select>
          </div>

          {/* Sort */}
          <div className="flex-1">
            <label className="block text-xs font-semibold text-[#7a88a8] uppercase tracking-wider mb-2">
              Sort By
            </label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="w-full bg-[#0c1220] border border-[#1a2540] rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-[#4cc9f0]"
            >
              <option value="value">Estimated Value</option>
              <option value="confidence">Confidence Level</option>
              <option value="date">Recently Detected</option>
            </select>
          </div>
        </div>
      </div>

      {/* Opportunities List */}
      {sortedOpportunities.length === 0 ? (
        <Card className="p-12 text-center bg-[#0d1422] border-[#1a2540]">
          <TrendingUp className="w-8 h-8 text-[#7a88a8] mx-auto mb-3 opacity-50" />
          <h3 className="text-lg font-semibold text-white mb-2">
            No opportunities found
          </h3>
          <p className="text-[#7a88a8]">
            Try adjusting your filters to see more opportunities
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {sortedOpportunities.map((opportunity) => (
            <Card
              key={opportunity.id}
              className="bg-gradient-to-r from-[#0c1220] to-[#0a0d15] border-[#1a2540] hover:border-[#2a3550] transition"
            >
              <CardContent className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                  {/* Client & Signal */}
                  <div className="md:col-span-4 space-y-2">
                    <Link
                      href={`/dashboard/clients/${opportunity.clientId}`}
                      className="text-lg font-semibold text-white hover:text-[#38e8c8] transition"
                    >
                      {opportunity.clientName}
                    </Link>
                    <p className="text-sm text-[#7a88a8]">{opportunity.signal}</p>
                    <p className="text-xs text-[#7a88a8] italic">
                      &quot;{opportunity.context}&quot;
                    </p>
                  </div>

                  {/* Services Flow */}
                  <div className="md:col-span-2 flex flex-col justify-center">
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-[#7a88a8] uppercase">
                        Current
                      </p>
                      <Badge variant="outline" className="w-fit text-xs">
                        {opportunity.currentServices}
                      </Badge>
                    </div>
                    <div className="my-3 flex justify-center">
                      <ArrowRight className="w-4 h-4 text-[#38e8c8]" />
                    </div>
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-[#7a88a8] uppercase">
                        Suggested
                      </p>
                      <Badge className="w-fit bg-[#38e8c8]/20 text-[#38e8c8] border-[#38e8c8]/30 text-xs">
                        {opportunity.suggestedService}
                      </Badge>
                    </div>
                  </div>

                  {/* Value & Confidence */}
                  <div className="md:col-span-2 space-y-3">
                    <div>
                      <p className="text-xs font-semibold text-[#7a88a8] uppercase mb-1">
                        Est. Value
                      </p>
                      <p className="text-xl font-bold text-[#38e8c8]">
                        ${(opportunity.estimatedValue ?? 0).toLocaleString()}
                      </p>
                    </div>
                    <Badge
                      className={`w-fit border ${getConfidenceBadgeColor(
                        opportunity.confidence
                      )}`}
                    >
                      {opportunity.confidence.charAt(0).toUpperCase() +
                        opportunity.confidence.slice(1)}{' '}
                      Confidence
                    </Badge>
                  </div>

                  {/* Source & Action */}
                  <div className="md:col-span-4 flex flex-col justify-between">
                    <div>
                      <p className="text-xs text-[#7a88a8] mb-1">
                        Source:{' '}
                        {opportunity.sourceMeetingId
                          ? 'From meeting'
                          : 'From usage patterns'}
                      </p>
                      <p className="text-xs text-[#7a88a8]">
                        Detected{' '}
                        {Math.floor(
                          (Date.now() - new Date(opportunity.detectedAt).getTime()) /
                            (24 * 60 * 60 * 1000)
                        )}{' '}
                        days ago
                      </p>
                    </div>
                    <Button
                      disabled
                      className="w-full bg-[#e74c3c]/50 hover:bg-[#e74c3c]/60 text-white cursor-not-allowed mt-4"
                    >
                      Create Proposal (Coming Soon)
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
