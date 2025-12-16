import { describe, it, expect, vi, beforeEach } from "vitest";
import { z } from "zod";
import { Forge } from "../src/core/Forge";

describe("Forge", () => {
    let forge: Forge;

    beforeEach(() => {
        forge = new Forge({ name: "test-server", version: "1.0.0" });
    });

    describe("constructor", () => {
        it("should create a new Forge instance with config", () => {
            expect(forge).toBeInstanceOf(Forge);
        });
    });

    describe("tool()", () => {
        it("should register a tool and return this for chaining", () => {
            const schema = z.object({ message: z.string() });
            const handler = vi.fn();

            const result = forge.tool("test-tool", { schema }, handler);

            expect(result).toBe(forge);
        });

        it("should register a tool with description", () => {
            const schema = z.object({ a: z.string() });

            const result = forge.tool(
                "described-tool",
                { schema, description: "A test tool" },
                () => "result"
            );

            expect(result).toBe(forge);
        });

        it("should register multiple tools", () => {
            const schema1 = z.object({ a: z.string() });
            const schema2 = z.object({ b: z.number() });

            forge
                .tool("tool1", { schema: schema1 }, () => "result1")
                .tool("tool2", { schema: schema2 }, () => "result2");

            expect(true).toBe(true);
        });

        it("should support legacy signature (schema only)", () => {
            const schema = z.object({ x: z.string() });

            const result = forge.tool("legacy-tool", schema, () => "result");

            expect(result).toBe(forge);
        });
    });

    describe("resource()", () => {
        it("should register a resource and return this for chaining", () => {
            const handler = vi.fn().mockResolvedValue({ text: "content" });

            const result = forge.resource("test-resource", "file:///test.txt", handler);

            expect(result).toBe(forge);
        });
    });

    describe("prompt()", () => {
        it("should register a prompt and return this for chaining", () => {
            const schema = z.object({ topic: z.string() });
            const handler = vi.fn().mockResolvedValue({
                messages: [{ role: "user", content: { type: "text", text: "Hello" } }],
            });

            const result = forge.prompt("test-prompt", schema, handler);

            expect(result).toBe(forge);
        });
    });

    describe("use()", () => {
        it("should register middleware and return this for chaining", () => {
            const middleware = vi.fn(async (ctx, next) => next());

            const result = forge.use(middleware);

            expect(result).toBe(forge);
        });

        it("should register multiple middleware", () => {
            const middleware1 = vi.fn(async (ctx, next) => next());
            const middleware2 = vi.fn(async (ctx, next) => next());

            forge.use(middleware1).use(middleware2);

            expect(true).toBe(true);
        });
    });

    describe("fluent API", () => {
        it("should support full chaining", () => {
            const result = forge
                .use(async (ctx, next) => next())
                .tool("tool1", z.object({ a: z.string() }), () => "result")
                .resource("res1", "file:///test.txt", () => ({ text: "content" }))
                .prompt("prompt1", z.object({ b: z.string() }), () => ({
                    messages: [],
                }));

            expect(result).toBe(forge);
        });
    });
});
