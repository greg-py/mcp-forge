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

// Tool: Get weather for a city
forge.tool(
    "get_weather",
    z.object({
        city: z.string().describe("The city to get weather for"),
        unit: z.enum(["celsius", "fahrenheit"]).optional().default("celsius"),
    }),
    async ({ city, unit }) => {
        const temp = Math.floor(Math.random() * 30);
        return `The weather in ${city} is ${temp} degrees ${unit}.`;
    }
);

// Resource: Application configuration
forge.resource("app-config", "file:///config.json", async () => ({
    text: JSON.stringify({ appName: "weather-server", version: "1.0.0" }, null, 2),
}));

// Prompt: Weather summary template
forge.prompt(
    "summarize_weather",
    z.object({
        city: z.string().describe("The city to summarize"),
    }),
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

forge.start().catch((err) => {
    console.error("Failed to start server:", err);
    process.exit(1);
});
