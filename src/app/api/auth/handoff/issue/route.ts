// Aurora Suite SSO — issue endpoint (CP side).
// Authed CP user clicks the RF link in the product switcher; we sign a
// short-lived token bound to their email and redirect them to RF's
// /auth/handoff verifier. RF mirrors this for the CP→RF direction.
//
// The Suite gate keys off `profiles.has_suite_access` — a real flag
// flipped only for buyers of the Aurora Suite bundle ($999/mo Stripe
// SKU). Agency-tier-only customers do NOT get cross-product access.

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

  // Suite gate — read via service-role to dodge the documented CP
  // auth-client RLS context drift (Apr 25). The .eq('id', user.id)
  // filter scopes the read to the authed user's row.
  const profileService = createServiceClient();
  const { data: profile } = await profileService
    .from('profiles')
    .select('has_suite_access')
    .eq('id', user.id)
    .maybeSingle();

  if (!profile?.has_suite_access) {
    // No Suite access. Bounce to upgrade with a hint — UI also hides
    // the switcher for non-Suite users; this is the security backstop.
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
