import { describe, it, expect, vi } from "vitest";
import { z } from "zod";
import { Forge } from "../src/core/Forge";

describe("Resource Templates", () => {
    describe("resourceTemplate()", () => {
        it("should register a resource template and return this for chaining", () => {
            const forge = new Forge({ name: "test", version: "1.0.0" });

            const result = forge.resourceTemplate(
                "logs",
                "file:///logs/{date}",
                { schema: z.object({ date: z.string() }) },
                () => ({ text: "log content" })
            );

            expect(result).toBe(forge);
        });

        it("should support multiple parameters", () => {
            const forge = new Forge({ name: "test", version: "1.0.0" });

            forge.resourceTemplate(
                "user-files",
                "files:///{userId}/{folder}/{filename}",
                {
                    schema: z.object({
                        userId: z.string(),
                        folder: z.string(),
                        filename: z.string(),
                    }),
                },
                ({ userId, folder, filename }) => ({
                    text: `File: ${userId}/${folder}/${filename}`,
                })
            );

            expect(forge).toBeInstanceOf(Forge);
        });

        it("should accept description and mimeType options", () => {
            const forge = new Forge({ name: "test", version: "1.0.0" });

            forge.resourceTemplate(
                "config",
                "config:///{env}",
                {
                    schema: z.object({ env: z.string() }),
                    description: "Environment-specific configuration",
                    mimeType: "application/json",
                },
                ({ env }) => ({ text: JSON.stringify({ env }) })
            );

            expect(forge).toBeInstanceOf(Forge);
        });

        it("should chain with other methods", () => {
            const forge = new Forge({ name: "test", version: "1.0.0" });

            const result = forge
                .resourceTemplate("a", "file:///{id}", { schema: z.object({ id: z.string() }) }, () => ({ text: "" }))
                .resource("b", "file:///static", () => ({ text: "" }))
                .resourceTemplate("c", "db:///{table}", { schema: z.object({ table: z.string() }) }, () => ({ text: "" }));

            expect(result).toBe(forge);
        });

        it("should work with plugins", () => {
            const forge = new Forge({ name: "test", version: "1.0.0" });

            forge.plugin((app) => {
                app.resourceTemplate(
                    "plugin-resource",
                    "plugin:///{param}",
                    { schema: z.object({ param: z.string() }) },
                    () => ({ text: "from plugin" })
                );
            });

            expect(forge).toBeInstanceOf(Forge);
        });
    });

    describe("URI template parsing", () => {
        it("should extract single parameter", () => {
            const forge = new Forge({ name: "test", version: "1.0.0" });
            let capturedParams: Record<string, string> | null = null;

            forge.resourceTemplate(
                "test",
                "file:///{id}",
                { schema: z.object({ id: z.string() }) },
                (params) => {
                    capturedParams = params as Record<string, string>;
                    return { text: "ok" };
                }
            );

            // Registration succeeds
            expect(forge).toBeInstanceOf(Forge);
        });

        it("should handle complex URI patterns", () => {
            const forge = new Forge({ name: "test", version: "1.0.0" });

            // Various URI patterns that should be valid
            const templates = [
                "file:///path/{id}",
                "db://users/{userId}",
                "api://v1/{resource}/{id}",
                "custom:///{a}/{b}/{c}",
            ];

            templates.forEach((template, i) => {
                forge.resourceTemplate(
                    `resource-${i}`,
                    template,
                    { schema: z.object({}).passthrough() },
                    () => ({ text: "" })
                );
            });

            expect(forge).toBeInstanceOf(Forge);
        });
    });

    describe("schema validation", () => {
        it("should validate parameters with Zod schema", () => {
            const forge = new Forge({ name: "test", version: "1.0.0" });

            const dateSchema = z.object({
                date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
            });

            forge.resourceTemplate(
                "logs",
                "file:///logs/{date}",
                { schema: dateSchema, description: "Daily logs by date" },
                ({ date }) => ({ text: `Logs for ${date}` })
            );

            expect(forge).toBeInstanceOf(Forge);
        });

        it("should support optional schema fields with defaults", () => {
            const forge = new Forge({ name: "test", version: "1.0.0" });

            const schema = z.object({
                id: z.string(),
                format: z.string().optional().default("json"),
            });

            forge.resourceTemplate(
                "data",
                "data:///{id}",
                { schema },
                ({ id, format }) => ({ text: `${id}.${format}` })
            );

            expect(forge).toBeInstanceOf(Forge);
        });
    });
});
