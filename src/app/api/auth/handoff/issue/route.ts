// Aurora Suite SSO — issue endpoint (CP side).
// Authed CP user clicks the RF link in the product switcher; we sign a
// short-lived token bound to their email and redirect them to RF's
// /auth/handoff verifier. RF mirrors this for the CP→RF direction.
//
// Server-side tier check is the security backstop — even if the UI
// somehow surfaces the link to a non-Suite user, this route refuses.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { signHandoff } from '@/lib/suite/handoff';

const RF_BASE = process.env.NEXT_PUBLIC_RF_BASE_URL ?? 'https://reforge.helloaurora.ai';

export async function GET(req: NextRequest) {
  const { searchParams, origin } = new URL(req.url);
  const to = searchParams.get('to');
  if (to !== 'rf') {
    return NextResponse.redirect(new URL('/dashboard', origin));
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(
      new URL(`/auth/login?next=${encodeURIComponent('/api/auth/handoff/issue?to=rf')}`, origin),
    );
  }
  if (!user.email) {
    return NextResponse.redirect(new URL('/dashboard?error=no_email', origin));
  }

  // Suite gate — proxy via subscription_plan === 'agency' until a
  // dedicated has_suite_access flag lands. See handoff.ts threat model.
  //
  // IMPORTANT: read the profile via service-role, NOT the auth-bound
  // SSR client. CP has a documented RLS context drift where the
  // auth-client `.from('profiles').eq('id', user.id)` can return null
  // even when the row exists (Apr 25 incident — `/api/me` 404'd silently
  // for the same reason; fix was to switch to service-role after
  // auth.getUser() verifies the session). The .eq('id', user.id)
  // filter scopes the service-role read to the authed user's row.
  const profileService = createServiceClient();
  const { data: profile } = await profileService
    .from('profiles')
    .select('subscription_plan')
    .eq('id', user.id)
    .maybeSingle();

  if (profile?.subscription_plan !== 'agency') {
    return NextResponse.redirect(new URL('/dashboard/upgrade?reason=suite', origin));
  }

  let token: string;
  try {
    token = signHandoff(user.email, 'cp');
  } catch (err) {
    console.error('[suite/handoff] sign failed:', err);
    return NextResponse.redirect(`${RF_BASE}/auth/login?error=sso_not_configured`);
  }

  return NextResponse.redirect(`${RF_BASE}/auth/handoff?token=${encodeURIComponent(token)}`);
}
