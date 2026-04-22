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

export interface MondayBriefRecommendedAction {
  id: string;
  type: 'check-in' | 'escalation' | 'upsell' | 're-engagement' | 'delivery-fix';
  clientId: string;
  clientName: string;
  companyName: string;
  title: string;
  rationale: string;
  urgency: 'high' | 'medium' | 'low';
  engagementContext?: string; // e.g. "No meetings in 23 days, email volume down 40%"
}

export interface MondayBriefEngagementInsight {
  clientId: string;
  clientName: string;
  companyName: string;
  overallEngagement: number;
  meetingFrequencyTrend?: string;
  lastMeetingDaysAgo?: number;
  emailVolumeTrend?: string;
  insight: string;
}

export interface MondayBriefContent {
  generatedAt: string;
  weekOf: string; // YYYY-MM-DD (Monday)
  snapshot: MondayBriefHealthSnapshot;
  needsAttention: MondayBriefClientEntry[];
  trendingRisks: MondayBriefClientEntry[];
  risingStars: MondayBriefClientEntry[];
  topActionItems: MondayBriefActionItem[];
  recommendedActions: MondayBriefRecommendedAction[];
  engagementInsights: MondayBriefEngagementInsight[];
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

    // 10. Engagement insights (Sprint 5 — Communication Intelligence)
    const { data: engagementRows } = clientIds.length
      ? await this.supabase
          .from('engagement_metrics')
          .select('client_id, overall_engagement_score, meeting_frequency_trend, last_meeting_days_ago, email_volume_trend, calendar_score, email_score')
          .eq('agency_id', agencyId)
          .in('client_id', clientIds)
      : { data: [] as Array<Record<string, unknown>> };

    const engagementByClient = new Map<string, Record<string, unknown>>();
    for (const row of engagementRows ?? []) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const r = row as any;
      engagementByClient.set(r.client_id as string, r);
    }

    const engagementInsights: MondayBriefEngagementInsight[] = [];
    for (const [clientId, eng] of Array.from(engagementByClient.entries())) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const e = eng as any;
      const meta = clientById.get(clientId);
      if (!meta) continue;
      const score = (e.overall_engagement_score as number) ?? 0;
      const trend = (e.meeting_frequency_trend as string) ?? 'stable';
      const lastDays = (e.last_meeting_days_ago as number) ?? undefined;
      const emailTrend = (e.email_volume_trend as string) ?? 'stable';

      let insight = '';
      if (score < 40) {
        insight = 'Low engagement across all channels — risk of going dark';
      } else if (score < 60) {
        insight = trend === 'declining'
          ? 'Meeting cadence declining, needs re-engagement'
          : emailTrend === 'declining'
            ? 'Email communication thinning out'
            : 'Moderate engagement — could improve';
      } else if (score >= 70) {
        insight = 'Strong multi-channel engagement';
      } else {
        insight = 'Engagement within normal range';
      }

      engagementInsights.push({
        clientId,
        clientName: meta.name,
        companyName: meta.company,
        overallEngagement: score,
        meetingFrequencyTrend: trend,
        lastMeetingDaysAgo: lastDays,
        emailVolumeTrend: emailTrend,
        insight,
      });
    }
    // Sort: lowest engagement first
    engagementInsights.sort((a, b) => a.overallEngagement - b.overallEngagement);

    // 11. Recommended Actions (3 actions for your approval)
    const recommendedActions = this.generateRecommendedActions(
      entries,
      engagementByClient,
      clientById,
      topActionItems
    );

    // 12. Narrative
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
      recommendedActionsCount: recommendedActions.length,
      topRecommendedAction: recommendedActions[0],
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
      recommendedActions,
      engagementInsights: engagementInsights.slice(0, 5),
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

  private generateRecommendedActions(
    entries: MondayBriefClientEntry[],
    engagementByClient: Map<string, Record<string, unknown>>,
    _clientById: Map<string, { name: string; company: string }>,
    _actionItems: MondayBriefActionItem[]
  ): MondayBriefRecommendedAction[] {
    const actions: MondayBriefRecommendedAction[] = [];
    let actionId = 0;

    // Priority 1: Critical clients → escalation or check-in
    const criticals = entries.filter((e) => e.status === 'critical').sort((a, b) => a.overallScore - b.overallScore);
    for (const client of criticals.slice(0, 1)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const eng = engagementByClient.get(client.clientId) as any;
      const lastDays = eng?.last_meeting_days_ago as number | undefined;
      const engagementContext = lastDays !== undefined && lastDays > 14
        ? `No meetings in ${lastDays} days`
        : eng?.email_volume_trend === 'declining'
          ? 'Email volume declining'
          : undefined;

      actions.push({
        id: `ra-${++actionId}`,
        type: 'escalation',
        clientId: client.clientId,
        clientName: client.clientName,
        companyName: client.companyName,
        title: `Schedule urgent check-in with ${client.companyName || client.clientName}`,
        rationale: `Health score at ${client.overallScore}/100${client.delta !== undefined ? ` (${client.delta > 0 ? '+' : ''}${client.delta} WoW)` : ''}. ${client.topSignal || 'Multiple risk signals detected.'}`,
        urgency: 'high',
        engagementContext,
      });
    }

    // Priority 2: Clients with declining engagement → re-engagement
    const decliningEngagement = entries
      .filter((e) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const eng = engagementByClient.get(e.clientId) as any;
        if (!eng) return false;
        const score = (eng.overall_engagement_score as number) ?? 100;
        return score < 50 && e.status !== 'critical';
      })
      .sort((a, b) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const engA = engagementByClient.get(a.clientId) as any;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const engB = engagementByClient.get(b.clientId) as any;
        return ((engA?.overall_engagement_score as number) ?? 100) - ((engB?.overall_engagement_score as number) ?? 100);
      });

    for (const client of decliningEngagement.slice(0, 1)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const eng = engagementByClient.get(client.clientId) as any;
      const lastDays = eng?.last_meeting_days_ago as number | undefined;
      const emailTrend = eng?.email_volume_trend as string | undefined;
      const parts: string[] = [];
      if (lastDays !== undefined && lastDays > 14) parts.push(`last meeting ${lastDays}d ago`);
      if (emailTrend === 'declining') parts.push('email volume declining');
      const engagementContext = parts.length > 0 ? parts.join(', ') : undefined;

      actions.push({
        id: `ra-${++actionId}`,
        type: 're-engagement',
        clientId: client.clientId,
        clientName: client.clientName,
        companyName: client.companyName,
        title: `Re-engage ${client.companyName || client.clientName} — going quiet`,
        rationale: `Engagement score at ${eng?.overall_engagement_score ?? '?'}/100. Communication gaps detected across channels.`,
        urgency: 'medium',
        engagementContext,
      });
    }

    // Priority 3: Rising stars → upsell opportunity
    const risers = entries
      .filter((e) => e.status === 'healthy' && e.delta !== undefined && e.delta > 5)
      .sort((a, b) => (b.delta ?? 0) - (a.delta ?? 0));

    for (const client of risers.slice(0, 1)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const eng = engagementByClient.get(client.clientId) as any;
      const engScore = eng?.overall_engagement_score as number | undefined;
      const engagementContext = engScore !== undefined && engScore >= 70
        ? 'Strong engagement across calendar + email'
        : undefined;

      actions.push({
        id: `ra-${++actionId}`,
        type: 'upsell',
        clientId: client.clientId,
        clientName: client.clientName,
        companyName: client.companyName,
        title: `Propose expansion to ${client.companyName || client.clientName}`,
        rationale: `Health trending up +${client.delta} WoW to ${client.overallScore}/100. Good time for a growth conversation.`,
        urgency: 'low',
        engagementContext,
      });
    }

    // Priority 4: At-risk with overdue action items → delivery fix
    if (actions.length < 3) {
      const atRiskClients = entries
        .filter((e) => e.status === 'at-risk')
        .sort((a, b) => a.overallScore - b.overallScore);

      for (const client of atRiskClients) {
        if (actions.length >= 3) break;
        if (actions.some((a) => a.clientId === client.clientId)) continue;

        actions.push({
          id: `ra-${++actionId}`,
          type: 'check-in',
          clientId: client.clientId,
          clientName: client.clientName,
          companyName: client.companyName,
          title: `Review and address concerns with ${client.companyName || client.clientName}`,
          rationale: `At-risk with score ${client.overallScore}/100. ${client.topSignal || 'Review signals and schedule a touchpoint.'}`,
          urgency: 'medium',
        });
      }
    }

    return actions.slice(0, 3);
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
    recommendedActionsCount: number;
    topRecommendedAction?: MondayBriefRecommendedAction;
  }): { headline: string; summary: string; recommendation: string } {
    const deltaLabel =
      ctx.weekOverWeekDelta > 0
        ? `up ${ctx.weekOverWeekDelta} pts`
        : ctx.weekOverWeekDelta < 0
          ? `down ${Math.abs(ctx.weekOverWeekDelta)} pts`
          : 'flat';

    // Sprint 8A: the brief is a decision surface — lead with state +
    // a proposal count when available. Critical state still takes
    // headline precedence over proposal-count-only framing.
    const proposalTail =
      ctx.recommendedActionsCount > 0
        ? ` · ${ctx.recommendedActionsCount} proposal${ctx.recommendedActionsCount > 1 ? 's' : ''} ready`
        : '';
    const headline =
      ctx.critical > 0
        ? `${ctx.critical} client${ctx.critical > 1 ? 's' : ''} in critical — act today${proposalTail}`
        : ctx.atRisk > 0
          ? `${ctx.atRisk} at-risk client${ctx.atRisk > 1 ? 's' : ''} this week${proposalTail}`
          : ctx.recommendedActionsCount > 0
            ? `${ctx.recommendedActionsCount} proposal${ctx.recommendedActionsCount > 1 ? 's' : ''} ready for your review`
            : ctx.totalClients === 0
              ? 'No clients yet — add your first client to start tracking health'
              : 'Portfolio is healthy — keep the momentum';

    const summary = [
      `${ctx.totalClients} active clients tracked.`,
      `Avg health ${ctx.averageScore}/100 (${deltaLabel} WoW).`,
      `${ctx.healthy} healthy · ${ctx.atRisk} at-risk · ${ctx.critical} critical.`,
      ctx.recommendedActionsCount > 0
        ? `${ctx.recommendedActionsCount} proposed action${ctx.recommendedActionsCount > 1 ? 's' : ''} below — Accept to add to your action items.`
        : '',
      ctx.trendingRisks.length > 0
        ? `${ctx.trendingRisks.length} client${ctx.trendingRisks.length > 1 ? 's' : ''} trending down this week.`
        : 'No sharp declines this week.',
      ctx.risingStars.length > 0
        ? `${ctx.risingStars.length} client${ctx.risingStars.length > 1 ? 's' : ''} improving.`
        : '',
      ctx.topActionItemsCount > 0
        ? `${ctx.topActionItemsCount} action item${ctx.topActionItemsCount > 1 ? 's' : ''} already open and due this week.`
        : '',
    ]
      .filter(Boolean)
      .join(' ');

    // Sprint 8A: lead the recommendation with the top proposal when
    // one is available — gives the user a concrete first move.
    const recommendation =
      ctx.topRecommendedAction
        ? `Start here: ${ctx.topRecommendedAction.title} — ${ctx.topRecommendedAction.companyName || ctx.topRecommendedAction.clientName}. ${ctx.topRecommendedAction.rationale}`
        : ctx.critical > 0
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

  const recommendedActionsHtml = (brief.recommendedActions ?? []).length === 0
    ? ''
    : `
    <h3 style="margin:24px 0 8px 0;color:${accent};font-size:15px;font-weight:700;">3 Actions for Your Approval</h3>
    ${(brief.recommendedActions ?? []).map((a, i) => {
      const urgencyColors: Record<string, string> = { high: accent, medium: '#f59e0b', low: '#16a34a' };
      const urgencyColor = urgencyColors[a.urgency] ?? muted;
      const typeLabels: Record<string, string> = {
        'check-in': 'Check-in', escalation: 'Escalation', upsell: 'Upsell',
        're-engagement': 'Re-engage', 'delivery-fix': 'Delivery Fix',
      };
      return `<div style="margin:8px 0;padding:12px 16px;border:1px solid #eef2f7;border-left:4px solid ${urgencyColor};border-radius:8px;background:${card};">
        <div style="font-size:12px;color:${urgencyColor};font-weight:600;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:4px;">${i + 1}. ${typeLabels[a.type] ?? a.type} · ${a.urgency}</div>
        <div style="font-size:15px;font-weight:600;color:${text};margin-bottom:4px;">${escapeHtml(a.title)}</div>
        <div style="font-size:13px;color:${muted};line-height:1.4;">${escapeHtml(a.rationale)}</div>
        ${a.engagementContext ? `<div style="font-size:12px;color:${urgencyColor};margin-top:4px;">📡 ${escapeHtml(a.engagementContext)}</div>` : ''}
      </div>`;
    }).join('')}
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
      ${recommendedActionsHtml}
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
