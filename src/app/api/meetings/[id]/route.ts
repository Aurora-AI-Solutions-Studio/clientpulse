export const dynamic = 'force-dynamic';
import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { MeetingWithIntelligence } from '@/types/meeting';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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

    // Fetch the specific meeting with intelligence and verify ownership
    const { data: meeting, error: meetingError } = await supabase
      .from('meetings')
      .select(
        `
        id,
        client_id,
        agency_id,
        title,
        meeting_date,
        duration_minutes,
        audio_url,
        transcript,
        status,
        created_at,
        meeting_intelligence (
          id,
          meeting_id,
          sentiment_score,
          action_items,
          scope_changes,
          stakeholder_engagement,
          escalation_signals,
          upsell_mentions,
          summary,
          extracted_at
        )
      `
      )
      .eq('id', id)
      .eq('agency_id', profile.agency_id)
      .single();

    if (meetingError || !meeting) {
      return NextResponse.json({ error: 'Meeting not found' }, { status: 404 });
    }

    // Map to MeetingWithIntelligence type
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mappedMeeting: MeetingWithIntelligence = {
      id: meeting.id,
      clientId: meeting.client_id,
      agencyId: meeting.agency_id,
      title: meeting.title,
      meetingDate: meeting.meeting_date,
      durationMinutes: meeting.duration_minutes,
      audioUrl: meeting.audio_url,
      transcript: meeting.transcript,
      status: meeting.status,
      createdAt: meeting.created_at,
      intelligence: meeting.meeting_intelligence && meeting.meeting_intelligence.length > 0
        ? {
            id: meeting.meeting_intelligence[0].id,
            meetingId: meeting.meeting_intelligence[0].meeting_id,
            sentimentScore: meeting.meeting_intelligence[0].sentiment_score,
            actionItems: meeting.meeting_intelligence[0].action_items || [],
            scopeChanges: meeting.meeting_intelligence[0].scope_changes || [],
            stakeholderEngagement: meeting.meeting_intelligence[0].stakeholder_engagement || {},
            escalationSignals: meeting.meeting_intelligence[0].escalation_signals || [],
            upsellMentions: meeting.meeting_intelligence[0].upsell_mentions || [],
            summary: meeting.meeting_intelligence[0].summary,
            extractedAt: meeting.meeting_intelligence[0].extracted_at,
          }
        : undefined,
    };

    return NextResponse.json(mappedMeeting);
  } catch (error) {
    console.error('Error fetching meeting:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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

    // Verify meeting ownership
    const { data: existingMeeting, error: checkError } = await supabase
      .from('meetings')
      .select('id')
      .eq('id', id)
      .eq('agency_id', profile.agency_id)
      .single();

    if (checkError || !existingMeeting) {
      return NextResponse.json(
        { error: 'Meeting not found or unauthorized' },
        { status: 404 }
      );
    }

    const body = await request.json();

    // Build update object with snake_case keys
    const updateData: Record<string, string | number | null> = {};
    if (body.title !== undefined) updateData.title = body.title;
    if (body.meetingDate !== undefined) updateData.meeting_date = body.meetingDate;
    if (body.transcript !== undefined) updateData.transcript = body.transcript;
    if (body.status !== undefined) updateData.status = body.status;

    // Update the meeting
    const { data: updatedMeeting, error: updateError } = await supabase
      .from('meetings')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json(
        { error: 'Failed to update meeting' },
        { status: 500 }
      );
    }

    // Map to type
    const mappedMeeting = {
      id: updatedMeeting.id,
      clientId: updatedMeeting.client_id,
      agencyId: updatedMeeting.agency_id,
      title: updatedMeeting.title,
      meetingDate: updatedMeeting.meeting_date,
      durationMinutes: updatedMeeting.duration_minutes,
      audioUrl: updatedMeeting.audio_url,
      transcript: updatedMeeting.transcript,
      status: updatedMeeting.status,
      createdAt: updatedMeeting.created_at,
    };

    return NextResponse.json(mappedMeeting);
  } catch (error) {
    console.error('Error updating meeting:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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

    // Verify meeting ownership and delete
    const { error: deleteError } = await supabase
      .from('meetings')
      .delete()
      .eq('id', id)
      .eq('agency_id', profile.agency_id);

    if (deleteError) {
      return NextResponse.json(
        { error: 'Failed to delete meeting' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting meeting:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
