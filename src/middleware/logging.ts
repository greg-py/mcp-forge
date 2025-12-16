import { ForgeMiddleware, MiddlewareContext } from "../core/Forge";

/**
 * Log levels for the logging middleware.
 */
export type LogLevel = "debug" | "info" | "warn" | "error";

/**
 * Log entry structure.
 */
export interface LogEntry {
    /** Log level */
    level: LogLevel;
    /** Log message */
    message: string;
    /** Handler name */
    name: string;
    /** Handler type */
    type: "tool" | "resource" | "prompt";
    /** Additional context data */
    data?: Record<string, unknown>;
    /** Timestamp */
    timestamp: Date;
    /** Execution duration (on completion) */
    durationMs?: number;
}

/**
 * Configuration options for logging middleware.
 */
export interface LoggingOptions {
    /**
     * Minimum log level to output.
     * @default "info"
     */
    level?: LogLevel;

    /**
     * Custom log output function.
     * Defaults to console.error (for MCP stdio compatibility).
     * @param entry - The log entry
     */
    output?: (entry: LogEntry) => void;

    /**
     * Whether to log handler arguments.
     * @default false (for security)
     */
    logArgs?: boolean;

    /**
     * Whether to log handler results.
     * @default false (for performance)
     */
    logResults?: boolean;

    /**
     * Prefix for log messages.
     * @default "[Forge]"
     */
    prefix?: string;
}

const LOG_LEVELS: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
};

/**
 * Structured logging middleware.
 *
 * Logs handler entry, exit, and errors with configurable detail levels.
 * Outputs to stderr by default to avoid interfering with MCP stdio transport.
 *
 * @param options - Logging configuration
 * @returns A Forge middleware function
 *
 * @example
 * ```typescript
 * // Basic logging
 * forge.use(logging({ level: "info" }));
 *
 * // With custom output
 * forge.use(logging({
 *   level: "debug",
 *   output: (entry) => myLogger.log(entry)
 * }));
 *
 * // Include arguments (caution: may log sensitive data)
 * forge.use(logging({ level: "debug", logArgs: true }));
 * ```
 */
export function logging(options: LoggingOptions = {}): ForgeMiddleware {
    const {
        level = "info",
        output,
        logArgs = false,
        logResults = false,
        prefix = "[Forge]",
    } = options;

    const minLevel = LOG_LEVELS[level];

    function shouldLog(entryLevel: LogLevel): boolean {
        return LOG_LEVELS[entryLevel] >= minLevel;
    }

    function log(entry: LogEntry): void {
        if (!shouldLog(entry.level)) return;

        if (output) {
            output(entry);
            return;
        }

        // Default output to stderr
        const levelStr = entry.level.toUpperCase().padEnd(5);
        const timestamp = entry.timestamp.toISOString();
        let message = `${prefix} ${timestamp} ${levelStr} ${entry.message}`;

        if (entry.durationMs !== undefined) {
            message += ` (${entry.durationMs}ms)`;
        }

        if (entry.data && Object.keys(entry.data).length > 0) {
            message += ` ${JSON.stringify(entry.data)}`;
        }

        console.error(message);
    }

    return async (ctx: MiddlewareContext, next: () => Promise<unknown>): Promise<unknown> => {
        const timestamp = new Date();
        const startTime = Date.now();

        // Log entry
        const entryData: Record<string, unknown> = {};
        if (logArgs) {
            entryData.args = ctx.args;
        }

        log({
            level: "debug",
            message: `${ctx.type} ${ctx.name} started`,
            name: ctx.name,
            type: ctx.type,
            data: Object.keys(entryData).length > 0 ? entryData : undefined,
            timestamp,
        });

        try {
            const result = await next();
            const durationMs = Date.now() - startTime;

            // Check for error result
            const isError = result && typeof result === "object" && "isError" in result && result.isError;

            const exitData: Record<string, unknown> = {};
            if (logResults && !isError) {
                exitData.result = result;
            }

            log({
                level: isError ? "warn" : "info",
                message: `${ctx.type} ${ctx.name} ${isError ? "failed" : "completed"}`,
                name: ctx.name,
                type: ctx.type,
                data: Object.keys(exitData).length > 0 ? exitData : undefined,
                timestamp: new Date(),
                durationMs,
            });

            return result;
        } catch (error) {
            const durationMs = Date.now() - startTime;

            log({
                level: "error",
                message: `${ctx.type} ${ctx.name} threw error: ${error instanceof Error ? error.message : String(error)}`,
                name: ctx.name,
                type: ctx.type,
                timestamp: new Date(),
                durationMs,
            });

            throw error;
        }
    };
}
