/**
 * Smart Retry Utility
 *
 * Provides intelligent retry logic with exponential backoff.
 * Generic enough to work with any async operation (WuzAPI, other providers, etc.)
 */

export interface RetryOptions {
  /** Maximum number of retry attempts (default: 3) */
  maxAttempts?: number;
  /** Initial delay in ms before first retry (default: 1000) */
  initialDelayMs?: number;
  /** Maximum delay in ms between retries (default: 10000) */
  maxDelayMs?: number;
  /** Multiplier for exponential backoff (default: 2) */
  backoffMultiplier?: number;
  /** Function to determine if error is retryable (default: all errors are retryable) */
  isRetryable?: (error: unknown) => boolean;
  /** Callback called before each retry attempt */
  onRetry?: (attempt: number, error: unknown, nextDelayMs: number) => void;
}

const DEFAULT_OPTIONS: Required<Omit<RetryOptions, 'onRetry' | 'isRetryable'>> = {
  maxAttempts: 3,
  initialDelayMs: 1000,
  maxDelayMs: 10000,
  backoffMultiplier: 2,
};

/**
 * Execute an async function with smart retry logic.
 *
 * @example
 * ```ts
 * const result = await withRetry(
 *   () => client.sendText(phone, message),
 *   {
 *     maxAttempts: 3,
 *     initialDelayMs: 1000,
 *     onRetry: (attempt, error) => log.warn("Retrying send", { attempt, error })
 *   }
 * );
 * ```
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let lastError: unknown;
  let delayMs = opts.initialDelayMs;

  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Check if we should retry
      const isRetryable = opts.isRetryable?.(error) ?? true;
      const isLastAttempt = attempt >= opts.maxAttempts;

      if (!isRetryable || isLastAttempt) {
        throw error;
      }

      // Call onRetry callback
      opts.onRetry?.(attempt, error, delayMs);

      // Wait before next attempt
      await sleep(delayMs);

      // Calculate next delay with exponential backoff
      delayMs = Math.min(delayMs * opts.backoffMultiplier, opts.maxDelayMs);
    }
  }

  // Should never reach here, but TypeScript needs this
  throw lastError;
}

/**
 * Check if an error is likely a transient/temporary error that should be retried.
 * Useful for network errors, rate limits, and "not ready" states.
 */
export function isTransientError(error: unknown): boolean {
  if (!(error instanceof Error)) return true;

  const message = error.message.toLowerCase();

  // Common transient error patterns
  const transientPatterns = [
    'timeout',
    'timed out',
    'econnreset',
    'econnrefused',
    'socket hang up',
    'network',
    'temporarily unavailable',
    'rate limit',
    'too many requests',
    '429',
    '503',
    '502',
    'not ready',
    'initializing',
    'connecting',
    'reconnect',
  ];

  return transientPatterns.some((pattern) => message.includes(pattern));
}

/**
 * Check if error is a "not ready" type error (connection still initializing)
 */
export function isNotReadyError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;

  const message = error.message.toLowerCase();

  const notReadyPatterns = [
    'not ready',
    'not connected',
    'not logged in',
    'initializing',
    'connecting',
    'session not found',
    'client not ready',
  ];

  return notReadyPatterns.some((pattern) => message.includes(pattern));
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
