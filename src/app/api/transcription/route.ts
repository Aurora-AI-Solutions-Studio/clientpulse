export const dynamic = 'force-dynamic';
import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { WhisperTranscriptionAgent } from '@/lib/agents/whisper-transcription-agent';
import { checkRateLimit, RATE_LIMITS } from '@/lib/api-rate-limit';

export async function POST(request: NextRequest) {
  // §12.2 Rate limit: 5/min per IP — expensive AI endpoint.
  const rl = checkRateLimit(request, 'transcription', RATE_LIMITS.aiExpensive);
  if (rl) return rl;

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

    // Get agency transcription settings
    const { data: agency, error: agencyError } = await supabase
      .from('agencies')
      .select('transcription_mode, local_whisper_endpoint')
      .eq('id', profile.agency_id)
      .single();

    if (agencyError) {
      console.error('Error fetching agency:', agencyError);
      return NextResponse.json(
        { error: 'Failed to fetch agency settings' },
        { status: 500 }
      );
    }

    // Parse multipart form data
    const formData = await request.formData();
    const audioFile = formData.get('audio') as File;
    const modeParam = formData.get('mode') as string | null;

    if (!audioFile) {
      return NextResponse.json(
        { error: 'No audio file provided' },
        { status: 400 }
      );
    }

    // Determine transcription mode
    let mode = modeParam || 'auto';
    if (mode === 'auto') {
      mode = agency?.transcription_mode || 'cloud';
    }

    // Convert File to Buffer
    const arrayBuffer = await audioFile.arrayBuffer();
    const audioBuffer = Buffer.from(arrayBuffer);
    const filename = audioFile.name || 'audio.mp3';

    let result;

    // Handle different transcription modes
    if (mode === 'cloud') {
      result = await transcribeWithCloud(audioBuffer, filename);
    } else if (mode === 'local') {
      if (!agency?.local_whisper_endpoint) {
        return NextResponse.json(
          { error: 'Local Whisper endpoint not configured' },
          { status: 400 }
        );
      }
      result = await transcribeWithLocal(audioBuffer, filename, agency.local_whisper_endpoint);
    } else if (mode === 'hybrid') {
      if (!agency?.local_whisper_endpoint) {
        // Fallback to cloud if local endpoint not configured
        result = await transcribeWithCloud(audioBuffer, filename);
      } else {
        // Try local first, fallback to cloud
        try {
          result = await transcribeWithLocal(audioBuffer, filename, agency.local_whisper_endpoint);
        } catch (localError) {
          console.warn('Local transcription failed, falling back to cloud:', localError);
          result = await transcribeWithCloud(audioBuffer, filename);
        }
      }
    } else {
      return NextResponse.json(
        { error: 'Invalid transcription mode' },
        { status: 400 }
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error transcribing audio:', error);
    return NextResponse.json(
      {
        error: `Transcription failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      },
      { status: 500 }
    );
  }
}

/**
 * Transcribe using cloud-based OpenAI Whisper API
 */
async function transcribeWithCloud(
  audioBuffer: Buffer,
  filename: string
) {
  const _agent = new WhisperTranscriptionAgent();

  // Save buffer to temporary location for transcription
  // Note: The WhisperTranscriptionAgent expects a URL, but we'll need to create
  // a temporary endpoint or use an alternative approach
  // For now, we'll create a File object and use a modified transcription approach

  // Create a temporary storage location or use a direct approach
  // Since the agent uses transcribeAudio(url), we need to adapt
  // Let's use a direct buffer approach by modifying the call

  // For this implementation, we'll create a blob-like approach
  const file = new File([new Uint8Array(audioBuffer)], filename, { type: 'audio/mpeg' });

  const formDataForOpenAI = new FormData();
  formDataForOpenAI.append('file', file);
  formDataForOpenAI.append('model', 'whisper-1');
  formDataForOpenAI.append('language', 'en');
  formDataForOpenAI.append('response_format', 'verbose_json');

  const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: formDataForOpenAI,
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.statusText}`);
  }

  const result = await response.json();

  return {
    text: result.text || '',
    segments: buildSegments(result),
    duration: result.duration || 0,
    language: result.language || 'en',
    transcribed_at: Date.now(),
  };
}

/**
 * Transcribe using local Whisper endpoint
 */
async function transcribeWithLocal(
  audioBuffer: Buffer,
  filename: string,
  localEndpoint: string
) {
  const file = new File([new Uint8Array(audioBuffer)], filename, { type: 'audio/mpeg' });
  const formData = new FormData();
  formData.append('audio', file);

  const response = await fetch(`${localEndpoint}/transcribe`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`Local Whisper endpoint error: ${response.statusText}`);
  }

  const result = await response.json();

  return {
    text: result.text || '',
    segments: result.segments || buildSegments(result),
    duration: result.duration || 0,
    language: result.language || 'en',
    transcribed_at: Date.now(),
  };
}

/**
 * Build segments from transcription result
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildSegments(result: any) {
  const segments = [];

  if (result.segments && Array.isArray(result.segments)) {
    // If segments already present, return them
    return result.segments;
  }

  if (result.words && Array.isArray(result.words)) {
    // Parse word-level timing if available
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let currentSegment: any = null;
    for (const word of result.words) {
      if (currentSegment === null) {
        currentSegment = {
          start: word.start || 0,
          end: word.end || 0,
          text: word.word || '',
        };
      } else {
        currentSegment.text += ' ' + (word.word || '');
        currentSegment.end = word.end || currentSegment.end;

        // Split into sentences (approximately 20 words per segment)
        if (currentSegment.text.split(' ').length >= 20) {
          segments.push(currentSegment);
          currentSegment = null;
        }
      }
    }
    if (currentSegment) {
      segments.push(currentSegment);
    }
  } else {
    // Fallback: create single segment
    segments.push({
      start: 0,
      end: result.duration || 0,
      text: result.text || '',
    });
  }

  return segments;
}
