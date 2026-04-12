export const dynamic = 'force-dynamic';
import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { SlackNotificationAgent } from '@/lib/agents/slack-notification-agent';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Get current user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's agency ID
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('agency_id')
      .eq('id', user.id)
      .single();

    if (profileError || !profile?.agency_id) {
      return NextResponse.json(
        { error: 'User profile not found' },
        { status: 404 }
      );
    }

    // Fetch Slack connection for agency
    const { data: slackConnection, error: slackError } = await supabase
      .from('slack_connections')
      .select('*')
      .eq('agency_id', profile.agency_id)
      .single();

    if (slackError && slackError.code !== 'PGRST116') {
      // PGRST116 = no rows returned (expected if no connection)
      console.error('Error fetching Slack connection:', slackError);
      return NextResponse.json(
        { error: 'Failed to fetch Slack connection' },
        { status: 500 }
      );
    }

    // Return null if no connection exists
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
    const supabase = await createClient();

    // Get current user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's agency ID and check permissions
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('agency_id')
      .eq('id', user.id)
      .single();

    if (profileError || !profile?.agency_id) {
      return NextResponse.json(
        { error: 'User profile not found' },
        { status: 404 }
      );
    }

    // Check if user is owner or manager
    const { data: currentMember } = await supabase
      .from('agency_members')
      .select('role')
      .eq('user_id', user.id)
      .eq('agency_id', profile.agency_id)
      .single();

    if (!currentMember || (currentMember.role !== 'owner' && currentMember.role !== 'manager')) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    const body = await request.json();

    // Validate required fields
    if (!body.webhookUrl || !body.channelName) {
      return NextResponse.json(
        { error: 'webhookUrl and channelName are required' },
        { status: 400 }
      );
    }

    // Validate webhook URL format
    if (!body.webhookUrl.startsWith('https://hooks.slack.com/')) {
      return NextResponse.json(
        { error: 'Invalid webhook URL. Must start with https://hooks.slack.com/' },
        { status: 400 }
      );
    }

    // Check if connection already exists
    const { data: existingConnection } = await supabase
      .from('slack_connections')
      .select('id')
      .eq('agency_id', profile.agency_id)
      .single();

    // Send test message to verify webhook
    try {
      const agent = new SlackNotificationAgent(body.webhookUrl);
      const testSuccess = await agent.send({
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
      // Update existing connection
      const { data, error: updateError } = await supabase
        .from('slack_connections')
        .update({
          webhook_url: body.webhookUrl,
          channel_name: body.channelName,
          is_active: true,
          last_message_at: new Date().toISOString(),
        })
        .eq('agency_id', profile.agency_id)
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
      // Create new connection
      const { data, error: insertError } = await supabase
        .from('slack_connections')
        .insert({
          agency_id: profile.agency_id,
          webhook_url: body.webhookUrl,
          channel_name: body.channelName,
          connected_by: user.id,
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

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Get current user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's agency ID and check permissions
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('agency_id')
      .eq('id', user.id)
      .single();

    if (profileError || !profile?.agency_id) {
      return NextResponse.json(
        { error: 'User profile not found' },
        { status: 404 }
      );
    }

    // Check if user is owner or manager
    const { data: currentMember } = await supabase
      .from('agency_members')
      .select('role')
      .eq('user_id', user.id)
      .eq('agency_id', profile.agency_id)
      .single();

    if (!currentMember || (currentMember.role !== 'owner' && currentMember.role !== 'manager')) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    // Delete Slack connection
    const { error: deleteError } = await supabase
      .from('slack_connections')
      .delete()
      .eq('agency_id', profile.agency_id);

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
