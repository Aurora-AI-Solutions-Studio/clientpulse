/**
 * Simple in-memory sliding-window rate limiter.
 * Sufficient for launch; swap for @upstash/ratelimit + Vercel KV at scale.
 */

interface RateLimitEntry {
  timestamps: number[];
}

const store = new Map<string, RateLimitEntry>();

// Clean stale entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store.entries()) {
    entry.timestamps = entry.timestamps.filter((t) => now - t < 60_000);
    if (entry.timestamps.length === 0) store.delete(key);
  }
}, 5 * 60 * 1000);

export interface RateLimitConfig {
  /** Max requests per window */
  limit: number;
  /** Window size in seconds */
  windowSec: number;
}

export function rateLimit(
  key: string,
  config: RateLimitConfig
): { success: boolean; remaining: number; reset: number } {
  const now = Date.now();
  const windowMs = config.windowSec * 1000;

  let entry = store.get(key);
  if (!entry) {
    entry = { timestamps: [] };
    store.set(key, entry);
  }

  // Remove timestamps outside current window
  entry.timestamps = entry.timestamps.filter((t) => now - t < windowMs);

  if (entry.timestamps.length >= config.limit) {
    const oldestInWindow = entry.timestamps[0];
    return {
      success: false,
      remaining: 0,
      reset: Math.ceil((oldestInWindow + windowMs - now) / 1000),
    };
  }

  entry.timestamps.push(now);
  return {
    success: true,
    remaining: config.limit - entry.timestamps.length,
    reset: config.windowSec,
  };
}

/**
 * Helper to create rate limit response headers + 429 response.
 */
export function rateLimitResponse(reset: number): Response {
  return new Response(
    JSON.stringify({ error: 'Too many requests. Please try again later.' }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': String(reset),
        'X-RateLimit-Remaining': '0',
      },
    }
  );
}
