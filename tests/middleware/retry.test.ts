import { describe, it, expect, vi } from "vitest";
import { retry } from "../../src/middleware/retry";
import { MiddlewareContext } from "../../src/core/Forge";

function createMockContext(name = "test-tool"): MiddlewareContext {
    return {
        name,
        args: {},
        schema: {} as any,
        type: "tool",
    };
}

describe("retry middleware", () => {
    it("should not retry on success", async () => {
        const middleware = retry({ maxRetries: 3 });
        const ctx = createMockContext();
        const next = vi.fn().mockResolvedValue("success");

        const result = await middleware(ctx, next);

        expect(result).toBe("success");
        expect(next).toHaveBeenCalledTimes(1);
    });

    it("should retry on failure and eventually succeed", async () => {
        const middleware = retry({ maxRetries: 2, initialDelayMs: 1, jitter: 0 });
        const ctx = createMockContext();
        let callCount = 0;
        const next = vi.fn().mockImplementation(async () => {
            callCount++;
            if (callCount < 3) {
                throw new Error(`fail${callCount}`);
            }
            return "success";
        });

        const result = await middleware(ctx, next);

        expect(result).toBe("success");
        expect(next).toHaveBeenCalledTimes(3);
    });

    it("should throw after max retries exhausted", async () => {
        const middleware = retry({ maxRetries: 2, initialDelayMs: 1, jitter: 0 });
        const ctx = createMockContext();
        const next = vi.fn().mockRejectedValue(new Error("always fails"));

        await expect(middleware(ctx, next)).rejects.toThrow("always fails");
        expect(next).toHaveBeenCalledTimes(3); // 1 initial + 2 retries
    });

    it("should respect shouldRetry predicate", async () => {
        const middleware = retry({
            maxRetries: 3,
            initialDelayMs: 1,
            shouldRetry: (error) => (error as Error).message !== "no-retry",
        });
        const ctx = createMockContext();
        const next = vi.fn().mockRejectedValue(new Error("no-retry"));

        await expect(middleware(ctx, next)).rejects.toThrow("no-retry");
        expect(next).toHaveBeenCalledTimes(1); // No retries
    });

    it("should call onRetry callback", async () => {
        const onRetry = vi.fn();
        const middleware = retry({ maxRetries: 1, initialDelayMs: 1, jitter: 0, onRetry });
        const ctx = createMockContext();
        let callCount = 0;
        const next = vi.fn().mockImplementation(async () => {
            callCount++;
            if (callCount < 2) {
                throw new Error("temp failure");
            }
            return "success";
        });

        await middleware(ctx, next);

        expect(onRetry).toHaveBeenCalledWith(
            expect.any(Error),
            1,
            1,
            ctx
        );
    });

    it("should apply exponential backoff", async () => {
        const onRetry = vi.fn();
        const middleware = retry({
            maxRetries: 2,
            initialDelayMs: 10,
            backoffMultiplier: 2,
            jitter: 0,
            onRetry,
        });
        const ctx = createMockContext();
        let callCount = 0;
        const next = vi.fn().mockImplementation(async () => {
            callCount++;
            if (callCount <= 2) {
                throw new Error("fail");
            }
            return "success";
        });

        await middleware(ctx, next);

        // Check delays: 10, 20 (with multiplier 2)
        expect(onRetry).toHaveBeenNthCalledWith(1, expect.any(Error), 1, 10, ctx);
        expect(onRetry).toHaveBeenNthCalledWith(2, expect.any(Error), 2, 20, ctx);
    });
});
