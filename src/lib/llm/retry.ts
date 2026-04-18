// ─── Retry wrapper for generateCompletion() ───────────────────────
// Sprint 8A M1.1: preserve the §23.4 LRA retry semantics (3× exponential
// back-off on 429/timeouts) while keeping the Anthropic SDK out of the
// agent layer. Duck-types the `cause` on LLMError so this layer stays
// provider-agnostic.
//
// Supersedes src/lib/agents/anthropic-retry.ts, which imported
// @anthropic-ai/sdk directly in the agent layer. That file is removed
// in this sprint.

import {
  generateCompletion,
  type GenerateCompletionArgs,
  type GenerateCompletionResult,
} from './client';
import { LLMError } from './types';

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1_000;

// ─── Public error class ──────────────────────────────────────────

export type LLMRetryErrorCode =
  | 'rate_limit'
  | 'auth_error'
  | 'timeout'
  | 'api_error';

export class LLMRetryError extends Error {
  constructor(
    message: string,
    public readonly code: LLMRetryErrorCode,
    public readonly retryable: boolean,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'LLMRetryError';
  }
}

// ─── Main export ─────────────────────────────────────────────────

/**
 * Call `generateCompletion()` with automatic retry on 429/timeout,
 * safe 401 logging, and exponential back-off.
 *
 * Retry policy:
 *   - 429 rate-limit     → retry up to 3 times (1s / 2s / 4s)
 *   - timeout / abort    → retry up to 3 times (1s / 2s / 3s)
 *   - 401 auth-error     → no retry; logged without leaking the API key
 *   - other API errors   → no retry; surfaced immediately
 *
 * @param args     Same shape as `generateCompletion()` args
 * @param context  Label used in log lines, e.g. '[churn-prediction-agent]'
 */
export async function generateCompletionWithRetry(
  args: GenerateCompletionArgs,
  context = '[llm-agent]',
): Promise<GenerateCompletionResult> {
  let lastError: unknown = new Error('Unknown LLM error');

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await generateCompletion(args);
    } catch (err) {
      lastError = err;
      const classified = classify(err);

      // ── 429 Rate limit ──────────────────────────────────────────
      if (classified === 'rate_limit') {
        const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1);
        console.warn(
          `${context} LLM rate-limited (429). ` +
          `Attempt ${attempt}/${MAX_RETRIES}. Retrying in ${delay} ms.`,
        );
        if (attempt < MAX_RETRIES) {
          await sleep(delay);
          continue;
        }
        throw new LLMRetryError(
          `LLM rate limit exceeded after ${MAX_RETRIES} attempts`,
          'rate_limit',
          true,
          err,
        );
      }

      // ── Timeout / abort ─────────────────────────────────────────
      if (classified === 'timeout') {
        const delay = BASE_DELAY_MS * attempt;
        console.error(
          `${context} LLM request timed out ` +
          `(attempt ${attempt}/${MAX_RETRIES}). Retrying in ${delay} ms.`,
        );
        if (attempt < MAX_RETRIES) {
          await sleep(delay);
          continue;
        }
        throw new LLMRetryError(
          `LLM request timed out after ${MAX_RETRIES} attempts`,
          'timeout',
          true,
          err,
        );
      }

      // ── 401 Authentication ─────────────────────────────────────
      if (classified === 'auth_error') {
        // Log the condition — NOT the key value — to avoid secret leakage
        console.error(
          `${context} LLM authentication failed (401). ` +
          `Verify that the provider API key is present and valid in environment variables.`,
        );
        throw new LLMRetryError(
          'LLM authentication failed — check provider API key',
          'auth_error',
          false,
          err,
        );
      }

      // ── Other API errors ───────────────────────────────────────
      const msg = err instanceof Error ? err.message : String(err);
      const statusInfo = getStatus(err) != null ? ` HTTP ${getStatus(err)}` : '';
      console.error(`${context} LLM API error${statusInfo}: ${msg}`);
      throw new LLMRetryError(`LLM API error: ${msg}`, 'api_error', false, err);
    }
  }

  // Unreachable in practice — TypeScript needs a return path
  throw lastError instanceof Error
    ? lastError
    : new Error(String(lastError));
}

// ─── Error classification ────────────────────────────────────────

type Classified = 'rate_limit' | 'timeout' | 'auth_error' | 'api_error' | 'unknown';

function classify(err: unknown): Classified {
  // LLMError wraps provider-native errors with .cause. Unwrap once.
  const candidate = err instanceof LLMError ? err.cause : err;

  if (candidate == null) return 'api_error';

  // Name/tag-based checks (works for Anthropic SDK error classes,
  // AbortSignal timeouts, and fetch-layer errors without needing
  // direct SDK imports).
  const name = (candidate as { name?: string }).name;
  if (name === 'TimeoutError' || name === 'AbortError') {
    return 'timeout';
  }
  if (name === 'RateLimitError') {
    return 'rate_limit';
  }
  if (name === 'AuthenticationError') {
    return 'auth_error';
  }
  if (name === 'APIConnectionTimeoutError' || name === 'APIUserAbortError') {
    return 'timeout';
  }

  // HTTP status code duck-typing (Anthropic/OpenAI/Google SDKs all
  // expose `.status` on their API-error instances).
  const status = getStatus(candidate);
  if (status === 429) return 'rate_limit';
  if (status === 401) return 'auth_error';
  if (status != null) return 'api_error';

  return 'api_error';
}

function getStatus(err: unknown): number | undefined {
  if (err == null || typeof err !== 'object') return undefined;
  const status = (err as { status?: unknown }).status;
  return typeof status === 'number' ? status : undefined;
}

// ─── Helpers ─────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
