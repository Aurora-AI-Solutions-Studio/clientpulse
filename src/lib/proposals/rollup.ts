// Portfolio-wide proposal rollup for the Action Proposal Engine v1.
//
// Reads the recommendedActions off the most recent Monday Brief for
// an agency. The brief is already generated on a weekly cron or via
// the `generate_monday_brief` MCP tool — re-using its output avoids
// a per-load LLM call and ties APE directly to the Brief, which is
// the spec ("Monday Brief evolution from status → actionable
// proposals").
//
// Tier behavior:
//   free    → no brief ever generated → empty
//   solo    → brief runs for all tiers ≥ solo → proposals flow through
//   pro     → same
//   agency  → same; full set
//
// "No proposals yet" is an expected empty state for new agencies. The
// caller surfaces a CTA to generate the first brief (wizard step 4).

import type { SupabaseClient } from '@supabase/supabase-js';
import type { CPTier } from '@/lib/tiers';
import type { MondayBriefContent, MondayBriefRecommendedAction } from '@/lib/agents/monday-brief-agent';

export interface Proposal extends MondayBriefRecommendedAction {
  weekOf: string;
  briefId: string;
}

export interface RolledProposals {
  proposals: Proposal[];
  weekOf: string | null;
  briefId: string | null;
  hasBrief: boolean;
}

const URGENCY_RANK: Record<MondayBriefRecommendedAction['urgency'], number> = {
  high: 0,
  medium: 1,
  low: 2,
};

export function rankProposals(rows: Proposal[]): Proposal[] {
  return [...rows].sort((a, b) => URGENCY_RANK[a.urgency] - URGENCY_RANK[b.urgency]);
}

export async function getPortfolioProposals(
  supabase: SupabaseClient,
  agencyId: string,
  tier: CPTier,
  opts: { limit?: number } = {}
): Promise<RolledProposals> {
  if (tier === 'free') {
    return { proposals: [], weekOf: null, briefId: null, hasBrief: false };
  }

  const { data: brief, error } = await supabase
    .from('monday_briefs')
    .select('id, content, created_at')
    .eq('agency_id', agencyId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.warn('[proposals/rollup] monday_briefs query failed:', error.message);
    return { proposals: [], weekOf: null, briefId: null, hasBrief: false };
  }

  if (!brief) {
    return { proposals: [], weekOf: null, briefId: null, hasBrief: false };
  }

  const content = brief.content as MondayBriefContent | null;
  const recommendedActions = content?.recommendedActions ?? [];
  const weekOf = content?.weekOf ?? null;

  const proposals: Proposal[] = recommendedActions.map((a) => ({
    ...a,
    weekOf: weekOf ?? '',
    briefId: brief.id as string,
  }));

  const ranked = rankProposals(proposals);
  const limited = typeof opts.limit === 'number' ? ranked.slice(0, opts.limit) : ranked;

  return {
    proposals: limited,
    weekOf,
    briefId: brief.id as string,
    hasBrief: true,
  };
}
