export const dynamic = 'force-dynamic';
import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export interface PortfolioClient {
  clientId: string;
  name: string;
  company: string;
  status: 'healthy' | 'at-risk' | 'critical' | 'unscored';
  overallScore: number | null;
  financial: number | null;
  relationship: number | null;
  delivery: number | null;
  engagement: number | null;
  previousScore: number | null;
  delta: number | null;
  topSignal: string | null;
  computedAt: string | null;
}

export interface PortfolioSnapshot {
  totalClients: number;
  scored: number;
  healthy: number;
  atRisk: number;
  critical: number;
  averageScore: number;
  weekOverWeekDelta: number;
  clients: PortfolioClient[];
}

/**
 * GET /api/portfolio
 * Returns the agency-wide portfolio snapshot — clients ranked by health score.
 */
export async function GET(_request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('agency_id')
      .eq('id', user.id)
      .single();

    if (profileError || !profile?.agency_id) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    const { data: clientsRaw } = await supabase
      .from('clients')
      .select('id, name, company_name')
      .eq('agency_id', profile.agency_id);

    const clients = clientsRaw ?? [];
    const clientIds = clients.map((c) => c.id as string);

    const { data: healthRows } = clientIds.length
      ? await supabase
          .from('client_health_scores')
          .select('client_id, overall_score, financial_score, relationship_score, delivery_score, engagement_score, signals, computed_at')
          .in('client_id', clientIds)
      : { data: [] as Array<Record<string, unknown>> };

    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data: historyRows } = clientIds.length
      ? await supabase
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

    const healthByClient = new Map<string, Record<string, unknown>>();
    for (const row of healthRows ?? []) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const r = row as any;
      healthByClient.set(r.client_id as string, r);
    }

    const severityRank: Record<string, number> = { high: 3, medium: 2, low: 1, positive: 0 };

    const mapped: PortfolioClient[] = clients.map((c) => {
      const h = healthByClient.get(c.id as string);
      if (!h) {
        return {
          clientId: c.id as string,
          name: c.name as string,
          company: (c.company_name as string) ?? '',
          status: 'unscored' as const,
          overallScore: null,
          financial: null,
          relationship: null,
          delivery: null,
          engagement: null,
          previousScore: null,
          delta: null,
          topSignal: null,
          computedAt: null,
        };
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const hr = h as any;
      const overall = (hr.overall_score as number) ?? 0;
      const previous = previousByClient.get(c.id as string) ?? null;
      const delta = previous !== null ? overall - previous : null;
      const signals = (hr.signals as Array<{ severity?: string; message?: string }>) ?? [];
      const topSignal = [...signals].sort(
        (a, b) => (severityRank[b.severity ?? ''] ?? -1) - (severityRank[a.severity ?? ''] ?? -1)
      )[0]?.message ?? null;

      return {
        clientId: c.id as string,
        name: c.name as string,
        company: (c.company_name as string) ?? '',
        status: overall >= 70 ? 'healthy' : overall >= 40 ? 'at-risk' : 'critical',
        overallScore: overall,
        financial: (hr.financial_score as number) ?? null,
        relationship: (hr.relationship_score as number) ?? null,
        delivery: (hr.delivery_score as number) ?? null,
        engagement: (hr.engagement_score as number) ?? null,
        previousScore: previous,
        delta,
        topSignal,
        computedAt: (hr.computed_at as string) ?? null,
      };
    });

    // Sort: critical → at-risk → healthy → unscored, then by score asc within group
    const statusOrder: Record<string, number> = { critical: 0, 'at-risk': 1, healthy: 2, unscored: 3 };
    mapped.sort((a, b) => {
      const s = statusOrder[a.status] - statusOrder[b.status];
      if (s !== 0) return s;
      return (a.overallScore ?? 101) - (b.overallScore ?? 101);
    });

    const scored = mapped.filter((m) => m.overallScore !== null);
    const averageScore =
      scored.length > 0
        ? Math.round(scored.reduce((a, b) => a + (b.overallScore ?? 0), 0) / scored.length)
        : 0;

    const prevValues = Array.from(previousByClient.values());
    const previousAvg =
      prevValues.length > 0
        ? Math.round(prevValues.reduce((a, b) => a + b, 0) / prevValues.length)
        : averageScore;

    const snapshot: PortfolioSnapshot = {
      totalClients: clients.length,
      scored: scored.length,
      healthy: mapped.filter((m) => m.status === 'healthy').length,
      atRisk: mapped.filter((m) => m.status === 'at-risk').length,
      critical: mapped.filter((m) => m.status === 'critical').length,
      averageScore,
      weekOverWeekDelta: averageScore - previousAvg,
      clients: mapped,
    };

    return NextResponse.json(snapshot);
  } catch (err) {
    console.error('[portfolio GET] error', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
