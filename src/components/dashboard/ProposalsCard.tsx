'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Zap, CheckCircle2, ChevronRight, Loader2 } from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import type { Proposal, RolledProposals } from '@/lib/proposals/rollup';

const URGENCY_STYLES: Record<Proposal['urgency'], { label: string; cls: string }> = {
  high: { label: 'High', cls: 'bg-[#e74c3c]/15 text-[#e74c3c] border-[#e74c3c]/30' },
  medium: { label: 'Medium', cls: 'bg-[#f0c84c]/15 text-[#f0c84c] border-[#f0c84c]/30' },
  low: { label: 'Low', cls: 'bg-[#38e8c8]/15 text-[#38e8c8] border-[#38e8c8]/30' },
};

export function ProposalsCard({ initialLimit = 3 }: { initialLimit?: number }) {
  const [state, setState] = useState<RolledProposals | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState<string | null>(null);
  const [acceptedIds, setAcceptedIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/proposals?limit=${initialLimit}`)
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
  }, [initialLimit]);

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
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-[#f0c84c]" />
              Suggested actions
            </CardTitle>
            <CardDescription>
              Proposals from your latest Monday Brief — Accept to add to your action items.
            </CardDescription>
          </div>
          <Link
            href="/dashboard/proposals"
            className="text-xs text-[#7a88a8] hover:text-white inline-flex items-center gap-1"
          >
            See all <ChevronRight className="w-3 h-3" />
          </Link>
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
        {!loading && !error && state && state.proposals.length === 0 && (
          <div className="py-4">
            <p className="text-sm text-[#7a88a8]">
              {state.hasBrief
                ? 'No proposals this week — your portfolio looks healthy.'
                : 'No Monday Brief yet. Finish onboarding or generate one to see proposals.'}
            </p>
            {!state.hasBrief && (
              <Link
                href="/dashboard/brief"
                className="text-xs text-[#38e8c8] hover:underline inline-block mt-2"
              >
                Generate Monday Brief →
              </Link>
            )}
          </div>
        )}
        {!loading && !error && state && state.proposals.length > 0 && (
          <div className="space-y-3">
            {state.proposals.map((p) => {
              const accepted = acceptedIds.has(p.id);
              const urg = URGENCY_STYLES[p.urgency];
              return (
                <div
                  key={p.id}
                  className="p-3 bg-[#1a2540]/30 rounded-lg space-y-2"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-white">{p.title}</p>
                      <p className="text-xs text-[#7a88a8] mt-1">
                        {p.companyName || p.clientName}
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
  );
}
