import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { ensureAgencyForUser } from '@/lib/agency/bootstrap';

export interface AuthedContext {
  userId: string;
  email: string | null;
  agencyId: string;
  subscriptionPlan: string;
  /** Auth-scoped client. Use for writes the user is authorized to do. */
  authClient: Awaited<ReturnType<typeof createClient>>;
  /** Service-role client. Use for reads/writes that have already been
   * scoped manually to the user's agency. Bypasses RLS context drift. */
  serviceClient: ReturnType<typeof createServiceClient>;
}

export type AuthedResult =
  | { ok: true; ctx: AuthedContext }
  | { ok: false; response: NextResponse };

/**
 * Standard "verify user, load profile, return agency context" preamble for
 * every authenticated API route.
 *
 * - Authenticates via auth.getUser() (the auth client knows about the JWT
 *   cookie and can decode it).
 * - Reads profile via the SERVICE client. The auth client's RLS context can
 *   silently return null even when the row exists (cookie/JWT/PostgREST
 *   issues — see Apr 25/26 incident where /api/me returned 'No profile' for
 *   an authenticated user). Service client avoids that whole class of bug.
 * - Backfills agency_id via ensureAgencyForUser if the profile predates the
 *   handle_new_user trigger.
 *
 * Returns either a usable context or a NextResponse to short-circuit with.
 *
 * Usage:
 *   const auth = await getAuthedContext();
 *   if (!auth.ok) return auth.response;
 *   const { userId, agencyId, serviceClient } = auth.ctx;
 */
export async function getAuthedContext(): Promise<AuthedResult> {
  const authClient = await createClient();
  const {
    data: { user },
    error: userError,
  } = await authClient.auth.getUser();

  if (userError || !user) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    };
  }

  const serviceClient = createServiceClient();

  let { data: profile } = await serviceClient
    .from('profiles')
    .select('agency_id, subscription_plan, email, full_name')
    .eq('id', user.id)
    .maybeSingle();

  if (!profile?.agency_id) {
    await ensureAgencyForUser(authClient, {
      userId: user.id,
      email: profile?.email ?? user.email ?? null,
      fullName: profile?.full_name ?? null,
    });
    const { data: healed } = await serviceClient
      .from('profiles')
      .select('agency_id, subscription_plan, email, full_name')
      .eq('id', user.id)
      .maybeSingle();
    profile = healed;
  }

  if (!profile?.agency_id) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Profile setup incomplete — please contact support' },
        { status: 500 },
      ),
    };
  }

  return {
    ok: true,
    ctx: {
      userId: user.id,
      email: profile.email ?? user.email ?? null,
      agencyId: profile.agency_id as string,
      subscriptionPlan: (profile.subscription_plan as string) ?? 'free',
      authClient,
      serviceClient,
    },
  };
}
