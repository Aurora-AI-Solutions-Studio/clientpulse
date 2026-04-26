// Aurora Suite SSO — issue endpoint (CP side).
// Authed CP user clicks the RF link in the product switcher; we sign a
// short-lived token bound to their email and redirect them to RF's
// /auth/handoff verifier. RF mirrors this for the CP→RF direction.
//
// Server-side tier check is the security backstop — even if the UI
// somehow surfaces the link to a non-Suite user, this route refuses.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
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
  const { data: profile } = await supabase
    .from('profiles')
    .select('subscription_plan')
    .eq('id', user.id)
    .single();

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
