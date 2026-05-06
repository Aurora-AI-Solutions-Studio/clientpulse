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
  /** Slice 2C-1: when set, this action was driven by a fresh ContentPulse signal
   *  (pause or 60% velocity drop) and the Brief headline can lead with
   *  it directly. Distinguishes signal-driven re-engagement from the
   *  engagement-metrics heuristic that already ships under the same type. */
  signalReason?: 'paused' | 'velocity_drop';
}

/**
 * Slice 2C-1 — ContentPulse→CP signals snapshot per client. Latest value per
 * signal_type within the lookback window plus the previous-period
 * content_velocity needed to detect a w/w drop.
 */
interface ClientSignalsSnapshot {
  pauseResume?: number;
  contentVelocityCurrent?: number;
  contentVelocityPrev?: number;
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

      // Extract top signal (highest severity). The demo seed (and any
      // legacy row) may have stamped `signals` as an object instead of
      // an array — guard with Array.isArray so a non-array shape just
      // produces no topSignal instead of a runtime crash.
      const rawSignals = r.signals;
      const signals: Array<{ severity?: string; message?: string }> = Array.isArray(
        rawSignals
      )
        ? (rawSignals as Array<{ severity?: string; message?: string }>)
        : [];
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

    // 10b. Slice 2C-1 — ContentPulse→CP signals snapshot.
    // Two queries: latest 50 signal rows for the agency (latest value per
    // signal_type wins), plus a separate scan of content_velocity ordered
    // by emitted_at desc that lets us pull current + previous period for
    // every client in one pass. Both are agency-scoped via the existing
    // RLS-aware path (the supabase client passed to the agent).
    const signalsByClient = new Map<string, ClientSignalsSnapshot>();
    if (clientIds.length > 0) {
      const { data: latestSignals } = await this.supabase
        .from('client_signals')
        .select('client_id, signal_type, value, emitted_at')
        .in('client_id', clientIds)
        .order('emitted_at', { ascending: false })
        .limit(200);
      const seenLatest = new Set<string>();
      for (const row of (latestSignals ?? []) as Array<{
        client_id: string;
        signal_type: string;
        value: number;
      }>) {
        const k = `${row.client_id}:${row.signal_type}`;
        if (seenLatest.has(k)) continue;
        seenLatest.add(k);
        const snap = signalsByClient.get(row.client_id) ?? {};
        if (row.signal_type === 'pause_resume') snap.pauseResume = row.value;
        else if (row.signal_type === 'content_velocity')
          snap.contentVelocityCurrent = row.value;
        signalsByClient.set(row.client_id, snap);
      }

      const { data: velocityRows } = await this.supabase
        .from('client_signals')
        .select('client_id, value, emitted_at')
        .in('client_id', clientIds)
        .eq('signal_type', 'content_velocity')
        .order('emitted_at', { ascending: false })
        .limit(200);
      const velocityCounts = new Map<string, number>();
      for (const row of (velocityRows ?? []) as Array<{
        client_id: string;
        value: number;
      }>) {
        const seen = velocityCounts.get(row.client_id) ?? 0;
        if (seen === 1) {
          // The latest is already on the snapshot; this is the prior period.
          const snap = signalsByClient.get(row.client_id) ?? {};
          snap.contentVelocityPrev = row.value;
          signalsByClient.set(row.client_id, snap);
        }
        velocityCounts.set(row.client_id, seen + 1);
      }
    }

    // 11. Recommended Actions (3 actions for your approval)
    const recommendedActions = this.generateRecommendedActions(
      entries,
      engagementByClient,
      clientById,
      topActionItems,
      signalsByClient
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
    _actionItems: MondayBriefActionItem[],
    signalsByClient: Map<string, ClientSignalsSnapshot> = new Map()
  ): MondayBriefRecommendedAction[] {
    const actions: MondayBriefRecommendedAction[] = [];
    let actionId = 0;

    // Slice 2C-1 — Priority 0: signal-driven re-engagement.
    // ContentPulse marked the client as paused, or velocity collapsed >=60% w/w.
    // Outranks the critical-clients priority because signals are
    // freshness-grounded (ContentPulse emits weekly) and the matching action_item
    // already exists on the dashboard from the APE auto-trigger.
    interface SignalHit {
      entry: MondayBriefClientEntry;
      reason: 'paused' | 'velocity_drop';
      severity: number;
      dropPct?: number;
      prev?: number;
      curr?: number;
    }
    const VELOCITY_DROP_THRESHOLD = 0.6;
    const signalDrivenSorted: SignalHit[] = entries
      .map((entry): SignalHit | null => {
        const snap = signalsByClient.get(entry.clientId);
        if (!snap) return null;
        if (snap.pauseResume === 1) {
          return { entry, reason: 'paused', severity: 0 };
        }
        if (
          typeof snap.contentVelocityCurrent === 'number' &&
          typeof snap.contentVelocityPrev === 'number' &&
          snap.contentVelocityPrev > 0
        ) {
          const dropPct =
            (snap.contentVelocityPrev - snap.contentVelocityCurrent) /
            snap.contentVelocityPrev;
          if (dropPct >= VELOCITY_DROP_THRESHOLD) {
            return {
              entry,
              reason: 'velocity_drop',
              severity: 1,
              dropPct,
              prev: snap.contentVelocityPrev,
              curr: snap.contentVelocityCurrent,
            };
          }
        }
        return null;
      })
      .filter((x): x is SignalHit => x !== null)
      .sort((a, b) => a.severity - b.severity);

    const topHit: SignalHit | undefined = signalDrivenSorted[0];
    if (topHit) {
      const label = topHit.entry.companyName || topHit.entry.clientName;
      if (topHit.reason === 'paused') {
        actions.push({
          id: `ra-${++actionId}`,
          type: 're-engagement',
          clientId: topHit.entry.clientId,
          clientName: topHit.entry.clientName,
          companyName: topHit.entry.companyName,
          title: `Re-engage ${label} — publishing has paused`,
          rationale: `ContentPulse reports zero new pieces in the latest period. Reach out today before the relationship goes fully cold.`,
          urgency: 'high',
          signalReason: 'paused',
        });
      } else {
        const dropDisplay = Math.round((topHit.dropPct ?? 0) * 100);
        actions.push({
          id: `ra-${++actionId}`,
          type: 're-engagement',
          clientId: topHit.entry.clientId,
          clientName: topHit.entry.clientName,
          companyName: topHit.entry.companyName,
          title: `Re-engage ${label} — output dropped ${dropDisplay}% week-over-week`,
          rationale: `Publishing rate fell from ${topHit.prev} to ${topHit.curr} pieces. Reach out before momentum collapses.`,
          urgency: 'high',
          signalReason: 'velocity_drop',
        });
      }
    }

    // Priority 1: Critical clients → escalation or check-in
    // Dedupe — if Priority 0 already covered the worst critical client
    // (Cypress in the demo), don't double-up on the same client.
    const alreadyTargeted = new Set(actions.map((a) => a.clientId));
    const criticals = entries
      .filter((e) => e.status === 'critical' && !alreadyTargeted.has(e.clientId))
      .sort((a, b) => a.overallScore - b.overallScore);
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
    const targetedAfterCritical = new Set(actions.map((a) => a.clientId));
    const decliningEngagement = entries
      .filter((e) => {
        if (targetedAfterCritical.has(e.clientId)) return false;
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
    // Slice 2C-1: signal-driven re-engagement outranks even critical
    // because the signal is freshness-grounded and the action is one
    // click away on the dashboard already.
    const proposalTail =
      ctx.recommendedActionsCount > 0
        ? ` · ${ctx.recommendedActionsCount} proposal${ctx.recommendedActionsCount > 1 ? 's' : ''} ready`
        : '';
    const signalAction = ctx.topRecommendedAction?.signalReason
      ? ctx.topRecommendedAction
      : undefined;
    const headline = signalAction
      ? signalAction.signalReason === 'paused'
        ? `${signalAction.companyName || signalAction.clientName} paused publishing — re-engage today${proposalTail}`
        : `${signalAction.companyName || signalAction.clientName} velocity dropped sharply — re-engage today${proposalTail}`
      : ctx.critical > 0
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

// Email rendering lives in ./brief-email.ts — actions-first HTML +
// plain-text + subject + preheader, with magic-link Accept and branded
// header support. This file stays focused on data composition.
