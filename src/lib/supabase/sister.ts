// Sprint 7.8 — sister-product Supabase client.
//
// Mirror of reforge/lib/supabase/sister.ts. Used by the Stripe webhook
// handler to mirror has_suite_access onto the OTHER product's profiles
// table when a Suite SKU event fires (the buyer might have signed up
// via either product first; the Suite flag must land on both DBs so
// the cross-product handoff works).
//
// Fail-loud on missing env vars — the webhook caller can decide
// whether to skip-with-warning or 5xx based on context.

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Create a service-role client pointing at ReForge's Supabase
 * project. Throws if the env vars aren't set — callers should catch
 * and warn-not-crash so the webhook still 2xxs to Stripe (avoid retry
 * storms on a config issue).
 */
export function createSisterClient(): SupabaseClient {
  const url = process.env.RF_SUPABASE_URL;
  const key = process.env.RF_SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      'Sister-DB env vars missing (RF_SUPABASE_URL + RF_SUPABASE_SERVICE_ROLE_KEY). ' +
        'Set both on the Vercel project before Suite-SKU webhooks fire.',
    );
  }
  return createClient(url, key);
}

/** Friendly name used in log lines. */
export const SISTER_PRODUCT_NAME = 'reforge';
