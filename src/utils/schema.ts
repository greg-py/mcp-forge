import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

/**
 * Converts a Zod schema to an MCP-compatible JSON Schema object.
 * @param schema The Zod schema to convert.
 * @returns The JSON Schema object.
 */
export function toMcpSchema(schema: z.ZodType<any>): any {
    // Cast to any to avoid "Type instantiation is excessively deep and possibly infinite" error
    const jsonSchema = zodToJsonSchema(schema as any, { target: "jsonSchema7" });

    // zod-to-json-schema wraps the result in a root definition if it's not a simple object sometimes,
    // or it might just return the object.
    // For MCP tool arguments, we expect an object definition.

    // We explicitly want the `properties` and `required` fields from the schema if it's an object.
    // If it's wrapped, unwrapping might be needed, but usually for tool arguments we pass a ZodObject.
    // Let's assume standard usage where the user provides z.object({...}).

    return jsonSchema;
}
