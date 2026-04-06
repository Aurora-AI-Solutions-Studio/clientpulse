'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Activity,
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Minus,
  ShieldCheck,
  TrendingDown,
} from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import type { PortfolioSnapshot, PortfolioClient } from '@/app/api/portfolio/route';

export default function HealthPage() {
  const [snapshot, setSnapshot] = useState<PortfolioSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'critical' | 'at-risk' | 'healthy'>('all');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const res = await fetch('/api/portfolio', { cache: 'no-store' });
        if (!res.ok) throw new Error(`Failed to load portfolio (${res.status})`);
        const data: PortfolioSnapshot = await res.json();
        if (!cancelled) setSnapshot(data);
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

  const filteredClients =
    snapshot?.clients.filter((c) => (filter === 'all' ? true : c.status === filter)) ?? [];

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-3xl font-bold text-white font-playfair mb-2">
            Client Risk Dashboard
          </h2>
          <p className="text-[#7a88a8]">
            Portfolio health ranked worst to best · weighted Financial 30% / Relationship 30% / Delivery 25% / Engagement 15%
          </p>
        </div>
      </div>

      {error && (
        <Card className="border-red-500/40 bg-red-500/5">
          <CardContent className="p-4 text-red-300">{error}</CardContent>
        </Card>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <StatCard
          label="Portfolio avg"
          value={loading ? '…' : `${snapshot?.averageScore ?? 0}`}
          accent="#e74c3c"
          icon={<Activity className="w-5 h-5 text-[#e74c3c] opacity-70" />}
          footer={
            snapshot && snapshot.weekOverWeekDelta !== 0 ? (
              <TrendDelta value={snapshot.weekOverWeekDelta} suffix=" pts WoW" />
            ) : (
              <span className="text-xs text-[#7a88a8]">no change</span>
            )
          }
        />
        <StatCard
          label="Total clients"
          value={loading ? '…' : `${snapshot?.totalClients ?? 0}`}
          accent="#7a88a8"
        />
        <StatCard
          label="Healthy"
          value={loading ? '…' : `${snapshot?.healthy ?? 0}`}
          accent="#22c55e"
          icon={<ShieldCheck className="w-5 h-5 text-green-400 opacity-70" />}
        />
        <StatCard
          label="At risk"
          value={loading ? '…' : `${snapshot?.atRisk ?? 0}`}
          accent="#f59e0b"
          icon={<TrendingDown className="w-5 h-5 text-yellow-400 opacity-70" />}
        />
        <StatCard
          label="Critical"
          value={loading ? '…' : `${snapshot?.critical ?? 0}`}
          accent="#e74c3c"
          icon={<AlertTriangle className="w-5 h-5 text-[#e74c3c] opacity-70" />}
        />
      </div>

      {/* Filter pills */}
      <div className="flex gap-2 flex-wrap">
        {(['all', 'critical', 'at-risk', 'healthy'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition ${
              filter === f
                ? 'bg-[#e74c3c] text-white'
                : 'bg-[#1a2340] text-[#7a88a8] hover:bg-[#232e4f]'
            }`}
          >
            {f === 'all' ? 'All' : f === 'at-risk' ? 'At risk' : f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* Risk Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-white">Clients ranked by health</CardTitle>
          <CardDescription>Worst first — click a client to drill into signals</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-12 text-center text-[#7a88a8]">Loading portfolio…</div>
          ) : filteredClients.length === 0 ? (
            <div className="py-12 text-center text-[#7a88a8]">
              {snapshot?.totalClients === 0
                ? 'No clients yet. Add your first client to start tracking health.'
                : 'No clients in this view.'}
            </div>
          ) : (
            <div className="divide-y divide-[#1a2340]">
              {filteredClients.map((c) => (
                <ClientRow key={c.clientId} client={c} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({
  label,
  value,
  accent,
  icon,
  footer,
}: {
  label: string;
  value: string;
  accent: string;
  icon?: React.ReactNode;
  footer?: React.ReactNode;
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
            {footer && <div className="mt-2">{footer}</div>}
          </div>
          {icon}
        </div>
      </CardContent>
    </Card>
  );
}

function TrendDelta({ value, suffix = '' }: { value: number; suffix?: string }) {
  if (value === 0) {
    return (
      <span className="text-xs text-[#7a88a8] flex items-center gap-1">
        <Minus className="w-3 h-3" /> flat{suffix}
      </span>
    );
  }
  const up = value > 0;
  return (
    <span
      className={`text-xs flex items-center gap-1 ${up ? 'text-green-400' : 'text-[#e74c3c]'}`}
    >
      {up ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
      {up ? '+' : ''}
      {value}
      {suffix}
    </span>
  );
}

function ClientRow({ client }: { client: PortfolioClient }) {
  const statusColor =
    client.status === 'healthy'
      ? 'bg-green-500/15 text-green-300 border-green-500/30'
      : client.status === 'at-risk'
        ? 'bg-yellow-500/15 text-yellow-300 border-yellow-500/30'
        : client.status === 'critical'
          ? 'bg-[#e74c3c]/15 text-[#e74c3c] border-[#e74c3c]/30'
          : 'bg-[#1a2340] text-[#7a88a8] border-[#1a2340]';

  return (
    <Link
      href={`/dashboard/clients/${client.clientId}`}
      className="grid grid-cols-12 gap-3 py-3 items-center hover:bg-[#0f1729] px-2 rounded transition"
    >
      <div className="col-span-5 min-w-0">
        <div className="text-white font-medium truncate">{client.company || client.name}</div>
        <div className="text-xs text-[#7a88a8] truncate">{client.name}</div>
      </div>
      <div className="col-span-2">
        <span
          className={`text-xs font-semibold uppercase px-2 py-1 rounded border ${statusColor}`}
        >
          {client.status === 'at-risk' ? 'At risk' : client.status}
        </span>
      </div>
      <div className="col-span-1 text-right">
        <div className="text-xl font-bold text-white">
          {client.overallScore ?? '—'}
        </div>
      </div>
      <div className="col-span-1 text-right">
        {client.delta !== null ? (
          <TrendDelta value={client.delta} />
        ) : (
          <span className="text-xs text-[#7a88a8]">—</span>
        )}
      </div>
      <div className="col-span-3 text-xs text-[#7a88a8] truncate">
        {client.topSignal ?? 'No signals'}
      </div>
    </Link>
  );
}
