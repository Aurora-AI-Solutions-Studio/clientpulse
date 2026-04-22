/**
 * Upgrade Banner Component
 * Displays call-to-action for free/solo users to upgrade to next tier
 */

'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { X, TrendingUp, Zap, Lock } from 'lucide-react';
import { SubscriptionPlan } from '@/types/stripe';

interface UpgradeBannerProps {
  currentPlan: 'free' | SubscriptionPlan;
  onClose?: () => void;
}

const PLAN_UPGRADES: Record<string, {
  nextPlan: SubscriptionPlan;
  nextPlanName: string;
  benefits: string[];
  cta: string;
}> = {
  free: {
    nextPlan: 'solo',
    nextPlanName: 'Solo',
    benefits: [
      'Up to 3 clients',
      'Health Scores & Monday Brief',
      'Stripe sync',
    ],
    cta: 'Upgrade to Solo',
  },
  solo: {
    nextPlan: 'pro',
    nextPlanName: 'Pro',
    benefits: [
      'Up to 10 clients',
      'Meeting Intelligence + Action Proposal Engine',
      'Upsell Detection',
      '3 seats',
    ],
    cta: 'Upgrade to Pro',
  },
  pro: {
    nextPlan: 'agency',
    nextPlanName: 'Agency',
    benefits: [
      'Unlimited clients',
      'AI-powered Financial Signal Agent',
      'Stripe Connect integration',
      'Advanced predictive analytics',
    ],
    cta: 'Upgrade to Agency',
  },
};

export function UpgradeBanner({ currentPlan, onClose }: UpgradeBannerProps) {
  const [isVisible, setIsVisible] = useState(true);
  const [isLoading, setIsLoading] = useState(false);

  if (!isVisible) {
    return null;
  }

  const upgradeInfo = PLAN_UPGRADES[currentPlan];
  if (!upgradeInfo) {
    return null;
  }

  const handleClose = () => {
    setIsVisible(false);
    onClose?.();
  };

  const handleUpgrade = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          plan: upgradeInfo.nextPlan,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create checkout session');
      }

      const data = await response.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      console.error('Upgrade error:', error);
      setIsLoading(false);
    }
  };

  const iconMap: Record<string, typeof Zap> = {
    free: Zap,
    solo: TrendingUp,
    pro: Lock,
  };

  const Icon = iconMap[currentPlan] || Zap;

  return (
    <Card className="border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50 p-4 md:p-6 relative overflow-hidden">
      {/* Decorative background element */}
      <div className="absolute right-0 top-0 -translate-y-1/3 translate-x-1/3 opacity-10">
        <Icon size={200} />
      </div>

      {/* Close button */}
      <button
        onClick={handleClose}
        className="absolute right-4 top-4 text-gray-400 hover:text-gray-600 transition-colors"
        aria-label="Close banner"
      >
        <X size={20} />
      </button>

      <div className="relative z-10">
        <div className="flex items-center gap-3 mb-3">
          <Icon className="text-blue-600" size={24} />
          <div>
            <h3 className="font-semibold text-gray-900">
              Ready for more power?
            </h3>
            <p className="text-sm text-gray-600">
              Unlock advanced features with {upgradeInfo.nextPlanName}
            </p>
          </div>
        </div>

        <div className="mb-4">
          <p className="text-sm font-medium text-gray-700 mb-2">
            What you&apos;ll get:
          </p>
          <ul className="space-y-1">
            {upgradeInfo.benefits.map((benefit, idx) => (
              <li key={idx} className="text-sm text-gray-600 flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-blue-600 rounded-full" />
                {benefit}
              </li>
            ))}
          </ul>
        </div>

        <div className="flex items-center gap-3">
          <Button
            onClick={handleUpgrade}
            disabled={isLoading}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            {isLoading ? 'Loading...' : upgradeInfo.cta}
          </Button>
          <Button
            onClick={handleClose}
            variant="outline"
            className="text-gray-700"
          >
            Maybe later
          </Button>
        </div>
      </div>
    </Card>
  );
}
