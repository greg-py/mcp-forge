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
- **Built-in Middleware** - Production-ready rate limiting, caching, metrics, and more
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
import { Forge, rateLimit, logging } from "mcp-forge";
import { z } from "zod";

const forge = new Forge({
  name: "my-mcp-server",
  version: "1.0.0",
});

// Add built-in middleware
forge.use(logging({ level: "info" }));
forge.use(rateLimit({ maxRequests: 100, windowMs: 60_000 }));

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

## Built-in Middleware

Forge ships with production-ready middleware for common use cases:

### Rate Limiting

Prevent abuse with configurable rate limits:

```typescript
import { rateLimit } from "mcp-forge";

// 100 requests per minute per handler
forge.use(rateLimit({ maxRequests: 100, windowMs: 60_000 }));

// Global limit across all handlers
forge.use(rateLimit({ maxRequests: 1000, windowMs: 60_000, perHandler: false }));

// Custom key for per-user rate limiting
forge.use(rateLimit({
  maxRequests: 10,
  windowMs: 60_000,
  keyGenerator: (ctx) => ctx.args.userId as string ?? "anonymous"
}));
```

### Caching

Cache handler results with TTL and LRU eviction:

```typescript
import { cache } from "mcp-forge";

// Cache tool results for 5 minutes
forge.use(cache({ ttlMs: 300_000, types: ["tool"] }));

// With hit/miss callbacks
forge.use(cache({
  ttlMs: 60_000,
  onHit: (ctx, key) => console.log(`Cache hit: ${key}`),
  onMiss: (ctx, key) => console.log(`Cache miss: ${key}`)
}));
```

### Timeout

Prevent runaway handlers:

```typescript
import { timeout } from "mcp-forge";

// 30 second timeout
forge.use(timeout({ ms: 30_000 }));

// Custom timeout message
forge.use(timeout({
  ms: 10_000,
  message: (ctx, ms) => `${ctx.name} timed out after ${ms}ms`
}));
```

### Metrics

Collect execution timing and statistics:

```typescript
import { metrics } from "mcp-forge";

const { middleware, getMetrics, getAggregated, reset } = metrics({
  onMetric: (m) => console.log(`${m.name}: ${m.durationMs}ms`)
});

forge.use(middleware);

// Later, retrieve metrics
const allMetrics = getMetrics();
const aggregated = getAggregated(); // { name, callCount, avgDurationMs, ... }
```

### Logging

Structured logging to stderr (MCP-compatible):

```typescript
import { logging } from "mcp-forge";

forge.use(logging({ level: "info" }));

// With custom output
forge.use(logging({
  level: "debug",
  output: (entry) => myLogger.log(entry)
}));
```

### Retry

Automatic retry with exponential backoff:

```typescript
import { retry } from "mcp-forge";

forge.use(retry({ maxRetries: 3, initialDelayMs: 1000 }));

// Only retry specific errors
forge.use(retry({
  maxRetries: 3,
  shouldRetry: (error) => error.message.includes("temporary")
}));
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

### Custom Middleware

Create your own middleware:

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
