'use client';

// Per-client workhorse page. Real data only — the old MOCK_CLIENTS shim
// is gone. URL-driven tabs (?tab=signals|actions|health|predictions|alerts)
// so a deep link works and refreshes preserve state.
//
// Each tab manages its own data fetch + empty state. The Health tab carries
// the HRAI Art 14 surfaces (Why this score? + Override).

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Edit3,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Activity,
  Zap,
  Bell,
  RotateCcw,
  Info,
  X,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import HealthScoreBadge from '@/components/clients/health-score-badge';
import type { Client } from '@/types/client';

import { PER_CLIENT_TABS, parsePerClientTab, type PerClientTab } from '@/lib/clients/tabs';

type Tab = PerClientTab;

const TAB_LABEL: Record<Tab, string> = {
  signals: 'Signals',
  actions: 'Actions',
  health: 'Health',
  predictions: 'Predictions',
  alerts: 'Alerts',
};

const TAB_ICON: Record<Tab, React.ElementType> = {
  signals: Activity,
  actions: Zap,
  health: TrendingUp,
  predictions: TrendingDown,
  alerts: Bell,
};

interface ActionItem {
  id: string;
  title: string;
  description: string | null;
  status: 'open' | 'done' | 'overdue';
  due_date: string | null;
  created_at: string;
}

export default function ClientDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const search = useSearchParams();
  const id = params?.id ?? '';

  const tab: Tab = parsePerClientTab(search?.get('tab'));

  const [client, setClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/clients/${id}`);
        if (!res.ok) throw new Error(`Failed to load client (${res.status})`);
        const data: Client = await res.json();
        if (!cancelled) setClient(data);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const setTab = useCallback(
    (next: Tab) => {
      router.replace(`/dashboard/clients/${id}?tab=${next}`, { scroll: false });
    },
    [router, id],
  );

  if (loading) {
    return (
      <div className="space-y-6">
        <BackLink />
        <Card>
          <CardContent className="p-12 text-center text-[#7a88a8]">Loading client…</CardContent>
        </Card>
      </div>
    );
  }

  if (error || !client) {
    return (
      <div className="space-y-6">
        <BackLink />
        <Card className="border-red-500/30 bg-red-500/5">
          <CardContent className="p-8 text-center">
            <p className="text-red-300 mb-3">{error ?? 'Client not found'}</p>
            <Button asChild variant="outline">
              <Link href="/dashboard/clients">Back to clients</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <BackLink />
      <IdentityCard client={client} />
      <TabStrip current={tab} onChange={setTab} />
      <div className="min-h-[200px]">
        {tab === 'signals' && <SignalsTab clientId={id} />}
        {tab === 'actions' && <ActionsTab clientId={id} />}
        {tab === 'health' && (
          <HealthTab
            clientId={id}
            client={client}
            onRefresh={async () => {
              const res = await fetch(`/api/clients/${id}`);
              if (res.ok) setClient(await res.json());
            }}
          />
        )}
        {tab === 'predictions' && <PredictionsTab />}
        {tab === 'alerts' && <AlertsTab />}
      </div>
    </div>
  );
}

// -----------------------------
// Header bits
// -----------------------------

function BackLink() {
  return (
    <Link
      href="/dashboard/clients"
      className="inline-flex items-center gap-1.5 text-sm text-[#7a88a8] hover:text-white"
    >
      <ArrowLeft className="w-4 h-4" />
      Back to clients
    </Link>
  );
}

function IdentityCard({ client }: { client: Client }) {
  const score = client.healthScore?.overall ?? null;
  return (
    <Card>
      <CardContent className="p-6 flex items-start gap-5 flex-wrap">
        {score !== null ? <HealthScoreBadge score={score} size="lg" /> : <ScorePlaceholder />}
        <div className="flex-1 min-w-[240px]">
          <h1 className="text-2xl font-semibold text-white mb-1">
            {client.company || client.name}
          </h1>
          <p className="text-sm text-[#9aa6c0] mb-3">{client.name}</p>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className="border-[#1a2540] text-[#9aa6c0]">
              {client.status}
            </Badge>
            {client.serviceType && (
              <Badge variant="outline" className="border-[#1a2540] text-[#9aa6c0]">
                {client.serviceType}
              </Badge>
            )}
            {typeof client.monthlyRetainer === 'number' && (
              <Badge variant="outline" className="border-[#1a2540] text-[#9aa6c0]">
                ${(client.monthlyRetainer / 100).toLocaleString()}/mo
              </Badge>
            )}
          </div>
          {client.notes && (
            <p className="text-xs text-[#7a88a8] mt-3 line-clamp-2">{client.notes}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function ScorePlaceholder() {
  return (
    <div className="w-24 h-24 rounded-full border-2 border-dashed border-[#1a2540] flex items-center justify-center text-[10px] text-[#5a6580] uppercase tracking-wider text-center px-3">
      No score yet
    </div>
  );
}

// -----------------------------
// Tab strip
// -----------------------------

function TabStrip({ current, onChange }: { current: Tab; onChange: (t: Tab) => void }) {
  return (
    <div className="flex items-center gap-1 border-b border-[#1a2540] overflow-x-auto">
      {PER_CLIENT_TABS.map((t) => {
        const active = t === current;
        const Icon = TAB_ICON[t];
        return (
          <button
            key={t}
            type="button"
            onClick={() => onChange(t)}
            className={`relative flex items-center gap-2 px-4 py-3 text-sm transition-colors ${
              active ? 'text-white' : 'text-[#7a88a8] hover:text-[#c8d0e0]'
            }`}
          >
            <Icon className="w-4 h-4" />
            {TAB_LABEL[t]}
            {active && (
              <span
                aria-hidden="true"
                className="absolute left-3 right-3 -bottom-px h-[2px] rounded-full bg-[#e74c3c]"
              />
            )}
          </button>
        );
      })}
    </div>
  );
}

// -----------------------------
// Signals tab — placeholder MVP, fed by RF→CP signal pipeline (step 4)
// -----------------------------

interface SignalRow {
  signal_type:
    | 'content_velocity'
    | 'approval_latency'
    | 'pause_resume'
    | 'voice_freshness'
    | 'ingestion_rate';
  period: string;
  value: number;
  metadata: Record<string, unknown> | null;
  emitted_at: string;
}

interface SignalsResponse {
  latest: Partial<Record<SignalRow['signal_type'], SignalRow>>;
  timeline: SignalRow[];
}

const SIGNAL_LABEL: Record<SignalRow['signal_type'], string> = {
  content_velocity: 'Content velocity',
  approval_latency: 'Approval latency',
  pause_resume: 'Pause / resume',
  voice_freshness: 'Voice freshness',
  ingestion_rate: 'Ingestion rate',
};

function formatSignalValue(s: SignalRow): string {
  switch (s.signal_type) {
    case 'content_velocity':
      return `${s.value} pieces / wk`;
    case 'approval_latency':
      return `${Math.round(s.value / 1000 / 60 / 60)} h avg`;
    case 'pause_resume':
      return s.value >= 0.5 ? 'Paused' : 'Active';
    case 'voice_freshness':
      return `${Math.round(s.value)} d since update`;
    case 'ingestion_rate':
      return `${s.value} jobs / 30d`;
  }
}

function SignalsTab({ clientId }: { clientId: string }) {
  const [data, setData] = useState<SignalsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/clients/${clientId}/signals`, { cache: 'no-store' })
      .then(async (r) => {
        if (!r.ok) throw new Error(String(r.status));
        return (await r.json()) as SignalsResponse;
      })
      .then((d) => { if (!cancelled) setData(d); })
      .catch((e) => { if (!cancelled) setError(String(e)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [clientId]);

  if (loading) {
    return (
      <Card>
        <CardContent className="p-8 text-sm text-[#9aa6c0]">Loading signals…</CardContent>
      </Card>
    );
  }
  if (error) {
    return (
      <Card>
        <CardContent className="p-8 text-sm text-[#e74c3c]">Couldn’t load signals: {error}</CardContent>
      </Card>
    );
  }

  const latestEntries = data ? Object.entries(data.latest) as Array<[SignalRow['signal_type'], SignalRow]> : [];
  const hasAny = latestEntries.length > 0;

  if (!hasAny) {
    return (
      <Card>
        <CardContent className="p-8">
          <div className="flex items-start gap-3">
            <Activity className="w-5 h-5 text-[#7a88a8] mt-0.5" />
            <div>
              <h3 className="text-base font-semibold text-white mb-1">No signals yet</h3>
              <p className="text-sm text-[#9aa6c0] max-w-2xl">
                Aurora Suite signals from ReForge land here once your agency starts publishing
                content for this client. For non-Suite signals (meetings, email, payments),
                connect Gmail / Calendar / Zoom / Stripe in{' '}
                <Link href="/dashboard/settings" className="text-[#e74c3c] hover:underline">
                  Settings
                </Link>.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Headline cards — latest value per signal type */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {latestEntries.map(([type, sig]) => {
          const meta = (sig.metadata ?? {}) as { delta?: number; prev_week?: number };
          const delta = typeof meta.delta === 'number' ? meta.delta : null;
          return (
            <Card key={type}>
              <CardContent className="p-4">
                <div className="text-[11px] uppercase tracking-[0.16em] text-[#5a6580] font-medium">
                  {SIGNAL_LABEL[type]}
                </div>
                <div className="mt-1.5 text-xl font-semibold text-white">
                  {formatSignalValue(sig)}
                </div>
                <div className="mt-1 text-[11px] text-[#7a88a8]">
                  {sig.period}
                  {delta !== null && (
                    <span
                      className={
                        'ml-2 inline-flex items-center ' +
                        (delta > 0 ? 'text-[#38e8c8]' : delta < 0 ? 'text-[#e87fa5]' : 'text-[#7a88a8]')
                      }
                    >
                      {delta > 0 ? '▲' : delta < 0 ? '▼' : '–'} {Math.abs(delta)}
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Timeline — reverse-chronological raw rows */}
      <Card>
        <CardContent className="p-5">
          <div className="text-sm font-semibold text-white mb-3">Timeline</div>
          <ul className="space-y-2">
            {data?.timeline.map((s, i) => (
              <li
                key={`${s.signal_type}-${s.period}-${i}`}
                className="flex items-center justify-between text-sm py-2 border-b border-white/5 last:border-b-0"
              >
                <div className="flex items-center gap-3">
                  <Activity className="w-3.5 h-3.5 text-[#5a6580]" />
                  <span className="text-[#c8d0e0]">{SIGNAL_LABEL[s.signal_type]}</span>
                  <span className="text-[11px] text-[#5a6580]">{s.period}</span>
                </div>
                <span className="text-[#9aa6c0]">{formatSignalValue(s)}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

// -----------------------------
// Actions tab — real data
// -----------------------------

function ActionsTab({ clientId }: { clientId: string }) {
  const [items, setItems] = useState<ActionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/action-items?clientId=${encodeURIComponent(clientId)}&limit=100`);
        if (!res.ok) throw new Error(`Failed to load actions (${res.status})`);
        const data: ActionItem[] = await res.json();
        if (!cancelled) setItems(data);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [clientId]);

  if (loading) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-[#7a88a8]">Loading actions…</CardContent>
      </Card>
    );
  }
  if (error) {
    return (
      <Card className="border-red-500/30 bg-red-500/5">
        <CardContent className="p-6 text-red-300">{error}</CardContent>
      </Card>
    );
  }
  if (items.length === 0) {
    return (
      <Card>
        <CardContent className="p-8">
          <div className="flex items-start gap-3">
            <Zap className="w-5 h-5 text-[#7a88a8] mt-0.5" />
            <div>
              <h3 className="text-base font-semibold text-white mb-1">No action items yet</h3>
              <p className="text-sm text-[#9aa6c0]">
                Accept proposals from the{' '}
                <Link href="/dashboard/brief" className="text-[#e74c3c] hover:underline">
                  Monday Brief
                </Link>{' '}
                to add action items here.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-0">
        <div className="divide-y divide-[#1a2340]">
          {items.map((a) => (
            <ActionRow key={a.id} action={a} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function ActionRow({ action }: { action: ActionItem }) {
  const statusInfo = {
    open: { color: 'text-[#9aa6c0]', label: 'Open', icon: Clock },
    done: { color: 'text-green-400', label: 'Done', icon: CheckCircle2 },
    overdue: { color: 'text-[#e74c3c]', label: 'Overdue', icon: AlertTriangle },
  }[action.status];
  const StatusIcon = statusInfo.icon;

  return (
    <div className="px-5 py-4 flex items-start gap-3">
      <StatusIcon className={`w-4 h-4 mt-0.5 ${statusInfo.color}`} />
      <div className="flex-1 min-w-0">
        <p className="text-sm text-white font-medium">{action.title}</p>
        {action.description && (
          <p className="text-xs text-[#7a88a8] mt-1 line-clamp-2">{action.description}</p>
        )}
        <div className="flex items-center gap-2 mt-2">
          <span className={`text-[10px] uppercase tracking-wider font-semibold ${statusInfo.color}`}>
            {statusInfo.label}
          </span>
          {action.due_date && (
            <span className="text-[10px] text-[#7a88a8]">· due {action.due_date}</span>
          )}
        </div>
      </div>
    </div>
  );
}

// -----------------------------
// Health tab — breakdown + Why? + Override (HRAI Art 14)
// -----------------------------

function HealthTab({
  clientId,
  client,
  onRefresh,
}: {
  clientId: string;
  client: Client;
  onRefresh: () => Promise<void>;
}) {
  const [whyOpen, setWhyOpen] = useState(false);
  const [overrideOpen, setOverrideOpen] = useState(false);

  const score = client.healthScore?.overall ?? null;
  const breakdown = client.healthScore?.breakdown;

  if (score === null) {
    return (
      <Card>
        <CardContent className="p-8">
          <div className="flex items-start gap-3">
            <TrendingUp className="w-5 h-5 text-[#7a88a8] mt-0.5" />
            <div>
              <h3 className="text-base font-semibold text-white mb-1">No health score yet</h3>
              <p className="text-sm text-[#9aa6c0]">
                A health score is computed once enough signal data exists for this client.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Breakdown */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-white">Score breakdown</h3>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setWhyOpen((o) => !o)}
                className="border-[#1a2540] text-[#9aa6c0] hover:text-white text-xs"
              >
                <Info className="w-3 h-3 mr-1.5" />
                {whyOpen ? 'Hide' : 'Why this score?'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setOverrideOpen(true)}
                className="border-[#1a2540] text-[#9aa6c0] hover:text-white text-xs"
              >
                <Edit3 className="w-3 h-3 mr-1.5" />
                Override
              </Button>
            </div>
          </div>
          {breakdown && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <SubScore label="Financial" score={breakdown.financial} />
              <SubScore label="Relationship" score={breakdown.relationship} />
              <SubScore label="Delivery" score={breakdown.delivery} />
              <SubScore label="Engagement" score={breakdown.engagement} />
            </div>
          )}
          {whyOpen && (
            <div className="mt-5 pt-5 border-t border-[#1a2540] text-sm text-[#9aa6c0] space-y-2">
              <p className="text-white font-medium flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#e74c3c]" />
                How this score is computed
              </p>
              <p>
                The overall score is a weighted blend of four dimensions: Financial (invoice
                timeliness, retainer changes), Relationship (sentiment, response latency),
                Delivery (on-time completion, scope changes), and Engagement (meeting cadence,
                email volume).
              </p>
              <p className="text-xs text-[#7a88a8]">
                Per the EU AI Act (Art 14 — Human Oversight), you can override this score with a
                reason. Overrides are logged for audit.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {overrideOpen && (
        <OverrideDialog
          clientId={clientId}
          currentScore={score}
          onClose={() => setOverrideOpen(false)}
          onSaved={async () => {
            setOverrideOpen(false);
            await onRefresh();
          }}
        />
      )}
    </div>
  );
}

function SubScore({ label, score }: { label: string; score: number }) {
  const color = score >= 70 ? 'text-green-400' : score >= 40 ? 'text-amber-400' : 'text-[#e74c3c]';
  return (
    <div className="bg-[#0f1420] border border-[#1a2540] rounded-md p-3">
      <div className="text-[10px] uppercase tracking-wider text-[#7a88a8] mb-1">{label}</div>
      <div className={`text-2xl font-semibold ${color}`}>{score}</div>
    </div>
  );
}

function OverrideDialog({
  clientId,
  currentScore,
  onClose,
  onSaved,
}: {
  clientId: string;
  currentScore: number;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [score, setScore] = useState<number>(currentScore);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    setSaving(true);
    try {
      const res = await fetch(`/api/clients/${clientId}/health/override`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ score, reason }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? `Failed (${res.status})`);
      }
      await onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save override');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="w-full max-w-md bg-[#0d1422] border border-[#1a2540] rounded-lg shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 border-b border-[#1a2540] flex items-start justify-between">
          <div>
            <h3 className="text-base font-semibold text-white">Override health score</h3>
            <p className="text-xs text-[#7a88a8] mt-1">HRAI Art 14 — your override is logged.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 -m-1 text-[#7a88a8] hover:text-white"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="text-xs text-[#9aa6c0] block mb-1.5">New score (0–100)</label>
            <input
              type="number"
              min={0}
              max={100}
              value={score}
              onChange={(e) => setScore(Number(e.target.value))}
              className="w-full bg-[#0f1420] border border-[#1a2540] rounded-md px-3 py-2 text-sm text-white outline-none focus:border-[#e74c3c]/50"
            />
          </div>
          <div>
            <label className="text-xs text-[#9aa6c0] block mb-1.5">Reason (5–500 chars)</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder="e.g. The model is over-weighting last month's late invoice; verbal commitment from CFO confirms continued partnership."
              className="w-full bg-[#0f1420] border border-[#1a2540] rounded-md px-3 py-2 text-sm text-white outline-none focus:border-[#e74c3c]/50 resize-none"
            />
            <p className="text-[10px] text-[#5a6580] mt-1">{reason.length} / 500</p>
          </div>
          {error && <p className="text-xs text-red-400">{error}</p>}
        </div>

        <div className="p-5 border-t border-[#1a2540] flex items-center justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            onClick={submit}
            disabled={saving || reason.trim().length < 5}
            className="bg-[#e74c3c] hover:bg-[#c0392b]"
          >
            <RotateCcw className={`w-4 h-4 mr-2 ${saving ? 'animate-spin' : ''}`} />
            {saving ? 'Saving…' : 'Save override'}
          </Button>
        </div>
      </div>
    </div>
  );
}

// -----------------------------
// Predictions / Alerts — honest empty states until step 4
// -----------------------------

function PredictionsTab() {
  return (
    <Card>
      <CardContent className="p-8">
        <div className="flex items-start gap-3">
          <TrendingDown className="w-5 h-5 text-[#7a88a8] mt-0.5" />
          <div>
            <h3 className="text-base font-semibold text-white mb-1">No predictions yet</h3>
            <p className="text-sm text-[#9aa6c0] max-w-2xl">
              Churn risk and upsell signals appear here once enough engagement data has accumulated.
              The first useful signals typically show up after ~3 weeks of meeting + email activity.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function AlertsTab() {
  return (
    <Card>
      <CardContent className="p-8">
        <div className="flex items-start gap-3">
          <Bell className="w-5 h-5 text-[#7a88a8] mt-0.5" />
          <div>
            <h3 className="text-base font-semibold text-white mb-1">No alerts yet</h3>
            <p className="text-sm text-[#9aa6c0] max-w-2xl">
              Alerts fire when health drops sharply, a deadline approaches, or a critical signal
              triggers (e.g. a payment failure or a sentiment cliff).
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

