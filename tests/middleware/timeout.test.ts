import { describe, it, expect, vi, beforeEach } from "vitest";
import { timeout } from "../../src/middleware/timeout";
import { MiddlewareContext } from "../../src/core/Forge";

function createMockContext(name = "test-tool"): MiddlewareContext {
    return {
        name,
        args: {},
        schema: {} as any,
        type: "tool",
    };
}

describe("timeout middleware", () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    it("should allow fast handlers to complete", async () => {
        const middleware = timeout({ ms: 1000 });
        const ctx = createMockContext();
        const next = vi.fn().mockResolvedValue({ result: "success" });

        const promise = middleware(ctx, next);
        await vi.runAllTimersAsync();
        const result = await promise;

        expect(result).toEqual({ result: "success" });
    });

    it("should timeout slow handlers", async () => {
        const middleware = timeout({ ms: 100 });
        const ctx = createMockContext();
        const next = vi.fn().mockImplementation(
            () => new Promise((resolve) => setTimeout(() => resolve("slow"), 500))
        );

        const promise = middleware(ctx, next);
        await vi.advanceTimersByTimeAsync(150);
        const result = await promise;

        expect(result).toHaveProperty("isError", true);
    });

    it("should use custom message", async () => {
        const middleware = timeout({
            ms: 100,
            message: (ctx, ms) => `Custom timeout: ${ctx.name} after ${ms}ms`,
        });
        const ctx = createMockContext("my-tool");
        const next = vi.fn().mockImplementation(
            () => new Promise((resolve) => setTimeout(resolve, 500))
        );

        const promise = middleware(ctx, next);
        await vi.advanceTimersByTimeAsync(150);
        const result = await promise;

        expect(result).toHaveProperty("isError", true);
        expect((result as any).content[0].text).toContain("Custom timeout: my-tool after 100ms");
    });

    it("should call onTimeout callback", async () => {
        const onTimeout = vi.fn();
        const middleware = timeout({ ms: 100, onTimeout });
        const ctx = createMockContext();
        const next = vi.fn().mockImplementation(
            () => new Promise((resolve) => setTimeout(resolve, 500))
        );

        const promise = middleware(ctx, next);
        await vi.advanceTimersByTimeAsync(150);
        await promise;

        expect(onTimeout).toHaveBeenCalledWith(ctx, 100);
    });
});
