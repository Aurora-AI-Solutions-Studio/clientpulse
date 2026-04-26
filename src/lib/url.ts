// Resolve the public origin for building absolute URLs (magic links,
// dashboard pointers, model-card refs).
//
// Priority:
//   1. NEXT_PUBLIC_APP_URL  — the canonical override; set in Vercel
//      to https://clientpulse.helloaurora.ai for prod.
//   2. The incoming request's protocol + host — works on Vercel preview
//      deployments where the URL is per-branch.
//   3. http://localhost:3000 — last-resort dev default.

import type { NextRequest } from 'next/server';

export function resolveAppUrl(request?: NextRequest): string {
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/+$/, '');

  if (request) {
    const host = request.headers.get('host');
    if (host) {
      const proto = request.headers.get('x-forwarded-proto') ?? 'https';
      return `${proto}://${host}`;
    }
  }

  return 'http://localhost:3000';
}
