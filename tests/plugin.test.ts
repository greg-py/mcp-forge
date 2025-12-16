import { describe, it, expect, vi } from "vitest";
import { z } from "zod";
import { Forge, ForgePlugin } from "../src/core/Forge";

describe("Plugin System", () => {
    describe("plugin()", () => {
        it("should register a plugin and return this for chaining", () => {
            const forge = new Forge({ name: "test", version: "1.0.0" });
            const plugin: ForgePlugin = vi.fn();

            const result = forge.plugin(plugin);

            expect(result).toBe(forge);
            expect(plugin).toHaveBeenCalledWith(forge);
        });

        it("should allow plugin to register tools", () => {
            const forge = new Forge({ name: "test", version: "1.0.0" });

            forge.plugin((app) => {
                app.tool(
                    "plugin-tool",
                    { schema: z.object({ x: z.string() }) },
                    () => "result"
                );
            });

            // If no error thrown, tool was registered
            expect(forge).toBeInstanceOf(Forge);
        });

        it("should allow plugin to register resources", () => {
            const forge = new Forge({ name: "test", version: "1.0.0" });

            forge.plugin((app) => {
                app.resource("plugin-resource", "file:///test", () => ({ text: "content" }));
            });

            expect(forge).toBeInstanceOf(Forge);
        });

        it("should allow plugin to register prompts", () => {
            const forge = new Forge({ name: "test", version: "1.0.0" });

            forge.plugin((app) => {
                app.prompt(
                    "plugin-prompt",
                    { schema: z.object({ topic: z.string() }) },
                    () => ({ messages: [] })
                );
            });

            expect(forge).toBeInstanceOf(Forge);
        });

        it("should allow plugin to register middleware", () => {
            const forge = new Forge({ name: "test", version: "1.0.0" });
            const middlewareFn = vi.fn(async (ctx, next) => next());

            forge.plugin((app) => {
                app.use(middlewareFn);
            });

            expect(forge).toBeInstanceOf(Forge);
        });

        it("should support multiple plugins", () => {
            const forge = new Forge({ name: "test", version: "1.0.0" });
            const plugin1 = vi.fn();
            const plugin2 = vi.fn();

            forge.plugin(plugin1).plugin(plugin2);

            expect(plugin1).toHaveBeenCalledWith(forge);
            expect(plugin2).toHaveBeenCalledWith(forge);
        });

        it("should support configurable plugin factories", () => {
            const forge = new Forge({ name: "test", version: "1.0.0" });

            function configuredPlugin(config: { prefix: string }): ForgePlugin {
                return (app) => {
                    app.tool(
                        `${config.prefix}_tool`,
                        { schema: z.object({}) },
                        () => config.prefix
                    );
                };
            }

            forge.plugin(configuredPlugin({ prefix: "custom" }));

            expect(forge).toBeInstanceOf(Forge);
        });

        it("should allow chaining with other methods", () => {
            const forge = new Forge({ name: "test", version: "1.0.0" });

            const result = forge
                .use(async (ctx, next) => next())
                .plugin((app) => {
                    app.tool("t1", { schema: z.object({}) }, () => "r1");
                })
                .tool("t2", { schema: z.object({}) }, () => "r2")
                .plugin((app) => {
                    app.resource("r1", "file:///r", () => ({ text: "" }));
                });

            expect(result).toBe(forge);
        });
    });

    describe("plugin composition", () => {
        it("should allow plugins to use other plugins", () => {
            const forge = new Forge({ name: "test", version: "1.0.0" });

            const basePlugin: ForgePlugin = (app) => {
                app.tool("base-tool", { schema: z.object({}) }, () => "base");
            };

            const composedPlugin: ForgePlugin = (app) => {
                app.plugin(basePlugin);
                app.tool("composed-tool", { schema: z.object({}) }, () => "composed");
            };

            forge.plugin(composedPlugin);

            expect(forge).toBeInstanceOf(Forge);
        });
    });
});
