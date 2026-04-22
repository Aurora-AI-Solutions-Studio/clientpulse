'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';

interface ClientLite {
  id: string;
  name: string;
  company_name: string;
}

interface ClientsResponse {
  clients: ClientLite[];
}

export function StepFirstClient() {
  const [existing, setExisting] = useState<ClientLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [retainer, setRetainer] = useState('');

  async function load() {
    try {
      const res = await fetch('/api/clients');
      if (res.ok) {
        const data: ClientsResponse = await res.json();
        setExisting(data.clients ?? []);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = { name, company };
      if (retainer) {
        const n = Number(retainer);
        if (!Number.isNaN(n)) payload.monthlyRetainer = n;
      }
      const res = await fetch('/api/clients', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? `Create failed (${res.status})`);
        return;
      }
      setName('');
      setCompany('');
      setRetainer('');
      await load();
    } finally {
      setSubmitting(false);
    }
  }

  const alreadyHasClients = existing.length > 0;

  return (
    <div className="space-y-4">
      <p className="text-sm text-[#c8d0e0]">
        Add your first client. You&apos;ll see their health score on
        the dashboard as soon as signals start flowing.
      </p>

      {alreadyHasClients && (
        <div className="p-3 bg-[#1a2540]/30 rounded-lg border border-[#1a2540]">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 className="w-4 h-4 text-[#38e8c8]" />
            <span className="text-sm text-white">
              {existing.length} client{existing.length === 1 ? '' : 's'} already added
            </span>
          </div>
          <p className="text-xs text-[#7a88a8]">
            You can add more here, or continue to the Monday Brief.
          </p>
        </div>
      )}

      {loading ? (
        <p className="text-[#7a88a8] text-sm">Loading…</p>
      ) : (
        <form onSubmit={onSubmit} className="space-y-3">
          <div>
            <label className="block text-xs text-[#7a88a8] mb-1">Contact name</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-[#0f1420] border border-[#1a2540] text-white text-sm rounded px-3 py-2"
              placeholder="e.g. Jane Doe"
            />
          </div>
          <div>
            <label className="block text-xs text-[#7a88a8] mb-1">Company</label>
            <input
              type="text"
              required
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              className="w-full bg-[#0f1420] border border-[#1a2540] text-white text-sm rounded px-3 py-2"
              placeholder="e.g. Acme Corp"
            />
          </div>
          <div>
            <label className="block text-xs text-[#7a88a8] mb-1">
              Monthly retainer (optional, USD)
            </label>
            <input
              type="number"
              min={0}
              step={1}
              value={retainer}
              onChange={(e) => setRetainer(e.target.value)}
              className="w-full bg-[#0f1420] border border-[#1a2540] text-white text-sm rounded px-3 py-2"
              placeholder="5000"
            />
          </div>
          {error && <p className="text-xs text-[#e74c3c]">{error}</p>}
          <button
            type="submit"
            disabled={submitting || !name || !company}
            className="text-sm bg-[#e74c3c]/15 border border-[#e74c3c]/40 text-[#e74c3c] hover:bg-[#e74c3c]/25 px-4 py-2 rounded transition-colors disabled:opacity-50"
          >
            {submitting ? 'Adding…' : 'Add client'}
          </button>
        </form>
      )}
    </div>
  );
}
