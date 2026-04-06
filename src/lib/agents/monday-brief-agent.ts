/**
 * Monday Brief Agent
 *
 * Composes a weekly "Monday Brief" for an agency summarizing:
 *  - Portfolio health snapshot (healthy / at-risk / critical counts)
 *  - Clients requiring attention this week
 *  - Trending risks (health score drops)
 *  - Top action items due this week
 *  - Positive highlights (clients on the rise)
 *
 * The agent is data-first: it builds a structured brief from DB queries.
 * Optionally, a Claude pass can polish the narrative sections.
 */

import { SupabaseClient } from '@supabase/supabase-js';

// -----------------------------
// Public types
// -----------------------------

export interface MondayBriefHealthSnapshot {
  totalClients: number;
  healthy: number;
  atRisk: number;
  critical: number;
  averageScore: number;
  weekOverWeekDelta: number; // avg score delta vs ~7 days ago
}

export interface MondayBriefClientEntry {
  clientId: string;
  clientName: string;
  companyName: string;
  overallScore: number;
  previousScore?: number;
  delta?: number;
  status: 'healthy' | 'at-risk' | 'critical';
  topSignal?: string;
}

export interface MondayBriefActionItem {
  id: string;
  title: string;
  clientId: string;
  clientName: string;
  dueDate?: string;
  status: string;
}

export interface MondayBriefContent {
  generatedAt: string;
  weekOf: string; // YYYY-MM-DD (Monday)
  snapshot: MondayBriefHealthSnapshot;
  needsAttention: MondayBriefClientEntry[];
  trendingRisks: MondayBriefClientEntry[];
  risingStars: MondayBriefClientEntry[];
  topActionItems: MondayBriefActionItem[];
  narrative: {
    headline: string;
    summary: string;
    recommendation: string;
  };
}

// -----------------------------
// Agent
// -----------------------------

export class MondayBriefAgent {
  constructor(private readonly supabase: SupabaseClient) {}

  async generate(agencyId: string): Promise<MondayBriefContent> {
    const now = new Date();
    const weekOf = this.getMostRecentMonday(now).toISOString().slice(0, 10);

    // 1. Clients for this agency
    const { data: clientsRaw, error: clientsErr } = await this.supabase
      .from('clients')
      .select('id, name, company_name, status')
      .eq('agency_id', agencyId);

    if (clientsErr) throw new Error(`Failed to load clients: ${clientsErr.message}`);
    const clients = clientsRaw ?? [];
    const clientIds = clients.map((c) => c.id as string);
    const clientById = new Map<string, { name: string; company: string }>();
    for (const c of clients) {
      clientById.set(c.id as string, {
        name: c.name as string,
        company: (c.company_name as string) ?? '',
      });
    }

    // 2. Current health scores
    const { data: currentHealth } = clientIds.length
      ? await this.supabase
          .from('client_health_scores')
          .select('client_id, overall_score, signals, computed_at')
          .in('client_id', clientIds)
      : { data: [] as Array<Record<string, unknown>> };

    // 3. Last week health scores (overall history rows ~7 days ago)
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data: historyRows } = clientIds.length
      ? await this.supabase
          .from('health_score_history')
          .select('client_id, score, score_type, recorded_at')
          .in('client_id', clientIds)
          .eq('score_type', 'overall')
          .lte('recorded_at', weekAgo)
          .order('recorded_at', { ascending: false })
      : { data: [] as Array<Record<string, unknown>> };

    const previousByClient = new Map<string, number>();
    for (const row of historyRows ?? []) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const r = row as any;
      if (!previousByClient.has(r.client_id as string)) {
        previousByClient.set(r.client_id as string, r.score as number);
      }
    }

    // 4. Build client entries from current health
    const entries: MondayBriefClientEntry[] = [];
    for (const row of currentHealth ?? []) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const r = row as any;
      const meta = clientById.get(r.client_id as string);
      if (!meta) continue;
      const overall = (r.overall_score as number) ?? 0;
      const previous = previousByClient.get(r.client_id as string);
      const delta = previous !== undefined ? overall - previous : undefined;

      // Extract top signal (highest severity)
      const signals = (r.signals as Array<{ severity?: string; message?: string }>) ?? [];
      const severityRank: Record<string, number> = { high: 3, medium: 2, low: 1, positive: 0 };
      const sorted = [...signals].sort(
        (a, b) => (severityRank[b.severity ?? ''] ?? -1) - (severityRank[a.severity ?? ''] ?? -1)
      );
      const topSignal: string | undefined = sorted[0]?.message;

      entries.push({
        clientId: r.client_id as string,
        clientName: meta.name,
        companyName: meta.company,
        overallScore: overall,
        previousScore: previous,
        delta,
        status: overall >= 70 ? 'healthy' : overall >= 40 ? 'at-risk' : 'critical',
        topSignal,
      });
    }

    // 5. Snapshot aggregates
    const totalClients = clients.length;
    const healthy = entries.filter((e) => e.status === 'healthy').length;
    const atRisk = entries.filter((e) => e.status === 'at-risk').length;
    const critical = entries.filter((e) => e.status === 'critical').length;
    const averageScore =
      entries.length > 0
        ? Math.round(entries.reduce((a, b) => a + b.overallScore, 0) / entries.length)
        : 0;

    const previousAvg =
      previousByClient.size > 0
        ? Math.round(
            Array.from(previousByClient.values()).reduce((a, b) => a + b, 0) /
              previousByClient.size
          )
        : averageScore;
    const weekOverWeekDelta = averageScore - previousAvg;

    // 6. Needs attention: critical + at-risk, worst first
    const needsAttention = [...entries]
      .filter((e) => e.status !== 'healthy')
      .sort((a, b) => a.overallScore - b.overallScore)
      .slice(0, 5);

    // 7. Trending risks: biggest negative deltas
    const trendingRisks = [...entries]
      .filter((e) => e.delta !== undefined && e.delta < -5)
      .sort((a, b) => (a.delta ?? 0) - (b.delta ?? 0))
      .slice(0, 5);

    // 8. Rising stars: biggest positive deltas
    const risingStars = [...entries]
      .filter((e) => e.delta !== undefined && e.delta > 5)
      .sort((a, b) => (b.delta ?? 0) - (a.delta ?? 0))
      .slice(0, 3);

    // 9. Top action items due this week
    const weekEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const { data: actionRows } = clientIds.length
      ? await this.supabase
          .from('action_items')
          .select('id, title, client_id, status, due_date')
          .in('client_id', clientIds)
          .in('status', ['open', 'overdue'])
          .lte('due_date', weekEnd)
          .order('due_date', { ascending: true, nullsFirst: false })
          .limit(10)
      : { data: [] as Array<Record<string, unknown>> };

    const topActionItems: MondayBriefActionItem[] = (actionRows ?? []).map((row) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const r = row as any;
      const meta = clientById.get(r.client_id as string);
      return {
        id: r.id as string,
        title: r.title as string,
        clientId: r.client_id as string,
        clientName: meta?.name ?? 'Unknown client',
        dueDate: (r.due_date as string) ?? undefined,
        status: r.status as string,
      };
    });

    // 10. Narrative
    const narrative = this.buildNarrative({
      totalClients,
      healthy,
      atRisk,
      critical,
      averageScore,
      weekOverWeekDelta,
      needsAttention,
      trendingRisks,
      risingStars,
      topActionItemsCount: topActionItems.length,
    });

    return {
      generatedAt: now.toISOString(),
      weekOf,
      snapshot: {
        totalClients,
        healthy,
        atRisk,
        critical,
        averageScore,
        weekOverWeekDelta,
      },
      needsAttention,
      trendingRisks,
      risingStars,
      topActionItems,
      narrative,
    };
  }

  // -----------------------------
  // Helpers
  // -----------------------------

  private getMostRecentMonday(date: Date): Date {
    const d = new Date(date);
    const day = d.getDay(); // 0 Sun .. 6 Sat
    const diff = (day + 6) % 7; // days since Monday
    d.setDate(d.getDate() - diff);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  private buildNarrative(ctx: {
    totalClients: number;
    healthy: number;
    atRisk: number;
    critical: number;
    averageScore: number;
    weekOverWeekDelta: number;
    needsAttention: MondayBriefClientEntry[];
    trendingRisks: MondayBriefClientEntry[];
    risingStars: MondayBriefClientEntry[];
    topActionItemsCount: number;
  }): { headline: string; summary: string; recommendation: string } {
    const deltaLabel =
      ctx.weekOverWeekDelta > 0
        ? `up ${ctx.weekOverWeekDelta} pts`
        : ctx.weekOverWeekDelta < 0
          ? `down ${Math.abs(ctx.weekOverWeekDelta)} pts`
          : 'flat';

    const headline =
      ctx.critical > 0
        ? `${ctx.critical} client${ctx.critical > 1 ? 's' : ''} in critical — act today`
        : ctx.atRisk > 0
          ? `${ctx.atRisk} at-risk client${ctx.atRisk > 1 ? 's' : ''} this week`
          : ctx.totalClients === 0
            ? 'No clients yet — add your first client to start tracking health'
            : 'Portfolio is healthy — keep the momentum';

    const summary = [
      `${ctx.totalClients} active clients tracked.`,
      `Avg health ${ctx.averageScore}/100 (${deltaLabel} WoW).`,
      `${ctx.healthy} healthy · ${ctx.atRisk} at-risk · ${ctx.critical} critical.`,
      ctx.trendingRisks.length > 0
        ? `${ctx.trendingRisks.length} client${ctx.trendingRisks.length > 1 ? 's' : ''} trending down this week.`
        : 'No sharp declines this week.',
      ctx.risingStars.length > 0
        ? `${ctx.risingStars.length} client${ctx.risingStars.length > 1 ? 's' : ''} improving.`
        : '',
      ctx.topActionItemsCount > 0
        ? `${ctx.topActionItemsCount} action item${ctx.topActionItemsCount > 1 ? 's' : ''} due this week.`
        : '',
    ]
      .filter(Boolean)
      .join(' ');

    const recommendation =
      ctx.critical > 0
        ? `Focus block on ${ctx.needsAttention[0]?.companyName ?? 'critical clients'} first thing today. Review financial + relationship signals and schedule a direct check-in.`
        : ctx.atRisk > 0
          ? `Schedule check-ins with the ${ctx.atRisk} at-risk account${ctx.atRisk > 1 ? 's' : ''} this week. Start with ${ctx.needsAttention[0]?.companyName ?? 'the lowest-scoring account'}.`
          : ctx.risingStars.length > 0
            ? `Portfolio is strong. Consider upsell conversations with your rising accounts.`
            : `Maintain cadence. Keep weekly check-ins on the calendar.`;

    return { headline, summary, recommendation };
  }
}

// -----------------------------
// Email rendering
// -----------------------------

export function renderBriefEmailHtml(brief: MondayBriefContent, agencyName?: string): string {
  const accent = '#e74c3c';
  const muted = '#6b7280';
  const bg = '#f8fafc';
  const card = '#ffffff';
  const text = '#0f172a';

  const deltaColor = (d?: number) =>
    d === undefined ? muted : d > 0 ? '#16a34a' : d < 0 ? accent : muted;

  const deltaLabel = (d?: number) =>
    d === undefined ? '—' : d > 0 ? `+${d}` : `${d}`;

  const clientRow = (e: MondayBriefClientEntry) => `
    <tr>
      <td style="padding:10px 12px;border-bottom:1px solid #eef2f7;color:${text};font-weight:500;">${escapeHtml(e.companyName || e.clientName)}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #eef2f7;color:${text};text-align:right;font-weight:600;">${e.overallScore}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #eef2f7;color:${deltaColor(e.delta)};text-align:right;font-weight:600;">${deltaLabel(e.delta)}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #eef2f7;color:${muted};font-size:13px;">${escapeHtml(e.topSignal ?? '')}</td>
    </tr>
  `;

  const section = (title: string, rows: MondayBriefClientEntry[]) =>
    rows.length === 0
      ? ''
      : `
    <h3 style="margin:24px 0 8px 0;color:${text};font-size:15px;">${title}</h3>
    <table cellspacing="0" cellpadding="0" width="100%" style="background:${card};border:1px solid #eef2f7;border-radius:8px;overflow:hidden;">
      <thead>
        <tr style="background:#f1f5f9;">
          <th align="left" style="padding:8px 12px;font-size:12px;color:${muted};font-weight:600;text-transform:uppercase;">Client</th>
          <th align="right" style="padding:8px 12px;font-size:12px;color:${muted};font-weight:600;text-transform:uppercase;">Score</th>
          <th align="right" style="padding:8px 12px;font-size:12px;color:${muted};font-weight:600;text-transform:uppercase;">Δ WoW</th>
          <th align="left" style="padding:8px 12px;font-size:12px;color:${muted};font-weight:600;text-transform:uppercase;">Signal</th>
        </tr>
      </thead>
      <tbody>${rows.map(clientRow).join('')}</tbody>
    </table>
  `;

  const actionItemsList = brief.topActionItems.length === 0
    ? ''
    : `
    <h3 style="margin:24px 0 8px 0;color:${text};font-size:15px;">Action items due this week</h3>
    <ul style="margin:0;padding-left:18px;color:${text};">
      ${brief.topActionItems
        .map(
          (a) =>
            `<li style="margin:6px 0;"><strong>${escapeHtml(a.title)}</strong> <span style="color:${muted};">— ${escapeHtml(a.clientName)}${a.dueDate ? ` · due ${a.dueDate}` : ''}</span></li>`
        )
        .join('')}
    </ul>
  `;

  return `<!doctype html>
<html>
<body style="margin:0;padding:0;background:${bg};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:${text};">
  <div style="max-width:640px;margin:0 auto;padding:32px 20px;">
    <div style="border-top:4px solid ${accent};background:${card};border-radius:12px;padding:28px;box-shadow:0 1px 3px rgba(0,0,0,0.04);">
      <div style="color:${accent};font-weight:700;font-size:12px;letter-spacing:0.1em;text-transform:uppercase;">Monday Brief · Week of ${brief.weekOf}</div>
      <h1 style="margin:8px 0 4px 0;font-size:24px;color:${text};">${escapeHtml(brief.narrative.headline)}</h1>
      ${agencyName ? `<div style="color:${muted};font-size:14px;">${escapeHtml(agencyName)}</div>` : ''}

      <table cellspacing="0" cellpadding="0" width="100%" style="margin:20px 0;">
        <tr>
          ${statCell('Clients', `${brief.snapshot.totalClients}`, muted, text)}
          ${statCell('Avg health', `${brief.snapshot.averageScore}`, muted, accent)}
          ${statCell('Healthy', `${brief.snapshot.healthy}`, muted, '#16a34a')}
          ${statCell('At-risk', `${brief.snapshot.atRisk}`, muted, '#f59e0b')}
          ${statCell('Critical', `${brief.snapshot.critical}`, muted, accent)}
        </tr>
      </table>

      <p style="color:${text};line-height:1.5;margin:0 0 8px 0;">${escapeHtml(brief.narrative.summary)}</p>
      <p style="color:${muted};line-height:1.5;margin:0 0 8px 0;font-style:italic;">${escapeHtml(brief.narrative.recommendation)}</p>

      ${section('Needs attention', brief.needsAttention)}
      ${section('Trending risks', brief.trendingRisks)}
      ${section('Rising stars', brief.risingStars)}
      ${actionItemsList}

      <div style="margin-top:28px;padding-top:16px;border-top:1px solid #eef2f7;color:${muted};font-size:12px;">
        Generated by ClientPulse · <a href="https://clientpulse.helloaurora.ai" style="color:${accent};text-decoration:none;">Open dashboard</a>
      </div>
    </div>
  </div>
</body>
</html>`;
}

function statCell(label: string, value: string, muted: string, color: string): string {
  return `<td align="center" style="padding:12px;background:#f8fafc;border-radius:8px;">
    <div style="font-size:11px;color:${muted};text-transform:uppercase;letter-spacing:0.06em;">${label}</div>
    <div style="font-size:20px;font-weight:700;color:${color};margin-top:4px;">${value}</div>
  </td>`;
}

function escapeHtml(s: string): string {
  return (s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
