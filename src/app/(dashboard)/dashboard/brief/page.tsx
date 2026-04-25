'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  DollarSign,
  Mail,
  Phone,
  RefreshCw,
  RotateCcw,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Wrench,
  X,
  Zap,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type {
  MondayBriefClientEntry,
  MondayBriefContent,
  MondayBriefHealthSnapshot,
  MondayBriefRecommendedAction,
} from '@/lib/agents/monday-brief-agent';

interface BriefRecord {
  id: string;
  content: MondayBriefContent;
  email_sent: boolean;
  sent_at: string | null;
  created_at: string;
}

const AI_MODEL_LABEL = 'Claude Sonnet 4.6';

const URGENCY_LABEL: Record<MondayBriefRecommendedAction['urgency'], string> = {
  high: 'HIGH',
  medium: 'MED',
  low: 'LOW',
};

const URGENCY_BORDER: Record<MondayBriefRecommendedAction['urgency'], string> = {
  high: 'border-l-[#e74c3c]',
  medium: 'border-l-amber-500',
  low: 'border-l-green-500',
};

const URGENCY_BADGE: Record<MondayBriefRecommendedAction['urgency'], string> = {
  high: 'bg-[#e74c3c]/10 text-[#e74c3c]',
  medium: 'bg-amber-500/10 text-amber-400',
  low: 'bg-green-500/10 text-green-400',
};

const TYPE_ICON: Record<MondayBriefRecommendedAction['type'], React.ReactNode> = {
  'check-in': <Phone className="w-3.5 h-3.5" />,
  escalation: <AlertTriangle className="w-3.5 h-3.5" />,
  upsell: <DollarSign className="w-3.5 h-3.5" />,
  're-engagement': <RotateCcw className="w-3.5 h-3.5" />,
  'delivery-fix': <Wrench className="w-3.5 h-3.5" />,
};

export default function BriefPage() {
  const [briefs, setBriefs] = useState<BriefRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState<'generate' | 'email' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [acceptedIds, setAcceptedIds] = useState<Set<string>>(new Set());
  const [skippedIds, setSkippedIds] = useState<Set<string>>(new Set());

  const latest = briefs[0];

  async function acceptProposal(a: {
    id: string;
    clientId: string;
    title: string;
    rationale: string;
  }) {
    setAcceptingId(a.id);
    setError(null);
    try {
      const res = await fetch('/api/action-items', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          clientId: a.clientId,
          title: a.title,
          description: a.rationale,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? `Accept failed (${res.status})`);
        return;
      }
      setAcceptedIds((s) => new Set(s).add(a.id));
    } finally {
      setAcceptingId(null);
    }
  }

  function skipProposal(id: string) {
    setSkippedIds((s) => new Set(s).add(id));
  }

  const load = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/monday-brief', { cache: 'no-store' });
      if (!res.ok) throw new Error(`Failed to load briefs (${res.status})`);
      const data: BriefRecord[] = await res.json();
      setBriefs(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const generate = async (send: boolean) => {
    try {
      setWorking(send ? 'email' : 'generate');
      setError(null);
      // HRAI Art 12 audit-log hook lands here once schema ships (target 2026-06-30)
      const res = await fetch('/api/monday-brief', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ send }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? `Request failed (${res.status})`);
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to generate');
    } finally {
      setWorking(null);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        weekOf={latest?.content.weekOf}
        working={working}
        hasBrief={!!latest}
        onEmail={() => generate(true)}
        onRegenerate={() => generate(false)}
      />

      {error && (
        <Card className="border-red-500/40 bg-red-500/5">
          <CardContent className="p-4 text-red-300">{error}</CardContent>
        </Card>
      )}

      {loading && !latest && (
        <Card>
          <CardContent className="p-12 text-center text-[#7a88a8]">Loading briefs…</CardContent>
        </Card>
      )}

      {!loading && !latest && (
        <Card>
          <CardContent className="p-12 text-center">
            <p className="text-[#7a88a8] mb-4">
              No briefs yet. Click <span className="text-white">Email me this brief</span> to create your first
              Monday Brief.
            </p>
          </CardContent>
        </Card>
      )}

      {latest && (
        <BriefView
          record={latest}
          acceptedIds={acceptedIds}
          skippedIds={skippedIds}
          acceptingId={acceptingId}
          onAccept={acceptProposal}
          onSkip={skipProposal}
        />
      )}

      {briefs.length > 1 && <BriefHistory briefs={briefs.slice(1)} />}
    </div>
  );
}

// -----------------------------
// Page header
// -----------------------------

function PageHeader({
  weekOf,
  working,
  hasBrief,
  onEmail,
  onRegenerate,
}: {
  weekOf?: string;
  working: 'generate' | 'email' | null;
  hasBrief: boolean;
  onEmail: () => void;
  onRegenerate: () => void;
}) {
  return (
    <div className="flex items-start justify-between flex-wrap gap-4">
      <div>
        <h2 className="text-3xl font-bold text-white font-playfair mb-1">Monday Brief</h2>
        <p className="text-sm text-[#7a88a8]">
          {weekOf ? `Week of ${weekOf} · delivered every Monday 8am` : 'Your weekly client health summary'}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Button
          onClick={onEmail}
          disabled={working !== null}
          className="bg-[#e74c3c] hover:bg-[#c0392b]"
        >
          <Mail className="w-4 h-4 mr-2" />
          {working === 'email' ? 'Sending…' : hasBrief ? 'Email me this brief' : 'Generate + email'}
        </Button>
        {hasBrief && (
          <Button
            variant="outline"
            size="sm"
            onClick={onRegenerate}
            disabled={working !== null}
            title="Regenerate without sending email"
          >
            <RefreshCw className={`w-4 h-4 ${working === 'generate' ? 'animate-spin' : ''}`} />
          </Button>
        )}
      </div>
    </div>
  );
}

// -----------------------------
// Brief view (assembled lanes)
// -----------------------------

interface BriefViewProps {
  record: BriefRecord;
  acceptedIds: Set<string>;
  skippedIds: Set<string>;
  acceptingId: string | null;
  onAccept: (a: { id: string; clientId: string; title: string; rationale: string }) => void;
  onSkip: (id: string) => void;
}

function BriefView({ record, acceptedIds, skippedIds, acceptingId, onAccept, onSkip }: BriefViewProps) {
  const brief = record.content;

  const visibleActions = useMemo(
    () => (brief.recommendedActions ?? []).filter((a) => !skippedIds.has(a.id)),
    [brief.recommendedActions, skippedIds],
  );

  const heroLine = useMemo(() => buildHeroLine(brief, visibleActions.length), [brief, visibleActions.length]);

  return (
    <div className="space-y-4">
      <HeroBanner heroLine={heroLine} emailedAt={record.email_sent ? record.sent_at : null} />

      <ActionsLane
        actions={visibleActions}
        acceptedIds={acceptedIds}
        acceptingId={acceptingId}
        onAccept={onAccept}
        onSkip={onSkip}
      />

      <ClientLane
        title="Needs your eyes"
        accent="#e74c3c"
        icon={<AlertTriangle className="w-4 h-4 text-[#e74c3c]" />}
        defaultOpen={brief.needsAttention.some((c) => c.status === 'critical')}
        entries={brief.needsAttention}
        emptyHint="No critical clients this week."
      />

      <ClientLane
        title="Trending down"
        accent="#f59e0b"
        icon={<TrendingDown className="w-4 h-4 text-amber-400" />}
        defaultOpen={false}
        entries={brief.trendingRisks}
        emptyHint="No worsening clients."
      />

      <ClientLane
        title="Good news"
        accent="#22c55e"
        icon={<TrendingUp className="w-4 h-4 text-green-400" />}
        defaultOpen={false}
        entries={brief.risingStars}
        emptyHint="No rising stars this week."
      />

      <SnapshotStrip snapshot={brief.snapshot} />

      <ComplianceFooter />
    </div>
  );
}

// -----------------------------
// Hero banner (one-liner)
// -----------------------------

function HeroBanner({ heroLine, emailedAt }: { heroLine: string; emailedAt: string | null }) {
  return (
    <Card className="border-[#e74c3c]/40 bg-gradient-to-r from-[#e74c3c]/5 to-transparent">
      <CardContent className="p-5 flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-start gap-3">
          <Sparkles className="w-5 h-5 text-[#e74c3c] mt-0.5 shrink-0" />
          <p className="text-white text-base leading-relaxed">{heroLine}</p>
        </div>
        {emailedAt && (
          <span className="text-xs text-green-400 inline-flex items-center gap-1 shrink-0">
            <CheckCircle2 className="w-3 h-3" />
            Emailed {new Date(emailedAt).toLocaleString()}
          </span>
        )}
      </CardContent>
    </Card>
  );
}

// -----------------------------
// Actions lane (top of page — the decisions)
// -----------------------------

interface ActionsLaneProps {
  actions: MondayBriefRecommendedAction[];
  acceptedIds: Set<string>;
  acceptingId: string | null;
  onAccept: (a: { id: string; clientId: string; title: string; rationale: string }) => void;
  onSkip: (id: string) => void;
}

function ActionsLane({ actions, acceptedIds, acceptingId, onAccept, onSkip }: ActionsLaneProps) {
  if (actions.length === 0) return null;
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-[#e74c3c]" />
            <CardTitle className="text-white text-lg">Do this week</CardTitle>
          </div>
          <span className="text-xs text-[#7a88a8] uppercase tracking-wider">
            {actions.length} action{actions.length === 1 ? '' : 's'} for your approval
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {actions.map((action) => {
          const accepted = acceptedIds.has(action.id);
          return (
            <div
              key={action.id}
              className={`p-4 border border-[#1a2540] border-l-4 ${URGENCY_BORDER[action.urgency]} rounded-lg bg-[#0f1729]`}
            >
              <div className="flex items-center gap-2 mb-2 text-xs uppercase tracking-wider">
                <span className={`px-2 py-0.5 rounded font-semibold inline-flex items-center gap-1 ${URGENCY_BADGE[action.urgency]}`}>
                  {URGENCY_LABEL[action.urgency]}
                </span>
                <span className="text-[#7a88a8] inline-flex items-center gap-1">
                  {TYPE_ICON[action.type] ?? <Zap className="w-3.5 h-3.5" />}
                  {action.type.replace('-', ' ')}
                </span>
                <span className="text-[#7a88a8]">·</span>
                <span className="text-white font-medium normal-case">{action.companyName || action.clientName}</span>
              </div>

              <p className="text-white text-sm font-medium leading-snug">{action.title}</p>
              <p className="text-xs text-[#7a88a8] mt-1.5 leading-relaxed">
                <span className="text-[#9aa6c0]">Why: </span>
                {action.rationale}
              </p>
              {action.engagementContext && (
                <p className="text-xs text-blue-400 mt-1">{action.engagementContext}</p>
              )}

              <div className="flex items-center gap-2 mt-3">
                {accepted ? (
                  <span className="text-xs text-green-400 inline-flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Added to action items
                  </span>
                ) : (
                  <>
                    <button
                      type="button"
                      disabled={acceptingId === action.id}
                      onClick={() =>
                        onAccept({
                          id: action.id,
                          clientId: action.clientId,
                          title: action.title,
                          rationale: action.rationale,
                        })
                      }
                      className="text-xs bg-[#38e8c8]/10 border border-[#38e8c8]/30 text-[#38e8c8] hover:bg-[#38e8c8]/20 px-3 py-1.5 rounded transition-colors disabled:opacity-50"
                    >
                      {acceptingId === action.id ? 'Accepting…' : 'Accept'}
                    </button>
                    <button
                      type="button"
                      onClick={() => onSkip(action.id)}
                      className="text-xs text-[#7a88a8] hover:text-white inline-flex items-center gap-1 px-2 py-1.5"
                      title="Reject this proposal (HRAI Art 14 — human oversight)"
                    >
                      <X className="w-3 h-3" />
                      Skip
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}
        <p className="text-[10px] text-[#5a6883] pt-1">
          Generated by {AI_MODEL_LABEL}. You approve before anything is sent or saved.
        </p>
      </CardContent>
    </Card>
  );
}

// -----------------------------
// Client lane (collapsible — needs eyes / trending / good news)
// -----------------------------

function ClientLane({
  title,
  accent,
  icon,
  entries,
  defaultOpen,
  emptyHint,
}: {
  title: string;
  accent: string;
  icon: React.ReactNode;
  entries: MondayBriefClientEntry[];
  defaultOpen: boolean;
  emptyHint: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const count = entries.length;

  return (
    <Card>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-2 p-4 hover:bg-[#0f1729]/40 transition-colors"
      >
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-white font-semibold text-sm">{title}</span>
          <span
            className="text-xs px-2 py-0.5 rounded-full font-semibold"
            style={{ background: `${accent}1a`, color: accent }}
          >
            {count}
          </span>
        </div>
        {open ? (
          <ChevronDown className="w-4 h-4 text-[#7a88a8]" />
        ) : (
          <ChevronRight className="w-4 h-4 text-[#7a88a8]" />
        )}
      </button>
      {open && (
        <div className="border-t border-[#1a2540]">
          {count === 0 ? (
            <p className="px-4 py-3 text-xs text-[#7a88a8] italic">{emptyHint}</p>
          ) : (
            <div className="divide-y divide-[#1a2340]">
              {entries.map((e) => (
                <ClientRow key={e.clientId} entry={e} />
              ))}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

function ClientRow({ entry }: { entry: MondayBriefClientEntry }) {
  const deltaColor =
    entry.delta === undefined || entry.delta === 0
      ? 'text-[#7a88a8]'
      : entry.delta > 0
        ? 'text-green-400'
        : 'text-[#e74c3c]';
  return (
    <Link
      href={`/dashboard/clients/${entry.clientId}`}
      className="grid grid-cols-12 gap-2 px-4 py-2.5 text-sm items-center hover:bg-[#0f1729]/40 transition-colors"
    >
      <div className="col-span-5 text-white font-medium truncate">
        {entry.companyName || entry.clientName}
      </div>
      <div className="col-span-2 text-right text-white font-semibold">{entry.overallScore}</div>
      <div className="col-span-2 text-right">
        {entry.delta !== undefined ? (
          <span className={`text-xs font-semibold ${deltaColor}`}>
            {entry.delta > 0 ? '+' : ''}
            {entry.delta}
          </span>
        ) : (
          <span className="text-xs text-[#7a88a8]">—</span>
        )}
      </div>
      <div className="col-span-3 text-xs text-[#7a88a8] truncate">{entry.topSignal ?? ''}</div>
    </Link>
  );
}

// -----------------------------
// Snapshot strip (single line, replaces the 5-card grid)
// -----------------------------

function SnapshotStrip({ snapshot }: { snapshot: MondayBriefHealthSnapshot }) {
  const delta = snapshot.weekOverWeekDelta;
  const deltaLabel =
    delta === 0 ? 'flat' : delta > 0 ? `↑ ${delta} WoW` : `↓ ${Math.abs(delta)} WoW`;
  const deltaColor = delta === 0 ? 'text-[#7a88a8]' : delta > 0 ? 'text-green-400' : 'text-[#e74c3c]';

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
          <Stat label="Clients" value={snapshot.totalClients} />
          <Stat label="Avg health" value={snapshot.averageScore} suffix={<span className={`text-xs ml-1.5 ${deltaColor}`}>{deltaLabel}</span>} />
          <Stat label="Critical" value={snapshot.critical} valueClass="text-[#e74c3c]" />
          <Stat label="At risk" value={snapshot.atRisk} valueClass="text-amber-400" />
          <Stat label="Healthy" value={snapshot.healthy} valueClass="text-green-400" />
        </div>
      </CardContent>
    </Card>
  );
}

function Stat({
  label,
  value,
  valueClass = 'text-white',
  suffix,
}: {
  label: string;
  value: number;
  valueClass?: string;
  suffix?: React.ReactNode;
}) {
  return (
    <div className="inline-flex items-baseline gap-2">
      <span className="text-xs text-[#7a88a8] uppercase tracking-wider">{label}</span>
      <span className={`text-base font-semibold ${valueClass}`}>{value}</span>
      {suffix}
    </div>
  );
}

// -----------------------------
// Compliance footer (HRAI Art 50 + Art 13 surfaces)
// -----------------------------

function ComplianceFooter() {
  return (
    <p className="text-[11px] text-[#5a6883] flex flex-wrap items-center gap-x-3 gap-y-1 px-1">
      <span>
        <Sparkles className="w-3 h-3 inline-block mr-1 -mt-0.5" />
        Generated by {AI_MODEL_LABEL}
      </span>
      <span className="text-[#3a4868]">·</span>
      <Link href="/model-card" className="hover:text-[#9aa6c0] underline-offset-2 hover:underline">
        How accurate is this brief?
      </Link>
    </p>
  );
}

// -----------------------------
// Brief history (collapsed at the bottom)
// -----------------------------

function BriefHistory({ briefs }: { briefs: BriefRecord[] }) {
  const [open, setOpen] = useState(false);
  return (
    <Card>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-2 p-4 hover:bg-[#0f1729]/40 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-white font-semibold text-sm">Brief history</span>
          <span className="text-xs text-[#7a88a8]">({briefs.length} previous)</span>
        </div>
        {open ? (
          <ChevronDown className="w-4 h-4 text-[#7a88a8]" />
        ) : (
          <ChevronRight className="w-4 h-4 text-[#7a88a8]" />
        )}
      </button>
      {open && (
        <CardContent className="pt-0">
          <div className="divide-y divide-[#1a2340]">
            {briefs.map((b) => (
              <div key={b.id} className="py-3 flex items-center justify-between">
                <div>
                  <div className="text-white text-sm font-medium">Week of {b.content.weekOf}</div>
                  <div className="text-xs text-[#7a88a8]">
                    {new Date(b.created_at).toLocaleString()} · {b.content.snapshot.totalClients} clients · avg{' '}
                    {b.content.snapshot.averageScore}
                  </div>
                </div>
                {b.email_sent && (
                  <span className="text-xs text-green-400 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> emailed
                  </span>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      )}
    </Card>
  );
}

// -----------------------------
// Helpers
// -----------------------------

function buildHeroLine(brief: MondayBriefContent, visibleActionCount: number): string {
  const parts: string[] = [];
  const critical = brief.snapshot.critical;
  const trending = brief.trendingRisks.length;
  const rising = brief.risingStars.length;

  if (critical > 0) {
    const lead = brief.needsAttention[0];
    if (lead) {
      parts.push(`${lead.companyName || lead.clientName} is critical`);
      if (critical > 1) parts.push(`${critical - 1} other${critical - 1 === 1 ? '' : 's'} need eyes`);
    } else {
      parts.push(`${critical} client${critical === 1 ? '' : 's'} critical`);
    }
  }
  if (trending > 0) parts.push(`${trending} trending down`);
  if (visibleActionCount > 0) parts.push(`${visibleActionCount} action${visibleActionCount === 1 ? '' : 's'} ready`);
  if (parts.length === 0 && rising > 0) parts.push(`${rising} client${rising === 1 ? '' : 's'} trending up`);
  if (parts.length === 0) parts.push('All clients healthy this week');

  return parts.join(' · ');
}
