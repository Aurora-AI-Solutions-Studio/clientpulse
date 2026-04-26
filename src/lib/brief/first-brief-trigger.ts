// First-Brief auto-send gate.
//
// Fires the first Monday Brief automatically the moment the agency reaches
// 3 clients — so a new sign-up sees a real Brief before they've waited a
// week. Once fired (atomic UPDATE), it never fires again for that agency:
// the regular Monday cron takes over.
//
// The actual generate+send is run inside Vercel's `after()` so the
// triggering request (POST /api/clients) returns immediately.

import type { SupabaseClient } from '@supabase/supabase-js';

export const FIRST_BRIEF_CLIENT_THRESHOLD = 3;

export interface FirstBriefDecision {
  shouldFire: boolean;
  /** Owner email if a fire is decided — required to actually deliver. */
  ownerEmail: string | null;
  /** Agency name (for branded header + subject). */
  agencyName: string | null;
}

/**
 * Atomically claim the right to send the first Brief.
 *
 * Returns shouldFire=true at most once per agency. The atomic UPDATE
 * (only sets first_brief_sent_at when currently NULL) is what guarantees
 * "exactly once" even under concurrent client inserts.
 *
 * Caller is responsible for then doing the generate+send. If that work
 * fails, the flag stays set — that's the right call: a failed first send
 * shouldn't keep retrying every time another client is added; it'll be
 * picked up by the next Monday cron run.
 */
export async function maybeClaimFirstBriefSend(
  supabase: SupabaseClient,
  agencyId: string,
): Promise<FirstBriefDecision> {
  const empty: FirstBriefDecision = {
    shouldFire: false,
    ownerEmail: null,
    agencyName: null,
  };

  const { count, error: countErr } = await supabase
    .from('clients')
    .select('id', { count: 'exact', head: true })
    .eq('agency_id', agencyId);

  if (countErr) return empty;
  if ((count ?? 0) < FIRST_BRIEF_CLIENT_THRESHOLD) return empty;

  // Atomic claim: set first_brief_sent_at only if still NULL. Returning
  // 'representation' lets us see whether we won the race.
  const { data: claimed, error: claimErr } = await supabase
    .from('agencies')
    .update({ first_brief_sent_at: new Date().toISOString() })
    .eq('id', agencyId)
    .is('first_brief_sent_at', null)
    .select('id, name, owner_id')
    .maybeSingle();

  if (claimErr || !claimed) return empty;

  // Look up owner email — needed to actually deliver.
  const { data: owner } = await supabase
    .from('profiles')
    .select('email')
    .eq('id', claimed.owner_id as string)
    .maybeSingle();

  return {
    shouldFire: true,
    ownerEmail: (owner?.email as string | null) ?? null,
    agencyName: (claimed.name as string | null) ?? null,
  };
}

/**
 * Release the claim. Use when the actual send work fails to set up — so
 * the flag doesn't stay flipped on a no-op. Call only on early failures
 * (e.g. owner email missing); for delivery failures, leave the flag set
 * because the Monday cron will handle the next attempt.
 */
export async function releaseFirstBriefClaim(
  supabase: SupabaseClient,
  agencyId: string,
): Promise<void> {
  await supabase
    .from('agencies')
    .update({ first_brief_sent_at: null })
    .eq('id', agencyId);
}
