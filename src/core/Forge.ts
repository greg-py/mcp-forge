import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { toMcpSchema } from "../utils/schema";
import { formatError, logger } from "./errors";

export class Forge {
    private server: McpServer;
    private tools: Array<{
        name: string;
        schema: z.ZodType<any>;
        handler: (args: any) => Promise<any> | any;
    }> = [];

    constructor(config: { name: string; version: string }) {
        this.server = new McpServer({
            name: config.name,
            version: config.version,
        });
    }

    /**
     * Registers a new tool with the Forge server.
     * @param name The name of the tool.
     * @param schema The Zod schema defining the tool's arguments.
     * @param handler The implementation of the tool.
     */
    tool<Schema extends z.ZodType<any>>(
        name: string,
        schema: Schema,
        handler: (args: z.infer<Schema>) => Promise<any> | any
    ) {
        this.tools.push({ name, schema, handler });

        // Convert Zod schema to JSON Schema for MCP
        // The SDK likely expects an input schema object.
        const jsonSchema = toMcpSchema(schema);

        this.server.tool(name, jsonSchema, async (args: any) => {
            try {
                // Validate arguments against Zod schema at runtime
                const validatedArgs = schema.parse(args);

                // Execute the user's handler
                const result = await handler(validatedArgs);

                // Return success result
                // MCP tools conventionally return a generic result structure.
                // We assume the handler returns a string or a JSON object that we wrap in a text content.
                // If the handler returns a structured CallToolResult (which includes `content`), we return it as is.

                if (result && typeof result === 'object' && 'content' in result) {
                    return result;
                }

                return {
                    content: [
                        {
                            type: "text",
                            text: typeof result === "string" ? result : JSON.stringify(result, null, 2),
                        },
                    ],
                };

            } catch (error) {
                return formatError(error);
            }
        });

        return this; // Fluent interface
    }

    /**
     * Starts the Forge server using Stdio transport.
     */
    async start() {
        const transport = new StdioServerTransport();
        await this.server.connect(transport);
        logger.info("Forge server started");
    }
}
