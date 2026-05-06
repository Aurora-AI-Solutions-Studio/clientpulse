// Sprint 7.8 — apply has_suite_access flips to local + sister profiles.
//
// Mirror of contentpulse/lib/stripe/suite-access.ts. Single source of truth
// called from the webhook handler for both the grant path
// (subscription created/updated → active|trialing) and the revoke
// path (deleted, canceled, past_due, unpaid).
//
// Sister-DB write is best-effort: a missing-env failure logs LOUDLY
// (because that's a config bug we want to fix immediately), a
// missing-row failure logs a WARNING (because the buyer hasn't signed
// up on the sister product yet — the next Suite SSO handoff will
// surface the gap to them). Neither propagates back to Stripe — the
// webhook must always 2xx so Stripe doesn't enter retry-storm.

import { createSisterClient, SISTER_PRODUCT_NAME } from '@/lib/supabase/sister';
import type { SupabaseClient } from '@supabase/supabase-js';

interface ApplyArgs {
  /** Local-product service-role client. */
  local: SupabaseClient;
  /** stripe customer.email — used to find the sister-product profile. */
  email: string;
  /** True = grant Suite, false = revoke. */
  grant: boolean;
  /** Local-product profile id (UUID). Optional — when supplied we update
   *  by id. When null/undefined we update by email. */
  localUserId?: string | null;
}

export interface ApplyResult {
  local: 'updated' | 'no_local_row' | 'error';
  sister: 'updated' | 'no_sister_row' | 'sister_db_unavailable' | 'error';
}

export async function applySuiteAccess({
  local,
  email,
  grant,
  localUserId,
}: ApplyArgs): Promise<ApplyResult> {
  const result: ApplyResult = { local: 'error', sister: 'error' };
  const normalizedEmail = email.toLowerCase().trim();

  // Local write — by id when we have it, otherwise by email.
  try {
    const update = local
      .from('profiles')
      .update({ has_suite_access: grant })
      .select('id');
    const filtered = localUserId
      ? update.eq('id', localUserId)
      : update.eq('email', normalizedEmail);
    const { data, error } = await filtered;
    if (error) {
      console.error('[suite-access] local update failed:', error);
      result.local = 'error';
    } else if (!data || data.length === 0) {
      console.warn(`[suite-access] no local profile for email=${normalizedEmail} id=${localUserId ?? 'n/a'}`);
      result.local = 'no_local_row';
    } else {
      result.local = 'updated';
    }
  } catch (err) {
    console.error('[suite-access] local update threw:', err);
    result.local = 'error';
  }

  // Sister write — by email.
  try {
    let sister: SupabaseClient;
    try {
      sister = createSisterClient();
    } catch (envErr) {
      // Loud: this is a config bug. Webhook still 2xxs (handled by caller).
      console.error('[suite-access] sister DB unavailable:', envErr);
      result.sister = 'sister_db_unavailable';
      return result;
    }

    const { data, error } = await sister
      .from('profiles')
      .update({ has_suite_access: grant })
      .eq('email', normalizedEmail)
      .select('id');
    if (error) {
      console.error('[suite-access] sister update failed:', error);
      result.sister = 'error';
    } else if (!data || data.length === 0) {
      console.warn(
        `[suite-access] no ${SISTER_PRODUCT_NAME} profile for email=${normalizedEmail} — buyer hasn't signed up there yet (will sync on first Suite SSO).`,
      );
      result.sister = 'no_sister_row';
    } else {
      result.sister = 'updated';
    }
  } catch (err) {
    console.error('[suite-access] sister update threw:', err);
    result.sister = 'error';
  }

  return result;
}
