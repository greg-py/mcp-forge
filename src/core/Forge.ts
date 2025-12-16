import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { CallToolResult, GetPromptResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import express, { Express } from "express";
import { Server } from "http";
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

/**
 * Configuration options for tool registration.
 */
export interface ToolOptions<T extends z.ZodTypeAny> {
    /** Zod schema for validating tool arguments */
    schema: T;
    /** Human-readable description of what the tool does */
    description?: string;
}

/**
 * Configuration options for resource registration.
 */
export interface ResourceOptions {
    /** Human-readable description of the resource */
    description?: string;
    /** MIME type of the resource content */
    mimeType?: string;
}

/**
 * Configuration options for resource template registration.
 */
export interface ResourceTemplateOptions<T extends z.ZodTypeAny> {
    /** Zod schema for validating URI parameters */
    schema: T;
    /** Human-readable description of the resource template */
    description?: string;
    /** MIME type of the resource content */
    mimeType?: string;
}

/**
 * Configuration options for prompt registration.
 */
export interface PromptOptions<T extends z.ZodTypeAny> {
    /** Zod schema for validating prompt arguments */
    schema: T;
    /** Human-readable description of the prompt */
    description?: string;
}

/**
 * A plugin function that extends a Forge instance with additional functionality.
 *
 * Plugins can register tools, resources, prompts, and middleware.
 * They receive the Forge instance and can call any of its public methods.
 *
 * @example
 * ```typescript
 * // Define a plugin
 * const analyticsPlugin: ForgePlugin = (forge) => {
 *   forge.use(loggingMiddleware);
 *   forge.tool("track_event", { schema: eventSchema }, handler);
 * };
 *
 * // Use the plugin
 * forge.plugin(analyticsPlugin);
 * ```
 */
export type ForgePlugin = (forge: Forge) => void;

/**
 * Plugin with configuration options.
 *
 * A factory function that accepts configuration and returns a plugin.
 *
 * @example
 * ```typescript
 * // Define a configurable plugin
 * function databasePlugin(config: { connectionString: string }): ForgePlugin {
 *   return (forge) => {
 *     const db = connect(config.connectionString);
 *     forge.tool("query", { schema }, async (args) => db.query(args.sql));
 *   };
 * }
 *
 * // Use with configuration
 * forge.plugin(databasePlugin({ connectionString: "postgres://..." }));
 * ```
 */
export type ForgePluginFactory<T> = (config: T) => ForgePlugin;

// Internal type definitions
interface ToolDefinition {
    name: string;
    schema: z.ZodTypeAny;
    description?: string;
    handler: (args: z.infer<z.ZodTypeAny>) => Promise<unknown> | unknown;
}

interface ResourceDefinition {
    name: string;
    uri: string;
    description?: string;
    mimeType?: string;
    handler: (uri: URL) => Promise<ResourceResult> | ResourceResult;
}

interface PromptDefinition {
    name: string;
    schema: z.ZodTypeAny;
    description?: string;
    handler: (args: z.infer<z.ZodTypeAny>) => Promise<GetPromptResult> | GetPromptResult;
}

interface ResourceTemplateDefinition {
    name: string;
    uriTemplate: string;
    schema: z.ZodTypeAny;
    description?: string;
    mimeType?: string;
    handler: (params: z.infer<z.ZodTypeAny>, uri: URL) => Promise<ResourceResult> | ResourceResult;
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
 * forge.tool("greet", { schema: z.object({ name: z.string() }), description: "Greet a user" }, ({ name }) => {
 *   return `Hello, ${name}!`;
 * });
 *
 * await forge.start();
 * ```
 */
export class Forge {
    private config: { name: string; version: string };
    private tools: ToolDefinition[] = [];
    private resources: ResourceDefinition[] = [];
    private resourceTemplates: ResourceTemplateDefinition[] = [];
    private prompts: PromptDefinition[] = [];
    private middlewares: ForgeMiddleware[] = [];
    private httpServer: Server | null = null;
    private transports: Map<string, StreamableHTTPServerTransport> = new Map();
    private stdioTransport: StdioServerTransport | null = null;

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
     * Registers a plugin with the Forge server.
     *
     * Plugins are functions that extend Forge with additional tools,
     * resources, prompts, and middleware. They enable modular, reusable
     * bundles of functionality that can be shared as npm packages.
     *
     * @param plugin - The plugin function to register.
     * @returns The Forge instance for chaining.
     *
     * @example
     * ```typescript
     * // Simple plugin
     * forge.plugin((app) => {
     *   app.tool("my_tool", { schema }, handler);
     * });
     *
     * // Plugin from package
     * import { analyticsPlugin } from "@forge/plugin-analytics";
     * forge.plugin(analyticsPlugin({ apiKey: "..." }));
     * ```
     */
    plugin(plugin: ForgePlugin): this {
        plugin(this);
        return this;
    }

    /**
     * Registers a tool with the Forge server.
     * Tools are functions that can be called by MCP clients.
     *
     * @param name - Unique name for the tool.
     * @param options - Tool configuration including schema and optional description.
     * @param handler - Function that implements the tool logic.
     * @returns The Forge instance for chaining.
     *
     * @example
     * ```typescript
     * // With description
     * forge.tool("add", { schema: z.object({ a: z.number(), b: z.number() }), description: "Add two numbers" }, ({ a, b }) => a + b);
     *
     * // Legacy signature (schema only)
     * forge.tool("add", z.object({ a: z.number(), b: z.number() }), ({ a, b }) => a + b);
     * ```
     */
    tool<T extends z.ZodTypeAny>(
        name: string,
        optionsOrSchema: ToolOptions<T> | T,
        handler: (args: z.infer<T>) => Promise<unknown> | unknown
    ): this {
        const isOptions = optionsOrSchema && typeof optionsOrSchema === "object" && "schema" in optionsOrSchema;
        const schema = isOptions ? (optionsOrSchema as ToolOptions<T>).schema : optionsOrSchema as T;
        const description = isOptions ? (optionsOrSchema as ToolOptions<T>).description : undefined;

        this.tools.push({ name, schema, description, handler });
        return this;
    }

    /**
     * Registers a resource with the Forge server.
     * Resources expose data that MCP clients can read.
     *
     * @param name - Display name for the resource.
     * @param uri - Unique URI identifying the resource.
     * @param optionsOrHandler - Resource options or handler function.
     * @param handler - Handler function (if options provided as third param).
     * @returns The Forge instance for chaining.
     *
     * @example
     * ```typescript
     * // With options
     * forge.resource("config", "file:///config.json", { description: "App config" }, async () => ({ text: "{}" }));
     *
     * // Simple (handler only)
     * forge.resource("config", "file:///config.json", async () => ({ text: "{}" }));
     * ```
     */
    resource(
        name: string,
        uri: string,
        optionsOrHandler: ResourceOptions | ((uri: URL) => Promise<ResourceResult> | ResourceResult),
        handler?: (uri: URL) => Promise<ResourceResult> | ResourceResult
    ): this {
        const isOptions = typeof optionsOrHandler === "object" && !("then" in optionsOrHandler);
        const options = isOptions ? optionsOrHandler as ResourceOptions : {};
        const actualHandler = isOptions ? handler! : optionsOrHandler as (uri: URL) => Promise<ResourceResult> | ResourceResult;

        this.resources.push({
            name,
            uri,
            description: options.description,
            mimeType: options.mimeType,
            handler: actualHandler,
        });
        return this;
    }

    /**
     * Registers a resource template for dynamic URIs.
     *
     * Resource templates allow you to define resources with parameterized URIs
     * like `file:///logs/{date}` or `db://users/{id}`. Parameters are extracted
     * from the URI and validated against the provided schema.
     *
     * @param name - Display name for the resource template.
     * @param uriTemplate - URI template with parameters in curly braces, e.g. `file:///logs/{date}`.
     * @param options - Configuration including schema for URI parameters.
     * @param handler - Function that handles the resource request with extracted parameters.
     * @returns The Forge instance for chaining.
     *
     * @example
     * ```typescript
     * // Dynamic log files by date
     * forge.resourceTemplate(
     *   "daily-logs",
     *   "file:///logs/{date}",
     *   {
     *     schema: z.object({ date: z.string().regex(/\d{4}-\d{2}-\d{2}/) }),
     *     description: "Daily log files",
     *     mimeType: "text/plain"
     *   },
     *   async ({ date }) => {
     *     const content = await fs.readFile(`logs/${date}.log`, "utf-8");
     *     return { text: content };
     *   }
     * );
     *
     * // Database records by ID
     * forge.resourceTemplate(
     *   "user",
     *   "db://users/{id}",
     *   {
     *     schema: z.object({ id: z.string() }),
     *     description: "User record by ID"
     *   },
     *   async ({ id }) => {
     *     const user = await db.users.findById(id);
     *     return { text: JSON.stringify(user) };
     *   }
     * );
     * ```
     */
    resourceTemplate<T extends z.ZodTypeAny>(
        name: string,
        uriTemplate: string,
        options: ResourceTemplateOptions<T>,
        handler: (params: z.infer<T>, uri: URL) => Promise<ResourceResult> | ResourceResult
    ): this {
        this.resourceTemplates.push({
            name,
            uriTemplate,
            schema: options.schema,
            description: options.description,
            mimeType: options.mimeType,
            handler,
        });
        return this;
    }

    /**
     * Registers a prompt template with the Forge server.
     * Prompts are reusable message templates for MCP clients.
     *
     * @param name - Unique name for the prompt.
     * @param optionsOrSchema - Prompt options or Zod schema.
     * @param handler - Function that returns the prompt messages.
     * @returns The Forge instance for chaining.
     *
     * @example
     * ```typescript
     * // With description
     * forge.prompt("summarize", { schema: z.object({ topic: z.string() }), description: "Summarize a topic" }, ({ topic }) => ({
     *   messages: [{ role: "user", content: { type: "text", text: `Summarize: ${topic}` } }]
     * }));
     * ```
     */
    prompt<T extends z.ZodTypeAny>(
        name: string,
        optionsOrSchema: PromptOptions<T> | T,
        handler: (args: z.infer<T>) => Promise<GetPromptResult> | GetPromptResult
    ): this {
        const isOptions = optionsOrSchema && typeof optionsOrSchema === "object" && "schema" in optionsOrSchema;
        const schema = isOptions ? (optionsOrSchema as PromptOptions<T>).schema : optionsOrSchema as T;
        const description = isOptions ? (optionsOrSchema as PromptOptions<T>).description : undefined;

        this.prompts.push({ name, schema, description, handler });
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

            server.registerTool(
                tool.name,
                { inputSchema: jsonSchema, description: tool.description },
                async (args: any) => {
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
                }
            );
        }

        for (const resource of this.resources) {
            server.registerResource(
                resource.name,
                resource.uri,
                { description: resource.description, mimeType: resource.mimeType },
                async (readUri) => {
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
                }
            );
        }

        for (const prompt of this.prompts) {
            const argsSchema = prompt.schema instanceof z.ZodObject
                ? prompt.schema.shape
                : prompt.schema;

            server.registerPrompt(
                prompt.name,
                { argsSchema: argsSchema as any, description: prompt.description },
                async (args: any) => {
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
                }
            );
        }

        // Register resource templates
        for (const template of this.resourceTemplates) {
            // Extract parameter names from URI template
            const paramNames = this.extractTemplateParams(template.uriTemplate);
            const regexPattern = this.templateToRegex(template.uriTemplate);

            // Register as a resource with the template URI
            // The handler will match incoming URIs against the pattern
            server.registerResource(
                template.name,
                template.uriTemplate,
                { description: template.description, mimeType: template.mimeType },
                async (readUri) => {
                    try {
                        const uriString = readUri.toString();
                        const match = uriString.match(regexPattern);

                        if (!match) {
                            throw new Error(`URI "${uriString}" does not match template "${template.uriTemplate}"`);
                        }

                        // Extract parameters from the matched groups
                        const params: Record<string, string> = {};
                        paramNames.forEach((name, index) => {
                            params[name] = match[index + 1] || "";
                        });

                        // Validate parameters against schema
                        const validatedParams = template.schema.parse(params);

                        const result = await this.executeWithMiddleware(
                            { name: template.name, args: validatedParams as Record<string, unknown>, schema: template.schema, type: "resource" },
                            () => Promise.resolve(template.handler(validatedParams, readUri))
                        );

                        return {
                            contents: [{ uri: uriString, ...(result as ResourceResult) }],
                        };
                    } catch (error) {
                        throw error;
                    }
                }
            );
        }
    }

    /**
     * Extracts parameter names from a URI template.
     * E.g., "file:///logs/{date}/{level}" => ["date", "level"]
     */
    private extractTemplateParams(template: string): string[] {
        const matches = template.match(/\{([^}]+)\}/g);
        if (!matches) return [];
        return matches.map((m) => m.slice(1, -1));
    }

    /**
     * Converts a URI template to a regex pattern for matching.
     * E.g., "file:///logs/{date}" => /^file:\/\/\/logs\/([^\/]+)$/
     */
    private templateToRegex(template: string): RegExp {
        // Escape special regex characters except for {param} placeholders
        const escaped = template.replace(/[.*+?^${}()|[\]\\]/g, (char) => {
            if (char === "{" || char === "}") return char;
            return "\\" + char;
        });

        // Replace {param} with capture groups
        const pattern = escaped.replace(/\\\{([^}]+)\\\}/g, "([^/]+)");

        return new RegExp("^" + pattern + "$");
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

    /**
     * Gracefully stops the Forge server and closes all connections.
     */
    async stop(): Promise<void> {
        // Close HTTP server if running
        if (this.httpServer) {
            await new Promise<void>((resolve, reject) => {
                this.httpServer!.close((err) => {
                    if (err) reject(err);
                    else resolve();
                });
            });
            this.httpServer = null;
        }

        // Close all active transports
        for (const transport of this.transports.values()) {
            await transport.close();
        }
        this.transports.clear();

        // Close stdio transport
        if (this.stdioTransport) {
            await this.stdioTransport.close();
            this.stdioTransport = null;
        }

        logger.info("Forge server stopped");
    }

    private async startStdio(): Promise<void> {
        const server = this.createServer();
        this.setupServer(server);

        this.stdioTransport = new StdioServerTransport();
        await server.connect(this.stdioTransport);

        logger.info("Forge server started (stdio)");
    }

    private async startHttp(port: number): Promise<void> {
        const app: Express = express();
        app.use(express.json());

        app.all("/mcp", async (req, res) => {
            const sessionId = req.headers["mcp-session-id"] as string | undefined;

            if (sessionId && this.transports.has(sessionId)) {
                const transport = this.transports.get(sessionId)!;
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
                    this.transports.delete(transport.sessionId);
                }
            };

            await server.connect(transport);

            if (transport.sessionId) {
                this.transports.set(transport.sessionId, transport);
            }

            await transport.handleRequest(req, res, req.body);
        });

        this.httpServer = app.listen(port, () => {
            logger.info(`Forge server started (HTTP) on port ${port}`);
        });
    }
}
