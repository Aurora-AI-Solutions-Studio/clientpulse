/**
 * §23.4 LRA: Anthropic API error-handling utility
 *
 * Wraps `client.messages.create` with:
 *  - 429 rate-limit retry  — 3 attempts, exponential back-off (1 s / 2 s / 4 s)
 *  - 401 auth error        — logged without leaking the ANTHROPIC_API_KEY value
 *  - 30-second per-attempt timeout via AbortSignal.timeout
 *
 * Usage:
 *   import { createMessageWithRetry } from '@/lib/agents/anthropic-retry';
 *   const message = await createMessageWithRetry(this.client, params, '[churn-prediction-agent]');
 */

import Anthropic from '@anthropic-ai/sdk';

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1_000;
const TIMEOUT_MS = 30_000;

// ─── Public error class ──────────────────────────────────────────────────────

export class AnthropicAPIError extends Error {
  constructor(
    message: string,
    public readonly code: 'rate_limit' | 'auth_error' | 'timeout' | 'api_error',
    public readonly retryable: boolean
  ) {
    super(message);
    this.name = 'AnthropicAPIError';
  }
}

// ─── Main export ─────────────────────────────────────────────────────────────

/**
 * Call `client.messages.create` with automatic retry on 429/timeout,
 * safe 401 logging, and a per-attempt AbortSignal timeout.
 *
 * @param client   Anthropic SDK instance
 * @param params   Same parameters you pass to `client.messages.create`
 * @param context  Label used in log lines, e.g. '[churn-prediction-agent]'
 */
export async function createMessageWithRetry(
  client: Anthropic,
  params: Parameters<typeof client.messages.create>[0],
  context = '[anthropic-agent]'
): Promise<Anthropic.Message> {
  let lastError: Error = new Error('Unknown Anthropic error');

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const signal = AbortSignal.timeout(TIMEOUT_MS);
      // The Anthropic SDK accepts a RequestOptions second arg with `signal`.
      const message = await client.messages.create(params, { signal } as Parameters<typeof client.messages.create>[1]);
      return message as Anthropic.Message;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));

      // ── 429 Rate limit ─────────────────────────────────────────────────────
      if (err instanceof Anthropic.RateLimitError) {
        const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1);
        console.warn(
          `${context} Anthropic rate-limited (429). ` +
          `Attempt ${attempt}/${MAX_RETRIES}. Retrying in ${delay} ms.`
        );
        if (attempt < MAX_RETRIES) {
          await sleep(delay);
          continue;
        }
        throw new AnthropicAPIError(
          `Anthropic rate limit exceeded after ${MAX_RETRIES} attempts`,
          'rate_limit',
          true
        );
      }

      // ── 401 Authentication ─────────────────────────────────────────────────
      if (err instanceof Anthropic.AuthenticationError) {
        // Log the condition — NOT the key value — to avoid secret leakage
        console.error(
          `${context} Anthropic authentication failed (401). ` +
          `Verify that ANTHROPIC_API_KEY is present and valid in environment variables.`
        );
        throw new AnthropicAPIError(
          'Anthropic authentication failed — check ANTHROPIC_API_KEY',
          'auth_error',
          false // not retryable: wrong key will keep failing
        );
      }

      // ── Timeout / abort ───────────────────────────────────────────────────
      if (
        err instanceof Anthropic.APIConnectionTimeoutError ||
        err instanceof Anthropic.APIUserAbortError ||
        (err instanceof Error && (err.name === 'TimeoutError' || err.name === 'AbortError'))
      ) {
        console.error(
          `${context} Anthropic request timed out after ${TIMEOUT_MS} ms ` +
          `(attempt ${attempt}/${MAX_RETRIES}).`
        );
        if (attempt < MAX_RETRIES) {
          await sleep(BASE_DELAY_MS * attempt);
          continue;
        }
        throw new AnthropicAPIError(
          `Anthropic request timed out after ${MAX_RETRIES} attempts`,
          'timeout',
          true
        );
      }

      // ── Other API errors ───────────────────────────────────────────────────
      // Connection errors, 5xx, etc. — don't retry; surface immediately.
      const statusInfo =
        err instanceof Anthropic.APIError ? ` HTTP ${err.status}` : '';
      console.error(
        `${context} Anthropic API error${statusInfo}: ${lastError.message}`
      );
      throw new AnthropicAPIError(
        `Anthropic API error: ${lastError.message}`,
        'api_error',
        false
      );
    }
  }

  // Unreachable in practice — TypeScript needs a return path
  throw lastError;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
