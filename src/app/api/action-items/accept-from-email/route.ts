export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { resolveAppUrl } from '@/lib/url';
import { hashAcceptToken, verifyAcceptToken } from '@/lib/email/brief-token';
import {
  ActionItemOwnershipError,
  ActionItemValidationError,
  createActionItem,
} from '@/lib/action-items/create';
import type { MondayBriefRecommendedAction } from '@/lib/agents/monday-brief-agent';

/**
 * GET /api/action-items/accept-from-email?t=<signed-token>
 *
 * Magic-link landing for "Accept" buttons inside the Monday Brief email.
 * No login required — the HMAC-signed token IS the auth (24h expiry).
 *
 * Flow:
 *   1. Verify token signature + expiry
 *   2. Look up the brief (scoped by token's agency_id)
 *   3. Find the recommendedAction by id within the brief content
 *   4. Cross-check that the brief's action.client_id matches the token
 *   5. Insert into action_items with source_email_token_hash unique key
 *   6. On UNIQUE violation → already accepted, redirect to success anyway
 *   7. Redirect to /dashboard/proposals/accepted with a status query param
 */
export async function GET(request: NextRequest) {
  const appUrl = resolveAppUrl(request);
  const token = request.nextUrl.searchParams.get('t') ?? '';
  const secret = process.env.EMAIL_TOKEN_SECRET;

  if (!secret) {
    console.error('[accept-from-email] EMAIL_TOKEN_SECRET missing');
    return redirectStatus(appUrl, 'server-error');
  }

  const verified = verifyAcceptToken(token, secret);
  if (!verified.ok) {
    return redirectStatus(appUrl, verified.reason);
  }

  const { payload } = verified;
  const supabase = createServiceClient();
  const tokenHash = hashAcceptToken(token);

  // Look up the brief — scoped by agency_id from the token (defense-in-depth
  // even though the token's signature already vouches for the agency).
  const { data: brief, error: briefErr } = await supabase
    .from('monday_briefs')
    .select('id, agency_id, content')
    .eq('id', payload.briefId)
    .eq('agency_id', payload.agencyId)
    .maybeSingle();

  if (briefErr || !brief) {
    return redirectStatus(appUrl, 'brief-missing');
  }

  const action = findRecommendedAction(brief.content, payload.actionId);
  if (!action) {
    return redirectStatus(appUrl, 'action-missing');
  }
  if (action.clientId !== payload.clientId) {
    return redirectStatus(appUrl, 'bad-signature');
  }

  // Idempotent insert. If we've already accepted this exact magic link,
  // the unique index on source_email_token_hash trips — look up the prior
  // row and redirect as success.
  try {
    const inserted = await createActionItem({
      supabase,
      agencyId: payload.agencyId,
      input: {
        clientId: action.clientId,
        title: action.title,
        description: action.rationale,
      },
    });
    // Stamp the email-source hash so a re-click is a no-op.
    await supabase
      .from('action_items')
      .update({ source_email_token_hash: tokenHash })
      .eq('id', inserted.id);

    return redirectAccepted(appUrl, inserted.id, action.title, 'created');
  } catch (err) {
    if (err instanceof ActionItemOwnershipError) {
      return redirectStatus(appUrl, 'ownership');
    }
    if (err instanceof ActionItemValidationError) {
      return redirectStatus(appUrl, 'validation');
    }
    if (isUniqueViolation(err)) {
      const { data: existing } = await supabase
        .from('action_items')
        .select('id')
        .eq('source_email_token_hash', tokenHash)
        .maybeSingle();
      if (existing) {
        return redirectAccepted(
          appUrl,
          existing.id as string,
          action.title,
          'already-accepted',
        );
      }
    }
    console.error('[accept-from-email] insert failed', err);
    return redirectStatus(appUrl, 'server-error');
  }
}

function findRecommendedAction(
  content: unknown,
  actionId: string,
): MondayBriefRecommendedAction | null {
  if (!content || typeof content !== 'object') return null;
  const list = (content as { recommendedActions?: MondayBriefRecommendedAction[] })
    .recommendedActions;
  if (!Array.isArray(list)) return null;
  return list.find((a) => a.id === actionId) ?? null;
}

function isUniqueViolation(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const e = err as { code?: string; message?: string };
  if (e.code === '23505') return true;
  return Boolean(e.message && /duplicate key value/i.test(e.message));
}

function redirectStatus(appUrl: string, reason: string): NextResponse {
  const url = new URL('/dashboard/proposals/accepted', appUrl);
  url.searchParams.set('status', 'error');
  url.searchParams.set('reason', String(reason));
  return NextResponse.redirect(url, { status: 303 });
}

function redirectAccepted(
  appUrl: string,
  actionItemId: string,
  title: string,
  variant: 'created' | 'already-accepted',
): NextResponse {
  const url = new URL('/dashboard/proposals/accepted', appUrl);
  url.searchParams.set('status', 'ok');
  url.searchParams.set('id', actionItemId);
  url.searchParams.set('title', title);
  url.searchParams.set('variant', variant);
  return NextResponse.redirect(url, { status: 303 });
}
