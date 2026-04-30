import { describe, expect, it } from 'vitest';
import {
  STEP_ORDER,
  buildStepOrder,
  canAdvance,
  isLastStep,
  isValidStep,
  isWizardComplete,
  nextStep,
  parseStep,
  prevStep,
  stepIndex,
  type OnboardingState,
} from '@/lib/onboarding/state';

function state(over: Partial<OnboardingState> = {}): OnboardingState {
  return {
    step: 'stripe',
    completedAt: null,
    hasSubscription: false,
    ...over,
  };
}

describe('STEP_ORDER / isValidStep / parseStep', () => {
  it('canonical order is 4 steps', () => {
    expect(STEP_ORDER).toEqual(['stripe', 'integrations', 'client', 'brief']);
  });

  it('isValidStep rejects unknown strings', () => {
    expect(isValidStep('wrong')).toBe(false);
    expect(isValidStep('stripe')).toBe(true);
    expect(isValidStep(null)).toBe(false);
  });

  it('parseStep defaults to stripe on missing/invalid', () => {
    expect(parseStep(null)).toBe('stripe');
    expect(parseStep(undefined)).toBe('stripe');
    expect(parseStep('bogus')).toBe('stripe');
    expect(parseStep('client')).toBe('client');
  });
});

describe('stepIndex / nextStep / prevStep / isLastStep', () => {
  it('stepIndex returns canonical position', () => {
    expect(stepIndex('stripe')).toBe(0);
    expect(stepIndex('integrations')).toBe(1);
    expect(stepIndex('client')).toBe(2);
    expect(stepIndex('brief')).toBe(3);
  });

  it('nextStep walks forward, null on last', () => {
    expect(nextStep('stripe')).toBe('integrations');
    expect(nextStep('integrations')).toBe('client');
    expect(nextStep('client')).toBe('brief');
    expect(nextStep('brief')).toBeNull();
  });

  it('prevStep walks back, null on first', () => {
    expect(prevStep('stripe')).toBeNull();
    expect(prevStep('integrations')).toBe('stripe');
    expect(prevStep('brief')).toBe('client');
  });

  it('isLastStep true only on brief', () => {
    expect(isLastStep('brief')).toBe(true);
    expect(isLastStep('client')).toBe(false);
  });
});

describe('canAdvance', () => {
  it('stripe step blocks advance without subscription', () => {
    expect(canAdvance('stripe', state({ hasSubscription: false }))).toBe(false);
    expect(canAdvance('stripe', state({ hasSubscription: true }))).toBe(true);
  });

  it('non-stripe steps are always advanceable (self-managing)', () => {
    for (const step of ['integrations', 'client', 'brief'] as const) {
      expect(canAdvance(step, state({ hasSubscription: false }))).toBe(true);
    }
  });
});

describe('buildStepOrder + dynamic helpers (Slice 7b)', () => {
  it('non-Suite agencies get the canonical 4-step order', () => {
    const order = buildStepOrder({ hasSuiteAccess: false, unmatchedCount: 5 });
    expect(order).toEqual(['stripe', 'integrations', 'client', 'brief']);
  });

  it('Suite agency with no unmatched signals gets the 4-step order', () => {
    const order = buildStepOrder({ hasSuiteAccess: true, unmatchedCount: 0 });
    expect(order).toEqual(['stripe', 'integrations', 'client', 'brief']);
  });

  it('Suite agency with unmatched signals gets the 5-step order with suite slotted before brief', () => {
    const order = buildStepOrder({ hasSuiteAccess: true, unmatchedCount: 3 });
    expect(order).toEqual(['stripe', 'integrations', 'client', 'suite', 'brief']);
  });

  it('nextStep / prevStep / isLastStep honor the dynamic order', () => {
    const order = buildStepOrder({ hasSuiteAccess: true, unmatchedCount: 1 });
    expect(nextStep('client', order)).toBe('suite');
    expect(nextStep('suite', order)).toBe('brief');
    expect(prevStep('brief', order)).toBe('suite');
    expect(prevStep('suite', order)).toBe('client');
    expect(isLastStep('brief', order)).toBe(true);
    expect(isLastStep('suite', order)).toBe(false);
  });

  it('stepIndex returns -1 for steps not in the supplied order (e.g. ?step=suite for non-Suite)', () => {
    const order = buildStepOrder({ hasSuiteAccess: false, unmatchedCount: 0 });
    expect(stepIndex('suite', order)).toBe(-1);
    expect(nextStep('suite', order)).toBeNull();
    expect(prevStep('suite', order)).toBeNull();
  });

  it('isValidStep accepts "suite" so the URL parser doesn\'t silently rewrite it', () => {
    expect(isValidStep('suite')).toBe(true);
    expect(parseStep('suite')).toBe('suite');
  });
});

describe('isWizardComplete', () => {
  it('false while completedAt is null', () => {
    expect(isWizardComplete(state())).toBe(false);
  });

  it('true once completedAt is set', () => {
    expect(
      isWizardComplete(state({ completedAt: '2026-04-22T00:00:00Z' }))
    ).toBe(true);
  });
});
