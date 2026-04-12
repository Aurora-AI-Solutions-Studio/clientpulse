export const dynamic = 'force-dynamic';
import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(_request: NextRequest) {
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

    // Fetch Slack connection preferences for agency
    const { data: slackConnection, error: slackError } = await supabase
      .from('slack_connections')
      .select(
        'notify_monday_brief, notify_churn_alerts, notify_upsell, notify_health_drops'
      )
      .eq('agency_id', profile.agency_id)
      .single();

    if (slackError && slackError.code !== 'PGRST116') {
      // PGRST116 = no rows returned (expected if no connection)
      console.error('Error fetching Slack preferences:', slackError);
      return NextResponse.json(
        { error: 'Failed to fetch Slack preferences' },
        { status: 500 }
      );
    }

    // Return default preferences if no connection exists
    if (!slackConnection) {
      return NextResponse.json({
        preferences: {
          notifyMondayBrief: true,
          notifyChurnAlerts: true,
          notifyUpsell: true,
          notifyHealthDrops: true,
        },
      });
    }

    return NextResponse.json({
      preferences: {
        notifyMondayBrief: slackConnection.notify_monday_brief,
        notifyChurnAlerts: slackConnection.notify_churn_alerts,
        notifyUpsell: slackConnection.notify_upsell,
        notifyHealthDrops: slackConnection.notify_health_drops,
      },
    });
  } catch (error) {
    console.error('Error getting Slack preferences:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
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

    // Build update object with only provided fields
    const updateData: Record<string, boolean> = {};

    if (body.notifyMondayBrief !== undefined) {
      updateData.notify_monday_brief = body.notifyMondayBrief;
    }
    if (body.notifyChurnAlerts !== undefined) {
      updateData.notify_churn_alerts = body.notifyChurnAlerts;
    }
    if (body.notifyUpsell !== undefined) {
      updateData.notify_upsell = body.notifyUpsell;
    }
    if (body.notifyHealthDrops !== undefined) {
      updateData.notify_health_drops = body.notifyHealthDrops;
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: 'No preferences to update' },
        { status: 400 }
      );
    }

    // Update preferences
    const { data: updated, error: updateError } = await supabase
      .from('slack_connections')
      .update(updateData)
      .eq('agency_id', profile.agency_id)
      .select(
        'notify_monday_brief, notify_churn_alerts, notify_upsell, notify_health_drops'
      )
      .single();

    if (updateError) {
      console.error('Error updating Slack preferences:', updateError);
      return NextResponse.json(
        { error: 'Failed to update Slack preferences' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      preferences: {
        notifyMondayBrief: updated.notify_monday_brief,
        notifyChurnAlerts: updated.notify_churn_alerts,
        notifyUpsell: updated.notify_upsell,
        notifyHealthDrops: updated.notify_health_drops,
      },
    });
  } catch (error) {
    console.error('Error updating Slack preferences:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
