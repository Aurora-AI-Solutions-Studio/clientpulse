export const dynamic = 'force-dynamic';
import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

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

    // Fetch transcription settings
    const { data: agency, error: agencyError } = await supabase
      .from('agencies')
      .select('transcription_mode, local_whisper_endpoint')
      .eq('id', profile.agency_id)
      .single();

    if (agencyError) {
      console.error('Error fetching agency:', agencyError);
      return NextResponse.json(
        { error: 'Failed to fetch transcription settings' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      settings: {
        transcriptionMode: agency?.transcription_mode || 'cloud',
        localWhisperEndpoint: agency?.local_whisper_endpoint || null,
      },
    });
  } catch (error) {
    console.error('Error getting transcription settings:', error);
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

    // Check if user is owner
    const { data: currentMember } = await supabase
      .from('agency_members')
      .select('role')
      .eq('user_id', user.id)
      .eq('agency_id', profile.agency_id)
      .single();

    if (!currentMember || currentMember.role !== 'owner') {
      return NextResponse.json(
        { error: 'Only owners can change transcription settings' },
        { status: 403 }
      );
    }

    const body = await request.json();

    // Validate transcription mode
    if (body.transcriptionMode) {
      const validModes = ['cloud', 'local', 'hybrid'];
      if (!validModes.includes(body.transcriptionMode)) {
        return NextResponse.json(
          { error: "transcriptionMode must be 'cloud', 'local', or 'hybrid'" },
          { status: 400 }
        );
      }
    }

    // Validate local endpoint if in use
    if (body.transcriptionMode === 'local' || body.transcriptionMode === 'hybrid') {
      if (body.localWhisperEndpoint) {
        try {
          new URL(body.localWhisperEndpoint);
        } catch {
          return NextResponse.json(
            { error: 'Invalid localWhisperEndpoint URL' },
            { status: 400 }
          );
        }
      }
    }

    // Build update object
    const updateData: Record<string, string | null> = {};

    if (body.transcriptionMode) {
      updateData.transcription_mode = body.transcriptionMode;
    }
    if (body.localWhisperEndpoint !== undefined) {
      updateData.local_whisper_endpoint = body.localWhisperEndpoint;
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: 'No settings to update' },
        { status: 400 }
      );
    }

    // Update settings
    const { data: updated, error: updateError } = await supabase
      .from('agencies')
      .update(updateData)
      .eq('id', profile.agency_id)
      .select('transcription_mode, local_whisper_endpoint')
      .single();

    if (updateError) {
      console.error('Error updating transcription settings:', updateError);
      return NextResponse.json(
        { error: 'Failed to update transcription settings' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      settings: {
        transcriptionMode: updated.transcription_mode,
        localWhisperEndpoint: updated.local_whisper_endpoint,
      },
    });
  } catch (error) {
    console.error('Error updating transcription settings:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
