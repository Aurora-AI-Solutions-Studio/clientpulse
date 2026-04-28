// Single shared "generate + persist + email" pipeline for the Monday Brief.
//
// Used by:
//   - POST /api/monday-brief        (user-initiated from /dashboard/brief)
//   - POST /api/cron/monday-brief   (Monday 8am cron, all agencies)
//   - First-Brief auto-trigger      (3rd client added)
//
// Single path → single set of bugs to fix. Returns a typed result so each
// caller can decide what to do with persistence + email outcomes.

import type { SupabaseClient } from '@supabase/supabase-js';
import { MondayBriefAgent } from '@/lib/agents/monday-brief-agent';
import {
  buildBriefSubject,
  renderBriefEmailHtml,
  renderBriefEmailText,
  type BriefAgencyBranding,
} from '@/lib/agents/brief-email';
import { sendEmail } from '@/lib/email/resend';
import { signAcceptToken } from '@/lib/email/brief-token';
import { signUnsubscribeToken } from '@/lib/email/unsubscribe-token';

export interface SendBriefArgs {
  supabase: SupabaseClient;
  agency: {
    id: string;
    name: string | null;
    brandLogoUrl?: string | null;
    brandColor?: string | null;
  };
  /**
   * Owner of the agency. Used to (a) deliver the email and (b) sign a
   * per-user one-click unsubscribe link. Skip email when `email` is null.
   */
  ownerUserId?: string | null;
  /** Owner email to deliver to. Skip email if null. */
  to: string | null;
  /** When false, generate + persist only (no email). */
  send: boolean;
  /** Used to build absolute URLs (accept links, dashboard, model card). */
  appUrl: string;
  /** Required when send=true (sign accept tokens). */
  emailTokenSecret?: string;
}

export interface SendBriefResult {
  briefId: string;
  emailStatus: 'sent' | 'no-recipient' | 'skipped-no-key' | 'failed' | 'not-requested';
  emailError?: string;
  /** Render args we actually used — handy for tests + audit log. */
  weekOf: string;
}

export async function generateAndSendBrief(args: SendBriefArgs): Promise<SendBriefResult> {
  const { supabase, agency, ownerUserId, to, send, appUrl, emailTokenSecret } = args;

  const agent = new MondayBriefAgent(supabase);
  const content = await agent.generate(agency.id);

  const { data: saved, error: insertErr } = await supabase
    .from('monday_briefs')
    .insert({ agency_id: agency.id, content, email_sent: false })
    .select('id')
    .single();

  if (insertErr || !saved) {
    throw new Error(`Failed to persist brief: ${insertErr?.message ?? 'unknown'}`);
  }

  const briefId = saved.id as string;

  if (!send) {
    return { briefId, emailStatus: 'not-requested', weekOf: content.weekOf };
  }
  if (!to) {
    return { briefId, emailStatus: 'no-recipient', weekOf: content.weekOf };
  }
  if (!emailTokenSecret) {
    throw new Error('emailTokenSecret is required when send=true');
  }

  const branding: BriefAgencyBranding = {
    name: agency.name,
    brandLogoUrl: agency.brandLogoUrl ?? null,
    brandColor: agency.brandColor ?? null,
  };

  const acceptUrlFor = (actionId: string): string => {
    const action = (content.recommendedActions ?? []).find((a) => a.id === actionId);
    if (!action) return `${appUrl}/dashboard/proposals`;
    const token = signAcceptToken(
      {
        agencyId: agency.id,
        briefId,
        actionId,
        clientId: action.clientId,
        issuedAt: Date.now(),
      },
      emailTokenSecret,
    );
    return `${appUrl}/api/action-items/accept-from-email?t=${encodeURIComponent(token)}`;
  };

  const renderArgs = {
    brief: content,
    agency: branding,
    acceptUrlFor,
    dashboardUrl: `${appUrl}/dashboard`,
    modelCardUrl: `${appUrl}/model-card`,
  };

  // One-click unsubscribe — required by Gmail's bulk-sender policy + Apple
  // Mail's button. Only sign when we have an owner id (cron path); user-
  // initiated sends through /api/monday-brief don't include the headers
  // because they're transactional, not bulk.
  let unsubscribeUrl: string | undefined;
  if (ownerUserId) {
    const token = signUnsubscribeToken(
      { userId: ownerUserId, list: 'monday-brief', issuedAt: Date.now() },
      emailTokenSecret,
    );
    unsubscribeUrl = `${appUrl}/api/unsubscribe?t=${encodeURIComponent(token)}`;
  }

  const result = await sendEmail({
    to,
    subject: buildBriefSubject(renderArgs),
    html: renderBriefEmailHtml(renderArgs),
    text: renderBriefEmailText(renderArgs),
    tags: { product: 'clientpulse', kind: 'monday-brief', agency_id: agency.id },
    unsubscribeUrl,
  });

  if (result.ok) {
    await supabase
      .from('monday_briefs')
      .update({ email_sent: true, sent_at: new Date().toISOString() })
      .eq('id', briefId);
    return { briefId, emailStatus: 'sent', weekOf: content.weekOf };
  }

  if (result.skipped) {
    return { briefId, emailStatus: 'skipped-no-key', weekOf: content.weekOf };
  }

  return {
    briefId,
    emailStatus: 'failed',
    emailError: result.error,
    weekOf: content.weekOf,
  };
}
