// Aurora Suite SSO — verify endpoint (CP side).
// Receives a signed token from RF, verifies it, claims the nonce, looks
// up the user by email via service role, and bootstraps a CP session by
// generating a Supabase magiclink. The magiclink action_link redirects
// through Supabase's verify endpoint and back to /auth/callback?code=...
// where the existing PKCE flow exchanges it for a session cookie.
//
// If the email doesn't have a CP account, we redirect to signup with
// the email pre-filled — never auto-create accounts from a token.

import { NextRequest, NextResponse } from 'next/server';
import { verifyHandoff } from '@/lib/suite/handoff';
import { createServiceClient } from '@/lib/supabase/service';

function loginWithError(origin: string, code: string): NextResponse {
  return NextResponse.redirect(new URL(`/auth/login?error=${encodeURIComponent(code)}`, origin));
}

export async function GET(req: NextRequest) {
  const { searchParams, origin } = new URL(req.url);
  const token = searchParams.get('token');
  if (!token) return loginWithError(origin, 'handoff_missing_token');

  const result = verifyHandoff(token);
  if (!result.ok) return loginWithError(origin, `handoff_${result.reason}`);

  const { email, nonce, source } = result.payload;
  const supabase = createServiceClient();

  // Replay protection — first claim wins via PRIMARY KEY.
  const { error: nonceError } = await supabase
    .from('auth_handoff_nonces')
    .insert({ nonce, email, source });
  if (nonceError) {
    return loginWithError(origin, 'handoff_token_reused');
  }

  // Find existing user by email — we never auto-create from a token.
  const { data: lookup, error: lookupErr } = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 200,
  });
  if (lookupErr) {
    console.error('[suite/handoff] listUsers failed:', lookupErr);
    return loginWithError(origin, 'handoff_user_lookup');
  }
  const existing = lookup.users.find(
    (u) => (u.email ?? '').toLowerCase() === email.toLowerCase(),
  );
  if (!existing) {
    return NextResponse.redirect(
      new URL(`/auth/signup?email=${encodeURIComponent(email)}&suite=1`, origin),
    );
  }

  // Generate a magiclink — its action_link sets the session via the
  // standard /auth/callback?code=... PKCE exchange.
  const { data: linkData, error: linkErr } = await supabase.auth.admin.generateLink({
    type: 'magiclink',
    email,
    options: { redirectTo: `${origin}/auth/callback?next=/dashboard` },
  });
  if (linkErr || !linkData?.properties?.action_link) {
    console.error('[suite/handoff] generateLink failed:', linkErr);
    return loginWithError(origin, 'handoff_magiclink');
  }

  return NextResponse.redirect(linkData.properties.action_link);
}
