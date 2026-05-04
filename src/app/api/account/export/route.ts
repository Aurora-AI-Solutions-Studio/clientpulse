import { NextResponse } from 'next/server';
import { getAuthedContext } from '@/lib/auth/get-authed-context';
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit';

/**
 * GET /api/account/export — GDPR Right of Access (Art. 15) + Data Portability (Art. 20)
 *
 * Returns the authenticated user's data across every table that holds
 * user-scoped or agency-scoped records, as a single JSON attachment.
 *
 * The table list is kept intentionally in sync with the account DELETE
 * handler — if a table holds user data for deletion purposes, it must also
 * be surfaced here for access purposes. When you add a table to one, add it
 * to the other.
 *
 * Rate-limited to 3 requests per hour per IP (same envelope as erasure).
 * OAuth tokens, webhook secrets, and other credentials are explicitly
 * redacted from the export — GDPR grants access to personal data, not to
 * the service's own secrets.
 */
export async function GET(request: Request) {
  const ip = request.headers.get('x-forwarded-for') || 'unknown';
  const rl = rateLimit(`export:${ip}`, { limit: 3, windowSec: 3600 });
  if (!rl.success) return rateLimitResponse(rl.reset);

  try {
    const auth = await getAuthedContext();
    if (!auth.ok) return auth.response;
    const { userId, email, serviceClient: admin } = auth.ctx;

    // Resolve the user's agency memberships (drives agency-scoped queries).
    const { data: memberships } = await admin
      .from('agency_members')
      .select('agency_id, role, joined_at')
      .eq('user_id', userId);

    const agencyIds = (memberships ?? []).map((m) => m.agency_id);

    // Agency-scoped tables (mirrors account DELETE deletionTables, minus
    // profiles / agency_members / agencies which need per-user queries).
    const agencyScopedTables = [
      'prediction_feedback',
      'action_items',
      'meeting_intelligence',
      'upsell_opportunities',
      'churn_predictions',
      'client_health_scores',
      'health_score_history',
      'engagement_metrics',
      'client_invoices',
      'email_threads',
      'calendar_events',
      'zoom_meetings',
      'meetings',
      'alerts',
      'approvals',
      'monday_briefs',
      'learning_snapshots',
      'client_outcomes',
      'slack_connections',
      'integration_connections',
      'retention_log',
      'client_assignments',
      'clients',
      'subscriptions',
      'team_invitations',
    ] as const;

    // Columns to redact on the way out — credentials, not personal data.
    const REDACTED_COLUMNS = new Set([
      'access_token',
      'refresh_token',
      'webhook_url',
      'webhook_secret',
      'api_key',
      'payload_hash',
    ]);

    const redact = <T extends Record<string, unknown>>(row: T): T => {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(row)) {
        out[k] = REDACTED_COLUMNS.has(k) ? '[redacted]' : v;
      }
      return out as T;
    };

    const data: Record<string, unknown> = {};

    // Per-user tables
    const { data: profile } = await admin
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();
    data.profile = profile ? redact(profile) : null;

    data.agency_memberships = memberships ?? [];

    if (agencyIds.length > 0) {
      const { data: agencies } = await admin
        .from('agencies')
        .select('*')
        .in('id', agencyIds);
      data.agencies = (agencies ?? []).map(redact);

      for (const table of agencyScopedTables) {
        const { data: rows, error } = await admin
          .from(table)
          .select('*')
          .in('agency_id', agencyIds);
        if (error) {
          // Tolerate missing-column / table-not-exists for forward compat.
          data[table] = { _error: error.message };
        } else {
          data[table] = (rows ?? []).map(redact);
        }
      }
    } else {
      data.agencies = [];
      for (const table of agencyScopedTables) data[table] = [];
    }

    const exportPayload = {
      exportedAt: new Date().toISOString(),
      exportedFor: {
        userId,
        email,
      },
      notice:
        'This export contains all personal data associated with your account ' +
        'under GDPR Art. 15 (Right of Access) and Art. 20 (Data Portability). ' +
        'Service credentials (OAuth tokens, webhook URLs, API keys, payload hashes) ' +
        'have been redacted as they are not personal data within the meaning of Art. 4(1).',
      data,
    };

    const filename = `clientpulse-export-${userId}-${Date.now()}.json`;

    return new NextResponse(JSON.stringify(exportPayload, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('Account export error:', error);
    return NextResponse.json(
      { error: 'An error occurred while preparing your data export.' },
      { status: 500 }
    );
  }
}
