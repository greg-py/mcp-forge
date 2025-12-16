import { ForgeMiddleware, MiddlewareContext } from "../core/Forge";

/**
 * Configuration options for authentication middleware.
 */
export interface AuthOptions {
    /**
     * Extract authentication token from request headers.
     * Return undefined if no token is present.
     *
     * @example
     * ```typescript
     * extractToken: (headers) => headers["authorization"]?.replace("Bearer ", "")
     * ```
     */
    extractToken: (headers: Record<string, string | string[] | undefined>) => string | undefined;

    /**
     * Validate the token and return user data if valid.
     * Return null to reject the request.
     *
     * @example
     * ```typescript
     * validate: async (token) => {
     *   const user = await db.users.findByToken(token);
     *   return user ? { userId: user.id, role: user.role } : null;
     * }
     * ```
     */
    validate: (token: string) => Promise<Record<string, unknown> | null> | Record<string, unknown> | null;

    /**
     * Optional custom error message for missing token.
     * @default "Authentication required"
     */
    missingTokenMessage?: string;

    /**
     * Optional custom error message for invalid token.
     * @default "Invalid authentication token"
     */
    invalidTokenMessage?: string;

    /**
     * Skip authentication for stdio transport (default: true).
     * Stdio is inherently trusted since it runs locally.
     */
    skipStdio?: boolean;
}

/**
 * Creates authentication middleware for protecting MCP handlers.
 *
 * This middleware extracts tokens from HTTP headers, validates them using
 * your custom logic, and attaches authentication data to the context.
 *
 * @param options - Authentication configuration.
 * @returns Middleware function that enforces authentication.
 *
 * @example
 * ```typescript
 * import { Forge, auth } from "mcp-forge";
 *
 * const forge = new Forge({ name: "secure-server", version: "1.0.0" });
 *
 * forge.use(auth({
 *   extractToken: (headers) => {
 *     const authHeader = headers["authorization"];
 *     if (typeof authHeader === "string") {
 *       return authHeader.replace("Bearer ", "");
 *     }
 *     return undefined;
 *   },
 *   validate: async (token) => {
 *     // Validate against your database, JWT library, or auth service
 *     const user = await myDatabase.validateToken(token);
 *     if (!user) return null;
 *     return { userId: user.id, role: user.role };
 *   },
 * }));
 *
 * // Access auth data in handlers
 * forge.tool("admin_action", { schema }, async (args, ctx) => {
 *   // ctx.auth contains { userId, role } from validate()
 *   return "Action completed";
 * });
 * ```
 *
 * @example
 * ```typescript
 * // API Key authentication
 * forge.use(auth({
 *   extractToken: (headers) => headers["x-api-key"] as string | undefined,
 *   validate: (apiKey) => {
 *     const validKeys = process.env.API_KEYS?.split(",") ?? [];
 *     return validKeys.includes(apiKey) ? { keyId: apiKey } : null;
 *   },
 * }));
 * ```
 */
export function auth(options: AuthOptions): ForgeMiddleware {
    const {
        extractToken,
        validate,
        missingTokenMessage = "Authentication required",
        invalidTokenMessage = "Invalid authentication token",
        skipStdio = true,
    } = options;

    return async (ctx: MiddlewareContext, next: () => Promise<unknown>) => {
        // Skip auth for stdio transport (no headers available)
        if (skipStdio && !ctx.headers) {
            return next();
        }

        // Extract token from headers
        const token = extractToken(ctx.headers ?? {});
        if (!token) {
            throw new Error(missingTokenMessage);
        }

        // Validate token
        const authData = await validate(token);
        if (!authData) {
            throw new Error(invalidTokenMessage);
        }

        // Attach auth data to context
        ctx.auth = authData;

        return next();
    };
}
