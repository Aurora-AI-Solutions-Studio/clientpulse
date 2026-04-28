'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Check, ChevronLeft, ChevronRight } from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  STEP_ORDER,
  STEP_LABELS,
  canAdvance,
  isLastStep,
  nextStep,
  parseStep,
  prevStep,
  stepIndex,
  type OnboardingStep,
} from '@/lib/onboarding/state';
import { StepStripe } from './steps/step-stripe';
import { StepIntegrations } from './steps/step-integrations';
import { StepFirstClient } from './steps/step-first-client';
import { StepFirstBrief } from './steps/step-first-brief';

interface MeResponse {
  agencyId: string | null;
  subscriptionPlan: string;
  subscriptionStatus: string;
  stripeCustomerId: string | null;
  onboardingCompletedAt: string | null;
  tier: 'free' | 'solo' | 'pro' | 'agency';
  tierLabel: string;
}

export default function OnboardingPage() {
  const router = useRouter();
  const params = useSearchParams();
  const step = parseStep(params.get('step'));
  const [me, setMe] = useState<MeResponse | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadMe() {
    try {
      const res = await fetch('/api/me');
      if (res.ok) setMe(await res.json());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadMe();
  }, []);

  useEffect(() => {
    if (me?.onboardingCompletedAt) {
      router.replace('/dashboard');
    }
  }, [me, router]);

  function goTo(next: OnboardingStep) {
    router.replace(`/dashboard/onboarding?step=${next}`);
  }

  async function onAdvance() {
    const n = nextStep(step);
    if (n) goTo(n);
  }

  async function onComplete() {
    const res = await fetch('/api/onboarding/complete', { method: 'POST' });
    if (res.ok) {
      router.replace('/dashboard');
    }
  }

  const hasSubscription =
    !!me &&
    me.subscriptionPlan !== 'free' &&
    (me.subscriptionStatus === 'active' || me.subscriptionStatus === 'trialing');

  const advanceable =
    !!me &&
    canAdvance(step, {
      step,
      completedAt: me.onboardingCompletedAt,
      hasSubscription,
    });

  const currentIdx = stepIndex(step);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl text-white mb-2">
          Welcome to ClientPulse
        </h1>
        <p className="text-[#7a88a8]">
          Four quick steps to a living portfolio view. Resume anytime —
          your progress sticks.
        </p>
      </div>

      {/* Step rail */}
      <div className="flex items-center gap-2">
        {STEP_ORDER.map((s, idx) => {
          const done = idx < currentIdx;
          const active = idx === currentIdx;
          return (
            <div key={s} className="flex items-center gap-2 flex-1">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0
                  ${
                    done
                      ? 'bg-[#38e8c8]/20 text-[#38e8c8] border border-[#38e8c8]/40'
                      : active
                        ? 'bg-[#e74c3c]/15 text-[#e74c3c] border border-[#e74c3c]/40'
                        : 'bg-[#1a2540] text-[#7a88a8] border border-[#1a2540]'
                  }`}
              >
                {done ? <Check className="w-4 h-4" /> : idx + 1}
              </div>
              <span
                className={`text-xs uppercase tracking-wider
                  ${
                    done || active ? 'text-white' : 'text-[#7a88a8]'
                  }`}
              >
                {STEP_LABELS[s]}
              </span>
              {idx < STEP_ORDER.length - 1 && (
                <div className="flex-1 h-px bg-[#1a2540]" />
              )}
            </div>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            Step {currentIdx + 1} · {STEP_LABELS[step]}
          </CardTitle>
          <CardDescription>
            {me?.tierLabel && (
              <span>
                Currently on <span className="text-white">{me.tierLabel}</span>
              </span>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading && <p className="text-[#7a88a8] text-sm">Loading…</p>}
          {!loading && me && (
            <>
              {step === 'stripe' && <StepStripe me={me} onReload={loadMe} />}
              {step === 'integrations' && <StepIntegrations />}
              {step === 'client' && <StepFirstClient />}
              {step === 'brief' && <StepFirstBrief agencyId={me.agencyId} />}
            </>
          )}
        </CardContent>
      </Card>

      {/* Nav footer */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => {
            const p = prevStep(step);
            if (p) goTo(p);
          }}
          disabled={!prevStep(step)}
          className="text-sm text-[#7a88a8] hover:text-white inline-flex items-center gap-1 disabled:opacity-30"
        >
          <ChevronLeft className="w-4 h-4" />
          Back
        </button>
        {isLastStep(step) ? (
          <button
            type="button"
            onClick={onComplete}
            className="text-sm bg-[#38e8c8]/15 border border-[#38e8c8]/40 text-[#38e8c8] hover:bg-[#38e8c8]/25 px-4 py-2 rounded transition-colors"
          >
            Finish onboarding
          </button>
        ) : (
          <button
            type="button"
            onClick={onAdvance}
            disabled={!advanceable}
            className="text-sm bg-[#e74c3c]/15 border border-[#e74c3c]/40 text-[#e74c3c] hover:bg-[#e74c3c]/25 px-4 py-2 rounded transition-colors inline-flex items-center gap-1 disabled:opacity-30"
          >
            Continue
            <ChevronRight className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}
