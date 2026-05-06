// Onboarding wizard — pure step state machine.
//
// Kept data-shape-only (no DOM, no fetch) so it can be unit-tested
// in isolation from the React surface. Caller drives step transitions
// from UI events; this module answers "which step am I on, what's
// next, is the sequence done?".

export type OnboardingStep = 'stripe' | 'integrations' | 'client' | 'brief' | 'suite';

/** Static step set — `STEP_ORDER` returns this for non-Suite agencies.
 *  Suite agencies with unmatched ContentPulse signals get the 'suite' step
 *  inserted between 'client' and 'brief' via `buildStepOrder`. */
const BASE_STEP_ORDER: readonly OnboardingStep[] = [
  'stripe',
  'integrations',
  'client',
  'brief',
] as const;

export const STEP_ORDER: readonly OnboardingStep[] = BASE_STEP_ORDER;

export const STEP_LABELS: Record<OnboardingStep, string> = {
  stripe: 'Billing',
  integrations: 'Connections',
  client: 'First client',
  brief: 'Monday Brief',
  suite: 'Suite mapping',
};

/** Build the step order for a specific user. Inserts the 'suite' step
 *  between 'client' and 'brief' for Suite agencies that have at least
 *  one unresolved ContentPulse→CP unmatched signal. Otherwise returns the base
 *  4-step sequence — non-Suite agencies and Suite agencies with no
 *  pending mappings never see the wizard step. */
export function buildStepOrder(opts: {
  hasSuiteAccess: boolean;
  unmatchedCount: number;
}): readonly OnboardingStep[] {
  if (!opts.hasSuiteAccess || opts.unmatchedCount <= 0) {
    return BASE_STEP_ORDER;
  }
  return ['stripe', 'integrations', 'client', 'suite', 'brief'] as const;
}

export interface OnboardingState {
  step: OnboardingStep;
  completedAt: string | null; // profiles.onboarding_completed_at
  hasSubscription: boolean; // subscription_plan != 'free' and status active|trialing
}

/** All known step ids — superset of any concrete order. Used by
 *  isValidStep so `?step=suite` doesn't get silently rewritten to
 *  'stripe' for non-Suite users (the page itself decides whether the
 *  step is reachable; the URL parser just decides whether the value is
 *  a known step id). */
const ALL_STEP_IDS: readonly OnboardingStep[] = [
  'stripe',
  'integrations',
  'client',
  'brief',
  'suite',
] as const;

export function isValidStep(v: unknown): v is OnboardingStep {
  return (
    typeof v === 'string' &&
    (ALL_STEP_IDS as readonly string[]).includes(v)
  );
}

export function parseStep(v: string | null | undefined): OnboardingStep {
  return isValidStep(v) ? v : 'stripe';
}

/** Step index against a specific order (defaults to the static
 *  4-step `STEP_ORDER`). Pass the result of `buildStepOrder` from the
 *  wizard page so the 'suite' step slot is honored. */
export function stepIndex(
  step: OnboardingStep,
  order: readonly OnboardingStep[] = STEP_ORDER,
): number {
  return order.indexOf(step);
}

export function isLastStep(
  step: OnboardingStep,
  order: readonly OnboardingStep[] = STEP_ORDER,
): boolean {
  return stepIndex(step, order) === order.length - 1;
}

export function nextStep(
  step: OnboardingStep,
  order: readonly OnboardingStep[] = STEP_ORDER,
): OnboardingStep | null {
  const i = stepIndex(step, order);
  if (i < 0 || i >= order.length - 1) return null;
  return order[i + 1];
}

export function prevStep(
  step: OnboardingStep,
  order: readonly OnboardingStep[] = STEP_ORDER,
): OnboardingStep | null {
  const i = stepIndex(step, order);
  if (i <= 0) return null;
  return order[i - 1];
}

// The wizard is complete only when:
//   1. profiles.onboarding_completed_at is set (user finished step 4), OR
//   2. the user somehow arrives having already done everything, though
//      we still require the explicit "Complete" click on step 4.
export function isWizardComplete(state: OnboardingState): boolean {
  return state.completedAt !== null;
}

// Can the user advance from the current step? Only step 'stripe' has
// a hard gate (must be on a paid plan OR explicitly skip-to-free).
// Integrations, client, and brief are self-managing — the user clicks
// Next when done.
export function canAdvance(step: OnboardingStep, state: OnboardingState): boolean {
  if (step === 'stripe') return state.hasSubscription;
  return true;
}
