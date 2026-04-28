'use client';

import { useEffect, useState } from 'react';
import { Activity, TrendingUp, Zap, Percent } from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface LearningData {
  accuracy: number;
  totalOutcomes: number;
  totalPredictions: number;
  confidenceLevel: number;
  predictionBreakdown: {
    truePositives: number;
    trueNegatives: number;
    falsePositives: number;
    falseNegatives: number;
  };
  signalEffectiveness: Array<{
    name: string;
    currentWeight: number;
    recommendedWeight: number;
    correlationStrength: number;
  }>;
  accuracyTrend: Array<{
    date: string;
    accuracy: number;
  }>;
  recentOutcomes: Array<{
    id: string;
    clientName: string;
    type: string;
    healthScore: number;
    date: string;
  }>;
}

export default function LearningPage() {
  const [data, setData] = useState<LearningData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const res = await fetch('/api/learning', { cache: 'no-store' });
        if (!res.ok) throw new Error(`Failed to load learning data (${res.status})`);
        const learningData: LearningData = await res.json();
        if (!cancelled) setData(learningData);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleGenerateSnapshot = async () => {
    try {
      setGenerating(true);
      const res = await fetch('/api/learning/snapshot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) throw new Error(`Failed to generate snapshot (${res.status})`);

      // Refresh data after snapshot
      const dataRes = await fetch('/api/learning', { cache: 'no-store' });
      if (dataRes.ok) {
        const refreshedData: LearningData = await dataRes.json();
        setData(refreshedData);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to generate snapshot');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-3xl text-white mb-2">
            Learning Dashboard
          </h2>
          <p className="text-[#7a88a8]">
            Recursive learning insights and signal effectiveness analysis
          </p>
        </div>
        <Button
          onClick={handleGenerateSnapshot}
          disabled={generating || loading}
          className="bg-[#e74c3c] hover:bg-[#d63c2d] text-white"
        >
          {generating ? 'Generating…' : 'Generate Snapshot'}
        </Button>
      </div>

      {error && (
        <Card className="border-red-500/40 bg-red-500/5">
          <CardContent className="p-4 text-red-300">{error}</CardContent>
        </Card>
      )}

      {/* Hero Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard
          label="Current Accuracy"
          value={loading ? '…' : `${data?.accuracy ?? 0}%`}
          icon={<Percent className="w-5 h-5 text-[#e74c3c]" />}
          accent="#e74c3c"
        />
        <StatCard
          label="Total Outcomes"
          value={loading ? '…' : `${data?.totalOutcomes ?? 0}`}
          icon={<Activity className="w-5 h-5 text-[#7a88a8]" />}
          accent="#7a88a8"
        />
        <StatCard
          label="Total Predictions"
          value={loading ? '…' : `${data?.totalPredictions ?? 0}`}
          icon={<TrendingUp className="w-5 h-5 text-[#22c55e]" />}
          accent="#22c55e"
        />
        <StatCard
          label="Confidence Level"
          value={loading ? '…' : `${data?.confidenceLevel ?? 0}%`}
          icon={<Zap className="w-5 h-5 text-[#f59e0b]" />}
          accent="#f59e0b"
        />
      </div>

      {/* Prediction Breakdown */}
      {!loading && data && (
        <Card>
          <CardHeader>
            <CardTitle className="text-white">Prediction Breakdown</CardTitle>
            <CardDescription>Distribution of prediction outcomes</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Donut Visual */}
              <div className="flex items-center justify-center">
                <div className="relative w-48 h-48">
                  <svg className="w-full h-full" viewBox="0 0 200 200">
                    <circle
                      cx="100"
                      cy="100"
                      r="80"
                      fill="none"
                      stroke="#22c55e"
                      strokeWidth="30"
                      strokeDasharray={`${
                        (data.predictionBreakdown.truePositives /
                          (data.predictionBreakdown.truePositives +
                            data.predictionBreakdown.trueNegatives +
                            data.predictionBreakdown.falsePositives +
                            data.predictionBreakdown.falseNegatives)) *
                        502.4
                      } 502.4`}
                      strokeDashoffset="0"
                      opacity="0.8"
                    />
                    <circle
                      cx="100"
                      cy="100"
                      r="80"
                      fill="none"
                      stroke="#f59e0b"
                      strokeWidth="30"
                      strokeDasharray={`${
                        (data.predictionBreakdown.trueNegatives /
                          (data.predictionBreakdown.truePositives +
                            data.predictionBreakdown.trueNegatives +
                            data.predictionBreakdown.falsePositives +
                            data.predictionBreakdown.falseNegatives)) *
                        502.4
                      } 502.4`}
                      strokeDashoffset={`-${
                        (data.predictionBreakdown.truePositives /
                          (data.predictionBreakdown.truePositives +
                            data.predictionBreakdown.trueNegatives +
                            data.predictionBreakdown.falsePositives +
                            data.predictionBreakdown.falseNegatives)) *
                        502.4
                      }`}
                      opacity="0.8"
                    />
                    <circle
                      cx="100"
                      cy="100"
                      r="80"
                      fill="none"
                      stroke="#3b82f6"
                      strokeWidth="30"
                      strokeDasharray={`${
                        (data.predictionBreakdown.falsePositives /
                          (data.predictionBreakdown.truePositives +
                            data.predictionBreakdown.trueNegatives +
                            data.predictionBreakdown.falsePositives +
                            data.predictionBreakdown.falseNegatives)) *
                        502.4
                      } 502.4`}
                      strokeDashoffset={`-${
                        (data.predictionBreakdown.truePositives +
                          data.predictionBreakdown.trueNegatives) /
                          (data.predictionBreakdown.truePositives +
                            data.predictionBreakdown.trueNegatives +
                            data.predictionBreakdown.falsePositives +
                            data.predictionBreakdown.falseNegatives) *
                        502.4
                      }`}
                      opacity="0.8"
                    />
                    <circle
                      cx="100"
                      cy="100"
                      r="80"
                      fill="none"
                      stroke="#e74c3c"
                      strokeWidth="30"
                      strokeDasharray={`${
                        (data.predictionBreakdown.falseNegatives /
                          (data.predictionBreakdown.truePositives +
                            data.predictionBreakdown.trueNegatives +
                            data.predictionBreakdown.falsePositives +
                            data.predictionBreakdown.falseNegatives)) *
                        502.4
                      } 502.4`}
                      strokeDashoffset={`-${
                        (data.predictionBreakdown.truePositives +
                          data.predictionBreakdown.trueNegatives +
                          data.predictionBreakdown.falsePositives) /
                          (data.predictionBreakdown.truePositives +
                            data.predictionBreakdown.trueNegatives +
                            data.predictionBreakdown.falsePositives +
                            data.predictionBreakdown.falseNegatives) *
                        502.4
                      }`}
                      opacity="0.8"
                    />
                    <circle cx="100" cy="100" r="50" fill="#0a0e1a" />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center">
                      <div className="text-sm text-[#7a88a8]">Total</div>
                      <div className="text-xl font-bold text-white">
                        {data.predictionBreakdown.truePositives +
                          data.predictionBreakdown.trueNegatives +
                          data.predictionBreakdown.falsePositives +
                          data.predictionBreakdown.falseNegatives}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Stats */}
              <div className="space-y-4">
                <div className="flex items-center gap-3 p-3 bg-[#1a1f35] rounded border border-[#2a3050]">
                  <div className="w-3 h-3 rounded-full bg-[#22c55e]"></div>
                  <div className="flex-1">
                    <p className="text-sm text-[#7a88a8]">True Positives</p>
                    <p className="text-lg font-bold text-white">
                      {data.predictionBreakdown.truePositives}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 bg-[#1a1f35] rounded border border-[#2a3050]">
                  <div className="w-3 h-3 rounded-full bg-[#f59e0b]"></div>
                  <div className="flex-1">
                    <p className="text-sm text-[#7a88a8]">True Negatives</p>
                    <p className="text-lg font-bold text-white">
                      {data.predictionBreakdown.trueNegatives}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 bg-[#1a1f35] rounded border border-[#2a3050]">
                  <div className="w-3 h-3 rounded-full bg-[#3b82f6]"></div>
                  <div className="flex-1">
                    <p className="text-sm text-[#7a88a8]">False Positives</p>
                    <p className="text-lg font-bold text-white">
                      {data.predictionBreakdown.falsePositives}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 bg-[#1a1f35] rounded border border-[#2a3050]">
                  <div className="w-3 h-3 rounded-full bg-[#e74c3c]"></div>
                  <div className="flex-1">
                    <p className="text-sm text-[#7a88a8]">False Negatives</p>
                    <p className="text-lg font-bold text-white">
                      {data.predictionBreakdown.falseNegatives}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Signal Effectiveness */}
      {!loading && data && (
        <Card>
          <CardHeader>
            <CardTitle className="text-white">Signal Effectiveness</CardTitle>
            <CardDescription>Current vs recommended signal weights and correlation</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {data.signalEffectiveness.map((signal) => (
                <div key={signal.name} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-white">{signal.name}</p>
                    <div className="flex gap-4">
                      <div className="text-right">
                        <p className="text-xs text-[#7a88a8]">Current</p>
                        <p className="text-sm font-semibold text-white">{signal.currentWeight}%</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-[#7a88a8]">Recommended</p>
                        <p className="text-sm font-semibold text-[#e74c3c]">{signal.recommendedWeight}%</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <div className="flex-1 h-2 bg-[#1a1f35] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#7a88a8]"
                        style={{ width: `${signal.currentWeight}%` }}
                      ></div>
                    </div>
                    <div className="flex-1 h-2 bg-[#1a1f35] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#e74c3c]"
                        style={{ width: `${signal.recommendedWeight}%` }}
                      ></div>
                    </div>
                  </div>
                  <p className="text-xs text-[#7a88a8]">
                    Correlation strength: <span className="text-white font-semibold">{signal.correlationStrength}%</span>
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Accuracy Trend */}
      {!loading && data && (
        <Card>
          <CardHeader>
            <CardTitle className="text-white">Accuracy Trend</CardTitle>
            <CardDescription>Historical accuracy over time</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#2a3050]">
                    <th className="text-left py-2 px-2 text-sm font-semibold text-[#7a88a8]">Date</th>
                    <th className="text-left py-2 px-2 text-sm font-semibold text-[#7a88a8]">Accuracy</th>
                    <th className="text-left py-2 px-2 text-sm font-semibold text-[#7a88a8]">Trend</th>
                  </tr>
                </thead>
                <tbody>
                  {data.accuracyTrend.map((point, idx) => (
                    <tr key={point.date} className="border-b border-[#2a3050] hover:bg-[#1a1f35] transition">
                      <td className="py-3 px-2 text-sm text-white">{point.date}</td>
                      <td className="py-3 px-2 text-sm font-semibold text-white">{point.accuracy}%</td>
                      <td className="py-3 px-2 text-sm">
                        {idx > 0 ? (
                          data.accuracyTrend[idx].accuracy > data.accuracyTrend[idx - 1].accuracy ? (
                            <span className="text-[#22c55e]">▲ Up</span>
                          ) : data.accuracyTrend[idx].accuracy < data.accuracyTrend[idx - 1].accuracy ? (
                            <span className="text-[#e74c3c]">▼ Down</span>
                          ) : (
                            <span className="text-[#7a88a8]">→ Flat</span>
                          )
                        ) : (
                          <span className="text-[#7a88a8]">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Outcomes */}
      {!loading && data && (
        <Card>
          <CardHeader>
            <CardTitle className="text-white">Recent Outcomes</CardTitle>
            <CardDescription>Latest 10 recorded outcomes</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {data.recentOutcomes.length === 0 ? (
                <p className="text-center text-[#7a88a8] py-8">No outcomes recorded yet</p>
              ) : (
                data.recentOutcomes.map((outcome) => (
                  <div
                    key={outcome.id}
                    className="flex items-center justify-between p-3 bg-[#1a1f35] rounded border border-[#2a3050] hover:border-[#3a4060] transition"
                  >
                    <div className="flex-1">
                      <p className="font-medium text-white">{outcome.clientName}</p>
                      <p className="text-xs text-[#7a88a8]">{outcome.date}</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <Badge variant="outline" className="bg-[#0a0e1a] text-[#7a88a8] border-[#2a3050]">
                        {outcome.type}
                      </Badge>
                      <div className="text-right">
                        <p className="text-xs text-[#7a88a8]">Health Score</p>
                        <p className="text-lg font-bold text-white">{outcome.healthScore}</p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  accent,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
  accent: string;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="min-w-0">
            <p className="text-[#7a88a8] text-xs font-medium mb-1 uppercase tracking-wider">
              {label}
            </p>
            <p className="text-2xl font-bold" style={{ color: accent }}>
              {value}
            </p>
          </div>
          {icon}
        </div>
      </CardContent>
    </Card>
  );
}
