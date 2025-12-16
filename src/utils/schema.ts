import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

/**
 * Converts a Zod schema to an MCP-compatible JSON Schema object.
 *
 * @deprecated Since v0.2.1. The MCP SDK now handles schema conversion internally.
 * This function is no longer needed when using mcp-forge and will be removed in a
 * future major version. If you need JSON Schema conversion for other purposes,
 * use the `zod-to-json-schema` package directly.
 *
 * @param schema - The Zod schema to convert.
 * @returns A JSON Schema 7 compatible object.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function toMcpSchema(schema: z.ZodTypeAny): any {
    // The 'any' cast is required to avoid TypeScript deep instantiation errors
    // when interfacing with zod-to-json-schema's complex generic types
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return zodToJsonSchema(schema as any, { target: "jsonSchema7" });
}

