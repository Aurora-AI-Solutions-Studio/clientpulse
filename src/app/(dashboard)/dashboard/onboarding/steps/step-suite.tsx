'use client';

// Sprint 7.9 Slice 7b — Suite mapping wizard step.
//
// Surfaces every unmatched ContentPulse→CP signal so the agency can pick the
// matching CP client. Only renders when the wizard order includes
// 'suite' (Suite agency + at least one unresolved unmatched row).
//
// Submission persists via /api/suite/unmatched-signals/resolve which
// upserts the cp_rf_client_map row + marks the unmatched row resolved.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, ExternalLink, AlertCircle } from 'lucide-react';

interface UnmatchedRow {
  id: string;
  rf_client_id: string;
  rf_client_name: string;
  signal_count: number;
  first_seen_at: string;
  last_seen_at: string;
}

interface ClientLite {
  id: string;
  name: string;
  company?: string | null;
}

interface ClientsResponse {
  clients: Array<ClientLite & { company?: string }>;
}

export function StepSuite() {
  const [unresolved, setUnresolved] = useState<UnmatchedRow[]>([]);
  const [clients, setClients] = useState<ClientLite[]>([]);
  const [picks, setPicks] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setError(null);
    try {
      const [unRes, clRes] = await Promise.all([
        fetch('/api/suite/unmatched-signals', { cache: 'no-store' }),
        fetch('/api/clients', { cache: 'no-store' }),
      ]);
      if (unRes.ok) {
        const body = (await unRes.json()) as { unresolved?: UnmatchedRow[] };
        setUnresolved(body.unresolved ?? []);
      }
      if (clRes.ok) {
        const body = (await clRes.json()) as ClientsResponse;
        setClients(
          (body.clients ?? []).map((c) => ({
            id: c.id,
            name: c.name,
            company: c.company,
          })),
        );
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function onResolve(unmatchedId: string) {
    const cp_client_id = picks[unmatchedId];
    if (!cp_client_id) {
      setError('Pick a ClientPulse client to map this ContentPulse client to.');
      return;
    }
    setError(null);
    setSavingId(unmatchedId);
    try {
      const res = await fetch('/api/suite/unmatched-signals/resolve', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ unmatched_id: unmatchedId, cp_client_id }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? `Mapping failed (${res.status})`);
        return;
      }
      setUnresolved((prev) => prev.filter((r) => r.id !== unmatchedId));
    } finally {
      setSavingId(null);
    }
  }

  if (loading) {
    return <p className="text-[#7a88a8] text-sm">Loading unmatched signals…</p>;
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-[#c8d0e0]">
        ContentPulse has been emitting signals for these clients, but ClientPulse couldn&apos;t
        match them to a client on this side. Pick the matching ClientPulse client to wire
        the signals into health scoring and proposals.
      </p>

      {clients.length === 0 && (
        <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-[#c8d0e0]">
              You haven&apos;t added any ClientPulse clients yet. Go back to the
              First-client step and add them first — then come back here to map.
            </p>
          </div>
        </div>
      )}

      {unresolved.length === 0 ? (
        <div className="p-4 bg-[#38e8c8]/5 border border-[#38e8c8]/30 rounded-lg">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-[#38e8c8]" />
            <p className="text-sm text-white">All ContentPulse signals are mapped.</p>
          </div>
          <p className="text-xs text-[#7a88a8] mt-1">
            New unmatched signals will surface here automatically. You can also manage
            mappings later from{' '}
            <Link href="/dashboard/settings/suite-mapping" className="underline text-[#38e8c8]">
              Settings → Suite mapping
            </Link>.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {unresolved.map((row) => (
            <div
              key={row.id}
              className="p-3 border border-[#1a2540] rounded-lg flex flex-col sm:flex-row sm:items-center gap-3"
            >
              <div className="flex-1">
                <p className="text-sm font-medium text-white">{row.rf_client_name}</p>
                <p className="text-xs text-[#7a88a8]">
                  ContentPulse id <span className="font-mono">{row.rf_client_id}</span> ·{' '}
                  {row.signal_count} signal{row.signal_count === 1 ? '' : 's'} · last seen{' '}
                  {new Date(row.last_seen_at).toLocaleDateString()}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={picks[row.id] ?? ''}
                  onChange={(e) => setPicks((p) => ({ ...p, [row.id]: e.target.value }))}
                  className="bg-[#0c1220] border border-[#1a2540] rounded px-2 py-1.5 text-sm text-white min-w-[14rem]"
                  disabled={clients.length === 0 || savingId === row.id}
                >
                  <option value="">— pick CP client —</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                      {c.company ? ` · ${c.company}` : ''}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => onResolve(row.id)}
                  disabled={!picks[row.id] || savingId === row.id}
                  className="text-sm bg-[#38e8c8]/15 border border-[#38e8c8]/40 text-[#38e8c8] hover:bg-[#38e8c8]/25 px-3 py-1.5 rounded transition-colors disabled:opacity-30"
                >
                  {savingId === row.id ? 'Mapping…' : 'Map'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-xs text-red-300">
          {error}
        </div>
      )}

      <p className="text-xs text-[#7a88a8]">
        Don&apos;t see all your ContentPulse clients? Open ContentPulse to confirm they&apos;re publishing.
        New signals show up here within minutes of arrival.{' '}
        <a
          href="https://contentpulse.helloaurora.ai/clients"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-0.5 underline"
        >
          Open ContentPulse clients <ExternalLink className="w-3 h-3" />
        </a>
      </p>
    </div>
  );
}
