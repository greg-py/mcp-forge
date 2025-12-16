import { describe, it, expect, vi } from "vitest";
import { auth, AuthOptions } from "../../src/middleware/auth";
import { MiddlewareContext } from "../../src/core/Forge";
import { z } from "zod";

describe("auth middleware", () => {
    const createMockContext = (
        headers?: Record<string, string | string[] | undefined>
    ): MiddlewareContext => ({
        name: "test_tool",
        args: {},
        schema: z.object({}),
        type: "tool",
        headers,
    });

    describe("token extraction", () => {
        it("should extract token from Authorization header", async () => {
            const validateFn = vi.fn().mockResolvedValue({ userId: "123" });
            const authMiddleware = auth({
                extractToken: (headers) => {
                    const authHeader = headers["authorization"];
                    if (typeof authHeader === "string") {
                        return authHeader.replace("Bearer ", "");
                    }
                    return undefined;
                },
                validate: validateFn,
            });

            const ctx = createMockContext({ authorization: "Bearer my-token" });
            const next = vi.fn().mockResolvedValue("result");

            await authMiddleware(ctx, next);

            expect(validateFn).toHaveBeenCalledWith("my-token");
            expect(next).toHaveBeenCalled();
            expect(ctx.auth).toEqual({ userId: "123" });
        });

        it("should extract token from custom header", async () => {
            const validateFn = vi.fn().mockResolvedValue({ keyId: "api-key-1" });
            const authMiddleware = auth({
                extractToken: (headers) => headers["x-api-key"] as string | undefined,
                validate: validateFn,
            });

            const ctx = createMockContext({ "x-api-key": "secret-key" });
            const next = vi.fn().mockResolvedValue("result");

            await authMiddleware(ctx, next);

            expect(validateFn).toHaveBeenCalledWith("secret-key");
            expect(ctx.auth).toEqual({ keyId: "api-key-1" });
        });
    });

    describe("validation", () => {
        it("should reject requests with missing token", async () => {
            const authMiddleware = auth({
                extractToken: (headers) => headers["authorization"] as string | undefined,
                validate: () => ({ userId: "123" }),
            });

            const ctx = createMockContext({}); // No authorization header
            const next = vi.fn();

            await expect(authMiddleware(ctx, next)).rejects.toThrow("Authentication required");
            expect(next).not.toHaveBeenCalled();
        });

        it("should reject requests with invalid token", async () => {
            const authMiddleware = auth({
                extractToken: (headers) => headers["authorization"] as string | undefined,
                validate: () => null, // Token invalid
            });

            const ctx = createMockContext({ authorization: "invalid-token" });
            const next = vi.fn();

            await expect(authMiddleware(ctx, next)).rejects.toThrow("Invalid authentication token");
            expect(next).not.toHaveBeenCalled();
        });

        it("should use custom error messages", async () => {
            const authMiddleware = auth({
                extractToken: () => undefined,
                validate: () => null,
                missingTokenMessage: "Please provide API key",
                invalidTokenMessage: "API key is invalid",
            });

            const ctx = createMockContext({});
            const next = vi.fn();

            await expect(authMiddleware(ctx, next)).rejects.toThrow("Please provide API key");
        });
    });

    describe("stdio transport", () => {
        it("should skip auth for stdio (no headers)", async () => {
            const validateFn = vi.fn();
            const authMiddleware = auth({
                extractToken: () => "token",
                validate: validateFn,
                skipStdio: true, // Default
            });

            const ctx = createMockContext(undefined); // No headers = stdio
            const next = vi.fn().mockResolvedValue("result");

            const result = await authMiddleware(ctx, next);

            expect(validateFn).not.toHaveBeenCalled();
            expect(next).toHaveBeenCalled();
            expect(result).toBe("result");
        });

        it("should enforce auth for stdio when skipStdio is false", async () => {
            const authMiddleware = auth({
                extractToken: () => undefined,
                validate: () => null,
                skipStdio: false,
            });

            const ctx = createMockContext(undefined); // No headers = stdio
            const next = vi.fn();

            await expect(authMiddleware(ctx, next)).rejects.toThrow("Authentication required");
        });
    });

    describe("async validation", () => {
        it("should support async validate function", async () => {
            const authMiddleware = auth({
                extractToken: (headers) => headers["authorization"] as string | undefined,
                validate: async (token) => {
                    // Simulate async database lookup
                    await new Promise((resolve) => setTimeout(resolve, 10));
                    return token === "valid-token" ? { userId: "123" } : null;
                },
            });

            const ctx = createMockContext({ authorization: "valid-token" });
            const next = vi.fn().mockResolvedValue("result");

            await authMiddleware(ctx, next);

            expect(ctx.auth).toEqual({ userId: "123" });
        });
    });
});
