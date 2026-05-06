'use client';

// Non-blocking EU notice banner. Mirrors contentpulse banner. Server-side
// detects EU-27 visitors via the geo header, passes `show={true}`;
// component handles dismissibility via localStorage so EU prospects
// can browse without nagging on every page view.
//
// Replaces the prior hard redirect to /eu-waitlist (Apr 28 CEO call).
// /eu-waitlist + /api/eu-waitlist + eu_waitlist table stay live as
// optional opt-in.

import Link from 'next/link';
import { useEffect, useState } from 'react';

const STORAGE_KEY = 'aurora-eu-notice-dismissed-v1';

export default function EuNoticeBanner({ show }: { show: boolean }) {
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!show) return;
    try {
      if (window.localStorage.getItem(STORAGE_KEY) === '1') setDismissed(true);
    } catch {
      // localStorage unavailable in some private-mode browsers; fall
      // through and show the banner — non-fatal.
    }
  }, [show]);

  if (!show || dismissed) return null;

  function dismiss() {
    setDismissed(true);
    try {
      window.localStorage.setItem(STORAGE_KEY, '1');
    } catch {
      // Best-effort.
    }
  }

  return (
    <aside
      role="region"
      aria-label="EU AI Act notice"
      className="relative z-50 w-full px-4 py-2.5 text-sm"
      style={{
        background:
          'linear-gradient(90deg, rgba(76,201,240,0.10) 0%, rgba(56,232,200,0.10) 50%, rgba(179,136,235,0.10) 100%)',
        borderBottom: '1px solid rgba(232,236,245,0.08)',
        color: 'var(--text-secondary, #b0bbcf)',
      }}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
        <p className="leading-snug">
          <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--teal, #38e8c8)' }}>
            EU notice ·{' '}
          </span>
          Aurora is preparing for EU AI Act enforcement (Aug 2, 2026). Until then ClientPulse is
          available globally; HRAI compliance applies to all post-Aug 2 usage.{' '}
          <Link
            href="/eu-waitlist"
            className="underline transition hover:text-white"
            style={{ color: 'var(--text-primary, #e8ecf5)' }}
          >
            Get notified when EU compliance is live
          </Link>
          .
        </p>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss notice"
          className="flex-shrink-0 rounded-md px-2 py-1 text-xs transition hover:bg-white/5"
          style={{ color: 'var(--text-tertiary, #5b6373)' }}
        >
          Dismiss
        </button>
      </div>
    </aside>
  );
}
