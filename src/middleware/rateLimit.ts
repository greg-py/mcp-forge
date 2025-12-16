import { ForgeMiddleware, MiddlewareContext } from "../core/Forge";

/**
 * Configuration options for rate limiting middleware.
 */
export interface RateLimitOptions {
    /**
     * Maximum number of requests allowed within the time window.
     * @default 100
     */
    maxRequests?: number;

    /**
     * Time window in milliseconds.
     * @default 60000 (1 minute)
     */
    windowMs?: number;

    /**
     * Whether to apply rate limiting per tool/resource/prompt name.
     * If false, rate limiting is applied globally across all handlers.
     * @default true
     */
    perHandler?: boolean;

    /**
     * Custom key generator for rate limiting buckets.
     * Allows rate limiting by custom criteria (e.g., by user, API key).
     * @param ctx - The middleware context
     * @returns A string key for the rate limit bucket
     */
    keyGenerator?: (ctx: MiddlewareContext) => string;

    /**
     * Callback when rate limit is exceeded.
     * @param ctx - The middleware context
     * @param retryAfterMs - Milliseconds until the rate limit resets
     */
    onRateLimited?: (ctx: MiddlewareContext, retryAfterMs: number) => void;
}

interface RateLimitBucket {
    count: number;
    resetTime: number;
}

/**
 * Rate limiting middleware using a sliding window algorithm.
 *
 * Prevents abuse by limiting the number of requests within a time window.
 * Returns an error when the limit is exceeded.
 *
 * @param options - Rate limiting configuration
 * @returns A Forge middleware function
 *
 * @example
 * ```typescript
 * // Limit to 100 requests per minute per handler
 * forge.use(rateLimit({ maxRequests: 100, windowMs: 60_000 }));
 *
 * // Global limit of 1000 requests per minute
 * forge.use(rateLimit({ maxRequests: 1000, windowMs: 60_000, perHandler: false }));
 *
 * // Custom key for per-user rate limiting
 * forge.use(rateLimit({
 *   maxRequests: 10,
 *   windowMs: 60_000,
 *   keyGenerator: (ctx) => ctx.args.userId as string ?? "anonymous"
 * }));
 * ```
 */
export function rateLimit(options: RateLimitOptions = {}): ForgeMiddleware {
    const {
        maxRequests = 100,
        windowMs = 60_000,
        perHandler = true,
        keyGenerator,
        onRateLimited,
    } = options;

    const buckets = new Map<string, RateLimitBucket>();

    // Clean up expired buckets periodically
    const cleanupInterval = setInterval(() => {
        const now = Date.now();
        for (const [key, bucket] of buckets.entries()) {
            if (now >= bucket.resetTime) {
                buckets.delete(key);
            }
        }
    }, windowMs);

    // Prevent the interval from keeping the process alive
    cleanupInterval.unref?.();

    return async (ctx: MiddlewareContext, next: () => Promise<unknown>): Promise<unknown> => {
        const now = Date.now();

        // Generate the bucket key
        let key: string;
        if (keyGenerator) {
            key = keyGenerator(ctx);
        } else if (perHandler) {
            key = `${ctx.type}:${ctx.name}`;
        } else {
            key = "global";
        }

        // Get or create bucket
        let bucket = buckets.get(key);
        if (!bucket || now >= bucket.resetTime) {
            bucket = { count: 0, resetTime: now + windowMs };
            buckets.set(key, bucket);
        }

        // Check rate limit
        if (bucket.count >= maxRequests) {
            const retryAfterMs = bucket.resetTime - now;

            if (onRateLimited) {
                onRateLimited(ctx, retryAfterMs);
            }

            return {
                content: [
                    {
                        type: "text" as const,
                        text: `Rate limit exceeded for ${ctx.name}. Please try again in ${Math.ceil(retryAfterMs / 1000)} seconds.`,
                    },
                ],
                isError: true,
            };
        }

        // Increment counter and proceed
        bucket.count++;
        return next();
    };
}
