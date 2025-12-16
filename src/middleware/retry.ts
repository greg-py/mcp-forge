import { ForgeMiddleware, MiddlewareContext } from "../core/Forge";

/**
 * Configuration options for retry middleware.
 */
export interface RetryOptions {
    /**
     * Maximum number of retry attempts.
     * @default 3
     */
    maxRetries?: number;

    /**
     * Initial delay between retries in milliseconds.
     * @default 1000
     */
    initialDelayMs?: number;

    /**
     * Maximum delay between retries in milliseconds.
     * @default 30000
     */
    maxDelayMs?: number;

    /**
     * Multiplier for exponential backoff.
     * @default 2
     */
    backoffMultiplier?: number;

    /**
     * Random jitter to add to delays (0-1, as a fraction of delay).
     * @default 0.1
     */
    jitter?: number;

    /**
     * Predicate to determine if an error should trigger a retry.
     * Defaults to retrying all errors.
     * @param error - The error that occurred
     * @param ctx - The middleware context
     * @returns Whether to retry
     */
    shouldRetry?: (error: unknown, ctx: MiddlewareContext) => boolean;

    /**
     * Callback when a retry occurs.
     * @param error - The error that triggered the retry
     * @param attempt - The current attempt number (1-indexed)
     * @param delayMs - The delay before the next attempt
     * @param ctx - The middleware context
     */
    onRetry?: (error: unknown, attempt: number, delayMs: number, ctx: MiddlewareContext) => void;
}

/**
 * Retry middleware with exponential backoff.
 *
 * Automatically retries failed handler executions with configurable
 * backoff and jitter to prevent thundering herd problems.
 *
 * @param options - Retry configuration
 * @returns A Forge middleware function
 *
 * @example
 * ```typescript
 * // Retry up to 3 times with exponential backoff
 * forge.use(retry({ maxRetries: 3, initialDelayMs: 1000 }));
 *
 * // Only retry specific errors
 * forge.use(retry({
 *   maxRetries: 3,
 *   shouldRetry: (error) => error instanceof NetworkError
 * }));
 * ```
 */
export function retry(options: RetryOptions = {}): ForgeMiddleware {
    const {
        maxRetries = 3,
        initialDelayMs = 1000,
        maxDelayMs = 30_000,
        backoffMultiplier = 2,
        jitter = 0.1,
        shouldRetry = () => true,
        onRetry,
    } = options;

    function calculateDelay(attempt: number): number {
        let delay = initialDelayMs * Math.pow(backoffMultiplier, attempt - 1);
        delay = Math.min(delay, maxDelayMs);

        // Add jitter
        const jitterAmount = delay * jitter * (Math.random() * 2 - 1);
        delay = Math.max(0, delay + jitterAmount);

        return Math.round(delay);
    }

    function sleep(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    return async (ctx: MiddlewareContext, next: () => Promise<unknown>): Promise<unknown> => {
        let lastError: unknown;

        for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
            try {
                return await next();
            } catch (error) {
                lastError = error;

                // Check if we should retry
                if (attempt > maxRetries || !shouldRetry(error, ctx)) {
                    throw error;
                }

                const delayMs = calculateDelay(attempt);
                onRetry?.(error, attempt, delayMs, ctx);

                await sleep(delayMs);
            }
        }

        throw lastError;
    };
}
