// EU geoblock waitlist email capture — mirror of contentpulse route.
//
// EU-27 visitors are redirected by middleware to /eu-waitlist; the form
// on that page POSTs here. Service-role insert into eu_waitlist;
// upsert-shaped on (lower(email), product) so a repeat submit is a
// no-op rather than a 409.

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { isEuRequest } from '@/lib/geo/eu';

const EMAIL_RX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: NextRequest) {
  let payload: { email?: unknown };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  // Normalize at the application boundary so the (email, product) UNIQUE
  // constraint dedupes case-variants. Migration 20260428_eu_waitlist_unique_constraint
  // replaced the prior LOWER(email) functional index — case-folding moves here.
  const email = typeof payload.email === 'string' ? payload.email.trim().toLowerCase() : '';
  if (!email || !EMAIL_RX.test(email) || email.length > 254) {
    return NextResponse.json({ error: 'invalid_email' }, { status: 400 });
  }

  const country = (request.headers.get('x-vercel-ip-country')
    ?? request.headers.get('cf-ipcountry')
    ?? '').toUpperCase() || null;

  const supabase = createServiceClient();
  const { error } = await supabase
    .from('eu_waitlist')
    .upsert(
      {
        email,
        product: 'clientpulse',
        country,
        user_agent: request.headers.get('user-agent'),
        referrer: request.headers.get('referer'),
        metadata: { eu_request: isEuRequest(request.headers) },
      },
      { onConflict: 'email,product', ignoreDuplicates: true },
    );

  if (error) {
    return NextResponse.json({ error: 'write_failed' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
