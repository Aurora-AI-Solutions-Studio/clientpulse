export const dynamic = 'force-dynamic';
import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { SlackNotificationAgent } from '@/lib/agents/slack-notification-agent';

export async function POST(_request: NextRequest) {
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
      .select('webhook_url')
      .eq('agency_id', profile.agency_id)
      .single();

    if (slackError || !slackConnection) {
      return NextResponse.json(
        { error: 'No Slack connection found for this agency' },
        { status: 404 }
      );
    }

    // Send test message
    const agent = new SlackNotificationAgent(slackConnection.webhook_url);
    const success = await agent.send({
      type: 'team_event',
      eventType: 'member_joined',
      message: 'This is a test message from ClientPulse',
      details: {
        'Time': new Date().toISOString(),
        'Test': 'Connection verified'
      }
    });

    if (!success) {
      return NextResponse.json(
        { error: 'Failed to send test message to Slack' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, message: 'Test message sent to Slack' });
  } catch (error) {
    console.error('Error sending test Slack message:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
