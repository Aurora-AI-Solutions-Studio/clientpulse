export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthedContext } from '@/lib/auth/get-authed-context';

/**
 * Auth + agency resolution goes through getAuthedContext (service-client
 * profile lookup) — see comment in /api/slack/route.ts for the
 * RLS-context-drift rationale. This used to surface as a misleading 404
 * "User profile not found" on every Transcription Settings page load.
 */
export async function GET(_request: NextRequest) {
  try {
    const auth = await getAuthedContext();
    if (!auth.ok) return auth.response;
    const { agencyId, serviceClient } = auth.ctx;

    const { data: agency, error: agencyError } = await serviceClient
      .from('agencies')
      .select('transcription_mode, local_whisper_endpoint')
      .eq('id', agencyId)
      .maybeSingle();

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
    const auth = await getAuthedContext();
    if (!auth.ok) return auth.response;
    const { userId, agencyId, serviceClient } = auth.ctx;

    const { data: currentMember } = await serviceClient
      .from('agency_members')
      .select('role')
      .eq('user_id', userId)
      .eq('agency_id', agencyId)
      .maybeSingle();

    if (!currentMember || currentMember.role !== 'owner') {
      return NextResponse.json(
        { error: 'Only owners can change transcription settings' },
        { status: 403 }
      );
    }

    const body = await request.json();

    if (body.transcriptionMode) {
      const validModes = ['cloud', 'local', 'hybrid'];
      if (!validModes.includes(body.transcriptionMode)) {
        return NextResponse.json(
          { error: "transcriptionMode must be 'cloud', 'local', or 'hybrid'" },
          { status: 400 }
        );
      }
    }

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

    const { data: updated, error: updateError } = await serviceClient
      .from('agencies')
      .update(updateData)
      .eq('id', agencyId)
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
