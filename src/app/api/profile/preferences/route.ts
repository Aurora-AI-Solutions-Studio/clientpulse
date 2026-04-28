export const dynamic = 'force-dynamic';

import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/profile/preferences
 *
 * Returns the current user's brief delivery preferences. Used by
 * /dashboard/settings to populate the timezone + send-hour controls
 * without leaking the full profile row.
 */
export async function GET(_request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Service client: same RLS-bypass pattern used by /api/me. Filter by
  // user.id (already verified above) so we only ever read the caller's
  // own row.
  const service = createServiceClient();
  const { data, error } = await service
    .from('profiles')
    .select('timezone, brief_send_hour')
    .eq('id', user.id)
    .maybeSingle();

  if (error) {
    console.error('[preferences GET]', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: 'No profile' }, { status: 404 });
  }

  return NextResponse.json({
    timezone: data.timezone,
    briefSendHour: data.brief_send_hour,
  });
}

/**
 * PATCH /api/profile/preferences
 *
 * Body: { timezone?: string; briefSendHour?: number }
 *
 * Validates the timezone via Intl.DateTimeFormat (which raises a
 * RangeError on bad zones, so a handcrafted POST can't poison the
 * cron). briefSendHour must be an integer 0..23.
 */
export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { timezone?: unknown; briefSendHour?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const update: Record<string, string | number> = {};

  if (body.timezone !== undefined) {
    if (typeof body.timezone !== 'string' || body.timezone.length === 0) {
      return NextResponse.json({ error: 'timezone must be a string' }, { status: 400 });
    }
    try {
      // Throws RangeError on invalid IANA name.
      new Intl.DateTimeFormat('en-US', { timeZone: body.timezone });
    } catch {
      return NextResponse.json({ error: 'Invalid IANA timezone' }, { status: 400 });
    }
    update.timezone = body.timezone;
  }

  if (body.briefSendHour !== undefined) {
    if (
      typeof body.briefSendHour !== 'number' ||
      !Number.isInteger(body.briefSendHour) ||
      body.briefSendHour < 0 ||
      body.briefSendHour > 23
    ) {
      return NextResponse.json(
        { error: 'briefSendHour must be an integer 0..23' },
        { status: 400 },
      );
    }
    update.brief_send_hour = body.briefSendHour;
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
  }

  const service = createServiceClient();
  const { data, error } = await service
    .from('profiles')
    .update(update)
    .eq('id', user.id)
    .select('timezone, brief_send_hour')
    .single();

  if (error || !data) {
    console.error('[preferences PATCH]', error);
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 });
  }

  return NextResponse.json({
    timezone: data.timezone,
    briefSendHour: data.brief_send_hour,
  });
}
