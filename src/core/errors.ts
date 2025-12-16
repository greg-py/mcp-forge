import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

/**
 * Logger that writes to stderr to avoid interfering with MCP stdout transport.
 */
export const logger = {
    info: (message: string, ...args: unknown[]): void => {
        console.error(`[Forge] ${message}`, ...args);
    },
    warn: (message: string, ...args: unknown[]): void => {
        console.error(`[Forge:Warn] ${message}`, ...args);
    },
    error: (message: string, ...args: unknown[]): void => {
        console.error(`[Forge:Error] ${message}`, ...args);
    },
};

/**
 * Formats an error into an MCP-compatible error response.
 * Extracts a clean message suitable for LLM consumption without exposing stack traces.
 * 
 * @param error - The error that occurred during tool execution.
 * @returns An MCP CallToolResult with isError: true.
 */
export function formatError(error: unknown): CallToolResult {
    const errorMessage = error instanceof Error ? error.message : String(error);

    logger.error("Tool execution failed:", error);

    return {
        content: [
            {
                type: "text",
                text: `Error: ${errorMessage}`,
            },
        ],
        isError: true,
    };
}
