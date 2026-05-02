'use client';

import { Users, BarChart3, AlertTriangle, DollarSign } from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { ProposalsCard } from '@/components/dashboard/ProposalsCard';
import { ConnectionHealthBanner } from '@/components/dashboard/ConnectionHealthBanner';

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  subtext?: string;
  trend?: {
    value: number;
    direction: 'up' | 'down';
  };
}

function StatCard({
  icon,
  label,
  value,
  subtext,
  trend,
}: StatCardProps) {
  return (
    <Card className="hover:border-[#e74c3c]/30 transition-colors">
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[#7a88a8] text-xs font-medium uppercase tracking-[0.12em] mb-2">{label}</p>
            <p className="text-3xl font-stat text-white">{value}</p>
            {subtext && (
              <p className="text-xs text-[#7a88a8] mt-2">{subtext}</p>
            )}
          </div>
          <div className="p-3 bg-[#e74c3c]/10 rounded-lg text-[#e74c3c]">
            {icon}
          </div>
        </div>
        {trend && (
          <div className="mt-4 flex items-center gap-1">
            <span
              className={`text-sm font-medium ${
                trend.direction === 'up'
                  ? 'text-green-400'
                  : 'text-[#e74c3c]'
              }`}
            >
              {trend.direction === 'up' ? '+' : '-'}
              {Math.abs(trend.value)}%
            </span>
            <span className="text-xs text-[#7a88a8]">vs last month</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  // TODO: Fetch actual data from Supabase
  const stats = {
    totalClients: 12,
    avgHealthScore: 78,
    atRiskClients: 2,
    revenueAtRisk: 45000,
  };

  return (
    <div className="space-y-8">
      {/* Welcome Section */}
      <div>
        <h2 className="text-3xl text-white mb-2 font-playfair">
          Welcome back
        </h2>
        <p className="text-[#7a88a8] font-outfit">
          Here&apos;s what&apos;s happening with your clients today.
        </p>
      </div>

      {/* Connection health — hidden when all providers healthy */}
      <ConnectionHealthBanner />

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          icon={<Users className="w-5 h-5" />}
          label="Total Clients"
          value={stats.totalClients}
          trend={{ value: 8, direction: 'up' }}
        />
        <StatCard
          icon={<BarChart3 className="w-5 h-5" />}
          label="Avg Health Score"
          value={`${stats.avgHealthScore}%`}
          subtext="Overall client wellness"
          trend={{ value: 5, direction: 'up' }}
        />
        <StatCard
          icon={<AlertTriangle className="w-5 h-5" />}
          label="At-Risk Clients"
          value={stats.atRiskClients}
          subtext="Require immediate attention"
          trend={{ value: 1, direction: 'down' }}
        />
        <StatCard
          icon={<DollarSign className="w-5 h-5" />}
          label="Revenue at Risk"
          value={`$${(stats.revenueAtRisk / 1000).toFixed(0)}k`}
          trend={{ value: 12, direction: 'down' }}
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Client Health Overview - Takes 2 columns */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Client Health Overview</CardTitle>
            <CardDescription>
              Distribution of client health scores across your portfolio
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center h-64 bg-[#1a2540]/30 rounded-lg">
              <div className="text-center">
                <p className="text-[#7a88a8] mb-2">Chart visualization</p>
                <p className="text-sm text-[#7a88a8]/60">
                  Health score chart will be rendered here
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quick Stats Sidebar */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Quick Stats</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-[#1a2540]/30 rounded-lg">
              <span className="text-sm text-[#7a88a8]">Healthy</span>
              <span className="text-lg font-stat text-green-400">10</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-[#1a2540]/30 rounded-lg">
              <span className="text-sm text-[#7a88a8]">At Risk</span>
              <span className="text-lg font-stat text-[#e74c3c]">2</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-[#1a2540]/30 rounded-lg">
              <span className="text-sm text-[#7a88a8]">Churned</span>
              <span className="text-lg font-stat text-[#7a88a8]">0</span>
            </div>
            <div className="pt-3 border-t border-[#1a2540]">
              <p className="text-xs text-[#7a88a8] text-center">
                Last updated: Today
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* APE v1 — portfolio proposals */}
      <ProposalsCard initialLimit={3} />

      {/* Recent Activity & Upcoming Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Latest updates from your clients</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="flex items-start gap-3 p-3 hover:bg-[#1a2540]/30 rounded-lg transition-colors cursor-pointer"
                >
                  <div className="w-2 h-2 rounded-full bg-[#e74c3c] mt-2 flex-shrink-0"></div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-white">
                      Activity item {i}
                    </p>
                    <p className="text-xs text-[#7a88a8] mt-1">
                      2 hours ago
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Upcoming Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Upcoming Actions</CardTitle>
            <CardDescription>Tasks you need to complete</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="flex items-start gap-3 p-3 hover:bg-[#1a2540]/30 rounded-lg transition-colors cursor-pointer"
                >
                  <input
                    type="checkbox"
                    className="w-4 h-4 rounded border-[#1a2540] bg-[#1a2540] text-[#e74c3c] mt-0.5 cursor-pointer"
                  />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-white">
                      Action item {i}
                    </p>
                    <p className="text-xs text-[#7a88a8] mt-1">
                      Due in {i} days
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
