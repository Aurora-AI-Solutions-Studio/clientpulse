// Defensive PKCE recovery-code exchange. Used by /auth/reset-password
// to gracefully handle the case where the email recovery link bypasses
// our /auth/callback route and lands directly on the form page with a
// `?code=<uuid>` query param. The canonical happy path runs the
// exchange server-side in the callback route — this helper is the
// fallback that keeps the UX from breaking if the email template ever
// drifts or the callback errors out.
//
// Pure module so it can be unit-tested without a browser/DOM.

export type RecoveryExchangeStatus = 'ok' | 'invalid' | 'no-code';

export type RecoveryExchangeResult = {
  status: RecoveryExchangeStatus;
};

// Minimal slice of the supabase auth client surface we depend on. Lets
// tests pass a hand-rolled fake without typing the full SupabaseClient.
export type RecoveryExchangeClient = {
  auth: {
    exchangeCodeForSession: (
      code: string,
    ) => Promise<{ error: { message?: string } | null }>;
  };
};

/**
 * Run the recovery-code → session exchange when a `?code=` param is
 * present. Returns `no-code` when there's nothing to do (canonical
 * callback path already established the session, or user bookmarked
 * the page), `invalid` when the link is expired/used, `ok` on success.
 */
export async function runRecoveryExchange(
  supabase: RecoveryExchangeClient,
  code: string | null | undefined,
): Promise<RecoveryExchangeResult> {
  if (!code) return { status: 'no-code' };
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return { status: 'invalid' };
  return { status: 'ok' };
}
