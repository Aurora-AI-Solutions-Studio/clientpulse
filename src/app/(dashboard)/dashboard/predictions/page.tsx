'use client';

import { useState } from 'react';
import { ChevronDown, TrendingDown, Zap, AlertTriangle } from 'lucide-react';
import {
  Card,
  CardContent,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface ChurnClient {
  id: string;
  name: string;
  churnProbability: number;
  drivingFactors: Array<{
    factor: string;
    impact: 'high' | 'medium' | 'low';
  }>;
  suggestedActions: Array<{
    action: string;
    priority: 'urgent' | 'high' | 'medium';
  }>;
  savePlan?: {
    emailDraft: string;
    qbrAgenda: string;
    talkingPoints: string;
  };
  expanded: boolean;
}

interface UpsellOpportunity {
  id: string;
  clientName: string;
  signal: string;
  suggestedService: string;
  estimatedValue: number;
  confidence: number;
  sourceMeeting: string;
  expanded: boolean;
}

const MOCK_CHURN_CLIENTS: ChurnClient[] = [
  {
    id: '4',
    name: 'Social First Media',
    churnProbability: 82,
    drivingFactors: [
      { factor: 'Engagement metric down 45%', impact: 'high' },
      { factor: 'Last meeting 45 days ago', impact: 'high' },
      { factor: 'Relationship score declining', impact: 'medium' },
      { factor: 'Reduced monthly usage', impact: 'medium' },
    ],
    suggestedActions: [
      { action: 'Schedule emergency check-in call', priority: 'urgent' },
      { action: 'Present expanded service proposal', priority: 'urgent' },
      { action: 'Offer service credit as goodwill', priority: 'high' },
      { action: 'Assign dedicated account manager', priority: 'high' },
    ],
    savePlan: {
      emailDraft:
        'Subject: Let\'s Talk About Taking Your Results to the Next Level\n\nDear [Contact],\n\nWe value your partnership and would like to discuss how we can better serve your goals. We\'ve noticed an opportunity to expand our services in ways that could drive significant ROI.',
      qbrAgenda:
        '1. Review Q1 performance metrics\n2. Discuss market trends and opportunities\n3. Present expanded service proposal\n4. Address any concerns or feedback\n5. Agree on next quarter priorities',
      talkingPoints:
        '• Our track record: 85% of clients see 20%+ improvement\n• Market opportunity: competitors are expanding\n• Risk mitigation: bundled services at better pricing\n• Timeline: implementation within 2 weeks',
    },
    expanded: false,
  },
  {
    id: '2',
    name: 'TechStart Solutions',
    churnProbability: 68,
    drivingFactors: [
      { factor: 'Reduced service usage', impact: 'high' },
      { factor: 'Budget review scheduled', impact: 'high' },
      { factor: 'Competitive inquiry detected', impact: 'medium' },
    ],
    suggestedActions: [
      { action: 'Proactive QBR this week', priority: 'high' },
      { action: 'Share ROI analysis', priority: 'high' },
      { action: 'Discuss optimization opportunities', priority: 'medium' },
    ],
    expanded: false,
  },
  {
    id: '1',
    name: 'Acme Corporation',
    churnProbability: 22,
    drivingFactors: [
      { factor: 'Consistent engagement', impact: 'low' },
      { factor: 'Positive feedback trend', impact: 'low' },
    ],
    suggestedActions: [
      { action: 'Maintain regular touch-points', priority: 'medium' },
      { action: 'Explore expansion opportunities', priority: 'medium' },
    ],
    expanded: false,
  },
];

const MOCK_UPSELL_OPPORTUNITIES: UpsellOpportunity[] = [
  {
    id: '1',
    clientName: 'Design Hub',
    signal: 'Increased creative project volume (30% up)',
    suggestedService: 'Video Production Suite',
    estimatedValue: 45000,
    confidence: 87,
    sourceMeeting: 'Q2 Planning Call - April 8',
    expanded: false,
  },
  {
    id: '2',
    clientName: 'PR Innovations',
    signal: 'Expansion into new markets',
    suggestedService: 'International PR Services',
    estimatedValue: 65000,
    confidence: 92,
    sourceMeeting: 'Executive Briefing - April 5',
    expanded: false,
  },
  {
    id: '3',
    clientName: 'Content Masters',
    signal: 'Planning product launch (Q3)',
    suggestedService: 'Integrated Launch Campaign',
    estimatedValue: 85000,
    confidence: 76,
    sourceMeeting: 'Strategic Review - March 28',
    expanded: false,
  },
];

const getChurnColor = (probability: number) => {
  if (probability > 70) return 'text-[#e74c3c]';
  if (probability > 50) return 'text-[#f59e0b]';
  if (probability > 30) return 'text-[#eab308]';
  return 'text-green-400';
};

const getChurnBgColor = (probability: number) => {
  if (probability > 70) return 'from-[#e74c3c]/10 to-[#e74c3c]/5';
  if (probability > 50) return 'from-[#f59e0b]/10 to-[#f59e0b]/5';
  if (probability > 30) return 'from-[#eab308]/10 to-[#eab308]/5';
  return 'from-green-500/10 to-green-500/5';
};

const getPriorityColor = (priority: string) => {
  switch (priority) {
    case 'urgent':
      return 'bg-[#e74c3c]/20 text-[#e74c3c]';
    case 'high':
      return 'bg-[#f59e0b]/20 text-[#f59e0b]';
    default:
      return 'bg-[#eab308]/20 text-[#eab308]';
  }
};

const getImpactColor = (impact: string) => {
  switch (impact) {
    case 'high':
      return 'bg-[#e74c3c]/20 text-[#e74c3c]';
    case 'medium':
      return 'bg-[#f59e0b]/20 text-[#f59e0b]';
    default:
      return 'bg-blue-500/20 text-blue-400';
  }
};

export default function PredictionsPage() {
  const [churnClients, setChurnClients] = useState<ChurnClient[]>(MOCK_CHURN_CLIENTS);
  const [upsellOpportunities, setUpsellOpportunities] = useState<UpsellOpportunity[]>(
    MOCK_UPSELL_OPPORTUNITIES
  );

  const handleToggleChurnExpand = (id: string) => {
    setChurnClients(
      churnClients.map((c) => (c.id === id ? { ...c, expanded: !c.expanded } : c))
    );
  };

  const _handleToggleUpsellExpand = (id: string) => {
    setUpsellOpportunities(
      upsellOpportunities.map((u) => (u.id === id ? { ...u, expanded: !u.expanded } : u))
    );
  };

  const handleGenerateSavePlan = (id: string) => {
    // In a real app, this would generate and save a plan
    setChurnClients(
      churnClients.map((c) => {
        if (c.id === id && !c.savePlan) {
          return {
            ...c,
            savePlan: {
              emailDraft: 'Subject: Let\'s Strengthen Our Partnership\n\n[Email content would be generated here]',
              qbrAgenda: '[QBR agenda would be generated here]',
              talkingPoints: '[Talking points would be generated here]',
            },
          };
        }
        return c;
      })
    );
  };

  // Sort churn clients by probability (highest first)
  const sortedChurnClients = [...churnClients].sort(
    (a, b) => b.churnProbability - a.churnProbability
  );

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div>
        <h2 className="text-3xl font-bold text-white font-playfair mb-2">
          Predictions & Opportunities
        </h2>
        <p className="text-[#7a88a8]">
          AI-powered churn risk and upsell opportunity analysis
        </p>
      </div>

      {/* Churn Risk Section */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <TrendingDown className="w-5 h-5 text-[#e74c3c]" />
          <h3 className="text-xl font-bold text-white font-playfair">Churn Risk</h3>
          <span className="text-xs bg-[#e74c3c]/20 text-[#e74c3c] px-2 py-1 rounded-full">
            {sortedChurnClients.filter((c) => c.churnProbability > 60).length} high risk
          </span>
        </div>

        {sortedChurnClients.map((client) => (
          <Card
            key={client.id}
            className={`bg-gradient-to-br ${getChurnBgColor(
              client.churnProbability
            )} border-[#1a2540] hover:border-[#2a3550] transition`}
          >
            <CardContent className="p-6">
              {/* Header row */}
              <div className="flex items-start justify-between gap-4 mb-4">
                <div className="flex-1">
                  <h4 className="text-lg font-semibold text-white">
                    {client.name}
                  </h4>
                </div>

                {/* Churn probability circle */}
                <div className="flex items-center gap-4">
                  <div className="relative w-16 h-16 flex-shrink-0">
                    <svg className="w-full h-full transform -rotate-90">
                      <circle
                        cx="32"
                        cy="32"
                        r="28"
                        fill="none"
                        stroke="#1a2540"
                        strokeWidth="4"
                      />
                      <circle
                        cx="32"
                        cy="32"
                        r="28"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="4"
                        strokeDasharray={`${(client.churnProbability / 100) * 176} 176`}
                        className={getChurnColor(client.churnProbability)}
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className={`text-sm font-bold ${getChurnColor(client.churnProbability)}`}>
                        {client.churnProbability}%
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Driving factors */}
              <div className="mb-4">
                <h5 className="text-xs font-semibold text-[#7a88a8] uppercase tracking-wider mb-2">
                  Driving Factors
                </h5>
                <div className="space-y-2">
                  {client.drivingFactors.map((factor, idx) => (
                    <div key={idx} className="flex items-center justify-between text-sm">
                      <span className="text-[#7a88a8]">{factor.factor}</span>
                      <span className={`text-xs font-semibold px-2 py-1 rounded ${getImpactColor(factor.impact)}`}>
                        {factor.impact}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Suggested actions */}
              <div className="mb-4">
                <h5 className="text-xs font-semibold text-[#7a88a8] uppercase tracking-wider mb-2">
                  Suggested Actions
                </h5>
                <div className="space-y-2">
                  {client.suggestedActions.map((action, idx) => (
                    <div key={idx} className="flex items-center justify-between text-sm">
                      <span className="text-[#7a88a8]">{action.action}</span>
                      <span className={`text-xs font-semibold px-2 py-1 rounded ${getPriorityColor(action.priority)}`}>
                        {action.priority}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Save plan section */}
              {client.churnProbability > 60 && (
                <>
                  {client.savePlan ? (
                    <div className="bg-[#06090f] border border-[#1a2540] rounded-lg p-4 mb-4">
                      <h5 className="text-xs font-semibold text-[#7a88a8] uppercase tracking-wider mb-3">
                        Save Plan
                      </h5>
                      <div
                        className={`space-y-4 ${client.expanded ? '' : 'max-h-48 overflow-hidden'}`}
                      >
                        <div>
                          <p className="text-xs font-semibold text-white mb-1">Email Draft</p>
                          <p className="text-xs text-[#7a88a8] font-mono whitespace-pre-wrap">
                            {client.savePlan.emailDraft}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-white mb-1">QBR Agenda</p>
                          <p className="text-xs text-[#7a88a8] font-mono whitespace-pre-wrap">
                            {client.savePlan.qbrAgenda}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-white mb-1">Talking Points</p>
                          <p className="text-xs text-[#7a88a8] font-mono whitespace-pre-wrap">
                            {client.savePlan.talkingPoints}
                          </p>
                        </div>
                      </div>
                      {client.savePlan.emailDraft.length > 100 && (
                        <button
                          onClick={() => handleToggleChurnExpand(client.id)}
                          className="mt-3 text-xs text-[#4cc9f0] hover:text-[#38e8c8] transition flex items-center gap-1"
                        >
                          <ChevronDown
                            className={`w-3 h-3 transition-transform ${
                              client.expanded ? 'rotate-180' : ''
                            }`}
                          />
                          {client.expanded ? 'Show less' : 'Show more'}
                        </button>
                      )}
                    </div>
                  ) : (
                    <Button
                      onClick={() => handleGenerateSavePlan(client.id)}
                      className="w-full bg-[#e74c3c] hover:bg-[#d43d2d] text-white mb-4"
                    >
                      <Zap className="w-4 h-4 mr-2" />
                      Generate Save Plan
                    </Button>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Upsell Opportunities Section */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-[#38e8c8]" />
          <h3 className="text-xl font-bold text-white font-playfair">Upsell Opportunities</h3>
          <span className="text-xs bg-[#38e8c8]/20 text-[#38e8c8] px-2 py-1 rounded-full">
            ${upsellOpportunities.reduce((sum, u) => sum + u.estimatedValue, 0).toLocaleString()} potential
          </span>
        </div>

        {upsellOpportunities.map((opportunity) => (
          <Card
            key={opportunity.id}
            className="bg-gradient-to-br from-[#38e8c8]/10 to-[#4cc9f0]/5 border-[#1a2540] hover:border-[#2a3550] transition"
          >
            <CardContent className="p-6">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div className="flex-1">
                  <h4 className="text-lg font-semibold text-white">
                    {opportunity.clientName}
                  </h4>
                  <p className="text-sm text-[#7a88a8] mt-1">{opportunity.signal}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <p className="text-xs font-semibold text-[#7a88a8] uppercase tracking-wider mb-1">
                    Suggested Service
                  </p>
                  <p className="text-sm text-white font-medium">
                    {opportunity.suggestedService}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-[#7a88a8] uppercase tracking-wider mb-1">
                    Estimated Value
                  </p>
                  <p className="text-sm text-[#38e8c8] font-bold">
                    ${opportunity.estimatedValue.toLocaleString()}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between mb-4">
                <p className="text-xs text-[#7a88a8]">
                  Source: {opportunity.sourceMeeting}
                </p>
                <span className="text-xs font-semibold px-2 py-1 rounded bg-[#4cc9f0]/20 text-[#4cc9f0]">
                  {opportunity.confidence}% confidence
                </span>
              </div>

              <Button className="w-full bg-[#38e8c8] hover:bg-[#2db8b8] text-[#06090f] font-semibold">
                View Full Opportunity
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
