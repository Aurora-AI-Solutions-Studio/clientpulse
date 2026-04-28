'use client';

/**
 * Dashboard Upgrade page — Sprint 8A
 *
 * Authenticated upgrade flow mirroring the public pricing section but adds:
 *   - current plan detection from profiles.subscription_plan
 *   - Manage Billing (Stripe portal) for active subscribers
 *   - Annual toggle (2 months free = 16.7% off)
 *   - CP-shaped feature comparison matrix (limits from src/lib/tiers/limits.ts)
 *   - Agency Suite cross-link to ReForge pricing
 */

import { Suspense, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Check, Loader2, ExternalLink, Crown } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { STRIPE_PLANS, getAnnualMonthly, BillingInterval } from '@/lib/stripe-config';
import { SubscriptionPlan } from '@/types/stripe';

type Tier = SubscriptionPlan;

// Display order left → right.
const TIER_ORDER: Tier[] = ['solo', 'pro', 'agency'];

// Rank used for upgrade/downgrade detection. Higher = more paid.
// 'free' is the default for users without an active subscription.
const TIER_RANK: Record<string, number> = {
  free: 0,
  solo: 1,
  pro: 2,
  agency: 3,
};

const FEATURED_TIER: Tier = 'pro';

interface TierCopy {
  subtitle: string;
  features: string[];
}

// Per-tier sales copy. Keep in sync with the landing page pricing section.
const TIER_COPY: Record<Tier, TierCopy> = {
  solo: {
    subtitle: 'Freelancers & solo consultants',
    features: [
      'Up to 3 clients',
      'Client Health Scores',
      'Monday Client Brief',
      'Stripe financial sync',
      '90-day data retention',
    ],
  },
  pro: {
    subtitle: "Growing agencies that can't afford to lose a client",
    features: [
      'Up to 10 clients',
      'Everything in Solo',
      'Meeting Intelligence (Zoom, Meet)',
      'Action Proposal Engine',
      'Upsell Detection Agent',
      'Calendar & email sentiment',
      '3 seats · 3 MCP connections',
      '12-month data retention',
    ],
  },
  agency: {
    subtitle: 'Established agencies treating retention as a moat',
    features: [
      'Unlimited clients',
      'Everything in Pro',
      '8 seats · team dashboard',
      'Real-time health refresh',
      'White-label PDF reports',
      'Slack bot + Recursive Learning',
      'Full API · unlimited MCP',
      '36-month data retention',
    ],
  },
};

// Feature-comparison matrix. Values mirror src/lib/tiers/limits.ts so the
// sales surface stays honest with the runtime gate.
const FEATURE_ROWS: { label: string; tooltip?: string; values: [string, string, string] }[] = [
  { label: 'Clients',             values: ['3', '10', 'Unlimited'] },
  { label: 'Data retention',      values: ['90 days', '12 months', '36 months'] },
  { label: 'Health refresh',      values: ['Daily', 'Hourly', 'Real-time'] },
  { label: 'Seats',               values: ['1', '3', '8'] },
  { label: 'MCP connections',     values: ['\u2014', '3', 'Unlimited'] },
  { label: 'API access',
    tooltip: 'Programmatic access to the ClientPulse API. Pro is read-only; Agency supports full write (incl. MCP write tools).',
    values: ['\u2014', 'Read-only', 'Full'] },
  { label: 'Meeting Intelligence', values: ['\u2014', '\u2713', '\u2713'] },
  { label: 'Action Proposal Engine', values: ['\u2014', '\u2713', '\u2713'] },
  { label: 'Upsell Detection',    values: ['\u2014', '\u2713', '\u2713'] },
  { label: 'White-label reports', values: ['\u2014', '\u2014', '\u2713'] },
  { label: 'Slack bot',           values: ['\u2014', '\u2014', '\u2713'] },
  { label: 'Priority support',    values: ['\u2014', '\u2713', '\u2713'] },
];

function resolveCurrentTier(subscriptionPlan: string | null | undefined): string {
  if (subscriptionPlan && ['solo', 'pro', 'agency'].includes(subscriptionPlan)) {
    return subscriptionPlan;
  }
  return 'free';
}

function isValidTier(v: string | null): v is Tier {
  return v === 'solo' || v === 'pro' || v === 'agency';
}

// Next 15 requires every component that calls useSearchParams() to be
// wrapped in <Suspense> at build time, otherwise the static prerender
// bails. Defensive wrap mirrors the RF-side fix and the earlier
// /auth/signup Suspense hotfix.
export default function UpgradePage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-[#7a88a8]" />
        </div>
      }
    >
      <UpgradePageInner />
    </Suspense>
  );
}

function UpgradePageInner() {
  const search = useSearchParams();
  // ?plan= came from the landing pricing CTA → signup → here. Validated
  // against the actual tier set so a hand-crafted ?plan=suite or
  // ?plan=anything-else is treated as "no pre-selection". Display only —
  // the user's actual tier is set by the Stripe webhook after payment,
  // never by this query param.
  const planFromUrl: Tier | null = isValidTier(search.get('plan'))
    ? (search.get('plan') as Tier)
    : null;
  const [loadingPlan, setLoadingPlan] = useState<Tier | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const [billingInterval, setBillingInterval] = useState<BillingInterval>(
    search.get('interval') === 'year' ? 'year' : 'month'
  );
  const [currentTier, setCurrentTier] = useState<string>('free');
  const [loading, setLoading] = useState(true);
  const cardRefs = useRef<Record<Tier, HTMLDivElement | null>>({
    solo: null, pro: null, agency: null,
  });

  useEffect(() => {
    const load = async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase
          .from('profiles')
          .select('subscription_plan')
          .eq('id', user.id)
          .maybeSingle();
        setCurrentTier(resolveCurrentTier(data?.subscription_plan));
      }
      setLoading(false);
    };
    load();
  }, []);

  // After data loads + cards mount, scroll the picked tier into view.
  useEffect(() => {
    if (!loading && planFromUrl) {
      const el = cardRefs.current[planFromUrl];
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [loading, planFromUrl]);

  async function handleUpgrade(tier: Tier) {
    setLoadingPlan(tier);
    setCheckoutError(null);
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: tier, interval: billingInterval }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.url) {
        window.location.href = data.url;
        return;
      }
      const msg =
        data?.error ??
        `Checkout failed (${res.status}). Stripe price ID for ${tier}/${billingInterval} may not be configured in Vercel env.`;
      setCheckoutError(msg);
    } catch (e) {
      setCheckoutError(e instanceof Error ? e.message : 'Network error');
    } finally {
      setLoadingPlan(null);
    }
  }

  async function openBillingPortal() {
    setPortalLoading(true);
    try {
      const res = await fetch('/api/stripe/portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch {
      // swallow — button re-enables in finally
    } finally {
      setPortalLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-[#7a88a8]" />
      </div>
    );
  }

  const isSubscribed = currentTier !== 'free';
  const currentTierName =
    currentTier === 'free'
      ? 'Free'
      : (STRIPE_PLANS[currentTier as Tier]?.name ?? currentTier);

  // Pre-select banner: shows the tier the user came from (landing
  // pricing CTA → signup → here) with a one-click "Continue to
  // checkout" affordance so the user doesn't accidentally pick a
  // different tier than they intended.
  const PreSelectBanner = () => {
    if (!planFromUrl) return null;
    if (planFromUrl === currentTier) return null; // already on it
    const plan = STRIPE_PLANS[planFromUrl];
    return (
      <div
        className="flex flex-wrap items-center justify-between gap-4 rounded-xl p-5"
        style={{
          background:
            'linear-gradient(135deg, rgba(56,232,200,0.08), rgba(56,232,200,0.02))',
          border: '1px solid rgba(56,232,200,0.3)',
        }}
      >
        <div>
          <p className="font-semibold text-white">
            You picked the {plan.name} plan
          </p>
          <p className="mt-1 text-sm text-[#7a88a8]">
            Confirm below to continue to Stripe checkout. You can switch
            tiers from this page if you change your mind.
          </p>
        </div>
        <button
          onClick={() => handleUpgrade(planFromUrl)}
          disabled={loadingPlan === planFromUrl}
          className="rounded-lg px-5 py-2.5 text-sm font-semibold transition disabled:opacity-50"
          style={{ background: '#38e8c8', color: '#06090f' }}
        >
          {loadingPlan === planFromUrl ? (
            <Loader2 className="mx-auto h-4 w-4 animate-spin" />
          ) : (
            `Continue with ${plan.name}`
          )}
        </button>
      </div>
    );
  };

  return (
    <div className="mx-auto max-w-6xl space-y-8 py-4">
      <PreSelectBanner />
      {/* ─── Current subscription banner ─── */}
      {isSubscribed && (
        <div
          className="flex items-center justify-between rounded-xl p-5"
          style={{
            background: 'linear-gradient(135deg, rgba(56,232,200,0.08), rgba(56,232,200,0.02))',
            border: '1px solid rgba(56,232,200,0.2)',
          }}
        >
          <div className="flex items-center gap-3">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-full"
              style={{ background: 'rgba(56,232,200,0.15)' }}
            >
              <Crown className="h-5 w-5 text-[#38e8c8]" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">
                You&apos;re on the <span className="text-[#38e8c8]">{currentTierName}</span> plan
              </p>
              <p className="text-xs text-[#7a88a8]">
                Active subscription · Manage billing, invoices, or cancel anytime
              </p>
            </div>
          </div>
          <button
            onClick={openBillingPortal}
            disabled={portalLoading}
            className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition hover:opacity-80 disabled:opacity-50"
            style={{
              color: '#38e8c8',
              border: '1px solid rgba(56,232,200,0.3)',
              background: 'rgba(56,232,200,0.08)',
            }}
          >
            {portalLoading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <ExternalLink className="h-3.5 w-3.5" />
            )}
            Manage Billing
          </button>
        </div>
      )}

      {/* ─── Header + interval toggle ─── */}
      <div className="text-center">
        <h1
          className="text-white"
          style={{ fontFamily: "'Playfair Display', serif", fontSize: '36px', fontWeight: 700 }}
        >
          {isSubscribed ? 'Your Plan' : 'Choose your plan'}
        </h1>
        <p className="mt-2 text-[#7a88a8]">
          {isSubscribed
            ? 'Compare plans or upgrade to unlock more.'
            : 'Client intelligence that pays for itself — prevent one churn, you break even.'}
        </p>

        {checkoutError && (
          <div className="mt-4 rounded-lg border border-red-500/40 bg-red-500/5 p-3 text-sm text-red-300">
            {checkoutError}
          </div>
        )}

        <div
          className="mt-6 inline-flex items-center gap-1 rounded-full p-1"
          style={{ background: '#0c1220', border: '1px solid rgba(232,236,245,0.08)' }}
        >
          <button
            type="button"
            onClick={() => setBillingInterval('month')}
            className="rounded-full px-5 py-2 text-sm font-medium transition"
            style={{
              background: billingInterval === 'month' ? '#141e33' : 'transparent',
              color: billingInterval === 'month' ? '#ffffff' : '#7a88a8',
              border: billingInterval === 'month' ? '1px solid rgba(232,236,245,0.12)' : '1px solid transparent',
            }}
          >
            Monthly
          </button>
          <button
            type="button"
            onClick={() => setBillingInterval('year')}
            className="relative rounded-full px-5 py-2 text-sm font-medium transition"
            style={{
              background: billingInterval === 'year' ? '#141e33' : 'transparent',
              color: billingInterval === 'year' ? '#ffffff' : '#7a88a8',
              border: billingInterval === 'year' ? '1px solid rgba(232,236,245,0.12)' : '1px solid transparent',
            }}
          >
            Annual
            <span
              className="ml-2 rounded-full px-2 py-0.5 text-[10px] font-bold"
              style={{ background: 'rgba(56,232,200,0.15)', color: '#38e8c8' }}
            >
              2 months free
            </span>
          </button>
        </div>
      </div>

      {/* ─── Tier cards ─── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {TIER_ORDER.map((tier) => {
          const plan = STRIPE_PLANS[tier];
          const copy = TIER_COPY[tier];
          const displayPrice =
            billingInterval === 'year' ? getAnnualMonthly(tier) : plan.price;
          const isCurrent = tier === currentTier;
          const isDowngrade = (TIER_RANK[tier] ?? -1) < (TIER_RANK[currentTier] ?? 0);
          const isUpgrade = (TIER_RANK[tier] ?? 99) > (TIER_RANK[currentTier] ?? 0);
          const isPopular = tier === FEATURED_TIER;

          const isPickedFromUrl = tier === planFromUrl && tier !== currentTier;

          return (
            <div
              key={tier}
              ref={(el) => { cardRefs.current[tier] = el; }}
              className="relative rounded-2xl p-6"
              style={{
                background:
                  isPickedFromUrl
                    ? 'linear-gradient(135deg, rgba(56,232,200,0.12), #141e33)'
                    : isCurrent || isPopular ? '#141e33' : '#0c1220',
                border: isPickedFromUrl
                  ? '2px solid #38e8c8'
                  : isCurrent
                    ? '1px solid #38e8c8'
                    : isPopular
                      ? '1px solid rgba(56,232,200,0.4)'
                      : '1px solid rgba(232,236,245,0.06)',
                boxShadow:
                  isPickedFromUrl
                    ? '0 0 60px rgba(56,232,200,0.25)'
                    : isCurrent
                      ? '0 0 40px rgba(56,232,200,0.12)'
                      : isPopular
                        ? '0 0 40px rgba(56,232,200,0.08)'
                        : 'none',
              }}
            >
              {isPickedFromUrl && (
                <span
                  className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full px-3 py-0.5 text-xs font-semibold"
                  style={{ background: '#38e8c8', color: '#06090f' }}
                >
                  You picked this
                </span>
              )}
              {!isPickedFromUrl && isCurrent && (
                <span
                  className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full px-3 py-0.5 text-xs font-semibold"
                  style={{ background: '#38e8c8', color: '#06090f' }}
                >
                  Current Plan
                </span>
              )}
              {!isPickedFromUrl && !isCurrent && isPopular && (
                <span
                  className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full px-3 py-0.5 text-xs font-semibold"
                  style={{ background: '#38e8c8', color: '#06090f' }}
                >
                  Most Popular
                </span>
              )}

              <h3 className="text-lg font-semibold text-white">{plan.name}</h3>
              <p className="mt-0.5 text-xs text-[#7a88a8]">{copy.subtitle}</p>

              <p className="mt-3">
                <span
                  className="text-3xl text-white"
                  style={{ fontFamily: "'Playfair Display', serif" }}
                >
                  ${displayPrice}
                </span>
                <span className="text-sm text-[#7a88a8]">/mo</span>
              </p>

              {billingInterval === 'year' ? (
                <p className="mt-1 text-xs text-[#7a88a8]">
                  Billed ${plan.priceYearly}/yr ·{' '}
                  <span className="text-[#38e8c8]">2 months free</span>
                </p>
              ) : (
                <p className="mt-1 text-xs text-[#7a88a8]">
                  ${getAnnualMonthly(tier)}/mo billed annually
                </p>
              )}

              <ul className="mt-5 space-y-2">
                {copy.features.map((f) => (
                  <li
                    key={f}
                    className="flex items-start gap-2 text-sm text-[#7a88a8]"
                  >
                    <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#38e8c8]" />
                    {f}
                  </li>
                ))}
              </ul>

              {isCurrent ? (
                <button
                  disabled
                  className="mt-6 w-full cursor-default rounded-lg py-2.5 text-sm font-semibold opacity-50"
                  style={{ color: '#ffffff', border: '1px solid rgba(232,236,245,0.12)' }}
                >
                  Current Plan
                </button>
              ) : isDowngrade ? (
                <button
                  onClick={openBillingPortal}
                  disabled={portalLoading}
                  className="mt-6 w-full rounded-lg py-2.5 text-sm font-semibold transition"
                  style={{
                    color: '#ffffff',
                    border: '1px solid rgba(232,236,245,0.12)',
                    background: 'transparent',
                  }}
                >
                  {portalLoading ? (
                    <Loader2 className="mx-auto h-4 w-4 animate-spin" />
                  ) : (
                    'Manage in Billing'
                  )}
                </button>
              ) : isUpgrade ? (
                <button
                  onClick={() => handleUpgrade(tier)}
                  disabled={loadingPlan === tier}
                  className="mt-6 w-full rounded-lg py-2.5 text-sm font-semibold transition"
                  style={
                    isPopular
                      ? { background: '#38e8c8', color: '#06090f' }
                      : {
                          background: 'transparent',
                          color: '#ffffff',
                          border: '1px solid rgba(232,236,245,0.12)',
                        }
                  }
                >
                  {loadingPlan === tier ? (
                    <Loader2 className="mx-auto h-4 w-4 animate-spin" />
                  ) : (
                    `Upgrade to ${plan.name}`
                  )}
                </button>
              ) : (
                <button
                  onClick={() => handleUpgrade(tier)}
                  disabled={loadingPlan === tier}
                  className="mt-6 w-full rounded-lg py-2.5 text-sm font-semibold transition"
                  style={{
                    background: 'transparent',
                    color: '#ffffff',
                    border: '1px solid rgba(232,236,245,0.12)',
                  }}
                >
                  {loadingPlan === tier ? (
                    <Loader2 className="mx-auto h-4 w-4 animate-spin" />
                  ) : (
                    `Get ${plan.name}`
                  )}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* ─── Feature comparison table ─── */}
      <div className="mt-8">
        <h2
          className="mb-6 text-center text-xl font-semibold text-white"
          style={{ fontFamily: "'Playfair Display', serif" }}
        >
          Compare Plans
        </h2>
        <div
          className="overflow-x-auto rounded-xl"
          style={{ border: '1px solid rgba(232,236,245,0.06)' }}
        >
          <table className="w-full text-sm text-[#7a88a8]">
            <thead>
              <tr
                style={{
                  background: 'rgba(12,18,32,0.6)',
                  borderBottom: '1px solid rgba(232,236,245,0.08)',
                }}
              >
                <th
                  className="py-3.5 pl-5 pr-4 text-left font-medium text-white"
                  style={{ minWidth: '200px' }}
                >
                  Feature
                </th>
                {TIER_ORDER.map((tier) => (
                  <th
                    key={tier}
                    className="px-3 py-3.5 text-center font-medium"
                    style={{
                      color: tier === FEATURED_TIER ? '#38e8c8' : '#ffffff',
                      minWidth: '120px',
                    }}
                  >
                    {STRIPE_PLANS[tier].name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {FEATURE_ROWS.map((row, idx) => (
                <tr
                  key={row.label}
                  style={{
                    borderBottom:
                      idx < FEATURE_ROWS.length - 1
                        ? '1px solid rgba(232,236,245,0.04)'
                        : 'none',
                    background: idx % 2 === 0 ? 'transparent' : 'rgba(12,18,32,0.3)',
                  }}
                >
                  <td
                    className="py-3 pl-5 pr-4 text-left text-sm"
                    title={row.tooltip || ''}
                  >
                    {row.label}
                    {row.tooltip && (
                      <span
                        className="ml-1 cursor-help text-xs"
                        style={{ color: 'rgba(122,136,168,0.5)' }}
                      >
                        &#9432;
                      </span>
                    )}
                  </td>
                  {row.values.map((val, i) => (
                    <td
                      key={i}
                      className="px-3 py-3 text-center text-sm"
                      style={{
                        color:
                          val === '\u2713'
                            ? '#38e8c8'
                            : val === '\u2014'
                              ? 'rgba(122,136,168,0.35)'
                              : '#7a88a8',
                      }}
                    >
                      {val}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ─── Suite cross-link ─── */}
      <div
        className="mt-8 rounded-xl p-6 flex items-center justify-between gap-6 max-md:flex-col max-md:items-start"
        style={{
          background: 'linear-gradient(135deg, rgba(56,232,200,0.05), #0c1220)',
          border: '1px solid rgba(232,236,245,0.06)',
        }}
      >
        <div className="flex-1">
          <div
            className="text-xs font-semibold uppercase tracking-[0.15em] mb-2"
            style={{ color: '#38e8c8' }}
          >
            Agency Suite
          </div>
          <h3
            className="text-lg font-semibold mb-1 text-white"
            style={{ fontFamily: "'Playfair Display', serif" }}
          >
            Already running ReForge? Bundle both for a built-in upsell loop.
          </h3>
          <p className="text-sm text-[#7a88a8]">
            ReForge publishing signals feed ClientPulse health scores. The bundled Agency Suite lives on the ReForge pricing page.
          </p>
        </div>
        <a
          href="https://reforge.helloaurora.ai/pricing"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 whitespace-nowrap rounded-lg px-5 py-2.5 text-sm font-semibold transition"
          style={{
            color: '#ffffff',
            border: '1px solid rgba(56,232,200,0.4)',
            background: 'rgba(56,232,200,0.08)',
          }}
        >
          View Suite pricing
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>

      {/* ─── Coupon hint ─── */}
      <p className="text-center text-xs text-[#7a88a8]">
        Have a promo code? Apply it at checkout — 30% off first year for Agency with{' '}
        <code className="text-[#38e8c8]">EA-CP-AGENCY-30</code> (20 slots remaining).
      </p>
    </div>
  );
}
