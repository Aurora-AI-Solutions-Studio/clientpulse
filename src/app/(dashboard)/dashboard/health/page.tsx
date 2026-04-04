'use client';

import { Activity, TrendingUp } from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

export default function HealthPage() {
  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <h2 className="text-3xl font-bold text-white font-playfair mb-2">
          Health Scores
        </h2>
        <p className="text-[#7a88a8]">
          Monitor the overall health and wellness of your clients
        </p>
      </div>

      {/* Overall Health Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[#7a88a8] text-sm font-medium mb-1">
                  Portfolio Average
                </p>
                <p className="text-3xl font-bold text-white">78%</p>
                <div className="flex items-center gap-1 mt-3">
                  <TrendingUp className="w-4 h-4 text-green-400" />
                  <span className="text-sm text-green-400">+5% this month</span>
                </div>
              </div>
              <Activity className="w-8 h-8 text-[#e74c3c] opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div>
              <p className="text-[#7a88a8] text-sm font-medium mb-1">
                Healthy Clients
              </p>
              <p className="text-3xl font-bold text-green-400">10</p>
              <p className="text-xs text-[#7a88a8] mt-3">Score above 70</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div>
              <p className="text-[#7a88a8] text-sm font-medium mb-1">
                At-Risk Clients
              </p>
              <p className="text-3xl font-bold text-[#e74c3c]">2</p>
              <p className="text-xs text-[#7a88a8] mt-3">Score below 50</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Health Score Details */}
      <Card>
        <CardHeader>
          <CardTitle>Health Score Breakdown</CardTitle>
          <CardDescription>
            Understand what factors affect your clients&apos; health scores
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[
              { metric: 'Engagement', weight: '30%', impact: 'High' },
              { metric: 'Support Tickets', weight: '25%', impact: 'High' },
              { metric: 'Usage Frequency', weight: '20%', impact: 'Medium' },
              { metric: 'Payment Health', weight: '15%', impact: 'Medium' },
              { metric: 'Sentiment Analysis', weight: '10%', impact: 'Low' },
            ].map((item, index) => (
              <div key={index} className="flex items-center justify-between p-3 border border-[#1a2540] rounded-lg">
                <div className="flex-1">
                  <p className="font-medium text-white">{item.metric}</p>
                  <p className="text-xs text-[#7a88a8] mt-1">
                    Weight: {item.weight} • Impact: {item.impact}
                  </p>
                </div>
                <div className="w-24 bg-[#1a2540] rounded-full h-2">
                  <div
                    className="bg-[#e74c3c] h-2 rounded-full"
                    style={{
                      width: item.weight,
                    }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Score Distribution */}
      <Card>
        <CardHeader>
          <CardTitle>Score Distribution</CardTitle>
          <CardDescription>
            How your clients are distributed across health score ranges
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[
              { range: '90-100', clients: 3, color: 'bg-green-500' },
              { range: '70-89', clients: 7, color: 'bg-blue-500' },
              { range: '50-69', clients: 1, color: 'bg-yellow-500' },
              { range: '0-49', clients: 1, color: 'bg-[#e74c3c]' },
            ].map((distribution, index) => (
              <div key={index} className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-white">
                    {distribution.range}
                  </span>
                  <span className="text-sm text-[#7a88a8]">
                    {distribution.clients} clients
                  </span>
                </div>
                <div className="flex gap-1">
                  {Array.from({ length: distribution.clients }).map(
                    (_, i) => (
                      <div
                        key={i}
                        className={`h-8 flex-1 rounded ${distribution.color}`}
                      ></div>
                    )
                  )}
                  {Array.from({ length: 12 - distribution.clients }).map(
                    (_, i) => (
                      <div
                        key={i}
                        className="h-8 flex-1 rounded bg-[#1a2540]"
                      ></div>
                    )
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
