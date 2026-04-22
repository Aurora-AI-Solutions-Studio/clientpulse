'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, RefreshCw, X } from 'lucide-react';
import type {
  IntegrationHealth,
  IntegrationProvider,
} from '@/lib/integrations/health';

interface HealthResponse {
  health: IntegrationHealth[];
  healthy: boolean;
  unhealthy: IntegrationHealth[];
}

const PROVIDER_LABELS: Record<IntegrationProvider, string> = {
  gmail: 'Gmail',
  calendar: 'Calendar',
  zoom: 'Zoom',
  stripe: 'Stripe',
};

export function ConnectionHealthBanner() {
  const [state, setState] = useState<HealthResponse | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [refreshing, setRefreshing] = useState<string | null>(null);

  async function load() {
    try {
      const res = await fetch('/api/integrations/health');
      if (!res.ok) return;
      const data: HealthResponse = await res.json();
      setState(data);
    } catch {
      // silent — banner is non-critical
    }
  }

  useEffect(() => {
    load();
  }, []);

  if (dismissed || !state || state.unhealthy.length === 0) return null;

  async function onRefresh(provider: IntegrationProvider) {
    if (provider === 'stripe') return; // no token-refresh concept for Stripe
    setRefreshing(provider);
    try {
      // Provider sync routes are session-authenticated; the browser
      // carries the cookie. Each sync route handles expired-token
      // refresh internally (see src/app/api/integrations/{provider}/sync/route.ts).
      await fetch(`/api/integrations/${provider}/sync`, { method: 'POST' });
      await load();
    } finally {
      setRefreshing(null);
    }
  }

  return (
    <div className="rounded-lg border border-[#f0c84c]/30 bg-[#f0c84c]/5 p-4">
      <div className="flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-[#f0c84c] flex-shrink-0 mt-0.5" />
        <div className="flex-1 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-medium text-white">
              {state.unhealthy.length === 1
                ? '1 connection needs attention'
                : `${state.unhealthy.length} connections need attention`}
            </p>
            <button
              type="button"
              onClick={() => setDismissed(true)}
              className="text-[#7a88a8] hover:text-white transition-colors"
              aria-label="Dismiss"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <ul className="space-y-2">
            {state.unhealthy.map((row) => (
              <li
                key={row.provider}
                className="flex items-center justify-between gap-3 text-sm"
              >
                <div className="min-w-0">
                  <span className="text-white font-medium">
                    {PROVIDER_LABELS[row.provider]}
                  </span>
                  <span className="text-[#7a88a8] ml-2">{row.message}</span>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {row.provider !== 'stripe' && (
                    <button
                      type="button"
                      disabled={refreshing === row.provider}
                      onClick={() => onRefresh(row.provider)}
                      className="text-xs bg-[#f0c84c]/10 border border-[#f0c84c]/30 text-[#f0c84c] hover:bg-[#f0c84c]/20 px-2 py-1 rounded transition-colors inline-flex items-center gap-1 disabled:opacity-50"
                    >
                      <RefreshCw
                        className={`w-3 h-3 ${refreshing === row.provider ? 'animate-spin' : ''}`}
                      />
                      {refreshing === row.provider ? 'Refreshing…' : 'Refresh'}
                    </button>
                  )}
                  <Link
                    href={
                      row.provider === 'stripe'
                        ? '/dashboard/upgrade'
                        : '/dashboard/settings'
                    }
                    className="text-xs text-[#38e8c8] hover:underline"
                  >
                    {row.provider === 'stripe' ? 'Manage billing' : 'Reconnect'}
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
