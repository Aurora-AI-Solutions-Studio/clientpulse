'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Zap, CheckCircle2, Loader2, Filter } from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import type { Proposal, RolledProposals } from '@/lib/proposals/rollup';
import type { MondayBriefRecommendedAction } from '@/lib/agents/monday-brief-agent';

type UrgencyFilter = 'all' | 'high' | 'medium' | 'low';
type TypeFilter = 'all' | MondayBriefRecommendedAction['type'];

const URGENCY_STYLES: Record<Proposal['urgency'], { label: string; cls: string }> = {
  high: { label: 'High', cls: 'bg-[#e74c3c]/15 text-[#e74c3c] border-[#e74c3c]/30' },
  medium: { label: 'Medium', cls: 'bg-[#f0c84c]/15 text-[#f0c84c] border-[#f0c84c]/30' },
  low: { label: 'Low', cls: 'bg-[#38e8c8]/15 text-[#38e8c8] border-[#38e8c8]/30' },
};

const TYPE_LABELS: Record<MondayBriefRecommendedAction['type'], string> = {
  'check-in': 'Check-in',
  escalation: 'Escalation',
  upsell: 'Upsell',
  're-engagement': 'Re-engagement',
  'delivery-fix': 'Delivery',
};

export default function ProposalsPage() {
  const [state, setState] = useState<RolledProposals | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accepting, setAccepting] = useState<string | null>(null);
  const [acceptedIds, setAcceptedIds] = useState<Set<string>>(new Set());

  const [urgencyFilter, setUrgencyFilter] = useState<UrgencyFilter>('all');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');

  useEffect(() => {
    let cancelled = false;
    fetch('/api/proposals?limit=100')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((data: RolledProposals) => {
        if (!cancelled) setState(data);
      })
      .catch(() => {
        if (!cancelled) setError('Could not load proposals.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    if (!state) return [];
    return state.proposals.filter(
      (p) =>
        (urgencyFilter === 'all' || p.urgency === urgencyFilter) &&
        (typeFilter === 'all' || p.type === typeFilter)
    );
  }, [state, urgencyFilter, typeFilter]);

  async function onAccept(p: Proposal) {
    setAccepting(p.id);
    setError(null);
    try {
      const res = await fetch('/api/action-items', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          clientId: p.clientId,
          title: p.title,
          description: p.rationale,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? `Accept failed (${res.status})`);
        return;
      }
      setAcceptedIds((s) => new Set(s).add(p.id));
    } finally {
      setAccepting(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl text-white mb-2 flex items-center gap-2">
          <Zap className="w-6 h-6 text-[#f0c84c]" />
          Action proposals
        </h2>
        <p className="text-[#7a88a8]">
          Proposals generated from your latest Monday Brief. Accept to create an action item on the corresponding client.
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <CardTitle className="text-lg">
                {state?.hasBrief
                  ? `Week of ${state.weekOf}`
                  : 'No proposals yet'}
              </CardTitle>
              <CardDescription>
                {state?.hasBrief
                  ? `${filtered.length} of ${state.proposals.length} shown`
                  : 'Generate a Monday Brief to surface proposals.'}
              </CardDescription>
            </div>
            <div className="flex items-center gap-3">
              <Filter className="w-4 h-4 text-[#7a88a8]" />
              <select
                value={urgencyFilter}
                onChange={(e) => setUrgencyFilter(e.target.value as UrgencyFilter)}
                className="bg-[#0f1420] border border-[#1a2540] text-white text-xs rounded px-2 py-1"
                aria-label="Filter by urgency"
              >
                <option value="all">All urgencies</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value as TypeFilter)}
                className="bg-[#0f1420] border border-[#1a2540] text-white text-xs rounded px-2 py-1"
                aria-label="Filter by type"
              >
                <option value="all">All types</option>
                <option value="check-in">Check-in</option>
                <option value="escalation">Escalation</option>
                <option value="upsell">Upsell</option>
                <option value="re-engagement">Re-engagement</option>
                <option value="delivery-fix">Delivery</option>
              </select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading && (
            <div className="flex items-center gap-2 text-[#7a88a8] py-4">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading proposals…
            </div>
          )}
          {!loading && error && (
            <p className="text-sm text-[#e74c3c] py-2">{error}</p>
          )}
          {!loading && !error && state && !state.hasBrief && (
            <div className="py-8 text-center space-y-2">
              <p className="text-[#7a88a8]">
                No Monday Brief has been generated for this agency yet.
              </p>
              <Link
                href="/dashboard/brief"
                className="inline-block text-sm text-[#38e8c8] hover:underline"
              >
                Go to Monday Brief →
              </Link>
            </div>
          )}
          {!loading && !error && state?.hasBrief && filtered.length === 0 && (
            <p className="text-sm text-[#7a88a8] py-4">
              No proposals match these filters.
            </p>
          )}
          {!loading && !error && filtered.length > 0 && (
            <div className="space-y-3">
              {filtered.map((p) => {
                const accepted = acceptedIds.has(p.id);
                const urg = URGENCY_STYLES[p.urgency];
                return (
                  <div
                    key={p.id}
                    className="p-4 bg-[#1a2540]/30 rounded-lg space-y-2"
                  >
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                      <div className="flex-1 min-w-[240px]">
                        <p className="text-sm font-medium text-white">{p.title}</p>
                        <p className="text-xs text-[#7a88a8] mt-1">
                          {p.companyName || p.clientName} · {TYPE_LABELS[p.type]}
                        </p>
                      </div>
                      <span
                        className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded border ${urg.cls}`}
                      >
                        {urg.label}
                      </span>
                    </div>
                    {p.rationale && (
                      <p className="text-xs text-[#7a88a8] italic">{p.rationale}</p>
                    )}
                    {p.engagementContext && (
                      <p className="text-xs text-[#7a88a8]">
                        <span className="text-[#c8d0e0]">Context:</span>{' '}
                        {p.engagementContext}
                      </p>
                    )}
                    <div className="flex items-center gap-2 pt-1">
                      {accepted ? (
                        <span className="text-xs text-green-400 inline-flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> Added to action items
                        </span>
                      ) : (
                        <button
                          type="button"
                          disabled={accepting === p.id}
                          onClick={() => onAccept(p)}
                          className="text-xs bg-[#38e8c8]/10 border border-[#38e8c8]/30 text-[#38e8c8] hover:bg-[#38e8c8]/20 px-2 py-1 rounded transition-colors disabled:opacity-50"
                        >
                          {accepting === p.id ? 'Accepting…' : 'Accept'}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
