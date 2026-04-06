'use client';

import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  Mail,
  RefreshCw,
  TrendingUp,
} from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { MondayBriefContent } from '@/lib/agents/monday-brief-agent';

interface BriefRecord {
  id: string;
  content: MondayBriefContent;
  email_sent: boolean;
  sent_at: string | null;
  created_at: string;
}

export default function BriefPage() {
  const [briefs, setBriefs] = useState<BriefRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const latest = briefs[0];

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
      if (send) setSending(true);
      else setGenerating(true);
      setError(null);
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
      setGenerating(false);
      setSending(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-3xl font-bold text-white font-playfair mb-2">
            Monday Brief
          </h2>
          <p className="text-[#7a88a8]">
            Your weekly client health summary, delivered every Monday 8am
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => generate(false)}
            disabled={generating || sending}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${generating ? 'animate-spin' : ''}`} />
            {generating ? 'Generating…' : 'Generate now'}
          </Button>
          <Button
            onClick={() => generate(true)}
            disabled={generating || sending}
            className="bg-[#e74c3c] hover:bg-[#c0392b]"
          >
            <Mail className="w-4 h-4 mr-2" />
            {sending ? 'Sending…' : 'Generate + email'}
          </Button>
        </div>
      </div>

      {error && (
        <Card className="border-red-500/40 bg-red-500/5">
          <CardContent className="p-4 text-red-300">{error}</CardContent>
        </Card>
      )}

      {loading && !latest ? (
        <Card>
          <CardContent className="p-12 text-center text-[#7a88a8]">
            Loading briefs…
          </CardContent>
        </Card>
      ) : !latest ? (
        <Card>
          <CardContent className="p-12 text-center">
            <p className="text-[#7a88a8] mb-4">
              No briefs yet. Click <span className="text-white">Generate now</span> to create your first Monday Brief.
            </p>
          </CardContent>
        </Card>
      ) : (
        <BriefPreview record={latest} />
      )}

      {/* History */}
      {briefs.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-white">Brief history</CardTitle>
            <CardDescription>Last {briefs.length - 1} previous briefs</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="divide-y divide-[#1a2340]">
              {briefs.slice(1).map((b) => (
                <div key={b.id} className="py-3 flex items-center justify-between">
                  <div>
                    <div className="text-white text-sm font-medium">
                      Week of {b.content.weekOf}
                    </div>
                    <div className="text-xs text-[#7a88a8]">
                      {new Date(b.created_at).toLocaleString()} ·{' '}
                      {b.content.snapshot.totalClients} clients · avg {b.content.snapshot.averageScore}
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
        </Card>
      )}
    </div>
  );
}

function BriefPreview({ record }: { record: BriefRecord }) {
  const brief = record.content;
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between flex-wrap gap-2">
          <div>
            <CardDescription className="text-[#e74c3c] font-semibold uppercase tracking-wider text-xs">
              Monday Brief · Week of {brief.weekOf}
            </CardDescription>
            <CardTitle className="text-white text-2xl mt-1">
              {brief.narrative.headline}
            </CardTitle>
          </div>
          {record.email_sent && record.sent_at && (
            <span className="text-xs text-green-400 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" />
              Emailed {new Date(record.sent_at).toLocaleString()}
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Snapshot stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Stat label="Clients" value={`${brief.snapshot.totalClients}`} />
          <Stat
            label="Avg health"
            value={`${brief.snapshot.averageScore}`}
            color="#e74c3c"
            delta={brief.snapshot.weekOverWeekDelta}
          />
          <Stat label="Healthy" value={`${brief.snapshot.healthy}`} color="#22c55e" />
          <Stat label="At risk" value={`${brief.snapshot.atRisk}`} color="#f59e0b" />
          <Stat label="Critical" value={`${brief.snapshot.critical}`} color="#e74c3c" />
        </div>

        {/* Narrative */}
        <div className="space-y-2">
          <p className="text-white leading-relaxed">{brief.narrative.summary}</p>
          <p className="text-[#7a88a8] italic leading-relaxed">
            {brief.narrative.recommendation}
          </p>
        </div>

        {brief.needsAttention.length > 0 && (
          <BriefSection
            title="Needs attention"
            icon={<AlertTriangle className="w-4 h-4 text-[#e74c3c]" />}
            entries={brief.needsAttention}
          />
        )}
        {brief.trendingRisks.length > 0 && (
          <BriefSection
            title="Trending risks"
            icon={<ArrowDown className="w-4 h-4 text-[#e74c3c]" />}
            entries={brief.trendingRisks}
          />
        )}
        {brief.risingStars.length > 0 && (
          <BriefSection
            title="Rising stars"
            icon={<TrendingUp className="w-4 h-4 text-green-400" />}
            entries={brief.risingStars}
          />
        )}
        {brief.topActionItems.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-white mb-2">
              Action items due this week
            </h4>
            <ul className="space-y-1.5">
              {brief.topActionItems.map((a) => (
                <li key={a.id} className="text-sm text-[#c7d0e3]">
                  <span className="text-white font-medium">{a.title}</span>
                  <span className="text-[#7a88a8]"> — {a.clientName}</span>
                  {a.dueDate && (
                    <span className="text-[#7a88a8]"> · due {a.dueDate}</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Stat({
  label,
  value,
  color = '#ffffff',
  delta,
}: {
  label: string;
  value: string;
  color?: string;
  delta?: number;
}) {
  return (
    <div className="bg-[#0f1729] rounded-lg p-3 border border-[#1a2340]">
      <div className="text-[10px] uppercase tracking-wider text-[#7a88a8] font-semibold">
        {label}
      </div>
      <div className="text-2xl font-bold mt-1" style={{ color }}>
        {value}
      </div>
      {delta !== undefined && delta !== 0 && (
        <div
          className={`text-xs mt-1 flex items-center gap-1 ${delta > 0 ? 'text-green-400' : 'text-[#e74c3c]'}`}
        >
          {delta > 0 ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
          {delta > 0 ? '+' : ''}
          {delta} WoW
        </div>
      )}
    </div>
  );
}

function BriefSection({
  title,
  icon,
  entries,
}: {
  title: string;
  icon: React.ReactNode;
  entries: MondayBriefContent['needsAttention'];
}) {
  return (
    <div>
      <h4 className="text-sm font-semibold text-white mb-2 flex items-center gap-2">
        {icon}
        {title}
      </h4>
      <div className="divide-y divide-[#1a2340] border border-[#1a2340] rounded-lg overflow-hidden">
        {entries.map((e) => (
          <div
            key={e.clientId}
            className="grid grid-cols-12 gap-2 px-3 py-2 text-sm items-center"
          >
            <div className="col-span-5 text-white font-medium truncate">
              {e.companyName || e.clientName}
            </div>
            <div className="col-span-2 text-right text-white font-semibold">
              {e.overallScore}
            </div>
            <div className="col-span-2 text-right">
              {e.delta !== undefined ? (
                <span
                  className={`text-xs font-semibold ${e.delta > 0 ? 'text-green-400' : e.delta < 0 ? 'text-[#e74c3c]' : 'text-[#7a88a8]'}`}
                >
                  {e.delta > 0 ? '+' : ''}
                  {e.delta}
                </span>
              ) : (
                <span className="text-xs text-[#7a88a8]">—</span>
              )}
            </div>
            <div className="col-span-3 text-xs text-[#7a88a8] truncate">
              {e.topSignal ?? ''}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
