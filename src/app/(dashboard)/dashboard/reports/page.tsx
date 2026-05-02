'use client';

import { useEffect, useState } from 'react';
import { Download, FileText, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import type { ClientReportData } from '@/app/api/reports/client/route';

interface Client {
  id: string;
  name: string;
  company: string;
}

export default function ReportsPage() {
  const { toast } = useToast();
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [report, setReport] = useState<ClientReportData | null>(null);
  const [, setLoading] = useState(false);
  const [generatingReport, setGeneratingReport] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load clients on mount
  useEffect(() => {
    const loadClients = async () => {
      try {
        setLoading(true);
        const res = await fetch('/api/clients', { cache: 'no-store' });
        if (!res.ok) throw new Error('Failed to load clients');
        const data = await res.json();
        setClients(data);
        if (data.length > 0) {
          setSelectedClientId(data[0].id);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load clients');
        toast({
          title: 'Error',
          description: 'Failed to load clients',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };
    loadClients();
  }, [toast]);

  const handleGenerateReport = async () => {
    if (!selectedClientId) {
      toast({
        title: 'Error',
        description: 'Please select a client',
        variant: 'destructive',
      });
      return;
    }

    try {
      setGeneratingReport(true);
      setError(null);
      const res = await fetch('/api/reports/client', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: selectedClientId }),
      });

      if (!res.ok) throw new Error('Failed to generate report');
      const reportData: ClientReportData = await res.json();
      setReport(reportData);
      toast({
        title: 'Success',
        description: 'Report generated successfully',
      });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to generate report';
      setError(errorMsg);
      toast({
        title: 'Error',
        description: errorMsg,
        variant: 'destructive',
      });
    } finally {
      setGeneratingReport(false);
    }
  };

  const handleDownloadPDF = () => {
    if (!report) return;
    // Trigger browser print dialog which can save as PDF
    window.print();
  };

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'critical':
        return 'text-red-600';
      case 'high':
        return 'text-orange-600';
      case 'medium':
        return 'text-yellow-600';
      default:
        return 'text-green-600';
    }
  };

  const getRiskBgColor = (level: string) => {
    switch (level) {
      case 'critical':
        return 'bg-red-50';
      case 'high':
        return 'bg-orange-50';
      case 'medium':
        return 'bg-yellow-50';
      default:
        return 'bg-green-50';
    }
  };

  const getHealthStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'text-green-600';
      case 'at-risk':
        return 'text-yellow-600';
      case 'critical':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  };

  const getEngagementColor = (sentiment: number) => {
    if (sentiment >= 0.7) return 'bg-green-100';
    if (sentiment >= 0.5) return 'bg-yellow-100';
    return 'bg-red-100';
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h2 className="font-playfair text-[28px] font-bold text-text-primary mb-2">Client Reports</h2>
        <p className="text-sm text-text-muted">Generate and download professional white-label client reports</p>
      </div>

      {/* Report Generator Controls */}
      <Card className="rounded-[10px] bg-polar border-border-subtle p-6">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#e8f0ff] mb-2">
              Select Client
            </label>
            <select
              value={selectedClientId}
              onChange={(e) => setSelectedClientId(e.target.value)}
              className="w-full px-4 py-2 rounded-xl bg-deep border border-border-subtle text-text-primary placeholder-text-muted focus:border-teal focus:outline-none transition-colors"
            >
              <option value="">Choose a client...</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name} ({client.company})
                </option>
              ))}
            </select>
          </div>

          <Button
            onClick={handleGenerateReport}
            disabled={!selectedClientId || generatingReport}
            className="w-full bg-teal hover:brightness-110 text-deep font-semibold rounded-xl transition-all"
          >
            {generatingReport ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Generating Report...
              </>
            ) : (
              <>
                <FileText className="w-4 h-4 mr-2" />
                Generate Report
              </>
            )}
          </Button>
        </div>
      </Card>

      {/* Error Display */}
      {error && (
        <Card className="bg-red-50 border-red-200 p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="text-red-800">{error}</div>
        </Card>
      )}

      {/* Report Preview */}
      {report && (
        <div>
          {/* Printable Report */}
          <div className="print:block" id="report-print">
            <Card className="bg-white text-gray-900 p-12 border-0">
              {/* Report Header */}
              <div className="border-b border-gray-200 pb-8 mb-8">
                <div className="flex items-start justify-between mb-8">
                  <div>
                    <div className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-1">
                      Client Report
                    </div>
                    <h1 className="text-4xl font-bold text-gray-900">
                      {report.clientInfo.name}
                    </h1>
                    <p className="text-lg text-gray-600 mt-1">{report.clientInfo.company}</p>
                  </div>
                  <div className="text-right">
                    {report.agencyInfo.logo && (
                      <img
                        src={report.agencyInfo.logo}
                        alt="Agency Logo"
                        className="h-12 mb-2"
                      />
                    )}
                    <p className="text-sm font-semibold text-gray-700">
                      {report.agencyInfo.name}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {new Date(report.dateRange.generatedAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                {/* Quick Facts */}
                <div className="grid grid-cols-4 gap-4 text-sm">
                  <div>
                    <p className="text-gray-500 uppercase text-xs font-semibold mb-1">
                      Service Type
                    </p>
                    <p className="font-semibold text-gray-900">
                      {report.clientInfo.serviceType || 'N/A'}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500 uppercase text-xs font-semibold mb-1">
                      Monthly Retainer
                    </p>
                    <p className="font-semibold text-gray-900">
                      ${(report.clientInfo.monthlyRetainer || 0).toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500 uppercase text-xs font-semibold mb-1">
                      Reporting Period
                    </p>
                    <p className="font-semibold text-gray-900">Last 90 Days</p>
                  </div>
                  <div>
                    <p className="text-gray-500 uppercase text-xs font-semibold mb-1">
                      Report Date
                    </p>
                    <p className="font-semibold text-gray-900">
                      {new Date(report.dateRange.generatedAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </div>

              {/* Health Score Section */}
              <div className="mb-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">Health Score</h2>
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <div className="relative w-40 h-40 mx-auto mb-4">
                      <svg viewBox="0 0 200 200" className="w-full h-full">
                        <circle
                          cx="100"
                          cy="100"
                          r="90"
                          fill="none"
                          stroke="#f0f0f0"
                          strokeWidth="20"
                        />
                        <circle
                          cx="100"
                          cy="100"
                          r="90"
                          fill="none"
                          stroke={
                            report.healthScore.status === 'healthy'
                              ? '#22c55e'
                              : report.healthScore.status === 'at-risk'
                                ? '#eab308'
                                : '#ef4444'
                          }
                          strokeWidth="20"
                          strokeDasharray={`${
                            (report.healthScore.overall / 100) * 565.48
                          } 565.48`}
                          strokeDashoffset="0"
                          strokeLinecap="round"
                          style={{ transform: 'rotate(-90deg)', transformOrigin: '100px 100px' }}
                        />
                        <text
                          x="100"
                          y="100"
                          textAnchor="middle"
                          dy="0.3em"
                          className="text-3xl font-bold text-gray-900"
                          fontSize="48"
                          fontWeight="bold"
                        >
                          {report.healthScore.overall}
                        </text>
                      </svg>
                    </div>
                    <div className="text-center">
                      <p className={`text-lg font-semibold ${getHealthStatusColor(report.healthScore.status)}`}>
                        {report.healthScore.status.charAt(0).toUpperCase() +
                          report.healthScore.status.slice(1)}
                      </p>
                      {report.healthScore.trend && (
                        <p className="text-sm text-gray-600 mt-1">
                          {report.healthScore.trend === 'up'
                            ? '↑ Trending Up'
                            : report.healthScore.trend === 'down'
                              ? '↓ Trending Down'
                              : '→ Stable'}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Breakdown Bars */}
                  <div className="space-y-3">
                    {[
                      {
                        label: 'Financial',
                        value: report.healthScore.breakdown.financial,
                      },
                      {
                        label: 'Relationship',
                        value: report.healthScore.breakdown.relationship,
                      },
                      {
                        label: 'Delivery',
                        value: report.healthScore.breakdown.delivery,
                      },
                      {
                        label: 'Engagement',
                        value: report.healthScore.breakdown.engagement,
                      },
                    ].map((metric) => (
                      <div key={metric.label}>
                        <div className="flex justify-between mb-1">
                          <p className="text-sm font-medium text-gray-700">{metric.label}</p>
                          <p className="text-sm font-semibold text-gray-900">{metric.value}</p>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-blue-600 h-2 rounded-full"
                            style={{ width: `${metric.value}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Meetings Summary */}
              <div className="mb-8 page-break">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">Recent Meetings</h2>
                {report.recentMeetings.length > 0 ? (
                  <div className="space-y-3">
                    {report.recentMeetings.map((meeting) => (
                      <div
                        key={meeting.id}
                        className={`p-4 border border-gray-200 rounded-lg ${getEngagementColor(
                          meeting.sentiment
                        )}`}
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-semibold text-gray-900">{meeting.title}</p>
                            <p className="text-sm text-gray-600 mt-1">
                              {new Date(meeting.date).toLocaleDateString()}
                            </p>
                            {meeting.summary && (
                              <p className="text-sm text-gray-700 mt-2">{meeting.summary}</p>
                            )}
                          </div>
                          <div className="text-right">
                            <p className="text-xs font-semibold text-gray-600 uppercase">
                              Sentiment
                            </p>
                            <p className="text-lg font-bold text-gray-900">
                              {Math.round(meeting.sentiment * 100)}%
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-600">No recent meetings</p>
                )}
              </div>

              {/* Risk Assessment */}
              <div className="mb-8 page-break">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">Risk Assessment</h2>
                <div className={`p-6 rounded-lg border ${getRiskBgColor(report.churnPrediction.riskLevel)}`}>
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <p className="text-sm font-semibold text-gray-700 uppercase mb-2">
                        Churn Risk Level
                      </p>
                      <p
                        className={`text-3xl font-bold ${getRiskColor(
                          report.churnPrediction.riskLevel
                        )}`}
                      >
                        {report.churnPrediction.riskLevel.charAt(0).toUpperCase() +
                          report.churnPrediction.riskLevel.slice(1)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-gray-700 uppercase mb-2">
                        Risk Score
                      </p>
                      <p className="text-3xl font-bold text-gray-900">
                        {report.churnPrediction.riskScore}
                      </p>
                    </div>
                  </div>

                  {report.churnPrediction.primaryRisks.length > 0 && (
                    <div>
                      <p className="text-sm font-semibold text-gray-700 uppercase mb-2">
                        Primary Risk Factors
                      </p>
                      <ul className="space-y-2">
                        {report.churnPrediction.primaryRisks.map((risk, idx) => (
                          <li key={idx} className="text-sm text-gray-700">
                            • {risk}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>

              {/* Recommended Actions */}
              <div className="mb-8 page-break">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">Recommended Actions</h2>
                <div className="space-y-3">
                  {report.suggestedActions.map((action) => (
                    <div
                      key={action.id}
                      className="border-l-4 border-blue-600 pl-4 py-3 bg-gray-50 rounded-r-lg"
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <p className="font-semibold text-gray-900">{action.title}</p>
                          <p className="text-sm text-gray-600 mt-1">{action.description}</p>
                          <p className="text-sm font-medium text-blue-600 mt-2">{action.action}</p>
                        </div>
                        <span
                          className={`text-xs font-semibold uppercase px-2 py-1 rounded whitespace-nowrap ml-4 ${
                            action.priority === 'high'
                              ? 'bg-red-100 text-red-700'
                              : action.priority === 'medium'
                                ? 'bg-yellow-100 text-yellow-700'
                                : 'bg-green-100 text-green-700'
                          }`}
                        >
                          {action.priority}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Footer */}
              <div className="border-t border-gray-200 pt-6 text-center">
                <p className="text-sm text-gray-600">Powered by ClientPulse</p>
                <p className="text-xs text-gray-500 mt-1">
                  This report is confidential and intended for internal use only.
                </p>
              </div>
            </Card>
          </div>

          {/* Screen-only Download Button */}
          <div className="print:hidden flex gap-3 mt-6">
            <Button
              onClick={handleDownloadPDF}
              className="flex-1 bg-teal hover:brightness-110 text-deep font-semibold rounded-xl transition-all"
            >
              <Download className="w-4 h-4 mr-2" />
              Download as PDF
            </Button>
          </div>
        </div>
      )}

      {/* Print Stylesheet */}
      <style>{`
        @media print {
          body {
            background: white;
            margin: 0;
            padding: 0;
          }
          .print\\:hidden {
            display: none !important;
          }
          .print\\:block {
            display: block !important;
          }
          .page-break {
            page-break-inside: avoid;
          }
          #report-print {
            margin: 0;
            padding: 0;
          }
          #report-print .bg-white {
            box-shadow: none;
            border: none;
          }
        }
      `}</style>
    </div>
  );
}
