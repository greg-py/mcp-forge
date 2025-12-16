import { describe, it, expect, vi } from "vitest";
import { logging } from "../../src/middleware/logging";
import { MiddlewareContext } from "../../src/core/Forge";

function createMockContext(name = "test-tool"): MiddlewareContext {
    return {
        name,
        args: { key: "value" },
        schema: {} as any,
        type: "tool",
    };
}

describe("logging middleware", () => {
    it("should log to custom output", async () => {
        const output = vi.fn();
        const middleware = logging({ level: "debug", output });
        const ctx = createMockContext();
        const next = vi.fn().mockResolvedValue("result");

        await middleware(ctx, next);

        expect(output).toHaveBeenCalled();
        expect(output).toHaveBeenCalledWith(
            expect.objectContaining({
                name: "test-tool",
                type: "tool",
            })
        );
    });

    it("should respect log level", async () => {
        const output = vi.fn();
        const middleware = logging({ level: "error", output });
        const ctx = createMockContext();
        const next = vi.fn().mockResolvedValue("result");

        await middleware(ctx, next);

        // Only error level logs should be output
        const calls = output.mock.calls;
        for (const call of calls) {
            expect(["error"]).toContain(call[0].level);
        }
    });

    it("should log errors", async () => {
        const output = vi.fn();
        const middleware = logging({ level: "debug", output });
        const ctx = createMockContext();
        const next = vi.fn().mockRejectedValue(new Error("Test error"));

        await expect(middleware(ctx, next)).rejects.toThrow("Test error");

        const errorLog = output.mock.calls.find((call) => call[0].level === "error");
        expect(errorLog).toBeDefined();
        expect(errorLog[0].message).toContain("Test error");
    });

    it("should include args when logArgs is true", async () => {
        const output = vi.fn();
        const middleware = logging({ level: "debug", output, logArgs: true });
        const ctx = createMockContext();
        const next = vi.fn().mockResolvedValue("result");

        await middleware(ctx, next);

        const debugLog = output.mock.calls.find((call) => call[0].level === "debug");
        expect(debugLog[0].data?.args).toEqual({ key: "value" });
    });

    it("should log to stderr by default", async () => {
        const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => { });
        const middleware = logging({ level: "info" });
        const ctx = createMockContext();
        const next = vi.fn().mockResolvedValue("result");

        await middleware(ctx, next);

        expect(consoleSpy).toHaveBeenCalled();
        consoleSpy.mockRestore();
    });
});
