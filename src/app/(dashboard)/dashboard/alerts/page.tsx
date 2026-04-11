'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Bell, X } from 'lucide-react';
import {
  Card,
  CardContent,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface Alert {
  id: string;
  title: string;
  message: string;
  clientName: string;
  clientId: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  timestamp: string;
  read: boolean;
}

const MOCK_ALERTS: Alert[] = [
  {
    id: '1',
    title: 'Churn Risk Alert',
    message: 'Health score dropped 25 points in the last 7 days',
    clientName: 'TechStart Solutions',
    clientId: '2',
    severity: 'critical',
    timestamp: '2 hours ago',
    read: false,
  },
  {
    id: '2',
    title: 'Health Drop Detected',
    message: 'Financial health metric decreased by 15%',
    clientName: 'Social First Media',
    clientId: '4',
    severity: 'high',
    timestamp: '4 hours ago',
    read: false,
  },
  {
    id: '3',
    title: 'Upsell Opportunity',
    message: 'Client engagement increased - good time for service expansion',
    clientName: 'Design Hub',
    clientId: '3',
    severity: 'medium',
    timestamp: '1 day ago',
    read: false,
  },
  {
    id: '4',
    title: 'Action Required',
    message: 'QBR scheduled for tomorrow - prepare talking points',
    clientName: 'Acme Corporation',
    clientId: '1',
    severity: 'medium',
    timestamp: '1 day ago',
    read: true,
  },
  {
    id: '5',
    title: 'Engagement Update',
    message: 'Client downloaded latest deliverables',
    clientName: 'PR Innovations',
    clientId: '6',
    severity: 'low',
    timestamp: '2 days ago',
    read: true,
  },
];

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<Alert[]>(MOCK_ALERTS);
  const [filter, setFilter] = useState<'all' | 'churn' | 'health' | 'upsell' | 'action'>('all');

  const filteredAlerts = alerts.filter((alert) => {
    if (filter === 'all') return true;
    if (filter === 'churn') return alert.title.includes('Churn');
    if (filter === 'health') return alert.title.includes('Health');
    if (filter === 'upsell') return alert.title.includes('Upsell');
    if (filter === 'action') return alert.title.includes('Action');
    return true;
  });

  const unreadCount = alerts.filter((a) => !a.read).length;

  const handleDismiss = (id: string) => {
    setAlerts(alerts.filter((a) => a.id !== id));
  };

  const handleMarkAsRead = (id: string) => {
    setAlerts(
      alerts.map((a) => (a.id === id ? { ...a, read: true } : a))
    );
  };

  const handleMarkAllAsRead = () => {
    setAlerts(alerts.map((a) => ({ ...a, read: true })));
  };

  const getSeverityColor = (severity: Alert['severity']) => {
    switch (severity) {
      case 'critical':
        return 'border-l-4 border-l-[#e74c3c] bg-[#e74c3c]/5';
      case 'high':
        return 'border-l-4 border-l-[#f59e0b] bg-[#f59e0b]/5';
      case 'medium':
        return 'border-l-4 border-l-[#eab308] bg-[#eab308]/5';
      case 'low':
        return 'border-l-4 border-l-[#4cc9f0] bg-[#4cc9f0]/5';
    }
  };

  const getSeverityDot = (severity: Alert['severity']) => {
    switch (severity) {
      case 'critical':
        return 'bg-[#e74c3c]';
      case 'high':
        return 'bg-[#f59e0b]';
      case 'medium':
        return 'bg-[#eab308]';
      case 'low':
        return 'bg-[#4cc9f0]';
    }
  };

  return (
    <div className="space-y-8">
      {/* Header with badge */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div className="relative">
            <Bell className="w-8 h-8 text-[#e74c3c]" />
            {unreadCount > 0 && (
              <div className="absolute -top-1 -right-1 bg-[#e74c3c] text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                {unreadCount}
              </div>
            )}
          </div>
          <div>
            <h2 className="text-3xl font-bold text-white font-playfair">
              Alerts
            </h2>
            <p className="text-[#7a88a8]">
              {unreadCount > 0 ? `${unreadCount} unread alerts` : 'All caught up!'}
            </p>
          </div>
        </div>
        {unreadCount > 0 && (
          <Button
            onClick={handleMarkAllAsRead}
            variant="outline"
            className="border-[#1a2540] text-[#7a88a8] hover:bg-[#1a2540]"
          >
            Mark all as read
          </Button>
        )}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 flex-wrap">
        {(['all', 'churn', 'health', 'upsell', 'action'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition ${
              filter === f
                ? 'bg-[#e74c3c] text-white'
                : 'bg-[#0d1422] text-[#7a88a8] border border-[#1a2540] hover:text-white hover:border-[#2a3550]'
            }`}
          >
            {f === 'all' ? 'All' : f === 'churn' ? 'Churn Risk' : f === 'health' ? 'Health Drop' : f === 'upsell' ? 'Upsell' : 'Action Required'}
          </button>
        ))}
      </div>

      {/* Alerts list */}
      {filteredAlerts.length > 0 ? (
        <div className="space-y-3">
          {filteredAlerts.map((alert) => (
            <Card
              key={alert.id}
              className={`${getSeverityColor(alert.severity)} border border-[#1a2540] hover:border-[#2a3550] transition ${
                !alert.read ? 'ring-1 ring-[#e74c3c]/30' : ''
              }`}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    {/* Severity dot */}
                    <div className={`w-2 h-2 rounded-full ${getSeverityDot(alert.severity)} flex-shrink-0 mt-1.5`}></div>

                    {/* Alert content */}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-white">
                        {alert.title}
                        {!alert.read && (
                          <span className="ml-2 inline-block w-2 h-2 rounded-full bg-[#e74c3c]"></span>
                        )}
                      </h3>
                      <p className="text-sm text-[#7a88a8] mt-1">
                        {alert.message}
                      </p>
                      <div className="flex items-center gap-3 mt-2 text-xs text-[#7a88a8] flex-wrap">
                        <Link
                          href={`/dashboard/clients/${alert.clientId}`}
                          className="text-[#4cc9f0] hover:text-[#38e8c8] transition"
                        >
                          {alert.clientName}
                        </Link>
                        <span>•</span>
                        <span>{alert.timestamp}</span>
                      </div>
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {!alert.read && (
                      <button
                        onClick={() => handleMarkAsRead(alert.id)}
                        className="p-2 text-[#7a88a8] hover:text-white hover:bg-[#1a2540] rounded transition text-xs"
                        title="Mark as read"
                      >
                        Read
                      </button>
                    )}
                    <button
                      onClick={() => handleDismiss(alert.id)}
                      className="p-2 text-[#7a88a8] hover:text-[#e74c3c] hover:bg-[#1a2540] rounded transition"
                      title="Dismiss"
                    >
                      <X className="w-4 h-4" />
                    </button>
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
              <div className="text-4xl">✨</div>
              <h3 className="text-lg font-semibold text-white">
                {filter !== 'all'
                  ? 'No alerts in this category'
                  : 'No alerts'}
              </h3>
              <p className="text-[#7a88a8]">
                {filter !== 'all'
                  ? 'Try adjusting your filter'
                  : 'Everything looks good!'}
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
