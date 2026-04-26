// Aurora Suite SSO — verify endpoint (CP side).
//
// Receives a signed token from RF, verifies HMAC + exp + nonce, looks
// up the user in CP's auth.users by email, and bootstraps a CP session
// by:
//   1) generating a Supabase magic-link via service role to mint a
//      short-lived hashed_token bound to the user's email,
//   2) calling auth.verifyOtp(token_hash) using the SSR (cookie-bound)
//      client — this exchanges the token for a session and writes the
//      Supabase auth cookies onto our app domain in one server step.
//
// Why this shape, not redirect-through-Supabase: the redirect approach
// returns the access_token in the URL fragment under implicit flow,
// which the server-side /auth/callback can't see (`?error=no_code` +
// `#access_token=…`). Hit this on first smoke test (Sasa, Apr 26).
// verifyOtp on the cookie-bound client sets the session cookie
// directly on our app, no fragment, no PKCE ambiguity.

import { NextRequest, NextResponse } from 'next/server';
import { verifyHandoff } from '@/lib/suite/handoff';
import { createClient } from '@/lib/supabase/server';
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
  const admin = createServiceClient();

  // Replay protection — first claim wins via PRIMARY KEY.
  const { error: nonceError } = await admin
    .from('auth_handoff_nonces')
    .insert({ nonce, email, source });
  if (nonceError) {
    return loginWithError(origin, 'handoff_token_reused');
  }

  // Find existing user by email — never auto-create from a token.
  const { data: lookup, error: lookupErr } = await admin.auth.admin.listUsers({
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

  // Mint a fresh hashed_token via admin.generateLink, then verify it
  // on the SSR (cookie-bound) client to set the session cookie on the
  // CP domain. Single server hop — the user never sees Supabase URLs.
  const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email,
  });
  const hashedToken = linkData?.properties?.hashed_token;
  if (linkErr || !hashedToken) {
    console.error('[suite/handoff] generateLink failed:', linkErr);
    return loginWithError(origin, 'handoff_magiclink');
  }

  const ssr = await createClient();
  const { error: verifyErr } = await ssr.auth.verifyOtp({
    type: 'magiclink',
    token_hash: hashedToken,
  });
  if (verifyErr) {
    console.error('[suite/handoff] verifyOtp failed:', verifyErr);
    return loginWithError(origin, 'handoff_verify_otp');
  }

  return NextResponse.redirect(new URL('/dashboard', origin));
}
