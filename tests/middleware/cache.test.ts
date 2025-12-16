import { describe, it, expect, vi, beforeEach } from "vitest";
import { cache } from "../../src/middleware/cache";
import { MiddlewareContext } from "../../src/core/Forge";

function createMockContext(
    name = "test-tool",
    args: Record<string, unknown> = {}
): MiddlewareContext {
    return {
        name,
        args,
        schema: {} as any,
        type: "tool",
    };
}

describe("cache middleware", () => {
    it("should cache results for repeated calls", async () => {
        const middleware = cache({ ttlMs: 60_000 });
        const ctx = createMockContext("tool", { key: "value" });
        const next = vi.fn().mockResolvedValue({ result: "cached" });

        const result1 = await middleware(ctx, next);
        const result2 = await middleware(ctx, next);

        expect(result1).toEqual({ result: "cached" });
        expect(result2).toEqual({ result: "cached" });
        expect(next).toHaveBeenCalledTimes(1);
    });

    it("should use separate cache keys for different args", async () => {
        const middleware = cache({ ttlMs: 60_000 });
        const ctx1 = createMockContext("tool", { a: 1 });
        const ctx2 = createMockContext("tool", { a: 2 });
        const next = vi.fn()
            .mockResolvedValueOnce("result1")
            .mockResolvedValueOnce("result2");

        const result1 = await middleware(ctx1, next);
        const result2 = await middleware(ctx2, next);

        expect(result1).toBe("result1");
        expect(result2).toBe("result2");
        expect(next).toHaveBeenCalledTimes(2);
    });

    it("should skip caching for non-matching types", async () => {
        const middleware = cache({ types: ["tool"] });
        const ctx = { ...createMockContext(), type: "resource" as const };
        const next = vi.fn().mockResolvedValue("result");

        await middleware(ctx, next);
        await middleware(ctx, next);

        expect(next).toHaveBeenCalledTimes(2);
    });

    it("should call onHit and onMiss callbacks", async () => {
        const onHit = vi.fn();
        const onMiss = vi.fn();
        const middleware = cache({ ttlMs: 60_000, onHit, onMiss });
        const ctx = createMockContext();
        const next = vi.fn().mockResolvedValue("result");

        await middleware(ctx, next);
        await middleware(ctx, next);

        expect(onMiss).toHaveBeenCalledTimes(1);
        expect(onHit).toHaveBeenCalledTimes(1);
    });

    it("should respect custom key generator", async () => {
        const middleware = cache({
            ttlMs: 60_000,
            keyGenerator: () => "same-key",
        });
        const ctx1 = createMockContext("tool1", { a: 1 });
        const ctx2 = createMockContext("tool2", { b: 2 });
        const next = vi.fn().mockResolvedValue("cached");

        await middleware(ctx1, next);
        const result = await middleware(ctx2, next);

        expect(result).toBe("cached");
        expect(next).toHaveBeenCalledTimes(1);
    });

    it("should skip caching when keyGenerator returns null", async () => {
        const middleware = cache({
            ttlMs: 60_000,
            keyGenerator: () => null,
        });
        const ctx = createMockContext();
        const next = vi.fn().mockResolvedValue("result");

        await middleware(ctx, next);
        await middleware(ctx, next);

        expect(next).toHaveBeenCalledTimes(2);
    });
});
