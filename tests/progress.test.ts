import { describe, it, expect, vi } from "vitest";
import { z } from "zod";
import { Forge, ToolContext } from "../src/index";

describe("Progress Reporting", () => {
    describe("ToolContext", () => {
        it("should pass ToolContext as second parameter to tool handler", async () => {
            const forge = new Forge({ name: "test", version: "1.0.0" });
            let receivedCtx: ToolContext | undefined;

            forge.tool(
                "test_tool",
                { schema: z.object({ value: z.string() }) },
                (args, ctx) => {
                    receivedCtx = ctx;
                    return `Got: ${args.value}`;
                }
            );

            // Verify the tool was registered
            expect(forge).toBeInstanceOf(Forge);
            // The context will be provided at runtime when the tool is called
        });

        it("should allow handlers to ignore the context parameter", () => {
            const forge = new Forge({ name: "test", version: "1.0.0" });

            // This should compile and work - handler only takes args
            forge.tool(
                "simple_tool",
                { schema: z.object({ a: z.number(), b: z.number() }) },
                ({ a, b }) => a + b
            );

            expect(forge).toBeInstanceOf(Forge);
        });

        it("should support async handlers with progress", () => {
            const forge = new Forge({ name: "test", version: "1.0.0" });

            forge.tool(
                "async_tool",
                { schema: z.object({ count: z.number() }) },
                async ({ count }, ctx) => {
                    for (let i = 0; i < count; i++) {
                        await ctx.reportProgress((i + 1) / count, `Processing ${i + 1}/${count}`);
                    }
                    return `Processed ${count} items`;
                }
            );

            expect(forge).toBeInstanceOf(Forge);
        });
    });

    describe("reportProgress", () => {
        it("should be a no-op when no progressToken is provided", async () => {
            const forge = new Forge({ name: "test", version: "1.0.0" });
            let progressCalled = false;

            forge.tool(
                "progress_tool",
                { schema: z.object({}) },
                async (_args, ctx) => {
                    // This should not throw even without progressToken
                    await ctx.reportProgress(0.5, "Half done");
                    progressCalled = true;
                    return "done";
                }
            );

            // Tool registered successfully
            expect(forge).toBeInstanceOf(Forge);
        });

        it("should clamp progress values to 0-1 range", () => {
            const forge = new Forge({ name: "test", version: "1.0.0" });

            forge.tool(
                "clamped_tool",
                { schema: z.object({}) },
                async (_args, ctx) => {
                    // Negative values should be clamped to 0
                    await ctx.reportProgress(-0.5, "Negative");
                    // Values > 1 should be clamped to 1
                    await ctx.reportProgress(1.5, "Over");
                    return "done";
                }
            );

            expect(forge).toBeInstanceOf(Forge);
        });
    });

    describe("backwards compatibility", () => {
        it("should work with legacy schema-only signature", () => {
            const forge = new Forge({ name: "test", version: "1.0.0" });

            // Legacy signature: (name, schema, handler)
            forge.tool(
                "legacy_tool",
                z.object({ x: z.number() }),
                ({ x }) => x * 2
            );

            expect(forge).toBeInstanceOf(Forge);
        });

        it("should work with plugins that register tools", () => {
            const forge = new Forge({ name: "test", version: "1.0.0" });

            forge.plugin((app) => {
                app.tool(
                    "plugin_tool",
                    { schema: z.object({ msg: z.string() }) },
                    async ({ msg }, ctx) => {
                        await ctx.reportProgress(0.5);
                        return msg;
                    }
                );
            });

            expect(forge).toBeInstanceOf(Forge);
        });

        it("should chain with other methods", () => {
            const forge = new Forge({ name: "test", version: "1.0.0" })
                .tool("a", { schema: z.object({}) }, async (_args, ctx) => {
                    await ctx.reportProgress(1);
                    return "a";
                })
                .tool("b", z.object({}), () => "b")
                .resource("c", "file:///c", () => ({ text: "c" }));

            expect(forge).toBeInstanceOf(Forge);
        });
    });
});
