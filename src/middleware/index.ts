/**
 * Built-in middleware library for Forge.
 *
 * Provides production-ready middleware for common cross-cutting concerns.
 *
 * @module middleware
 */

export { rateLimit, RateLimitOptions } from "./rateLimit";
export { cache, createCache, CacheOptions } from "./cache";
export { timeout, TimeoutOptions } from "./timeout";
export { metrics, Metric, AggregatedMetrics, MetricsOptions } from "./metrics";
export { logging, LogLevel, LogEntry, LoggingOptions } from "./logging";
export { retry, RetryOptions } from "./retry";
export { auth, AuthOptions } from "./auth";

