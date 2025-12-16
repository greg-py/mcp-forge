import { z } from "zod";
import { Forge } from "../src/index";

// Initialize Forge
const forge = new Forge({
    name: "weather-server",
    version: "1.0.0",
});

// Define a tool
forge.tool(
    "get_weather",
    z.object({
        city: z.string().describe("The city to get weather for"),
        unit: z.enum(["celsius", "fahrenheit"]).optional().default("celsius"),
    }),
    async (args) => {
        // args is typed! args.city is string, args.unit is "celsius" | "fahrenheit" | undefined
        const { city, unit } = args;

        // Simulate API call
        const temp = Math.floor(Math.random() * 30);

        return `The weather in ${city} is ${temp} degrees ${unit}.`;
    }
);

// Define a resource
forge.resource(
    "app-config",
    "file:///config.json",
    async (uri) => {
        return {
            text: JSON.stringify({ appName: "weather-server", version: "1.0.0" }, null, 2)
        };
    }
);

// Define a prompt
forge.prompt(
    "summarize_weather",
    z.object({
        city: z.string().describe("The city to summarize"),
    }),
    async ({ city }) => {
        return {
            messages: [
                {
                    role: "user",
                    content: {
                        type: "text",
                        text: `Please give me a weather summary for ${city}.`
                    }
                }
            ]
        };
    }
);

// Start the server
forge.start().catch((err) => {
    console.error("Failed to start server:", err);
    process.exit(1);
});
