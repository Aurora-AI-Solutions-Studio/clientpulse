export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { verifyUnsubscribeToken } from '@/lib/email/unsubscribe-token';

/**
 * GET  /api/unsubscribe?t=<token>  — fallback when an email client opens
 *                                    the List-Unsubscribe URL via GET.
 *                                    Sets the opt-out and 302s to the
 *                                    confirmation page.
 * POST /api/unsubscribe?t=<token>  — RFC 8058 one-click endpoint that
 *                                    Gmail / Apple Mail call when the
 *                                    user taps the inbox button. Same
 *                                    opt-out write, JSON 200 response.
 *
 * Idempotent: if `brief_optout_at` is already set, the write succeeds
 * (no-op semantics for the user — they're still opted out).
 */
async function handle(request: NextRequest, method: 'GET' | 'POST') {
  const secret = process.env.EMAIL_TOKEN_SECRET;
  if (!secret) {
    console.error('[/api/unsubscribe] EMAIL_TOKEN_SECRET not configured');
    return method === 'GET'
      ? NextResponse.redirect(new URL('/unsubscribe?status=error', request.url), 302)
      : NextResponse.json({ error: 'Server not configured' }, { status: 500 });
  }

  const token = new URL(request.url).searchParams.get('t') ?? '';
  const verified = verifyUnsubscribeToken(token, secret);
  if (!verified.ok) {
    return method === 'GET'
      ? NextResponse.redirect(
          new URL(`/unsubscribe?status=invalid&reason=${verified.reason}`, request.url),
          302,
        )
      : NextResponse.json({ error: 'Invalid token', reason: verified.reason }, { status: 400 });
  }

  const service = createServiceClient();
  const { error } = await service
    .from('profiles')
    .update({ brief_optout_at: new Date().toISOString() })
    .eq('id', verified.payload.userId);

  if (error) {
    console.error('[/api/unsubscribe] update failed', error);
    return method === 'GET'
      ? NextResponse.redirect(new URL('/unsubscribe?status=error', request.url), 302)
      : NextResponse.json({ error: 'Failed to opt out' }, { status: 500 });
  }

  return method === 'GET'
    ? NextResponse.redirect(new URL('/unsubscribe?status=ok', request.url), 302)
    : NextResponse.json({ ok: true });
}

export async function GET(request: NextRequest) {
  return handle(request, 'GET');
}

export async function POST(request: NextRequest) {
  return handle(request, 'POST');
}
