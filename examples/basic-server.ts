import { z } from "zod";
import { Forge } from "../src/index";

const forge = new Forge({
    name: "weather-server",
    version: "1.0.0",
});

// Logging middleware
forge.use(async (ctx, next) => {
    console.error(`[Middleware] Executing ${ctx.type}: ${ctx.name}`);
    const start = Date.now();
    const result = await next();
    console.error(`[Middleware] Finished ${ctx.name} in ${Date.now() - start}ms`);
    return result;
});

// Tool with description
forge.tool(
    "get_weather",
    {
        schema: z.object({
            city: z.string().describe("The city to get weather for"),
            unit: z.enum(["celsius", "fahrenheit"]).optional().default("celsius"),
        }),
        description: "Get the current weather for a city",
    },
    async ({ city, unit }) => {
        const temp = Math.floor(Math.random() * 30);
        return `The weather in ${city} is ${temp} degrees ${unit}.`;
    }
);

// Resource with description
forge.resource(
    "app-config",
    "file:///config.json",
    { description: "Application configuration", mimeType: "application/json" },
    async () => ({
        text: JSON.stringify({ appName: "weather-server", version: "1.0.0" }, null, 2),
    })
);

// Prompt with description
forge.prompt(
    "summarize_weather",
    {
        schema: z.object({
            city: z.string().describe("The city to summarize"),
        }),
        description: "Generate a weather summary prompt for a city",
    },
    async ({ city }) => ({
        messages: [
            {
                role: "user",
                content: {
                    type: "text",
                    text: `Please give me a weather summary for ${city}.`,
                },
            },
        ],
    })
);

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
