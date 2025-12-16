import { ForgeMiddleware, MiddlewareContext } from "../core/Forge";

/**
 * Metric data collected for each handler execution.
 */
export interface Metric {
    /** Name of the handler */
    name: string;
    /** Type of handler (tool, resource, prompt) */
    type: "tool" | "resource" | "prompt";
    /** Execution duration in milliseconds */
    durationMs: number;
    /** Whether the execution was successful */
    success: boolean;
    /** Timestamp when execution started */
    timestamp: Date;
    /** Error message if execution failed */
    error?: string;
}

/**
 * Aggregated metrics for a specific handler.
 */
export interface AggregatedMetrics {
    /** Handler name */
    name: string;
    /** Handler type */
    type: "tool" | "resource" | "prompt";
    /** Total number of calls */
    callCount: number;
    /** Number of successful calls */
    successCount: number;
    /** Number of failed calls */
    errorCount: number;
    /** Average execution time in milliseconds */
    avgDurationMs: number;
    /** Minimum execution time in milliseconds */
    minDurationMs: number;
    /** Maximum execution time in milliseconds */
    maxDurationMs: number;
    /** Last execution timestamp */
    lastCall: Date;
}

/**
 * Configuration options for metrics middleware.
 */
export interface MetricsOptions {
    /**
     * Callback for each metric collected.
     * @param metric - The collected metric data
     */
    onMetric?: (metric: Metric) => void;

    /**
     * Whether to store metrics for aggregation.
     * @default true
     */
    store?: boolean;

    /**
     * Maximum number of metrics to store per handler.
     * Older metrics are evicted when exceeded.
     * @default 1000
     */
    maxPerHandler?: number;
}

interface MetricStore {
    metrics: Metric[];
    aggregate: AggregatedMetrics;
}

/**
 * Metrics collection middleware.
 *
 * Collects execution timing and success/failure data for all handlers.
 * Provides aggregated metrics via the returned `getMetrics()` function.
 *
 * @param options - Metrics configuration
 * @returns An object with the middleware and metrics accessor functions
 *
 * @example
 * ```typescript
 * const { middleware, getMetrics, getAggregated, reset } = metrics({
 *   onMetric: (m) => console.log(`${m.name}: ${m.durationMs}ms`)
 * });
 *
 * forge.use(middleware);
 *
 * // Later, retrieve metrics
 * const allMetrics = getMetrics();
 * const aggregated = getAggregated();
 * ```
 */
export function metrics(options: MetricsOptions = {}): {
    middleware: ForgeMiddleware;
    getMetrics: () => Metric[];
    getAggregated: () => AggregatedMetrics[];
    reset: () => void;
} {
    const {
        onMetric,
        store = true,
        maxPerHandler = 1000,
    } = options;

    const stores = new Map<string, MetricStore>();

    function getStoreKey(ctx: MiddlewareContext): string {
        return `${ctx.type}:${ctx.name}`;
    }

    function getOrCreateStore(ctx: MiddlewareContext): MetricStore {
        const key = getStoreKey(ctx);
        let s = stores.get(key);
        if (!s) {
            s = {
                metrics: [],
                aggregate: {
                    name: ctx.name,
                    type: ctx.type,
                    callCount: 0,
                    successCount: 0,
                    errorCount: 0,
                    avgDurationMs: 0,
                    minDurationMs: Infinity,
                    maxDurationMs: 0,
                    lastCall: new Date(),
                },
            };
            stores.set(key, s);
        }
        return s;
    }

    function recordMetric(metric: Metric): void {
        onMetric?.(metric);

        if (!store) return;

        const key = `${metric.type}:${metric.name}`;
        let s = stores.get(key);
        if (!s) {
            s = {
                metrics: [],
                aggregate: {
                    name: metric.name,
                    type: metric.type,
                    callCount: 0,
                    successCount: 0,
                    errorCount: 0,
                    avgDurationMs: 0,
                    minDurationMs: Infinity,
                    maxDurationMs: 0,
                    lastCall: new Date(),
                },
            };
            stores.set(key, s);
        }

        // Store metric
        s.metrics.push(metric);
        if (s.metrics.length > maxPerHandler) {
            s.metrics.shift();
        }

        // Update aggregates
        const agg = s.aggregate;
        const prevTotal = agg.avgDurationMs * agg.callCount;
        agg.callCount++;
        agg.avgDurationMs = (prevTotal + metric.durationMs) / agg.callCount;
        agg.minDurationMs = Math.min(agg.minDurationMs, metric.durationMs);
        agg.maxDurationMs = Math.max(agg.maxDurationMs, metric.durationMs);
        agg.lastCall = metric.timestamp;

        if (metric.success) {
            agg.successCount++;
        } else {
            agg.errorCount++;
        }
    }

    const middleware: ForgeMiddleware = async (
        ctx: MiddlewareContext,
        next: () => Promise<unknown>
    ): Promise<unknown> => {
        const startTime = Date.now();
        const timestamp = new Date();
        let success = true;
        let errorMessage: string | undefined;

        try {
            const result = await next();

            // Check if result indicates an error
            if (result && typeof result === "object" && "isError" in result && result.isError) {
                success = false;
                if ("content" in result && Array.isArray(result.content) && result.content[0]) {
                    const content = result.content[0];
                    if (typeof content === "object" && "text" in content) {
                        errorMessage = String(content.text);
                    }
                }
            }

            return result;
        } catch (error) {
            success = false;
            errorMessage = error instanceof Error ? error.message : String(error);
            throw error;
        } finally {
            const durationMs = Date.now() - startTime;

            recordMetric({
                name: ctx.name,
                type: ctx.type,
                durationMs,
                success,
                timestamp,
                error: errorMessage,
            });
        }
    };

    return {
        middleware,
        getMetrics: () => {
            const allMetrics: Metric[] = [];
            for (const s of stores.values()) {
                allMetrics.push(...s.metrics);
            }
            return allMetrics.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
        },
        getAggregated: () => {
            return Array.from(stores.values()).map((s) => ({ ...s.aggregate }));
        },
        reset: () => {
            stores.clear();
        },
    };
}
