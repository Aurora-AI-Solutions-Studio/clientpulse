// "See live demo" auto-signin (no Free tier — landing page CTA flow).
//
// Signs the user into the shared demo agency (`demo@helloaurora.ai`)
// via the SSR cookie-aware Supabase client, so the auth cookies land
// on the response and the subsequent /dashboard request is authed.
// Redirects to /dashboard on success, or back to / with an error
// query param on failure.
//
// Why a server-side route instead of a client autopost form:
//   - Keeps the demo password out of the JS bundle (it's already in
//     scripts/demo-seed/identities.ts which is publicly committed,
//     but the convention "auth secrets never in client JS" is worth
//     preserving for the next reader).
//   - One round-trip from button click to logged-in dashboard.
//   - The route is GET-only on purpose so it can be a plain <a href>
//     without form mechanics; it's not a state-changing action from
//     the user's browser perspective.

export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const DEMO_EMAIL = 'demo@helloaurora.ai';
// Public demo password — committed to scripts/demo-seed/identities.ts.
// Kept in env var so a real launch-day rotation is one Vercel update
// away, with a hard-coded fallback so a missing env var never breaks
// the public CTA (failure mode = "demo password rotated, env var not
// pushed yet" — current value still works).
const DEMO_PASSWORD = process.env.DEMO_USER_PASSWORD ?? 'AuroraDemo2026';

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: DEMO_EMAIL,
    password: DEMO_PASSWORD,
  });
  if (error) {
    console.error('[/api/demo/signin]', error.message);
    return NextResponse.redirect(new URL('/?demo_error=1', request.url));
  }
  return NextResponse.redirect(new URL('/dashboard', request.url));
}
