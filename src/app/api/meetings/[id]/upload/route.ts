export const dynamic = 'force-dynamic';
import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    // Get meeting record and verify ownership
    const { data: meeting, error: meetingError } = await supabase
      .from('meetings')
      .select('*')
      .eq('id', params.id)
      .eq('agency_id', profile.agency_id)
      .single();

    if (meetingError || !meeting) {
      return NextResponse.json({ error: 'Meeting not found' }, { status: 404 });
    }

    // Parse multipart form data
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Convert file to buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Create storage path: {agency_id}/{meeting_id}/{filename}
    const filename = file.name || `audio_${Date.now()}.mp3`;
    const storagePath = `${profile.agency_id}/${params.id}/${filename}`;

    // Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from('meeting-recordings')
      .upload(storagePath, buffer, {
        contentType: file.type || 'audio/mpeg',
        upsert: true,
      });

    if (uploadError) {
      console.error('Error uploading file:', uploadError);
      return NextResponse.json(
        { error: 'Failed to upload file' },
        { status: 500 }
      );
    }

    // Get public URL for the uploaded file
    const { data: publicUrlData } = supabase.storage
      .from('meeting-recordings')
      .getPublicUrl(storagePath);

    const audioUrl = publicUrlData.publicUrl;

    // Update meeting record with audio_url
    const { error: updateError } = await supabase
      .from('meetings')
      .update({ audio_url: audioUrl })
      .eq('id', params.id);

    if (updateError) {
      console.error('Error updating meeting with audio URL:', updateError);
      return NextResponse.json(
        { error: 'Failed to update meeting record' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      audioUrl: audioUrl,
      filename: filename,
    });
  } catch (error) {
    console.error('Error in upload endpoint:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
