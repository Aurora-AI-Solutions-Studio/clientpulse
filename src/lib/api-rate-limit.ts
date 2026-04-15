import { rateLimit, rateLimitResponse, type RateLimitConfig } from './rate-limit';

/** Rate limit presets for different API route types */
export const RATE_LIMITS = {
  /** Auth routes: 10 requests per minute */
  auth: { limit: 10, windowSec: 60 } satisfies RateLimitConfig,
  /** AI agent routes: 20 requests per minute per user */
  ai: { limit: 20, windowSec: 60 } satisfies RateLimitConfig,
  /** Expensive AI routes (churn prediction, meeting intel): 5 per minute */
  aiExpensive: { limit: 5, windowSec: 60 } satisfies RateLimitConfig,
  /** Webhook routes: 100 per minute (Stripe sends bursts) */
  webhook: { limit: 100, windowSec: 60 } satisfies RateLimitConfig,
  /** General API: 60 per minute */
  general: { limit: 60, windowSec: 60 } satisfies RateLimitConfig,
} as const;

/**
 * Apply rate limiting to an API route.
 * Returns a 429 Response if limited, or null if allowed.
 */
export function checkRateLimit(
  request: Request,
  prefix: string,
  config: RateLimitConfig
): Response | null {
  const ip = request.headers.get('x-forwarded-for') || 'unknown';
  const key = `${prefix}:${ip}`;
  const result = rateLimit(key, config);

  if (!result.success) {
    return rateLimitResponse(result.reset);
  }
  return null;
}
