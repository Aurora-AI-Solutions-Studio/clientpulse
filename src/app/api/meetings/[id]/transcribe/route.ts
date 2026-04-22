export const dynamic = 'force-dynamic';
import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { WhisperTranscriptionAgent } from '@/lib/agents/whisper-transcription-agent';
import { MeetingIntelligenceAgent } from '@/lib/agents/meeting-intelligence-agent';
import { checkRateLimit, RATE_LIMITS } from '@/lib/api-rate-limit';
import { requireTier, TierLimitError } from '@/lib/tiers';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // §12.2 Rate limit: 5/min per IP — expensive AI endpoint.
  const rl = checkRateLimit(request, 'meetings-transcribe', RATE_LIMITS.aiExpensive);
  if (rl) return rl;

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

    // Get user's agency ID and subscription plan (Sprint 8A M1.1)
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('agency_id, subscription_plan')
      .eq('id', user.id)
      .single();

    if (profileError || !profile?.agency_id) {
      return NextResponse.json(
        { error: 'User profile not found' },
        { status: 404 }
      );
    }

    // Meeting transcription + Meeting Intelligence are Pro+ per D-D2.
    try {
      requireTier({ subscription_plan: profile.subscription_plan }, 'pro');
    } catch (err) {
      if (err instanceof TierLimitError) {
        return NextResponse.json(
          { error: err.message, dimension: err.dimension, tier: err.tier },
          { status: err.status }
        );
      }
      throw err;
    }

    const subscriptionPlan = (profile.subscription_plan as 'solo' | 'pro' | 'agency' | null) ?? 'solo';

    // Get meeting record and verify ownership
    const { data: meeting, error: meetingError } = await supabase
      .from('meetings')
      .select('*')
      .eq('id', id)
      .eq('agency_id', profile.agency_id)
      .single();

    if (meetingError || !meeting) {
      return NextResponse.json({ error: 'Meeting not found' }, { status: 404 });
    }

    // Validate audio_url exists
    if (!meeting.audio_url) {
      return NextResponse.json(
        { error: 'No audio URL found for this meeting' },
        { status: 400 }
      );
    }

    // Get client info for context
    const { data: client } = await supabase
      .from('clients')
      .select('name')
      .eq('id', meeting.client_id)
      .single();

    // Update status to 'processing'
    await supabase
      .from('meetings')
      .update({ status: 'processing' })
      .eq('id', id);

    // Step 1: Transcribe audio
    const transcriptionAgent = new WhisperTranscriptionAgent();
    let transcript: string;
    try {
      const transcriptionResult = await transcriptionAgent.transcribeAudio(meeting.audio_url);
      transcript = transcriptionResult.text;
    } catch (transcriptionError) {
      console.error('Transcription failed:', transcriptionError);
      // Update meeting status to failed
      await supabase
        .from('meetings')
        .update({ status: 'failed' })
        .eq('id', id);

      return NextResponse.json(
        { error: `Transcription failed: ${transcriptionError instanceof Error ? transcriptionError.message : 'Unknown error'}` },
        { status: 500 }
      );
    }

    // Update meeting with transcript and status='completed'
    const { error: updateTranscriptError } = await supabase
      .from('meetings')
      .update({
        transcript: transcript,
        status: 'completed',
      })
      .eq('id', id);

    if (updateTranscriptError) {
      console.error('Error updating transcript:', updateTranscriptError);
      return NextResponse.json(
        { error: 'Failed to update meeting with transcript' },
        { status: 500 }
      );
    }

    // Step 2: Extract meeting intelligence if we have transcript
    // Sprint 8A M1.1: plan drives which model the router selects.
    const intelligenceAgent = new MeetingIntelligenceAgent(subscriptionPlan);
    const clientName = client?.name || 'Unknown';

    let intelligenceData;
    try {
      intelligenceData = await intelligenceAgent.extractMeetingIntelligence(
        transcript,
        clientName
      );
    } catch (intelligenceError) {
      console.error('Intelligence extraction failed:', intelligenceError);
      // Continue even if intelligence extraction fails
      intelligenceData = null;
    }

    // Step 3: Insert into meeting_intelligence table if we have data
    if (intelligenceData) {
      const { error: intelligenceInsertError } = await supabase
        .from('meeting_intelligence')
        .upsert({
          meeting_id: id,
          sentiment_score: intelligenceData.sentiment_score,
          action_items: intelligenceData.action_items,
          scope_changes: intelligenceData.scope_changes,
          stakeholder_engagement: intelligenceData.stakeholder_engagement,
          escalation_signals: intelligenceData.escalation_signals,
          upsell_mentions: intelligenceData.upsell_mentions,
          summary: intelligenceData.summary,
          extracted_at: intelligenceData.extracted_at,
        })
        .eq('meeting_id', id);

      if (intelligenceInsertError) {
        console.error('Error inserting meeting intelligence:', intelligenceInsertError);
        // Continue even if this fails
      }

      // Step 4: Extract action items and insert into action_items table
      if (intelligenceData.action_items && intelligenceData.action_items.length > 0) {
        const actionItems = intelligenceData.action_items.map((item) => ({
          client_id: meeting.client_id,
          meeting_id: id,
          title: item.title,
          description: `From meeting: ${meeting.title}`,
          status: 'open',
          due_date: item.deadline || null,
          assigned_to: item.assignee !== 'TBD' ? item.assignee : null,
        }));

        const { error: actionItemsError } = await supabase
          .from('action_items')
          .insert(actionItems);

        if (actionItemsError) {
          console.error('Error inserting action items:', actionItemsError);
          // Continue even if this fails
        }
      }
    }

    // Return result with transcript and intelligence data
    return NextResponse.json({
      success: true,
      meetingId: id,
      transcript,
      intelligence: intelligenceData || null,
    });
  } catch (error) {
    console.error('Error in transcription endpoint:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
