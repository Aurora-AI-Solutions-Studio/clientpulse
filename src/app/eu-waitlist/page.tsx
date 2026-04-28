'use client';

// EU-27 geoblock landing — every EU visitor lands here via middleware.
// Honest about why we're geoblocked (HRAI / EU AI Act enforcement
// Aug 2, 2026) and gives them a way to be told when we open.

import { useState } from 'react';

export default function EuWaitlistPage() {
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setState('submitting');
    setErrorMsg('');
    try {
      const res = await fetch('/api/eu-waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setErrorMsg(body.error === 'invalid_email' ? 'Please enter a valid email.' : 'Something went wrong. Try again in a moment.');
        setState('error');
        return;
      }
      setState('success');
    } catch {
      setErrorMsg('Network error. Try again.');
      setState('error');
    }
  }

  return (
    <main
      className="min-h-screen flex items-center justify-center px-6 py-16 relative overflow-hidden"
      style={{ background: '#06090f', color: 'var(--text-primary)' }}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: [
            'radial-gradient(900px 600px at 8% 12%, rgba(76,201,240,0.10), transparent 60%)',
            'radial-gradient(1100px 700px at 92% 88%, rgba(56,232,200,0.10), transparent 60%)',
            'radial-gradient(900px 700px at 50% 100%, rgba(179,136,235,0.08), transparent 65%)',
          ].join(', '),
        }}
      />
      <section className="relative z-10 max-w-2xl text-center">
        <p
          className="mb-3 text-sm uppercase tracking-widest"
          style={{ fontFamily: 'var(--font-mono)', color: 'var(--teal, #38e8c8)' }}
        >
          ClientPulse · EU waitlist
        </p>

        <h1
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(32px, 5vw, 52px)',
            fontWeight: 700,
            lineHeight: 1.1,
            letterSpacing: '-0.02em',
          }}
        >
          We&rsquo;re not open in the EU yet.
        </h1>

        <p
          className="mt-6 max-w-xl mx-auto text-base md:text-lg leading-relaxed"
          style={{ color: 'var(--text-secondary)' }}
        >
          ClientPulse launches first in the United States, United Kingdom, Canada, Australia and New Zealand.
          We&rsquo;re holding off on EU-27 access until the EU AI Act compliance work (Aug 2, 2026) is in place — we&rsquo;d
          rather get it right than rush a half-compliant product into a regulated market.
        </p>

        {state === 'success' ? (
          <div
            className="mt-10 mx-auto max-w-md p-6 rounded-2xl"
            style={{
              background: 'rgba(56,232,200,0.08)',
              border: '1px solid rgba(56,232,200,0.30)',
            }}
          >
            <p style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '1.1rem' }}>
              You&rsquo;re on the list.
            </p>
            <p className="mt-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
              We&rsquo;ll email <strong>{email}</strong> the moment EU access opens.
            </p>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="mt-10 mx-auto max-w-md flex flex-col sm:flex-row gap-3">
            <input
              type="email"
              required
              autoComplete="email"
              placeholder="you@agency.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={state === 'submitting'}
              className="flex-1 px-4 py-3 rounded-xl text-base outline-none focus:ring-2"
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.12)',
                color: 'var(--text-primary)',
              }}
            />
            <button
              type="submit"
              disabled={state === 'submitting'}
              className="px-6 py-3 rounded-xl font-semibold transition disabled:opacity-50"
              style={{
                fontFamily: 'var(--font-display)',
                background: 'var(--aurora-gradient, linear-gradient(135deg, #38e8c8, #b388eb))',
                color: '#06090f',
              }}
            >
              {state === 'submitting' ? 'Submitting…' : 'Notify me'}
            </button>
          </form>
        )}

        {state === 'error' && errorMsg && (
          <p className="mt-3 text-sm" style={{ color: '#e87fa5' }}>
            {errorMsg}
          </p>
        )}

        <p className="mt-12 text-xs" style={{ color: 'var(--text-tertiary, #5b6373)' }}>
          Aurora AI Solutions Studio (UG i.G.) · Stuttgart, Germany ·{' '}
          <a href="https://helloaurora.ai" className="underline">helloaurora.ai</a>
        </p>
      </section>
    </main>
  );
}
