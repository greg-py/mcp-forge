import { describe, it, expect, vi, beforeEach } from "vitest";
import { rateLimit } from "../../src/middleware/rateLimit";
import { MiddlewareContext } from "../../src/core/Forge";

function createMockContext(name = "test-tool"): MiddlewareContext {
    return {
        name,
        args: {},
        schema: {} as any,
        type: "tool",
    };
}

describe("rateLimit middleware", () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    it("should allow requests under the limit", async () => {
        const middleware = rateLimit({ maxRequests: 5, windowMs: 60_000 });
        const ctx = createMockContext();
        const next = vi.fn().mockResolvedValue({ result: "success" });

        for (let i = 0; i < 5; i++) {
            const result = await middleware(ctx, next);
            expect(result).toEqual({ result: "success" });
        }

        expect(next).toHaveBeenCalledTimes(5);
    });

    it("should block requests over the limit", async () => {
        const middleware = rateLimit({ maxRequests: 2, windowMs: 60_000 });
        const ctx = createMockContext();
        const next = vi.fn().mockResolvedValue({ result: "success" });

        await middleware(ctx, next);
        await middleware(ctx, next);

        const result = await middleware(ctx, next);

        expect(result).toHaveProperty("isError", true);
        expect(next).toHaveBeenCalledTimes(2);
    });

    it("should reset after window expires", async () => {
        const middleware = rateLimit({ maxRequests: 1, windowMs: 1000 });
        const ctx = createMockContext();
        const next = vi.fn().mockResolvedValue({ result: "success" });

        await middleware(ctx, next);
        const blocked = await middleware(ctx, next);
        expect(blocked).toHaveProperty("isError", true);

        // Advance time past window
        vi.advanceTimersByTime(1001);

        const result = await middleware(ctx, next);
        expect(result).toEqual({ result: "success" });
    });

    it("should use separate buckets per handler when perHandler is true", async () => {
        const middleware = rateLimit({ maxRequests: 1, windowMs: 60_000, perHandler: true });
        const ctx1 = createMockContext("tool1");
        const ctx2 = createMockContext("tool2");
        const next = vi.fn().mockResolvedValue({ result: "success" });

        await middleware(ctx1, next);
        const result = await middleware(ctx2, next);

        expect(result).toEqual({ result: "success" });
        expect(next).toHaveBeenCalledTimes(2);
    });

    it("should call onRateLimited callback", async () => {
        const onRateLimited = vi.fn();
        const middleware = rateLimit({ maxRequests: 1, windowMs: 60_000, onRateLimited });
        const ctx = createMockContext();
        const next = vi.fn().mockResolvedValue("ok");

        await middleware(ctx, next);
        await middleware(ctx, next);

        expect(onRateLimited).toHaveBeenCalledWith(ctx, expect.any(Number));
    });

    it("should support custom key generator", async () => {
        const middleware = rateLimit({
            maxRequests: 1,
            windowMs: 60_000,
            keyGenerator: (ctx) => (ctx.args as any).userId ?? "anonymous",
        });

        const ctx1 = { ...createMockContext(), args: { userId: "user1" } };
        const ctx2 = { ...createMockContext(), args: { userId: "user2" } };
        const next = vi.fn().mockResolvedValue("ok");

        await middleware(ctx1, next);
        const result = await middleware(ctx2, next);

        expect(result).toBe("ok");
    });
});
