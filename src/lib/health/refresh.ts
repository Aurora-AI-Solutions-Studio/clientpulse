// ─── Client health refresh — Sprint 8A ──────────────────────────
// Shared compute+store pipeline for a single client's health score.
// Consumed by:
//   - POST /api/health-score  (dashboard-triggered refresh)
//   - trigger_health_refresh  (MCP write tool)
//
// The helper does not perform any auth or ownership checks — callers
// are expected to verify that the client belongs to the authenticated
// agency before invoking. Both call sites do this up-front.

import type { SupabaseClient } from '@supabase/supabase-js';
import { FinancialSignalAgent } from '@/lib/agents/financial-signal-agent';
import {
  HealthScoringAgent,
  type HealthScoreInput,
  type HealthScoreResult,
} from '@/lib/agents/health-scoring-agent';

export interface RefreshClientHealthArgs {
  supabase: SupabaseClient;
  clientId: string;
}

interface MeetingRow {
  id: string;
  meeting_date: string;
  meeting_intelligence: Array<{ sentiment_score: number | null }> | null;
}

interface ActionItemRow {
  id: string;
  status: 'open' | 'done' | 'overdue';
}

interface EngagementRow {
  overall_engagement_score: number | null;
  meeting_frequency_trend: 'increasing' | 'stable' | 'declining' | null;
  last_meeting_days_ago: number | null;
}

/**
 * Recompute and persist one client's health score. Returns the computed
 * result so callers (HTTP route, MCP tool) can surface it.
 *
 * Side effects:
 *   - Inserts 5 rows into health_score_history (overall + 4 subscores)
 *   - Upserts the current snapshot into client_health_scores
 *
 * Idempotent by "last-write-wins": the upsert uses `client_id` as the
 * conflict key, so repeated calls only keep the latest snapshot plus
 * append to history.
 */
export async function refreshClientHealth({
  supabase,
  clientId,
}: RefreshClientHealthArgs): Promise<HealthScoreResult> {
  // ─── 1. Financial score ──────────────────────────────────────────
  // Mock invoices until the Stripe pull-through lands — mirrors the
  // HTTP route behaviour exactly so MCP + HTTP produce the same score.
  const financialAgent = new FinancialSignalAgent();
  const mockInvoices: unknown[] = [];
  const financialHealthScore = await financialAgent.computeFinancialHealthScore(
    mockInvoices as Parameters<typeof financialAgent.computeFinancialHealthScore>[0]
  );
  const financialScore = financialHealthScore.score;

  // ─── 2. Meetings + sentiment ─────────────────────────────────────
  const { data: meetingsRaw } = await supabase
    .from('meetings')
    .select(
      `id, meeting_date, meeting_intelligence ( sentiment_score, escalation_signals )`
    )
    .eq('client_id', clientId)
    .order('meeting_date', { ascending: false });

  const meetings = (meetingsRaw ?? []) as unknown as MeetingRow[];
  const meetingSentimentScores: number[] = [];
  let lastMeetingDaysAgo = 999;
  if (meetings.length > 0) {
    for (const m of meetings) {
      const mi = m.meeting_intelligence;
      if (Array.isArray(mi) && mi.length > 0 && mi[0].sentiment_score !== null) {
        meetingSentimentScores.push(mi[0].sentiment_score as number);
      }
    }
    const lastDate = new Date(meetings[0].meeting_date);
    lastMeetingDaysAgo = Math.floor(
      (Date.now() - lastDate.getTime()) / (1000 * 60 * 60 * 24)
    );
  }

  let meetingFrequencyTrend: 'increasing' | 'stable' | 'declining' = 'stable';
  if (meetings.length >= 4) {
    const midpoint = Math.floor(meetings.length / 2);
    const recentCount = midpoint;
    const olderCount = meetings.length - midpoint;
    if (recentCount > olderCount * 1.3) meetingFrequencyTrend = 'increasing';
    else if (recentCount < olderCount * 0.7) meetingFrequencyTrend = 'declining';
  }

  // ─── 3. Action items ─────────────────────────────────────────────
  const { data: actionItemsRaw } = await supabase
    .from('action_items')
    .select('id, status')
    .eq('client_id', clientId);
  const actionItems = (actionItemsRaw ?? []) as ActionItemRow[];
  const actionItemStats = {
    total: actionItems.length,
    completed: actionItems.filter((a) => a.status === 'done').length,
    overdue: actionItems.filter((a) => a.status === 'overdue').length,
  };

  // ─── 4. Engagement metrics (Sprint 5 override) ───────────────────
  // `.maybeSingle` here vs `.single` in the original route — avoids a
  // hard error when the row is missing. Read-through behaves the same.
  const { data: engagementData } = await supabase
    .from('engagement_metrics')
    .select('overall_engagement_score, meeting_frequency_trend, last_meeting_days_ago')
    .eq('client_id', clientId)
    .maybeSingle();
  const engagement = (engagementData ?? null) as EngagementRow | null;

  const finalTrend = engagement?.meeting_frequency_trend ?? meetingFrequencyTrend;
  const finalLastDaysAgo =
    engagement?.last_meeting_days_ago ?? lastMeetingDaysAgo;

  // ─── 5. Compute ──────────────────────────────────────────────────
  const scoringAgent = new HealthScoringAgent();
  const scoreInput: HealthScoreInput = {
    financialScore,
    meetingSentimentScores,
    actionItemStats,
    meetingFrequencyTrend: finalTrend,
    lastMeetingDaysAgo: finalLastDaysAgo,
    engagementScoreOverride: engagement?.overall_engagement_score ?? undefined,
  };
  const healthScore = scoringAgent.computeHealthScore(scoreInput);

  // ─── 6. Persist history + current ────────────────────────────────
  const nowIso = new Date().toISOString();

  await supabase.from('health_score_history').insert({
    client_id: clientId,
    score: healthScore.overall,
    score_type: 'overall',
    recorded_at: nowIso,
  });

  const subScoreEntries = [
    { score: healthScore.breakdown.financial, score_type: 'financial' },
    { score: healthScore.breakdown.relationship, score_type: 'relationship' },
    { score: healthScore.breakdown.delivery, score_type: 'delivery' },
    { score: healthScore.breakdown.engagement, score_type: 'engagement' },
  ].map((entry) => ({
    client_id: clientId,
    ...entry,
    recorded_at: nowIso,
  }));
  await supabase.from('health_score_history').insert(subScoreEntries);

  await supabase.from('client_health_scores').upsert(
    {
      client_id: clientId,
      overall_score: healthScore.overall,
      financial_score: healthScore.breakdown.financial,
      relationship_score: healthScore.breakdown.relationship,
      delivery_score: healthScore.breakdown.delivery,
      engagement_score: healthScore.breakdown.engagement,
      status: healthScore.status,
      signals: healthScore.signals,
      explanation: healthScore.explanation,
      computed_at: nowIso,
    },
    { onConflict: 'client_id' }
  );

  return healthScore;
}
