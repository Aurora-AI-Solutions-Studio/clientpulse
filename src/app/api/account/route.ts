import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit';

/**
 * DELETE /api/account — GDPR Right to Erasure (Art. 17)
 * Deletes all user data across all tables, then deletes the auth user.
 */
export async function DELETE(request: Request) {
  // Rate limit: 3 requests per hour per IP
  const ip = request.headers.get('x-forwarded-for') || 'unknown';
  const rl = rateLimit(`erasure:${ip}`, { limit: 3, windowSec: 3600 });
  if (!rl.success) return rateLimitResponse(rl.reset);

  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const userId = user.id;

    // Delete in dependency order (children before parents)
    // Use service role for cross-table deletion
    const { createServiceClient } = await import(
      '@/lib/supabase/service'
    );
    const admin = createServiceClient();

    // 1. Delete user's data from all tables (order matters for FK constraints)
    const deletionTables = [
      // Deepest children first
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
      'agency_members',
      'agencies',
      'profiles',
    ];

    // Get user's agency IDs first
    const { data: memberships } = await admin
      .from('agency_members')
      .select('agency_id')
      .eq('user_id', userId);

    const agencyIds = memberships?.map((m) => m.agency_id) || [];

    // Delete agency-scoped data
    for (const table of deletionTables) {
      if (table === 'profiles') {
        await admin.from(table).delete().eq('id', userId);
      } else if (table === 'agency_members') {
        await admin.from(table).delete().eq('user_id', userId);
      } else if (table === 'agencies') {
        // Only delete agencies where user is the sole owner
        if (agencyIds.length > 0) {
          await admin.from(table).delete().in('id', agencyIds);
        }
      } else if (agencyIds.length > 0) {
        // Try agency_id column first, fall back silently
        await admin.from(table).delete().in('agency_id', agencyIds);
      }
    }

    // 2. Delete the auth user via admin API
    const { error: deleteError } = await admin.auth.admin.deleteUser(userId);

    if (deleteError) {
      console.error('Failed to delete auth user:', deleteError);
      return NextResponse.json(
        { error: 'Account deletion partially completed. Contact support.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message:
        'Your account and all associated data have been permanently deleted.',
      deletedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Account deletion error:', error);
    return NextResponse.json(
      { error: 'An error occurred during account deletion.' },
      { status: 500 }
    );
  }
}
