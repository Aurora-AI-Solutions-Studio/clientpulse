'use client';

import Link from 'next/link';
import { CheckCircle2, CreditCard } from 'lucide-react';

interface MeLite {
  subscriptionPlan: string;
  subscriptionStatus: string;
  stripeCustomerId: string | null;
  tierLabel: string;
}

export function StepStripe({
  me,
  onReload,
}: {
  me: MeLite;
  onReload: () => void | Promise<void>;
}) {
  const paid =
    me.subscriptionPlan !== 'free' &&
    (me.subscriptionStatus === 'active' || me.subscriptionStatus === 'trialing');

  return (
    <div className="space-y-4">
      <p className="text-sm text-[#c8d0e0]">
        ClientPulse is billed per agency. Pick a plan to unlock client
        slots, agent features, and the Monday Brief. You can cancel or
        change plans anytime from the billing portal.
      </p>

      <div className="p-4 bg-[#1a2540]/30 rounded-lg border border-[#1a2540]">
        <div className="flex items-center gap-3">
          {paid ? (
            <CheckCircle2 className="w-5 h-5 text-[#38e8c8] flex-shrink-0" />
          ) : (
            <CreditCard className="w-5 h-5 text-[#f0c84c] flex-shrink-0" />
          )}
          <div className="flex-1">
            <p className="text-sm font-medium text-white">
              {paid
                ? `You're on ${me.tierLabel} (${me.subscriptionStatus})`
                : 'No paid plan yet'}
            </p>
            <p className="text-xs text-[#7a88a8] mt-1">
              {paid
                ? 'Billing is set up. Click Continue to connect your data sources.'
                : 'Choose a plan on the upgrade page — then come back to continue.'}
            </p>
          </div>
        </div>
      </div>

      {!paid && (
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/upgrade"
            className="text-sm bg-[#38e8c8]/15 border border-[#38e8c8]/40 text-[#38e8c8] hover:bg-[#38e8c8]/25 px-4 py-2 rounded transition-colors"
          >
            View plans
          </Link>
          <button
            type="button"
            onClick={() => onReload()}
            className="text-sm text-[#7a88a8] hover:text-white"
          >
            I just subscribed — refresh status
          </button>
        </div>
      )}

      {paid && me.stripeCustomerId && (
        <p className="text-xs text-[#7a88a8]">
          Manage your subscription later from Dashboard → View plans & upgrade → Manage billing.
        </p>
      )}
    </div>
  );
}
