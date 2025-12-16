import { describe, it, expect } from "vitest";
import { z } from "zod";
import { toMcpSchema } from "../src/utils/schema";

describe("schema", () => {
    describe("toMcpSchema()", () => {
        it("should convert a simple object schema", () => {
            const schema = z.object({
                name: z.string(),
                age: z.number(),
            });

            const result = toMcpSchema(schema);

            expect(result).toHaveProperty("type", "object");
            expect(result).toHaveProperty("properties");
            expect(result.properties).toHaveProperty("name");
            expect(result.properties).toHaveProperty("age");
        });

        it("should convert schemas with optional fields", () => {
            const schema = z.object({
                required: z.string(),
                optional: z.string().optional(),
            });

            const result = toMcpSchema(schema);

            expect(result).toHaveProperty("required");
            expect(result.required).toContain("required");
            expect(result.required).not.toContain("optional");
        });

        it("should convert schemas with descriptions", () => {
            const schema = z.object({
                field: z.string().describe("A test field"),
            });

            const result = toMcpSchema(schema);

            expect(result.properties.field).toHaveProperty("description", "A test field");
        });

        it("should convert enum schemas", () => {
            const schema = z.object({
                status: z.enum(["active", "inactive"]),
            });

            const result = toMcpSchema(schema);

            expect(result.properties.status).toHaveProperty("enum");
            expect(result.properties.status.enum).toContain("active");
            expect(result.properties.status.enum).toContain("inactive");
        });

        it("should convert array schemas", () => {
            const schema = z.object({
                items: z.array(z.string()),
            });

            const result = toMcpSchema(schema);

            expect(result.properties.items).toHaveProperty("type", "array");
            expect(result.properties.items).toHaveProperty("items");
        });

        it("should convert nested object schemas", () => {
            const schema = z.object({
                nested: z.object({
                    value: z.number(),
                }),
            });

            const result = toMcpSchema(schema);

            expect(result.properties.nested).toHaveProperty("type", "object");
            expect(result.properties.nested.properties).toHaveProperty("value");
        });
    });
});
