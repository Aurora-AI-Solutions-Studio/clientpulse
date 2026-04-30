'use client';

// Sprint 7.9 Slice 7b — Suite mapping management page.
//
// Standalone view to map RF clients to CP clients outside of the
// onboarding wizard flow. Two sections:
//   1) Unresolved — RF signals that haven't been wired to a CP client.
//   2) Already mapped — read-only audit of the cp_rf_client_map rows.
//
// Reuses the same /api/suite/unmatched-signals endpoints as the wizard
// step. Re-resolving a mapping (changing which CP client an RF id
// points to) is an upsert on (agency_id, rf_client_id) — already
// covered by the resolve endpoint.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, CheckCircle2, AlertCircle } from 'lucide-react';

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

export default function SuiteMappingPage() {
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
        const body = (await clRes.json()) as { clients?: ClientLite[] };
        setClients(body.clients ?? []);
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
      setError('Pick a ClientPulse client to map this RF client to.');
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

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <Link
          href="/dashboard/settings"
          className="inline-flex items-center gap-1 text-xs text-[#7a88a8] hover:text-white mb-2"
        >
          <ArrowLeft className="w-3 h-3" />
          Back to settings
        </Link>
        <h1 className="text-3xl text-white mb-1">Suite mapping</h1>
        <p className="text-sm text-[#7a88a8]">
          Pair RF clients with their ClientPulse counterparts so cross-product signals
          flow into health scoring and proposals.
        </p>
      </div>

      <div className="rounded-lg border border-[#1a2540] bg-[#0c1220] p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-medium text-white uppercase tracking-wide">
            Unresolved
          </h2>
          <span className="text-xs text-[#7a88a8]">
            {unresolved.length} client{unresolved.length === 1 ? '' : 's'} waiting
          </span>
        </div>

        {loading ? (
          <p className="text-sm text-[#7a88a8]">Loading…</p>
        ) : unresolved.length === 0 ? (
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-[#38e8c8]" />
            <p className="text-sm text-white">All RF signals are mapped.</p>
          </div>
        ) : clients.length === 0 ? (
          <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-[#c8d0e0]">
              You have unmatched RF signals but no CP clients yet. Add a client first
              from the Clients page.
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
                    RF id <span className="font-mono">{row.rf_client_id}</span> ·{' '}
                    {row.signal_count} signal{row.signal_count === 1 ? '' : 's'} · last seen{' '}
                    {new Date(row.last_seen_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={picks[row.id] ?? ''}
                    onChange={(e) => setPicks((p) => ({ ...p, [row.id]: e.target.value }))}
                    className="bg-[#0c1220] border border-[#1a2540] rounded px-2 py-1.5 text-sm text-white min-w-[14rem]"
                    disabled={savingId === row.id}
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
          <div className="mt-3 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-xs text-red-300">
            {error}
          </div>
        )}
      </div>

      <p className="text-xs text-[#7a88a8]">
        Want to change a previously-mapped pairing? Reach out via support — full editing
        of existing maps is on the post-launch roadmap (Option C unified client layer).
      </p>
    </div>
  );
}
