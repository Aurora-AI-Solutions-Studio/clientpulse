export const dynamic = 'force-dynamic';
import { getAuthedContext } from '@/lib/auth/get-authed-context';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const auth = await getAuthedContext();
    if (!auth.ok) return auth.response;
    const { agencyId, serviceClient: supabase } = auth.ctx;

    // Get meeting record and verify ownership
    const { data: meeting, error: meetingError } = await supabase
      .from('meetings')
      .select('*')
      .eq('id', id)
      .eq('agency_id', agencyId)
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
    const storagePath = `${agencyId}/${id}/${filename}`;

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
      .eq('id', id);

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
