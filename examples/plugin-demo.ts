import { z } from "zod";
import { Forge, ForgePlugin, logging } from "../src/index";

// =====================================================
// Example 1: Simple inline plugin
// =====================================================

const forge = new Forge({
    name: "plugin-demo-server",
    version: "1.0.0",
});

// Inline plugin for math operations
forge.plugin((app) => {
    app.tool(
        "add",
        { schema: z.object({ a: z.number(), b: z.number() }), description: "Add two numbers" },
        ({ a, b }) => a + b
    );

    app.tool(
        "multiply",
        { schema: z.object({ a: z.number(), b: z.number() }), description: "Multiply two numbers" },
        ({ a, b }) => a * b
    );
});

// =====================================================
// Example 2: Reusable plugin function
// =====================================================

/**
 * Creates a greeting plugin with configurable messages.
 */
function greetingPlugin(config: { defaultGreeting: string }): ForgePlugin {
    return (app) => {
        app.tool(
            "greet",
            {
                schema: z.object({
                    name: z.string().describe("Name to greet"),
                    greeting: z.string().optional().describe("Custom greeting"),
                }),
                description: "Greet someone with a message",
            },
            ({ name, greeting }) => {
                const message = greeting ?? config.defaultGreeting;
                return `${message}, ${name}!`;
            }
        );

        app.tool(
            "farewell",
            {
                schema: z.object({ name: z.string() }),
                description: "Say goodbye to someone",
            },
            ({ name }) => `Goodbye, ${name}!`
        );
    };
}

forge.plugin(greetingPlugin({ defaultGreeting: "Hello" }));

// =====================================================
// Example 3: Plugin with middleware
// =====================================================

/**
 * Time tracking plugin that logs execution time for all handlers.
 */
const timeTrackingPlugin: ForgePlugin = (app) => {
    // Add middleware
    app.use(async (ctx, next) => {
        const start = Date.now();
        const result = await next();
        console.error(`[TimeTracking] ${ctx.type}:${ctx.name} took ${Date.now() - start}ms`);
        return result;
    });

    // Add a tool to get current time
    app.tool(
        "current_time",
        {
            schema: z.object({}),
            description: "Get the current server time",
        },
        () => new Date().toISOString()
    );
};

forge.plugin(timeTrackingPlugin);

// =====================================================
// Example 4: Plugin with resources and prompts
// =====================================================

/**
 * Documentation plugin providing help resources and prompts.
 */
function documentationPlugin(config: { appName: string; version: string }): ForgePlugin {
    return (app) => {
        // Add a help resource
        app.resource(
            "help",
            "forge://help",
            { description: "Application help documentation" },
            () => ({
                text: `Welcome to ${config.appName} v${config.version}!\n\nAvailable tools:\n- add: Add two numbers\n- multiply: Multiply two numbers\n- greet: Greet someone\n- farewell: Say goodbye\n- current_time: Get current time`,
            })
        );

        // Add a prompt template
        app.prompt(
            "explain_tool",
            {
                schema: z.object({
                    toolName: z.string().describe("Name of the tool to explain"),
                }),
                description: "Generate an explanation prompt for a tool",
            },
            ({ toolName }) => ({
                messages: [
                    {
                        role: "user" as const,
                        content: {
                            type: "text" as const,
                            text: `Please explain how to use the "${toolName}" tool in ${config.appName}.`,
                        },
                    },
                ],
            })
        );
    };
}

forge.plugin(documentationPlugin({ appName: "Plugin Demo", version: "1.0.0" }));

// Add logging for visibility
forge.use(logging({ level: "info" }));

// Handle graceful shutdown
process.on("SIGINT", async () => {
    console.error("\nShutting down...");
    await forge.stop();
    process.exit(0);
});

forge.start().catch((err) => {
    console.error("Failed to start server:", err);
    process.exit(1);
});
