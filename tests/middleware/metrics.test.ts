import { describe, it, expect, vi } from "vitest";
import { metrics } from "../../src/middleware/metrics";
import { MiddlewareContext } from "../../src/core/Forge";

function createMockContext(name = "test-tool"): MiddlewareContext {
    return {
        name,
        args: {},
        schema: {} as any,
        type: "tool",
    };
}

describe("metrics middleware", () => {
    it("should collect metrics for successful calls", async () => {
        const { middleware, getMetrics } = metrics();
        const ctx = createMockContext();
        const next = vi.fn().mockResolvedValue({ result: "success" });

        await middleware(ctx, next);

        const allMetrics = getMetrics();
        expect(allMetrics).toHaveLength(1);
        expect(allMetrics[0].name).toBe("test-tool");
        expect(allMetrics[0].success).toBe(true);
        expect(allMetrics[0].durationMs).toBeGreaterThanOrEqual(0);
    });

    it("should collect metrics for failed calls", async () => {
        const { middleware, getMetrics } = metrics();
        const ctx = createMockContext();
        const next = vi.fn().mockResolvedValue({ content: [{ text: "Error" }], isError: true });

        await middleware(ctx, next);

        const allMetrics = getMetrics();
        expect(allMetrics[0].success).toBe(false);
    });

    it("should aggregate metrics correctly", async () => {
        const { middleware, getAggregated } = metrics();
        const ctx = createMockContext("tool1");
        const next = vi.fn().mockResolvedValue("ok");

        await middleware(ctx, next);
        await middleware(ctx, next);
        await middleware(ctx, next);

        const aggregated = getAggregated();
        expect(aggregated).toHaveLength(1);
        expect(aggregated[0].callCount).toBe(3);
        expect(aggregated[0].successCount).toBe(3);
        expect(aggregated[0].errorCount).toBe(0);
    });

    it("should call onMetric callback", async () => {
        const onMetric = vi.fn();
        const { middleware } = metrics({ onMetric });
        const ctx = createMockContext();
        const next = vi.fn().mockResolvedValue("ok");

        await middleware(ctx, next);

        expect(onMetric).toHaveBeenCalledWith(
            expect.objectContaining({
                name: "test-tool",
                type: "tool",
                success: true,
            })
        );
    });

    it("should reset metrics", async () => {
        const { middleware, getMetrics, reset } = metrics();
        const ctx = createMockContext();
        const next = vi.fn().mockResolvedValue("ok");

        await middleware(ctx, next);
        expect(getMetrics()).toHaveLength(1);

        reset();
        expect(getMetrics()).toHaveLength(0);
    });

    it("should track min/max/avg duration", async () => {
        const { middleware, getAggregated } = metrics();
        const ctx = createMockContext();
        const next = vi.fn().mockResolvedValue("ok");

        await middleware(ctx, next);

        const agg = getAggregated()[0];
        expect(agg.minDurationMs).toBeGreaterThanOrEqual(0);
        expect(agg.maxDurationMs).toBeGreaterThanOrEqual(agg.minDurationMs);
        expect(agg.avgDurationMs).toBeGreaterThanOrEqual(0);
    });
});
