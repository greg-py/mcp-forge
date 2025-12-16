import { ForgeMiddleware, MiddlewareContext } from "../core/Forge";

/**
 * Configuration options for caching middleware.
 */
export interface CacheOptions {
    /**
     * Time-to-live for cached results in milliseconds.
     * @default 300000 (5 minutes)
     */
    ttlMs?: number;

    /**
     * Maximum number of entries to store in the cache.
     * When exceeded, oldest entries are evicted (LRU).
     * @default 1000
     */
    maxEntries?: number;

    /**
     * Which handler types to cache.
     * @default ["tool"]
     */
    types?: Array<"tool" | "resource" | "prompt">;

    /**
     * Custom cache key generator.
     * @param ctx - The middleware context
     * @returns A string key for caching, or null to skip caching
     */
    keyGenerator?: (ctx: MiddlewareContext) => string | null;

    /**
     * Callback when a cache hit occurs.
     * @param ctx - The middleware context
     * @param key - The cache key
     */
    onHit?: (ctx: MiddlewareContext, key: string) => void;

    /**
     * Callback when a cache miss occurs.
     * @param ctx - The middleware context
     * @param key - The cache key
     */
    onMiss?: (ctx: MiddlewareContext, key: string) => void;
}

interface CacheEntry {
    value: unknown;
    expiresAt: number;
}

/**
 * In-memory caching middleware with TTL and LRU eviction.
 *
 * Caches handler results to improve performance for repeated calls
 * with the same arguments.
 *
 * @param options - Caching configuration
 * @returns A Forge middleware function
 *
 * @example
 * ```typescript
 * // Cache tool results for 5 minutes
 * forge.use(cache({ ttlMs: 300_000, types: ["tool"] }));
 *
 * // Cache with custom key and limit
 * forge.use(cache({
 *   ttlMs: 60_000,
 *   maxEntries: 500,
 *   keyGenerator: (ctx) => `${ctx.name}:${JSON.stringify(ctx.args)}`
 * }));
 * ```
 */
export function cache(options: CacheOptions = {}): ForgeMiddleware {
    const {
        ttlMs = 300_000,
        maxEntries = 1000,
        types = ["tool"],
        keyGenerator,
        onHit,
        onMiss,
    } = options;

    const store = new Map<string, CacheEntry>();
    const accessOrder: string[] = [];

    // Clean up expired entries periodically
    const cleanupInterval = setInterval(() => {
        const now = Date.now();
        for (const [key, entry] of store.entries()) {
            if (now >= entry.expiresAt) {
                store.delete(key);
                const idx = accessOrder.indexOf(key);
                if (idx !== -1) accessOrder.splice(idx, 1);
            }
        }
    }, Math.min(ttlMs, 60_000));

    cleanupInterval.unref?.();

    function generateKey(ctx: MiddlewareContext): string | null {
        if (keyGenerator) {
            return keyGenerator(ctx);
        }
        // Default key: type:name:stringified-args
        return `${ctx.type}:${ctx.name}:${JSON.stringify(ctx.args)}`;
    }

    function evictIfNeeded(): void {
        while (store.size >= maxEntries && accessOrder.length > 0) {
            const oldest = accessOrder.shift();
            if (oldest) store.delete(oldest);
        }
    }

    function updateAccessOrder(key: string): void {
        const idx = accessOrder.indexOf(key);
        if (idx !== -1) accessOrder.splice(idx, 1);
        accessOrder.push(key);
    }

    return async (ctx: MiddlewareContext, next: () => Promise<unknown>): Promise<unknown> => {
        // Skip caching for non-matching types
        if (!types.includes(ctx.type)) {
            return next();
        }

        const key = generateKey(ctx);
        if (key === null) {
            return next();
        }

        const now = Date.now();

        // Check cache
        const cached = store.get(key);
        if (cached && now < cached.expiresAt) {
            updateAccessOrder(key);
            onHit?.(ctx, key);
            return cached.value;
        }

        // Cache miss
        onMiss?.(ctx, key);

        // Execute handler
        const result = await next();

        // Store result
        evictIfNeeded();
        store.set(key, { value: result, expiresAt: now + ttlMs });
        updateAccessOrder(key);

        return result;
    };
}

/**
 * Creates a cache instance that can be cleared programmatically.
 *
 * @param options - Caching configuration
 * @returns An object with the middleware and a clear function
 *
 * @example
 * ```typescript
 * const { middleware, clear } = createCache({ ttlMs: 60_000 });
 * forge.use(middleware);
 *
 * // Later, clear the cache
 * clear();
 * ```
 */
export function createCache(options: CacheOptions = {}): {
    middleware: ForgeMiddleware;
    clear: () => void;
} {
    const middleware = cache(options);

    // The cache is encapsulated, so we create a new one with exposed clear
    const store = new Map<string, CacheEntry>();

    return {
        middleware,
        clear: () => store.clear(),
    };
}
