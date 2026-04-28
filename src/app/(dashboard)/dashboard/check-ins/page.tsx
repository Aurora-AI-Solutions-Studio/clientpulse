'use client';

import { useState } from 'react';
import { Clock, AlertCircle, CheckCircle2, X, ChevronDown } from 'lucide-react';
import {
  Card,
  CardContent,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface SuggestedCheckIn {
  id: string;
  clientName: string;
  healthScore: number;
  reason: string;
  suggestedDate: string;
  suggestedTime: string;
  agendaPoints: string[];
  priority: 'urgent' | 'recommended' | 'optional';
  dismissed: boolean;
  expanded: boolean;
}

interface ScheduledCheckIn {
  id: string;
  clientName: string;
  date: string;
  time: string;
  status: 'confirmed' | 'tentative';
  agendaPoints: string[];
  agendaExpanded: boolean;
}

const MOCK_SUGGESTED: SuggestedCheckIn[] = [
  {
    id: '1',
    clientName: 'Acme Corporation',
    healthScore: 62,
    reason: 'Health score dropped 15pts in 2 weeks',
    suggestedDate: 'April 18, 2026',
    suggestedTime: '2:00 PM PT',
    agendaPoints: [
      'Review recent campaign performance metrics',
      'Discuss Q2 objectives and timeline',
      'Address resource allocation concerns',
      'Confirm next month&apos;s deliverables',
    ],
    priority: 'urgent',
    dismissed: false,
    expanded: false,
  },
  {
    id: '2',
    clientName: 'TechStart Solutions',
    healthScore: 55,
    reason: 'No meeting in 45 days',
    suggestedDate: 'April 22, 2026',
    suggestedTime: '10:30 AM PT',
    agendaPoints: [
      'Catch up on project progress since last QBR',
      'Review engagement metrics and KPIs',
      'Discuss any service improvements needed',
      'Plan next quarter&apos;s focus areas',
    ],
    priority: 'recommended',
    dismissed: false,
    expanded: false,
  },
  {
    id: '3',
    clientName: 'Social First Media',
    healthScore: 45,
    reason: '3 overdue action items from last meeting',
    suggestedDate: 'April 16, 2026',
    suggestedTime: '3:00 PM PT',
    agendaPoints: [
      'Follow up on outstanding action items',
      'Discuss blockers and dependencies',
      'Review current scope vs. contract terms',
      'Identify quick wins for re-engagement',
    ],
    priority: 'urgent',
    dismissed: false,
    expanded: false,
  },
];

const MOCK_SCHEDULED: ScheduledCheckIn[] = [
  {
    id: 's1',
    clientName: 'Design Hub',
    date: 'April 25, 2026',
    time: '2:00 PM PT',
    status: 'confirmed',
    agendaPoints: [
      'Quarterly business review',
      'Review key metrics and successes',
      'Discuss opportunities for next quarter',
    ],
    agendaExpanded: false,
  },
  {
    id: 's2',
    clientName: 'Marketing Innovations Inc.',
    date: 'April 28, 2026',
    time: '11:00 AM PT',
    status: 'tentative',
    agendaPoints: [
      'Monthly performance review',
      'Discuss campaign results',
      'Plan upcoming initiatives',
    ],
    agendaExpanded: false,
  },
];

const PRIORITY_CONFIG = {
  urgent: {
    badge: 'bg-[#e74c3c]/15 text-[#e74c3c]',
    icon: AlertCircle,
    label: 'Urgent',
  },
  recommended: {
    badge: 'bg-[#38e8c8]/15 text-[#38e8c8]',
    icon: CheckCircle2,
    label: 'Recommended',
  },
  optional: {
    badge: 'bg-[#7a88a8]/15 text-[#7a88a8]',
    icon: Clock,
    label: 'Optional',
  },
};

function HealthScoreBadge({ score }: { score: number }) {
  let color = 'bg-[#38e8c8]/15 text-[#38e8c8]';
  if (score < 50) {
    color = 'bg-[#e74c3c]/15 text-[#e74c3c]';
  } else if (score < 70) {
    color = 'bg-amber-500/15 text-amber-300';
  }
  return (
    <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-semibold ${color}`}>
      Health: {score}
    </span>
  );
}

export default function CheckInsPage() {
  const [suggested, setSuggested] = useState<SuggestedCheckIn[]>(MOCK_SUGGESTED);
  const [scheduled, setScheduled] = useState<ScheduledCheckIn[]>(MOCK_SCHEDULED);

  const handleDismiss = (id: string) => {
    setSuggested(
      suggested.map((item) => (item.id === id ? { ...item, dismissed: true } : item))
    );
  };

  const handleScheduleCheckIn = (id: string) => {
    const checkIn = suggested.find((item) => item.id === id);
    if (!checkIn) return;

    const newScheduled: ScheduledCheckIn = {
      id: `s${Date.now()}`,
      clientName: checkIn.clientName,
      date: checkIn.suggestedDate,
      time: checkIn.suggestedTime,
      status: 'tentative',
      agendaPoints: checkIn.agendaPoints,
      agendaExpanded: false,
    };

    setScheduled([...scheduled, newScheduled]);
    handleDismiss(id);
  };

  const handleToggleExpand = (id: string) => {
    setSuggested(
      suggested.map((item) =>
        item.id === id ? { ...item, expanded: !item.expanded } : item
      )
    );
  };

  const handleToggleAgendaExpand = (id: string) => {
    setScheduled(
      scheduled.map((item) =>
        item.id === id ? { ...item, agendaExpanded: !item.agendaExpanded } : item
      )
    );
  };

  const handleCancelCheckIn = (id: string) => {
    setScheduled(scheduled.filter((item) => item.id !== id));
  };

  const activeSuggested = suggested.filter((item) => !item.dismissed);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-3xl text-white mb-2">
            Proactive Check-ins
          </h2>
          <p className="text-[#7a88a8]">
            AI-suggested check-in meetings for at-risk clients
          </p>
        </div>
      </div>

      {/* Suggested Check-ins Section */}
      <div className="space-y-4">
        <h3 className="text-xl font-semibold text-white font-playfair">
          Suggested Check-ins
        </h3>

        {activeSuggested.length > 0 ? (
          <div className="space-y-4">
            {activeSuggested.map((checkIn) => {
              const PriorityIcon = PRIORITY_CONFIG[checkIn.priority].icon;
              return (
                <Card
                  key={checkIn.id}
                  className="bg-[#0d1422] border-[#1a2540] hover:border-[#2a3550] transition"
                >
                  <CardContent className="p-6">
                    <div className="space-y-4">
                      {/* Top row: Client name and health badge */}
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <h3 className="text-lg font-semibold text-white mb-2">
                            {checkIn.clientName}
                          </h3>
                          <div className="flex items-center gap-3">
                            <HealthScoreBadge score={checkIn.healthScore} />
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold ${
                                PRIORITY_CONFIG[checkIn.priority].badge
                              }`}
                            >
                              <PriorityIcon className="w-3 h-3" />
                              {PRIORITY_CONFIG[checkIn.priority].label}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Reason */}
                      <div className="bg-[#06090f] border border-[#1a2540] rounded-lg p-4">
                        <p className="text-sm text-[#7a88a8] font-semibold mb-1">
                          Reason for suggestion
                        </p>
                        <p className="text-[#c0c7d1]">{checkIn.reason}</p>
                      </div>

                      {/* Suggested date/time */}
                      <div className="flex gap-6">
                        <div>
                          <p className="text-xs text-[#7a88a8] font-semibold mb-1">
                            SUGGESTED DATE
                          </p>
                          <p className="text-white font-semibold">
                            {checkIn.suggestedDate}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-[#7a88a8] font-semibold mb-1">
                            SUGGESTED TIME
                          </p>
                          <p className="text-white font-semibold">
                            {checkIn.suggestedTime}
                          </p>
                        </div>
                      </div>

                      {/* Agenda */}
                      <div>
                        <button
                          onClick={() => handleToggleExpand(checkIn.id)}
                          className="flex items-center gap-2 text-[#4cc9f0] hover:text-[#38e8c8] transition font-semibold text-sm mb-2"
                        >
                          <ChevronDown
                            className={`w-4 h-4 transition-transform ${
                              checkIn.expanded ? 'rotate-180' : ''
                            }`}
                          />
                          {checkIn.expanded ? 'Hide' : 'Show'} suggested agenda
                        </button>
                        {checkIn.expanded && (
                          <div className="bg-[#06090f] border border-[#1a2540] rounded-lg p-4 space-y-2">
                            <p className="text-xs text-[#7a88a8] font-semibold mb-2">
                              TALKING POINTS
                            </p>
                            <ul className="space-y-2">
                              {checkIn.agendaPoints.map((point, idx) => (
                                <li
                                  key={idx}
                                  className="text-sm text-[#c0c7d1] flex gap-2"
                                >
                                  <span className="text-[#38e8c8] flex-shrink-0">
                                    •
                                  </span>
                                  {point}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>

                      {/* Action buttons */}
                      <div className="flex gap-2 pt-2">
                        <Button
                          onClick={() => handleScheduleCheckIn(checkIn.id)}
                          className="bg-green-600 hover:bg-green-700 text-white"
                          size="sm"
                        >
                          Schedule Check-in
                        </Button>
                        <Button
                          onClick={() => handleDismiss(checkIn.id)}
                          variant="outline"
                          className="border-[#1a2540] text-[#7a88a8] hover:bg-[#1a2540]"
                          size="sm"
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card className="bg-[#0d1422] border-[#1a2540]">
            <CardContent className="p-12 text-center">
              <div className="space-y-4">
                <div className="text-4xl">✨</div>
                <h3 className="text-lg font-semibold text-white">
                  All caught up!
                </h3>
                <p className="text-[#7a88a8]">
                  No suggested check-ins at this time. Your clients are healthy.
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Scheduled Check-ins Section */}
      <div className="space-y-4">
        <h3 className="text-xl font-semibold text-white font-playfair">
          Scheduled Check-ins
        </h3>

        {scheduled.length > 0 ? (
          <div className="space-y-4">
            {scheduled.map((checkIn) => (
              <Card
                key={checkIn.id}
                className="bg-[#0d1422] border-[#1a2540] hover:border-[#2a3550] transition"
              >
                <CardContent className="p-6">
                  <div className="space-y-4">
                    {/* Top row: Client name and status */}
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-white mb-2">
                          {checkIn.clientName}
                        </h3>
                        <span
                          className={`inline-flex items-center px-2 py-1 rounded text-xs font-semibold ${
                            checkIn.status === 'confirmed'
                              ? 'bg-green-500/15 text-green-300'
                              : 'bg-amber-500/15 text-amber-300'
                          }`}
                        >
                          {checkIn.status === 'confirmed'
                            ? 'Confirmed'
                            : 'Tentative'}
                        </span>
                      </div>
                    </div>

                    {/* Date and time */}
                    <div className="flex gap-6">
                      <div>
                        <p className="text-xs text-[#7a88a8] font-semibold mb-1">
                          DATE
                        </p>
                        <p className="text-white font-semibold">
                          {checkIn.date}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-[#7a88a8] font-semibold mb-1">
                          TIME
                        </p>
                        <p className="text-white font-semibold">
                          {checkIn.time}
                        </p>
                      </div>
                    </div>

                    {/* Agenda */}
                    <div>
                      <button
                        onClick={() => handleToggleAgendaExpand(checkIn.id)}
                        className="flex items-center gap-2 text-[#4cc9f0] hover:text-[#38e8c8] transition font-semibold text-sm mb-2"
                      >
                        <ChevronDown
                          className={`w-4 h-4 transition-transform ${
                            checkIn.agendaExpanded ? 'rotate-180' : ''
                          }`}
                        />
                        {checkIn.agendaExpanded ? 'Hide' : 'View'} agenda
                      </button>
                      {checkIn.agendaExpanded && (
                        <div className="bg-[#06090f] border border-[#1a2540] rounded-lg p-4 space-y-2">
                          <ul className="space-y-2">
                            {checkIn.agendaPoints.map((point, idx) => (
                              <li
                                key={idx}
                                className="text-sm text-[#c0c7d1] flex gap-2"
                              >
                                <span className="text-[#38e8c8] flex-shrink-0">
                                  •
                                </span>
                                {point}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>

                    {/* Action buttons */}
                    <div className="flex gap-2 pt-2">
                      <Button
                        onClick={() => handleCancelCheckIn(checkIn.id)}
                        variant="outline"
                        className="border-[#1a2540] text-[#7a88a8] hover:bg-[#1a2540]"
                        size="sm"
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="bg-[#0d1422] border-[#1a2540]">
            <CardContent className="p-12 text-center">
              <div className="space-y-4">
                <div className="text-4xl">📅</div>
                <h3 className="text-lg font-semibold text-white">
                  No scheduled check-ins
                </h3>
                <p className="text-[#7a88a8]">
                  Schedule a check-in from the suggested list above or create a new one.
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
