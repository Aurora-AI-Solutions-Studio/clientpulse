export const dynamic = 'force-dynamic';
import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { Meeting, MeetingWithIntelligence, MeetingCreateInput } from '@/types/meeting';

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

    // Get query params
    const searchParams = request.nextUrl.searchParams;
    const clientId = searchParams.get('clientId');

    // Build query
    let query = supabase
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
      .eq('agency_id', profile.agency_id);

    // Filter by client if provided
    if (clientId) {
      query = query.eq('client_id', clientId);
    }

    // Order by meeting_date descending
    query = query.order('meeting_date', { ascending: false });

    const { data: meetings, error: meetingsError } = await query;

    if (meetingsError) {
      return NextResponse.json(
        { error: 'Failed to fetch meetings' },
        { status: 500 }
      );
    }

    // Map to typed response
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mappedMeetings: MeetingWithIntelligence[] = (meetings || []).map((m: any) => ({
      id: m.id,
      clientId: m.client_id,
      agencyId: m.agency_id,
      title: m.title,
      meetingDate: m.meeting_date,
      durationMinutes: m.duration_minutes,
      audioUrl: m.audio_url,
      transcript: m.transcript,
      status: m.status,
      createdAt: m.created_at,
      intelligence: m.meeting_intelligence && m.meeting_intelligence.length > 0
        ? {
            id: m.meeting_intelligence[0].id,
            meetingId: m.meeting_intelligence[0].meeting_id,
            sentimentScore: m.meeting_intelligence[0].sentiment_score,
            actionItems: m.meeting_intelligence[0].action_items || [],
            scopeChanges: m.meeting_intelligence[0].scope_changes || [],
            stakeholderEngagement: m.meeting_intelligence[0].stakeholder_engagement || {},
            escalationSignals: m.meeting_intelligence[0].escalation_signals || [],
            upsellMentions: m.meeting_intelligence[0].upsell_mentions || [],
            summary: m.meeting_intelligence[0].summary,
            extractedAt: m.meeting_intelligence[0].extracted_at,
          }
        : undefined,
    }));

    return NextResponse.json(mappedMeetings);
  } catch (error) {
    console.error('Error fetching meetings:', error);
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

    const body: MeetingCreateInput = await request.json();

    // Validate required fields
    if (!body.clientId || !body.title || !body.meetingDate) {
      return NextResponse.json(
        { error: 'clientId, title, and meetingDate are required' },
        { status: 400 }
      );
    }

    // Create meeting in database
    const { data: newMeeting, error: createError } = await supabase
      .from('meetings')
      .insert({
        client_id: body.clientId,
        agency_id: profile.agency_id,
        title: body.title,
        meeting_date: body.meetingDate,
        duration_minutes: body.durationMinutes,
        status: 'scheduled',
      })
      .select()
      .single();

    if (createError) {
      console.error('Error creating meeting:', createError);
      return NextResponse.json(
        { error: 'Failed to create meeting' },
        { status: 500 }
      );
    }

    // Map to Meeting type
    const mappedMeeting: Meeting = {
      id: newMeeting.id,
      clientId: newMeeting.client_id,
      agencyId: newMeeting.agency_id,
      title: newMeeting.title,
      meetingDate: newMeeting.meeting_date,
      durationMinutes: newMeeting.duration_minutes,
      audioUrl: newMeeting.audio_url,
      transcript: newMeeting.transcript,
      status: newMeeting.status,
      createdAt: newMeeting.created_at,
    };

    return NextResponse.json(mappedMeeting, { status: 201 });
  } catch (error) {
    console.error('Error creating meeting:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
