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
 * if missing. Idempotent.
 *
 * Mirrors the `handle_new_user` trigger from migration 20260411 for users
 * whose accounts predate the trigger and were never backfilled. Uses the
 * service-role client because the agencies table is locked down to
 * SECURITY DEFINER inserts at the row-level-security layer.
 */
export async function ensureAgencyForUser(
  authClient: SupabaseClient,
  input: BootstrapInput,
): Promise<BootstrapResult> {
  // Fast path: profile already linked to an agency.
  const { data: profile } = await authClient
    .from('profiles')
    .select('agency_id')
    .eq('id', input.userId)
    .maybeSingle();

  if (profile?.agency_id) {
    return { agencyId: profile.agency_id as string, created: false };
  }

  // Slow path: backfill via service role (mirrors handle_new_user trigger).
  const service = createServiceClient();
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

  // Profile may not exist yet for very-old accounts — upsert to be safe.
  const { error: profileErr } = await service.from('profiles').upsert(
    {
      id: input.userId,
      email: input.email,
      full_name: input.fullName,
      agency_id: agencyId,
      subscription_plan: 'free',
      subscription_status: 'active',
    },
    { onConflict: 'id' },
  );
  if (profileErr) {
    throw new Error(`Failed to upsert profile: ${profileErr.message}`);
  }

  // Add the user as agency owner. Idempotent — ignore conflicts.
  const { error: memberErr } = await service.from('agency_members').upsert(
    { agency_id: agencyId, user_id: input.userId, role: 'owner' },
    { onConflict: 'agency_id,user_id', ignoreDuplicates: true },
  );
  if (memberErr) {
    throw new Error(`Failed to upsert agency_member: ${memberErr.message}`);
  }

  return { agencyId, created: true };
}
