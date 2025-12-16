import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

/**
 * Custom logger that writes to stderr to avoid interfering with MCP stdout transport.
 */
export const logger = {
    info: (message: string, ...args: any[]) => {
        console.error(`[Forge:Info] ${message}`, ...args);
    },
    warn: (message: string, ...args: any[]) => {
        console.error(`[Forge:Warn] ${message}`, ...args);
    },
    error: (message: string, ...args: any[]) => {
        console.error(`[Forge:Error] ${message}`, ...args);
    },
};

/**
 * Formats an error into a robust CallToolResult error response.
 * @param error The error that occurred.
 * @returns An MCP CallToolResult with isError: true.
 */
export function formatError(error: unknown): CallToolResult {
    const errorMessage = error instanceof Error ? error.message : String(error);

    // Log the full error to stderr for debugging
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
