// Single Resend send path for the whole app.
//
// Replaces the three near-identical `sendBriefEmail` helpers that were
// scattered across /api/monday-brief, /api/cron/monday-brief and /api/team.
// Same code path, one place to evolve, one place to test.
//
// Returns a discriminated result so callers can tell "skipped because the
// API key isn't configured" apart from "Resend rejected our payload" — the
// monday-brief flow needs to know which one to react to.

export interface SendEmailArgs {
  to: string;
  subject: string;
  html: string;
  text?: string;
  /** Override the default sender. If omitted, RESEND_FROM_EMAIL is used. */
  from?: string;
  /** Optional reply-to header. */
  replyTo?: string;
  /** Optional list of CC recipients. */
  cc?: string[];
  /** Optional Resend tags (string key → string value). */
  tags?: Record<string, string>;
}

export type SendEmailResult =
  | { ok: true; id: string }
  | { ok: false; skipped: true; reason: 'no-api-key' }
  | { ok: false; skipped: false; status: number; error: string };

const DEFAULT_FROM = 'ClientPulse <brief@helloaurora.ai>';

export async function sendEmail(args: SendEmailArgs): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return { ok: false, skipped: true, reason: 'no-api-key' };
  }

  const from = args.from ?? process.env.RESEND_FROM_EMAIL ?? DEFAULT_FROM;

  const payload: Record<string, unknown> = {
    from,
    to: args.to,
    subject: args.subject,
    html: args.html,
  };
  if (args.text) payload.text = args.text;
  if (args.replyTo) payload.reply_to = args.replyTo;
  if (args.cc && args.cc.length > 0) payload.cc = args.cc;
  if (args.tags) {
    payload.tags = Object.entries(args.tags).map(([name, value]) => ({
      name,
      value,
    }));
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errorText = await res.text();
      return {
        ok: false,
        skipped: false,
        status: res.status,
        error: errorText,
      };
    }

    const body = (await res.json()) as { id?: string };
    return { ok: true, id: body.id ?? '' };
  } catch (err) {
    return {
      ok: false,
      skipped: false,
      status: 0,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
