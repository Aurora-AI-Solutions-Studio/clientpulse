export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { SlackNotificationAgent } from '@/lib/agents/slack-notification-agent';
import { getAuthedContext } from '@/lib/auth/get-authed-context';

/**
 * Auth + agency resolution goes through getAuthedContext (service-client
 * profile lookup) — the auth-scoped Supabase client occasionally returns
 * null on profile lookup even for valid sessions (RLS-context drift,
 * Apr 25/26 incident; documented in get-authed-context.ts). This used to
 * surface as a misleading 404 "User profile not found" on every Slack
 * settings page load.
 */
export async function GET(_request: NextRequest) {
  try {
    const auth = await getAuthedContext();
    if (!auth.ok) return auth.response;
    const { agencyId, serviceClient } = auth.ctx;

    const { data: slackConnection, error: slackError } = await serviceClient
      .from('slack_connections')
      .select('*')
      .eq('agency_id', agencyId)
      .maybeSingle();

    if (slackError) {
      console.error('Error fetching Slack connection:', slackError);
      return NextResponse.json(
        { error: 'Failed to fetch Slack connection' },
        { status: 500 }
      );
    }

    if (!slackConnection) {
      return NextResponse.json({ connection: null });
    }

    return NextResponse.json({
      connection: {
        id: slackConnection.id,
        webhookUrl: slackConnection.webhook_url,
        channelName: slackConnection.channel_name,
        connectedBy: slackConnection.connected_by,
        isActive: slackConnection.is_active,
        notifyMondayBrief: slackConnection.notify_monday_brief,
        notifyChurnAlerts: slackConnection.notify_churn_alerts,
        notifyUpsell: slackConnection.notify_upsell,
        notifyHealthDrops: slackConnection.notify_health_drops,
        createdAt: slackConnection.created_at,
        lastMessageAt: slackConnection.last_message_at,
      },
    });
  } catch (error) {
    console.error('Error getting Slack connection:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthedContext();
    if (!auth.ok) return auth.response;
    const { userId, agencyId, serviceClient } = auth.ctx;

    // Owner / manager check — service-client read avoids the same RLS drift
    const { data: currentMember } = await serviceClient
      .from('agency_members')
      .select('role')
      .eq('user_id', userId)
      .eq('agency_id', agencyId)
      .maybeSingle();

    if (!currentMember || (currentMember.role !== 'owner' && currentMember.role !== 'manager')) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    const body = await request.json();

    if (!body.webhookUrl || !body.channelName) {
      return NextResponse.json(
        { error: 'webhookUrl and channelName are required' },
        { status: 400 }
      );
    }

    if (!body.webhookUrl.startsWith('https://hooks.slack.com/')) {
      return NextResponse.json(
        { error: 'Invalid webhook URL. Must start with https://hooks.slack.com/' },
        { status: 400 }
      );
    }

    const { data: existingConnection } = await serviceClient
      .from('slack_connections')
      .select('id')
      .eq('agency_id', agencyId)
      .maybeSingle();

    // Verify webhook works before persisting
    try {
      const agentInstance = new SlackNotificationAgent(body.webhookUrl);
      const testSuccess = await agentInstance.send({
        type: 'team_event',
        eventType: 'member_joined',
        message: 'Slack connection test - Connection successful!',
      });

      if (!testSuccess) {
        return NextResponse.json(
          { error: 'Failed to send test message. Webhook URL may be invalid.' },
          { status: 400 }
        );
      }
    } catch (error) {
      return NextResponse.json(
        { error: `Failed to test webhook: ${error instanceof Error ? error.message : 'Unknown error'}` },
        { status: 400 }
      );
    }

    let slackConnection;

    if (existingConnection) {
      const { data, error: updateError } = await serviceClient
        .from('slack_connections')
        .update({
          webhook_url: body.webhookUrl,
          channel_name: body.channelName,
          is_active: true,
          last_message_at: new Date().toISOString(),
        })
        .eq('agency_id', agencyId)
        .select()
        .single();

      if (updateError) {
        console.error('Error updating Slack connection:', updateError);
        return NextResponse.json(
          { error: 'Failed to update Slack connection' },
          { status: 500 }
        );
      }

      slackConnection = data;
    } else {
      const { data, error: insertError } = await serviceClient
        .from('slack_connections')
        .insert({
          agency_id: agencyId,
          webhook_url: body.webhookUrl,
          channel_name: body.channelName,
          connected_by: userId,
          is_active: true,
          notify_monday_brief: true,
          notify_churn_alerts: true,
          notify_upsell: true,
          notify_health_drops: true,
        })
        .select()
        .single();

      if (insertError) {
        console.error('Error creating Slack connection:', insertError);
        return NextResponse.json(
          { error: 'Failed to create Slack connection' },
          { status: 500 }
        );
      }

      slackConnection = data;
    }

    return NextResponse.json(
      {
        connection: {
          id: slackConnection.id,
          webhookUrl: slackConnection.webhook_url,
          channelName: slackConnection.channel_name,
          connectedBy: slackConnection.connected_by,
          isActive: slackConnection.is_active,
          notifyMondayBrief: slackConnection.notify_monday_brief,
          notifyChurnAlerts: slackConnection.notify_churn_alerts,
          notifyUpsell: slackConnection.notify_upsell,
          notifyHealthDrops: slackConnection.notify_health_drops,
          createdAt: slackConnection.created_at,
          lastMessageAt: slackConnection.last_message_at,
        },
      },
      { status: existingConnection ? 200 : 201 }
    );
  } catch (error) {
    console.error('Error creating/updating Slack connection:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(_request: NextRequest) {
  try {
    const auth = await getAuthedContext();
    if (!auth.ok) return auth.response;
    const { userId, agencyId, serviceClient } = auth.ctx;

    const { data: currentMember } = await serviceClient
      .from('agency_members')
      .select('role')
      .eq('user_id', userId)
      .eq('agency_id', agencyId)
      .maybeSingle();

    if (!currentMember || (currentMember.role !== 'owner' && currentMember.role !== 'manager')) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    const { error: deleteError } = await serviceClient
      .from('slack_connections')
      .delete()
      .eq('agency_id', agencyId);

    if (deleteError) {
      console.error('Error deleting Slack connection:', deleteError);
      return NextResponse.json(
        { error: 'Failed to delete Slack connection' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error disconnecting Slack:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
