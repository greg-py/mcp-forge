import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { CallToolResult, GetPromptResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import express from "express";
import { randomUUID } from "crypto";
import { toMcpSchema } from "../utils/schema";
import { formatError, logger } from "./errors";

/**
 * Context object passed to middleware functions.
 */
export interface MiddlewareContext {
    /** Name of the tool, resource, or prompt being called */
    name: string;
    /** Arguments passed to the handler */
    args: Record<string, unknown>;
    /** Zod schema used for validation */
    schema: z.ZodTypeAny;
    /** Type of MCP primitive being invoked */
    type: "tool" | "resource" | "prompt";
}

/**
 * Middleware function signature.
 * Middleware can intercept, modify, or short-circuit handler execution.
 */
export type ForgeMiddleware = (
    ctx: MiddlewareContext,
    next: () => Promise<unknown>
) => Promise<unknown>;

/**
 * Configuration options for starting the Forge server.
 */
export interface ForgeStartOptions {
    /** Transport type: "stdio" (default) or "http" */
    transport?: "stdio" | "http";
    /** Port number for HTTP transport (default: 3000) */
    port?: number;
}

/**
 * Result type for resource handlers.
 */
export type ResourceResult = { text: string } | { blob: string; mimeType?: string };

// Internal type definitions
interface ToolDefinition {
    name: string;
    schema: z.ZodTypeAny;
    handler: (args: z.infer<z.ZodTypeAny>) => Promise<unknown> | unknown;
}

interface ResourceDefinition {
    name: string;
    uri: string;
    handler: (uri: URL) => Promise<ResourceResult> | ResourceResult;
}

interface PromptDefinition {
    name: string;
    schema: z.ZodTypeAny;
    handler: (args: z.infer<z.ZodTypeAny>) => Promise<GetPromptResult> | GetPromptResult;
}

/**
 * Forge - A high-level application framework for the Model Context Protocol (MCP).
 *
 * Forge provides an Express.js-like API for building MCP servers with:
 * - Type-safe tool, resource, and prompt registration using Zod schemas
 * - Middleware support for cross-cutting concerns
 * - Multiple transport options (stdio, HTTP)
 *
 * @example
 * ```typescript
 * const forge = new Forge({ name: "my-server", version: "1.0.0" });
 *
 * forge.use(async (ctx, next) => {
 *   console.log(`Calling: ${ctx.name}`);
 *   return next();
 * });
 *
 * forge.tool("greet", z.object({ name: z.string() }), ({ name }) => {
 *   return `Hello, ${name}!`;
 * });
 *
 * forge.start();
 * ```
 */
export class Forge {
    private config: { name: string; version: string };
    private tools: ToolDefinition[] = [];
    private resources: ResourceDefinition[] = [];
    private prompts: PromptDefinition[] = [];
    private middlewares: ForgeMiddleware[] = [];

    /**
     * Creates a new Forge instance.
     * @param config - Server configuration with name and version.
     */
    constructor(config: { name: string; version: string }) {
        this.config = config;
    }

    /**
     * Registers a middleware function to intercept all handler calls.
     * Middleware is executed in the order it is registered.
     *
     * @param middleware - The middleware function.
     * @returns The Forge instance for chaining.
     */
    use(middleware: ForgeMiddleware): this {
        this.middlewares.push(middleware);
        return this;
    }

    /**
     * Registers a tool with the Forge server.
     * Tools are functions that can be called by MCP clients.
     *
     * @param name - Unique name for the tool.
     * @param schema - Zod schema defining the tool's input arguments.
     * @param handler - Function that implements the tool logic.
     * @returns The Forge instance for chaining.
     */
    tool<T extends z.ZodTypeAny>(
        name: string,
        schema: T,
        handler: (args: z.infer<T>) => Promise<unknown> | unknown
    ): this {
        this.tools.push({ name, schema, handler });
        return this;
    }

    /**
     * Registers a resource with the Forge server.
     * Resources expose data that MCP clients can read.
     *
     * @param name - Display name for the resource.
     * @param uri - Unique URI identifying the resource.
     * @param handler - Function that returns the resource content.
     * @returns The Forge instance for chaining.
     */
    resource(
        name: string,
        uri: string,
        handler: (uri: URL) => Promise<ResourceResult> | ResourceResult
    ): this {
        this.resources.push({ name, uri, handler });
        return this;
    }

    /**
     * Registers a prompt template with the Forge server.
     * Prompts are reusable message templates for MCP clients.
     *
     * @param name - Unique name for the prompt.
     * @param schema - Zod schema defining the prompt's arguments.
     * @param handler - Function that returns the prompt messages.
     * @returns The Forge instance for chaining.
     */
    prompt<T extends z.ZodTypeAny>(
        name: string,
        schema: T,
        handler: (args: z.infer<T>) => Promise<GetPromptResult> | GetPromptResult
    ): this {
        this.prompts.push({ name, schema, handler });
        return this;
    }

    /**
     * Executes the middleware chain and then the handler.
     */
    private async executeWithMiddleware(
        ctx: MiddlewareContext,
        handler: () => Promise<unknown>
    ): Promise<unknown> {
        const runner = async (index: number): Promise<unknown> => {
            if (index === this.middlewares.length) {
                return handler();
            }
            return this.middlewares[index](ctx, () => runner(index + 1));
        };
        return runner(0);
    }

    /**
     * Configures an McpServer instance with all registered tools, resources, and prompts.
     */
    private setupServer(server: McpServer): void {
        for (const tool of this.tools) {
            const jsonSchema = toMcpSchema(tool.schema);

            server.registerTool(tool.name, { inputSchema: jsonSchema }, async (args: any) => {
                try {
                    const validatedArgs = tool.schema.parse(args);

                    const result = await this.executeWithMiddleware(
                        { name: tool.name, args: validatedArgs as Record<string, unknown>, schema: tool.schema, type: "tool" },
                        () => Promise.resolve(tool.handler(validatedArgs))
                    );

                    if (result && typeof result === "object" && "content" in result) {
                        return result as CallToolResult;
                    }

                    return {
                        content: [
                            {
                                type: "text" as const,
                                text: typeof result === "string" ? result : JSON.stringify(result, null, 2),
                            },
                        ],
                    };
                } catch (error) {
                    return formatError(error);
                }
            });
        }

        for (const resource of this.resources) {
            server.registerResource(resource.name, resource.uri, {}, async (readUri) => {
                try {
                    const result = await this.executeWithMiddleware(
                        { name: resource.name, args: { uri: readUri.toString() }, schema: z.any(), type: "resource" },
                        () => Promise.resolve(resource.handler(readUri))
                    );

                    return {
                        contents: [{ uri: readUri.toString(), ...(result as ResourceResult) }],
                    };
                } catch (error) {
                    throw error;
                }
            });
        }

        for (const prompt of this.prompts) {
            // Extract shape if it's a ZodObject, otherwise pass the schema directly
            const argsSchema = prompt.schema instanceof z.ZodObject
                ? prompt.schema.shape
                : prompt.schema;

            server.registerPrompt(prompt.name, { argsSchema: argsSchema as any }, async (args: any) => {
                try {
                    const validatedArgs = prompt.schema.parse(args);

                    const result = await this.executeWithMiddleware(
                        { name: prompt.name, args: validatedArgs as Record<string, unknown>, schema: prompt.schema, type: "prompt" },
                        () => Promise.resolve(prompt.handler(validatedArgs))
                    );

                    return result as GetPromptResult;
                } catch (error) {
                    throw error;
                }
            });
        }
    }

    /**
     * Creates a new McpServer instance configured with this Forge's settings.
     */
    private createServer(): McpServer {
        return new McpServer({
            name: this.config.name,
            version: this.config.version,
        });
    }

    /**
     * Starts the Forge server with the specified transport.
     *
     * @param options - Configuration options for the server.
     */
    async start(options: ForgeStartOptions = {}): Promise<void> {
        const transportType = options.transport ?? "stdio";

        if (transportType === "stdio") {
            await this.startStdio();
        } else if (transportType === "http") {
            await this.startHttp(options.port ?? 3000);
        }
    }

    private async startStdio(): Promise<void> {
        const server = this.createServer();
        this.setupServer(server);

        const transport = new StdioServerTransport();
        await server.connect(transport);

        logger.info("Forge server started (stdio)");
    }

    private async startHttp(port: number): Promise<void> {
        const app = express();
        app.use(express.json());

        const transports = new Map<string, StreamableHTTPServerTransport>();

        app.all("/mcp", async (req, res) => {
            const sessionId = req.headers["mcp-session-id"] as string | undefined;

            if (sessionId && transports.has(sessionId)) {
                const transport = transports.get(sessionId)!;
                await transport.handleRequest(req, res, req.body);
                return;
            }

            const transport = new StreamableHTTPServerTransport({
                sessionIdGenerator: () => randomUUID(),
            });

            const server = this.createServer();
            this.setupServer(server);

            transport.onclose = () => {
                if (transport.sessionId) {
                    transports.delete(transport.sessionId);
                }
            };

            await server.connect(transport);

            if (transport.sessionId) {
                transports.set(transport.sessionId, transport);
            }

            await transport.handleRequest(req, res, req.body);
        });

        app.listen(port, () => {
            logger.info(`Forge server started (HTTP) on port ${port}`);
        });
    }
}
