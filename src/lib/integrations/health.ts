// Integration connection health — single source of truth used by
// the dashboard banner, the settings page, and the onboarding wizard.
//
// "Healthy" means the provider is connected, has a non-expired token,
// and has synced within STALE_THRESHOLD_DAYS. "Stale" means connected
// but either expired or hasn't synced recently. "Error" mirrors the
// `error` field on integration_connections (the sync route writes it
// on transient failures). "Disconnected" means no row.

import type { SupabaseClient } from '@supabase/supabase-js';

export type IntegrationProvider = 'gmail' | 'calendar' | 'zoom' | 'stripe';
export type IntegrationHealthStatus =
  | 'healthy'
  | 'stale'
  | 'error'
  | 'disconnected';

export interface IntegrationHealth {
  provider: IntegrationProvider;
  status: IntegrationHealthStatus;
  lastSyncAt: string | null;
  tokenExpiresAt: string | null;
  message: string | null;
  accountEmail: string | null;
}

export interface IntegrationConnectionRow {
  provider: string;
  status: string | null;
  token_expires_at: string | null;
  last_sync_at: string | null;
  error: string | null;
  account_email: string | null;
}

export interface ProfileBillingRow {
  stripe_customer_id: string | null;
  subscription_plan: string | null;
  subscription_status: string | null;
}

export const STALE_THRESHOLD_DAYS = 7;
const STALE_MS = STALE_THRESHOLD_DAYS * 24 * 60 * 60 * 1000;
const OAUTH_PROVIDERS: IntegrationProvider[] = ['gmail', 'calendar', 'zoom'];

export function classifyOAuthConnection(
  provider: IntegrationProvider,
  conn: IntegrationConnectionRow | undefined,
  now: number
): IntegrationHealth {
  if (!conn) {
    return {
      provider,
      status: 'disconnected',
      lastSyncAt: null,
      tokenExpiresAt: null,
      message: 'Not connected',
      accountEmail: null,
    };
  }

  const expiresMs = conn.token_expires_at
    ? new Date(conn.token_expires_at).getTime()
    : null;
  const lastSyncMs = conn.last_sync_at
    ? new Date(conn.last_sync_at).getTime()
    : null;

  if (conn.error) {
    return {
      provider,
      status: 'error',
      lastSyncAt: conn.last_sync_at,
      tokenExpiresAt: conn.token_expires_at,
      message: conn.error,
      accountEmail: conn.account_email,
    };
  }
  if (expiresMs !== null && expiresMs < now) {
    return {
      provider,
      status: 'stale',
      lastSyncAt: conn.last_sync_at,
      tokenExpiresAt: conn.token_expires_at,
      message: 'Access token expired — sync to refresh',
      accountEmail: conn.account_email,
    };
  }
  if (lastSyncMs !== null && now - lastSyncMs > STALE_MS) {
    const days = Math.floor((now - lastSyncMs) / (24 * 60 * 60 * 1000));
    return {
      provider,
      status: 'stale',
      lastSyncAt: conn.last_sync_at,
      tokenExpiresAt: conn.token_expires_at,
      message: `Last sync ${days}d ago`,
      accountEmail: conn.account_email,
    };
  }
  return {
    provider,
    status: 'healthy',
    lastSyncAt: conn.last_sync_at,
    tokenExpiresAt: conn.token_expires_at,
    message: null,
    accountEmail: conn.account_email,
  };
}

export function classifyStripe(
  profile: ProfileBillingRow | null
): IntegrationHealth {
  if (!profile || !profile.stripe_customer_id) {
    return {
      provider: 'stripe',
      status: 'disconnected',
      lastSyncAt: null,
      tokenExpiresAt: null,
      message: 'No active subscription',
      accountEmail: null,
    };
  }
  const status = profile.subscription_status ?? '';
  if (status === 'active' || status === 'trialing') {
    return {
      provider: 'stripe',
      status: 'healthy',
      lastSyncAt: null,
      tokenExpiresAt: null,
      message: `${profile.subscription_plan ?? 'unknown'} · ${status}`,
      accountEmail: null,
    };
  }
  return {
    provider: 'stripe',
    status: 'error',
    lastSyncAt: null,
    tokenExpiresAt: null,
    message: `Subscription ${status || 'unknown'}`,
    accountEmail: null,
  };
}

export async function getIntegrationHealth(
  supabase: SupabaseClient,
  agencyId: string,
  userId: string,
  now: number = Date.now()
): Promise<IntegrationHealth[]> {
  const [{ data: connections }, { data: profile }] = await Promise.all([
    supabase
      .from('integration_connections')
      .select(
        'provider, status, token_expires_at, last_sync_at, error, account_email'
      )
      .eq('agency_id', agencyId)
      .eq('user_id', userId),
    supabase
      .from('profiles')
      .select('stripe_customer_id, subscription_plan, subscription_status')
      .eq('id', userId)
      .maybeSingle(),
  ]);

  const oauthResults = OAUTH_PROVIDERS.map((provider) => {
    const conn = (connections ?? []).find(
      (c: IntegrationConnectionRow) => c.provider === provider
    );
    return classifyOAuthConnection(provider, conn, now);
  });

  const stripeResult = classifyStripe(profile as ProfileBillingRow | null);

  return [...oauthResults, stripeResult];
}

export function isHealthyOverall(rows: IntegrationHealth[]): boolean {
  return rows.every(
    (r) => r.status === 'healthy' || r.status === 'disconnected'
  );
}

export function unhealthyProviders(
  rows: IntegrationHealth[]
): IntegrationHealth[] {
  return rows.filter((r) => r.status === 'stale' || r.status === 'error');
}
