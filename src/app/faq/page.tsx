'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import {
  ArrowLeft,
  CreditCard,
  RefreshCw,
  XCircle,
  Plug,
  Activity,
  Sparkles,
  Clock,
  Shield,
  Globe,
  Zap,
} from 'lucide-react';

type FaqItem = {
  id: string;
  q: string;
  a: React.ReactNode;
  icon: LucideIcon;
};

const FAQ_SECTIONS: { id: string; label: string; items: FaqItem[] }[] = [
  {
    id: 'pricing',
    label: 'Pricing & Plans',
    items: [
      {
        id: 'pricing',
        q: 'How much does ClientPulse cost?',
        icon: CreditCard,
        a: (
          <>
            <p>
              Three monthly plans: <strong>Solo $59</strong> · <strong>Pro $199</strong> ·{' '}
              <strong>Agency $799</strong>. Annual billing gives you{' '}
              <strong>two months free</strong> on every tier. The Aurora Agency Suite — ReForge
              Agency + ClientPulse Agency bundled — is <strong>$999/mo</strong> (vs $1,398
              stacked).
            </p>
            <p className="mt-3">
              Each tier raises the number of clients you can track, the data retention window,
              the health-score refresh cadence, agency seats, and API/MCP access. Solo tracks 3
              clients; Pro tracks 10; Agency is unlimited. Full matrix on the{' '}
              <Link
                href="/#pricing"
                className="hover:underline"
                style={{ color: 'var(--brand-accent, #14b8a6)' }}
              >
                pricing page
              </Link>
              .
            </p>
          </>
        ),
      },
      {
        id: 'cancellation',
        q: 'Can I cancel anytime?',
        icon: XCircle,
        a: (
          <>
            <p>
              Yes. Cancel from <strong>Settings → Billing → Manage subscription</strong> at any
              time (the Stripe billing portal opens in a new tab). You keep full access until the
              end of your current billing period — no prorated clawbacks, no exit fees, no
              long-term contract.
            </p>
            <p className="mt-3">
              Annual subscribers who cancel keep access through the paid year. We do not
              auto-renew cancelled subscriptions.
            </p>
          </>
        ),
      },
      {
        id: 'refunds',
        q: 'Do you offer refunds?',
        icon: RefreshCw,
        a: (
          <>
            <p>
              We offer a <strong>14-day refund window</strong> on first-time monthly subscriptions
              and a <strong>30-day window</strong> on first-time annual subscriptions, no
              questions asked. Full policy at{' '}
              <a
                href="https://helloaurora.ai/refund"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:underline"
                style={{ color: 'var(--brand-accent, #14b8a6)' }}
              >
                helloaurora.ai/refund
              </a>
              .
            </p>
          </>
        ),
      },
    ],
  },
  {
    id: 'data',
    label: 'Data Sources & Signals',
    items: [
      {
        id: 'data-sources',
        q: 'What does ClientPulse connect to?',
        icon: Plug,
        a: (
          <>
            <p>
              Four OAuth-based connections at launch: <strong>Google Calendar</strong> (meeting
              cadence, attendee patterns), <strong>Gmail</strong> (response latency, sentiment
              shifts, reply-rate decay), <strong>Zoom</strong> (recording cadence, attendance,
              transcripts when present), and <strong>Stripe</strong> (subscription status, MRR
              changes, churn signals).
            </p>
            <p className="mt-3">
              Plus content velocity from <strong>ReForge</strong> when both products are connected
              via the Aurora Suite — engagement events from each client&rsquo;s published content
              feed CP&rsquo;s health signals automatically.
            </p>
            <p className="mt-3">
              All connections are <strong>read-only</strong>. CP never sends emails, books
              meetings, or modifies billing on your behalf.
            </p>
          </>
        ),
      },
      {
        id: 'health-scores',
        q: 'How does the client health score work?',
        icon: Activity,
        a: (
          <>
            <p>
              CP rolls every signal it sees per client into a 0–100 health score across five
              dimensions: <strong>communication frequency</strong>, <strong>communication
              sentiment</strong>, <strong>meeting cadence</strong>, <strong>commercial signals</strong>{' '}
              (Stripe), and <strong>content velocity</strong> (ReForge engagement when
              connected).
            </p>
            <p className="mt-3">
              The scoring isn&rsquo;t a black box — every score change shows the underlying
              signals that moved it, with timestamps and the raw data that caused the swing. You
              can mark a signal as &ldquo;not applicable&rdquo; and it stops weighing into the
              score for that client.
            </p>
            <p className="mt-3">
              Solo refreshes daily, Pro hourly, Agency in real-time as signals arrive.
            </p>
          </>
        ),
      },
      {
        id: 'ape-brief',
        q: 'How does the Action Proposal Engine + Monday Brief actually help me?',
        icon: Sparkles,
        a: (
          <>
            <p>
              Every Monday morning at 6 a.m. local time, you get the <strong>Monday
              Brief</strong> — a one-screen email + dashboard view of every client ranked by
              urgency, with three things spelled out for each: what changed since last week, what
              that probably means, and what action to take.
            </p>
            <p className="mt-3">
              The <strong>Action Proposal Engine (APE)</strong> turns the &ldquo;what to take&rdquo;
              into one-click action items: send this follow-up, book this check-in, escalate this
              conversation. Each proposal is ranked by urgency and impact; you accept it (it
              becomes a tracked action item), edit it, or dismiss it.
            </p>
            <p className="mt-3">
              The Brief is also where Suite-connected agencies see the cross-product picture: CP
              signals × ReForge engagement × content velocity in one place.
            </p>
          </>
        ),
      },
    ],
  },
  {
    id: 'cadence',
    label: 'Refresh Cadence & Limits',
    items: [
      {
        id: 'refresh-cadence',
        q: 'How often does CP recalculate signals?',
        icon: Clock,
        a: (
          <>
            <p>
              <strong>Solo: daily</strong> at 5 a.m. UTC.{' '}
              <strong>Pro: hourly</strong>.{' '}
              <strong>Agency: real-time</strong> — webhooks from connected providers trigger an
              immediate recompute for the affected client.
            </p>
            <p className="mt-3">
              Data retention follows the same tier ladder: <strong>90 days on Solo</strong>,{' '}
              <strong>12 months on Pro</strong>, <strong>36 months on Agency</strong>. Beyond
              those windows, raw signals are aggregated into rollups so historical trends survive
              while raw records expire (per GDPR data-minimization).
            </p>
          </>
        ),
      },
    ],
  },
  {
    id: 'privacy',
    label: 'Privacy & Compliance',
    items: [
      {
        id: 'data-handling',
        q: 'Where is my data stored, and is it used to train AI models?',
        icon: Shield,
        a: (
          <>
            <p>
              All data is stored in the <strong>EU (Frankfurt, Germany)</strong> on Supabase
              infrastructure. OAuth tokens are encrypted at rest with AES-256-GCM; signals,
              scores, and Brief content live in an EU Postgres database. Both are tenant-isolated
              via row-level security.
            </p>
            <p className="mt-3">
              Brief generation and APE proposals are produced via the Anthropic Claude API under
              their commercial terms — which contractually prohibit using customer inputs to
              train their models. <strong>Your client data is never used to train any AI
              model.</strong> It is never shared with other ClientPulse users, and never sold.
            </p>
            <p className="mt-3">
              Right-to-erasure (GDPR Art. 17) is one click in{' '}
              <strong>Settings → Account → Delete account</strong>. Full details in our{' '}
              <a
                href="https://helloaurora.ai/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:underline"
                style={{ color: 'var(--brand-accent, #14b8a6)' }}
              >
                Privacy Policy
              </a>{' '}
              and{' '}
              <a
                href="https://helloaurora.ai/dpa"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:underline"
                style={{ color: 'var(--brand-accent, #14b8a6)' }}
              >
                DPA
              </a>
              .
            </p>
          </>
        ),
      },
      {
        id: 'eu',
        q: 'I&rsquo;m in the EU — am I blocked from using ClientPulse?',
        icon: Globe,
        a: (
          <>
            <p>
              <strong>No.</strong> ClientPulse is globally accessible. EU visitors see a
              non-blocking notice on the landing page about the EU AI Act (enforcement begins
              August 2, 2026) and can choose to opt into a launch waitlist or proceed with normal
              signup.
            </p>
            <p className="mt-3">
              Aurora&rsquo;s posture is <strong>global by default, exclude per regulator</strong>.
              Today only the EU-27 carries enforcement-eligible AI regulation that affects our
              product class (per our Apr 30 launch-jurisdiction scan covering UAE, Singapore,
              KSA, Indonesia, Hong Kong, Malaysia, Israel, Mexico, Brazil, and South Africa — all
              cleared as no-op for pre-launch).
            </p>
            <p className="mt-3">
              See our{' '}
              <Link
                href="/model-card"
                className="hover:underline"
                style={{ color: 'var(--brand-accent, #14b8a6)' }}
              >
                Model Card
              </Link>{' '}
              for the full risk classification across EU AI Act Art. 50, the California AI
              Transparency Act, the Colorado AI Act, GDPR, and UK GDPR.
            </p>
          </>
        ),
      },
      {
        id: 'livemode',
        q: 'Are you charging real money today, or am I in test mode?',
        icon: Zap,
        a: (
          <>
            <p>
              ClientPulse is currently in <strong>pre-launch</strong>. The pricing page shows
              real tiers, but Stripe is in test mode — no real card is charged.
            </p>
            <p className="mt-3">
              We flip to live mode when our German UG entity registration (HRB) clears, expected
              mid-May 2026. Existing test-mode signups carry forward; you&rsquo;ll be invited to
              re-confirm your tier on a live Stripe price before any charge is made.
            </p>
          </>
        ),
      },
    ],
  },
];

export default function FaqPage() {
  const [activeSection, setActiveSection] = useState('pricing');

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
      setActiveSection(id);
    }
  };

  return (
    <div className="min-h-screen text-white" style={{ background: 'var(--bg-base, #0a0e1a)', fontFamily: 'var(--font-body)' }}>
      {/* Navigation */}
      <nav
        className="fixed top-0 z-50 w-full backdrop-blur-md border-b"
        style={{
          background: 'rgba(10, 14, 26, 0.8)',
          borderColor: 'var(--border-subtle, #1a2540)',
        }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <ArrowLeft size={20} style={{ color: 'var(--brand-accent, #14b8a6)' }} />
            <span className="text-sm font-semibold" style={{ color: 'var(--text-secondary, #7a88a8)' }}>
              Back to ClientPulse
            </span>
          </Link>
          <h1
            className="text-xl font-bold"
            style={{
              fontFamily: 'var(--font-display)',
              background: 'linear-gradient(to right, #14b8a6, #38e8c8)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            FAQ
          </h1>
          <div className="w-[120px]"></div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="pt-24 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-8">
          {/* Sidebar */}
          <aside className="lg:sticky lg:top-24 lg:self-start">
            <nav className="space-y-1">
              {FAQ_SECTIONS.map((section) => (
                <button
                  key={section.id}
                  type="button"
                  onClick={() => scrollToSection(section.id)}
                  className={`block w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                    activeSection === section.id
                      ? 'bg-[#1a2540] text-white'
                      : 'text-[#7a88a8] hover:text-white hover:bg-[#0f1626]'
                  }`}
                >
                  {section.label}
                </button>
              ))}
            </nav>
          </aside>

          {/* Body */}
          <main className="space-y-12">
            <header>
              <h1 className="text-3xl sm:text-4xl font-bold mb-4" style={{ fontFamily: 'var(--font-display)' }}>
                Frequently asked questions
              </h1>
              <p style={{ color: 'var(--text-secondary, #7a88a8)' }}>
                Launch-honest answers about pricing, data sources, signals, and what you can
                expect on day one. Last updated 2026-04-30.
              </p>
            </header>

            {FAQ_SECTIONS.map((section) => (
              <section key={section.id} id={section.id} className="scroll-mt-24">
                <h2 className="text-2xl font-bold mb-6" style={{ fontFamily: 'var(--font-display)' }}>
                  {section.label}
                </h2>
                <div className="space-y-6">
                  {section.items.map((item) => (
                    <article
                      key={item.id}
                      id={item.id}
                      className="rounded-xl p-6 border scroll-mt-24"
                      style={{
                        background: 'var(--bg-elevated, #0f1626)',
                        borderColor: 'var(--border-subtle, #1a2540)',
                      }}
                    >
                      <div className="flex items-start gap-3 mb-3">
                        <item.icon size={20} className="mt-1 shrink-0" />
                        <h3 className="text-lg font-semibold text-white">{item.q}</h3>
                      </div>
                      <div className="text-sm leading-relaxed pl-8" style={{ color: 'var(--text-primary, #c9d1de)' }}>
                        {item.a}
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            ))}

            <section
              className="rounded-xl p-6 border"
              style={{
                background: 'var(--bg-elevated, #0f1626)',
                borderColor: 'var(--border-subtle, #1a2540)',
              }}
            >
              <h2 className="text-lg font-semibold mb-2">Didn&rsquo;t find your question?</h2>
              <p className="text-sm" style={{ color: 'var(--text-primary, #c9d1de)' }}>
                Email{' '}
                <a
                  href="mailto:hello@helloaurora.ai"
                  className="hover:underline"
                  style={{ color: 'var(--brand-accent, #14b8a6)' }}
                >
                  hello@helloaurora.ai
                </a>{' '}
                and we&rsquo;ll get back to you within one business day. Pre-sales questions go to
                the same address.
              </p>
            </section>
          </main>
        </div>
      </div>
    </div>
  );
}
