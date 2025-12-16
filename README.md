# Forge (mcp-forge)

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-Strict-blue.svg)](https://www.typescriptlang.org/)
[![CI](https://github.com/username/mcp-forge/actions/workflows/ci.yml/badge.svg)](https://github.com/username/mcp-forge/actions/workflows/ci.yml)

Forge is a high-level application framework for the **Model Context Protocol (MCP)**. Think of it as **Express.js** for building MCP servers.

Forge abstracts away the low-level details of the MCP SDK, allowing you to focus on defining your AI tools using simple Zod schemas and standard JavaScript functions. It handles:

- Protocol handshake and negotiation
- JSON-RPC message processing
- Automatic argument validation using Zod
- Type-safe argument inference for your handlers
- Robust error handling

## Features

- **Type Safety** - Full TypeScript support with argument inference from Zod schemas
- **MCP Primitives** - Register tools, resources, and prompts with a simple API
- **Middleware** - Add cross-cutting concerns like logging, authentication, and rate limiting
- **Multiple Transports** - Run locally with stdio or remotely with HTTP
- **Descriptions** - Add human-readable descriptions to tools, resources, and prompts
- **Graceful Shutdown** - Clean shutdown with `forge.stop()`
- **Validation** - Runtime argument validation using Zod
- **Error Handling** - Polished error reporting to LLMs to prevent hallucinations

## Quick Start

### Installation

```bash
npm install mcp-forge zod
```

### Basic Usage

Create a file `server.ts`:

```typescript
import { Forge } from "mcp-forge";
import { z } from "zod";

const forge = new Forge({
  name: "my-mcp-server",
  version: "1.0.0",
});

forge.tool(
  "echo",
  {
    schema: z.object({
      message: z.string().describe("The message to echo back"),
    }),
    description: "Echo a message back to the user",
  },
  async ({ message }) => {
    return `Echo: ${message}`;
  }
);

forge.start();
```

Run it:

```bash
npx ts-node server.ts
```

## API Reference

### Tools

Register tools that can be called by MCP clients:

```typescript
// With description (recommended)
forge.tool(
  "add",
  {
    schema: z.object({ a: z.number(), b: z.number() }),
    description: "Add two numbers together",
  },
  ({ a, b }) => a + b
);

// Simple form (schema only)
forge.tool("add", z.object({ a: z.number(), b: z.number() }), ({ a, b }) => a + b);
```

### Resources

Expose data that MCP clients can read:

```typescript
forge.resource(
  "config",
  "file:///config.json",
  { description: "Application configuration", mimeType: "application/json" },
  async () => ({
    text: JSON.stringify({ key: "value" }),
  })
);
```

### Prompts

Create reusable prompt templates:

```typescript
forge.prompt(
  "summarize",
  {
    schema: z.object({ topic: z.string() }),
    description: "Generate a summary prompt",
  },
  ({ topic }) => ({
    messages: [
      {
        role: "user",
        content: { type: "text", text: `Summarize: ${topic}` },
      },
    ],
  })
);
```

### Middleware

Add cross-cutting concerns with the `.use()` method:

```typescript
forge.use(async (ctx, next) => {
  console.log(`Calling ${ctx.type}: ${ctx.name}`);
  const start = Date.now();
  const result = await next();
  console.log(`Completed in ${Date.now() - start}ms`);
  return result;
});
```

### Transport Options

By default, Forge uses stdio transport (for local MCP clients like Claude Desktop).

For remote clients, use HTTP transport:

```typescript
await forge.start({ transport: "http", port: 3000 });
```

### Graceful Shutdown

```typescript
process.on("SIGINT", async () => {
  await forge.stop();
  process.exit(0);
});
```

## Connecting to Claude Desktop

1. Open your Claude Desktop configuration file:
   - macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
   - Windows: `%APPDATA%\Claude\claude_desktop_config.json`

2. Add your Forge server:

```json
{
  "mcpServers": {
    "my-forge-server": {
      "command": "npx",
      "args": ["-y", "ts-node", "/absolute/path/to/your/server.ts"]
    }
  }
}
```

3. Restart Claude Desktop. Your tools will now be available!

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup and guidelines.

## License

[MIT](LICENSE)
