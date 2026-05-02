// Server component wrapper for the landing page. Reads the geo header
// to decide whether to render the EU notice banner above the client
// landing content. The 1.4kloc client landing lives in `_landing-client.tsx`
// next to this file; nothing about its behavior changes — it's just
// rendered inside this server shell now.
//
// Rationale: dropping the hard EU geoblock (CEO call 2026-04-28
// evening) replaced middleware redirect with a non-blocking notice
// banner. Banner needs server-side `headers()` for the country read,
// which can't run inside a `'use client'` component. Wrapping is the
// minimum-churn path.

import type { Metadata } from 'next';
import { headers } from 'next/headers';
import EuNoticeBanner from '@/components/eu-notice-banner';
import { isEuRequest } from '@/lib/geo/eu';
import LandingClient from './_landing-client';

export const metadata: Metadata = {
  title: 'ClientPulse — Know which clients are about to leave before they tell you',
  description:
    'Stripe + meeting + email + calendar + content velocity signals fused into one Health Score per client. Monday Brief tells you who needs attention and what to do. Predict churn 60 days early. MCP-native, agency-priced.',
};

export default async function Page() {
  const requestHeaders = await headers();
  const showEuNotice = isEuRequest(requestHeaders);

  return (
    <>
      <EuNoticeBanner show={showEuNotice} />
      <LandingClient />
    </>
  );
}
