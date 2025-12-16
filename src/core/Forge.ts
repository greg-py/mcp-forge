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
        const jsonSchema = toMcpSchema(schema);

        this.server.registerTool(name, { inputSchema: jsonSchema }, async (args: any) => {
            try {
                // Validate arguments against Zod schema at runtime
                const validatedArgs = schema.parse(args);

                // Execute the user's handler
                const result = await handler(validatedArgs);

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
     * Registers a static resource with the Forge server.
     * @param name The name of the resource.
     * @param uri The URI of the resource.
     * @param handler The implementation of the resource reader.
     */
    resource(
        name: string,
        uri: string,
        handler: (uri: URL) => Promise<{ text: string } | { blob: string; mimeType?: string }> | { text: string } | { blob: string; mimeType?: string }
    ) {
        // registerResource requires metadata config
        this.server.registerResource(name, uri, {}, async (readUri) => {
            try {
                const result = await handler(readUri);

                return {
                    contents: [
                        {
                            uri: readUri.toString(),
                            ...result
                        }
                    ]
                };
            } catch (error) {
                throw error;
            }
        });
        return this;
    }

    /**
     * Registers a prompt with the Forge server.
     * @param name The name of the prompt.
     * @param schema The Zod schema defining the prompt's arguments.
     * @param handler The implementation of the prompt.
     */
    prompt<Schema extends z.ZodType<any>>(
        name: string,
        schema: Schema,
        handler: (args: z.infer<Schema>) => Promise<any> | any
    ) {
        this.server.registerPrompt(name, { argsSchema: schema as any }, async (args: any) => {
            try {
                const result = await handler(args);
                return result;
            } catch (error) {
                throw error;
            }
        });

        return this;
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
