import type { SupabaseClient } from '@supabase/supabase-js';
import { createServiceClient } from '@/lib/supabase/service';

interface BootstrapInput {
  userId: string;
  email: string | null;
  fullName: string | null;
}

interface BootstrapResult {
  agencyId: string;
  created: boolean;
}

/**
 * Ensure the user has an agency. Returns the agency_id, creating one
 * only if no membership exists. Idempotent — safe to call on every request.
 *
 * Mirrors the `handle_new_user` trigger from migration 20260411 for users
 * whose accounts predate the trigger and were never backfilled.
 *
 * **Lessons baked in (Apr 25 2026 incident — created 21 duplicate agencies
 * for a single user before this rewrite):**
 *
 * 1. ALWAYS use the service client for reads in here. The auth client is
 *    RLS-restricted; on a profile row that exists but the policy doesn't
 *    surface, agency_id reads as null and the slow path fires every time.
 * 2. Check agency_members BEFORE creating an agency. Owner-of-orphan
 *    agencies leak in here otherwise.
 * 3. NEVER use upsert on profiles for backfill. Use plain update, and only
 *    touch the columns we're actually backfilling — never subscription_plan,
 *    subscription_status, stripe_customer_id, or any other field that
 *    represents user-visible state. We had a bug where the backfill upsert
 *    wrote `subscription_plan: 'free'` and clobbered an Agency subscription.
 *
 * The first arg is kept for API back-compat but no longer used — service
 * client is used for everything internally.
 */
export async function ensureAgencyForUser(
  _authClient: SupabaseClient,
  input: BootstrapInput,
): Promise<BootstrapResult> {
  const service = createServiceClient();

  // 1. Fast path A — profile already linked to an agency.
  const { data: profile } = await service
    .from('profiles')
    .select('agency_id')
    .eq('id', input.userId)
    .maybeSingle();

  if (profile?.agency_id) {
    return { agencyId: profile.agency_id as string, created: false };
  }

  // 2. Fast path B — user is already a member of one or more agencies (e.g.
  //    profile.agency_id was nulled by an earlier bug; agency_members still
  //    holds the relationship). Use the oldest = original agency.
  const { data: memberships } = await service
    .from('agency_members')
    .select('agency_id, created_at')
    .eq('user_id', input.userId)
    .order('created_at', { ascending: true })
    .limit(1);

  const existingAgencyId = memberships?.[0]?.agency_id as string | undefined;

  if (existingAgencyId) {
    // Backfill the profile's agency_id only — leave subscription state alone.
    await service
      .from('profiles')
      .update({ agency_id: existingAgencyId })
      .eq('id', input.userId);
    return { agencyId: existingAgencyId, created: false };
  }

  // 3. Slow path — genuinely no agency exists for this user. Create one.
  const displayName = input.fullName ?? input.email?.split('@')[0] ?? 'Owner';
  const agencyName = `${displayName}'s Agency`;

  const { data: agency, error: agencyErr } = await service
    .from('agencies')
    .insert({ name: agencyName, owner_id: input.userId })
    .select('id')
    .single();

  if (agencyErr || !agency) {
    throw new Error(`Failed to create agency: ${agencyErr?.message ?? 'unknown'}`);
  }

  const agencyId = agency.id as string;

  // Profile may not exist yet for very-old accounts. INSERT only — never
  // upsert — and never write subscription_* fields here.
  const { data: existingProfile } = await service
    .from('profiles')
    .select('id')
    .eq('id', input.userId)
    .maybeSingle();

  if (!existingProfile) {
    await service.from('profiles').insert({
      id: input.userId,
      email: input.email,
      full_name: input.fullName,
      agency_id: agencyId,
      subscription_plan: 'free',
      subscription_status: 'active',
    });
  } else {
    // Profile exists — only fill in agency_id, leave everything else alone.
    await service
      .from('profiles')
      .update({ agency_id: agencyId })
      .eq('id', input.userId);
  }

  // Add the user as agency owner. Idempotent — ignore conflicts.
  await service.from('agency_members').upsert(
    { agency_id: agencyId, user_id: input.userId, role: 'owner' },
    { onConflict: 'agency_id,user_id', ignoreDuplicates: true },
  );

  return { agencyId, created: true };
}
