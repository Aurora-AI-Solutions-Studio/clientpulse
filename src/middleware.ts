import { NextResponse, type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';
import { isEuRequest, isEuAllowedPath } from '@/lib/geo/eu';

export async function middleware(request: NextRequest) {
  // EU-27 geoblock — runs before any auth work. Aurora's launch
  // posture is US + UK + CA + AU + NZ only; EU-27 visitors land on
  // /eu-waitlist until HRAI compliance clears (Aug 2, 2026 EU AI Act
  // enforcement). UK / CH / NO are NOT in EU-27 — they pass through.
  // /eu-waitlist + /api/eu-waitlist are whitelisted so the redirect
  // can't loop and the form can submit.
  if (isEuRequest(request.headers) && !isEuAllowedPath(request.nextUrl.pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = '/eu-waitlist';
    url.search = '';
    return NextResponse.redirect(url);
  }

  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     *
     * /api/* IS matched so the EU geoblock fires on direct API hits.
     */
    '/((?!_next/static|_next/image|favicon.ico|public).*)',
  ],
};
