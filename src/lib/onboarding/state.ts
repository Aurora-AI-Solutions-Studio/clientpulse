// Onboarding wizard — pure step state machine.
//
// Kept data-shape-only (no DOM, no fetch) so it can be unit-tested
// in isolation from the React surface. Caller drives step transitions
// from UI events; this module answers "which step am I on, what's
// next, is the sequence done?".

export type OnboardingStep = 'stripe' | 'integrations' | 'client' | 'brief';

export const STEP_ORDER: readonly OnboardingStep[] = [
  'stripe',
  'integrations',
  'client',
  'brief',
] as const;

export const STEP_LABELS: Record<OnboardingStep, string> = {
  stripe: 'Billing',
  integrations: 'Connections',
  client: 'First client',
  brief: 'Monday Brief',
};

export interface OnboardingState {
  step: OnboardingStep;
  completedAt: string | null; // profiles.onboarding_completed_at
  hasSubscription: boolean; // subscription_plan != 'free' and status active|trialing
}

export function isValidStep(v: unknown): v is OnboardingStep {
  return (
    typeof v === 'string' &&
    (STEP_ORDER as readonly string[]).includes(v)
  );
}

export function parseStep(v: string | null | undefined): OnboardingStep {
  return isValidStep(v) ? v : 'stripe';
}

export function stepIndex(step: OnboardingStep): number {
  return STEP_ORDER.indexOf(step);
}

export function isLastStep(step: OnboardingStep): boolean {
  return stepIndex(step) === STEP_ORDER.length - 1;
}

export function nextStep(step: OnboardingStep): OnboardingStep | null {
  const i = stepIndex(step);
  if (i < 0 || i >= STEP_ORDER.length - 1) return null;
  return STEP_ORDER[i + 1];
}

export function prevStep(step: OnboardingStep): OnboardingStep | null {
  const i = stepIndex(step);
  if (i <= 0) return null;
  return STEP_ORDER[i - 1];
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
