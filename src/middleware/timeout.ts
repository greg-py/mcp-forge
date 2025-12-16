import { ForgeMiddleware, MiddlewareContext } from "../core/Forge";

/**
 * Configuration options for timeout middleware.
 */
export interface TimeoutOptions {
    /**
     * Timeout duration in milliseconds.
     * @default 30000 (30 seconds)
     */
    ms?: number;

    /**
     * Custom error message when timeout occurs.
     * @param ctx - The middleware context
     * @param ms - The timeout duration
     * @returns Error message string
     */
    message?: (ctx: MiddlewareContext, ms: number) => string;

    /**
     * Callback when a timeout occurs.
     * @param ctx - The middleware context
     * @param ms - The timeout duration
     */
    onTimeout?: (ctx: MiddlewareContext, ms: number) => void;
}

/**
 * Timeout middleware that prevents runaway handlers.
 *
 * Wraps handler execution with a timeout and returns an error
 * if the handler doesn't complete within the specified duration.
 *
 * @param options - Timeout configuration
 * @returns A Forge middleware function
 *
 * @example
 * ```typescript
 * // 30 second timeout with default message
 * forge.use(timeout({ ms: 30_000 }));
 *
 * // Custom timeout message
 * forge.use(timeout({
 *   ms: 10_000,
 *   message: (ctx, ms) => `${ctx.name} timed out after ${ms}ms`
 * }));
 * ```
 */
export function timeout(options: TimeoutOptions = {}): ForgeMiddleware {
    const {
        ms = 30_000,
        message,
        onTimeout,
    } = options;

    return async (ctx: MiddlewareContext, next: () => Promise<unknown>): Promise<unknown> => {
        return new Promise((resolve, reject) => {
            let settled = false;

            const timer = setTimeout(() => {
                if (!settled) {
                    settled = true;
                    onTimeout?.(ctx, ms);

                    const errorMessage = message
                        ? message(ctx, ms)
                        : `Handler '${ctx.name}' timed out after ${ms}ms`;

                    resolve({
                        content: [
                            {
                                type: "text" as const,
                                text: `Error: ${errorMessage}`,
                            },
                        ],
                        isError: true,
                    });
                }
            }, ms);

            next()
                .then((result) => {
                    if (!settled) {
                        settled = true;
                        clearTimeout(timer);
                        resolve(result);
                    }
                })
                .catch((error) => {
                    if (!settled) {
                        settled = true;
                        clearTimeout(timer);
                        reject(error);
                    }
                });
        });
    };
}
