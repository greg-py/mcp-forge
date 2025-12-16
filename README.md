# mcp-forge

[![npm version](https://img.shields.io/npm/v/mcp-forge.svg)](https://www.npmjs.com/package/mcp-forge)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)

A high-level application framework for the **Model Context Protocol (MCP)**. Think of it as **Express.js** for building MCP servers.

## Why mcp-forge?

Building MCP servers with the raw SDK requires handling low-level protocol details, JSON-RPC messaging, and repetitive boilerplate. **mcp-forge** provides a clean, fluent API that lets you focus on your tool logic:

```typescript
import { Forge } from "mcp-forge";
import { z } from "zod";

const forge = new Forge({ name: "my-server", version: "1.0.0" });

forge.tool(
  "get_weather",
  {
    schema: z.object({ city: z.string() }),
    description: "Get weather for a city",
  },
  async ({ city }) => `Weather in ${city}: 72°F, Sunny`
);

forge.start();
```

## Features

- **🔧 Simple API** — Register tools, resources, and prompts with a fluent builder pattern
- **📦 Plugin System** — Create modular, reusable bundles that can be published to npm
- **🔌 Built-in Middleware** — Rate limiting, caching, metrics, logging, retry, timeout, and auth
- **📐 Type Safety** — Full TypeScript support with Zod schema inference
- **🌐 Multiple Transports** — Stdio (default) and HTTP/StreamableHTTP
- **📋 Resource Templates** — Dynamic URIs with parameterized paths like `file:///logs/{date}`
- **📊 Progress Reporting** — Report progress during long-running tool operations
- **🔐 Pluggable Auth** — Bring your own authentication with `extractToken`/`validate` hooks

## Requirements

- Node.js 18 or higher
- TypeScript 5.0+ (recommended)

## Installation

```bash
npm install mcp-forge zod
```

## Quick Start

### 1. Create a Server

```typescript
// server.ts
import { Forge, logging } from "mcp-forge";
import { z } from "zod";

const forge = new Forge({
  name: "demo-server",
  version: "1.0.0",
});

// Add logging middleware
forge.use(logging({ level: "info" }));

// Register a tool
forge.tool(
  "greet",
  {
    schema: z.object({ name: z.string().describe("Name to greet") }),
    description: "Greet someone by name",
  },
  ({ name }) => `Hello, ${name}!`
);

// Start the server
forge.start();
```

### 2. Run the Server

```bash
npx ts-node server.ts
```

### 3. Connect to Claude Desktop

Add to your Claude Desktop configuration:

**macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`  
**Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "demo-server": {
      "command": "npx",
      "args": ["ts-node", "/absolute/path/to/server.ts"]
    }
  }
}
```

Restart Claude Desktop, and your tools will be available!

## Core Concepts

### Tools

Tools are functions that MCP clients can invoke:

```typescript
forge.tool(
  "add_numbers",
  {
    schema: z.object({
      a: z.number().describe("First number"),
      b: z.number().describe("Second number"),
    }),
    description: "Add two numbers together",
  },
  ({ a, b }) => a + b
);
```

### Progress Reporting

For long-running tools, report progress to the client:

```typescript
forge.tool(
  "analyze_repo",
  {
    schema: z.object({ url: z.string() }),
    description: "Analyze a repository",
  },
  async ({ url }, ctx) => {
    await ctx.reportProgress(0.1, "Cloning repository...");
    await cloneRepo(url);

    await ctx.reportProgress(0.5, "Analyzing files...");
    const results = await analyzeFiles();

    await ctx.reportProgress(0.9, "Generating report...");
    return generateReport(results);
  }
);
```

### Resources

Resources expose data that clients can read:

```typescript
forge.resource(
  "config",
  "file:///config.json",
  { description: "Application configuration", mimeType: "application/json" },
  () => ({ text: JSON.stringify({ version: "1.0.0" }) })
);
```

### Resource Templates

Define dynamic resources with URI parameters:

```typescript
forge.resourceTemplate(
  "user-profile",
  "db://users/{userId}",
  {
    schema: z.object({ userId: z.string() }),
    description: "User profile by ID",
  },
  async ({ userId }) => {
    const user = await db.findUser(userId);
    return { text: JSON.stringify(user) };
  }
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
    messages: [{ role: "user", content: { type: "text", text: `Summarize: ${topic}` } }],
  })
);
```

### Middleware

Add cross-cutting concerns:

```typescript
forge.use(async (ctx, next) => {
  console.log(`Executing ${ctx.type}: ${ctx.name}`);
  const result = await next();
  return result;
});
```

### Plugins

Bundle related functionality into reusable modules:

```typescript
import { ForgePlugin } from "mcp-forge";

const mathPlugin: ForgePlugin = (forge) => {
  forge.tool("add", { schema: z.object({ a: z.number(), b: z.number() }) }, ({ a, b }) => a + b);
  forge.tool("multiply", { schema: z.object({ a: z.number(), b: z.number() }) }, ({ a, b }) => a * b);
};

forge.plugin(mathPlugin);
```

## Built-in Middleware

| Middleware | Description |
|------------|-------------|
| `rateLimit()` | Token bucket rate limiting |
| `cache()` | In-memory caching with TTL |
| `timeout()` | Handler timeout protection |
| `metrics()` | Execution timing and statistics |
| `logging()` | Structured logging to stderr |
| `retry()` | Automatic retry with exponential backoff |
| `auth()` | Pluggable authentication |

```typescript
import { rateLimit, cache, timeout, logging , auth } from "mcp-forge";

forge
  .use(logging({ level: "info" }))
  .use(rateLimit({ maxRequests: 100, windowMs: 60_000 }))
  .use(cache({ ttlMs: 300_000 }))
  .use(timeout({ ms: 30_000 }));
```

## Authentication

Protect your HTTP endpoints with pluggable authentication:

```typescript
import { Forge, auth } from "mcp-forge";

const forge = new Forge({ name: "secure-server", version: "1.0.0" });

forge.use(auth({
  extractToken: (headers) => {
    const authHeader = headers["authorization"];
    if (typeof authHeader === "string") {
      return authHeader.replace("Bearer ", "");
    }
    return undefined;
  },
  validate: async (token) => {
    // Your validation logic (database, JWT, API key, etc.)
    const user = await db.validateToken(token);
    return user ? { userId: user.id, role: user.role } : null;
  },
}));
```

> **Note:** Auth is automatically skipped for stdio transport (inherently trusted).

## Transport Options

### Stdio (Default)

For local MCP clients like Claude Desktop:

```typescript
forge.start(); // Uses stdio by default
```

### HTTP

For remote clients:

```typescript
forge.start({ transport: "http", port: 3000 });
```

## Graceful Shutdown

```typescript
process.on("SIGINT", async () => {
  await forge.stop();
  process.exit(0);
});
```

## API Reference

See the [API documentation](https://github.com/greg-py/mcp-forge#api-reference) for complete details.

## Examples

Browse the [`examples/`](./examples) directory for complete working examples:

- **basic-server.ts** — Simple server with tools, resources, and prompts
- **plugin-demo.ts** — Demonstrates the plugin system

## Contributing

We welcome contributions! See [CONTRIBUTING.md](CONTRIBUTING.md) for:

- Development setup instructions
- Code style guidelines
- Pull request process

## License

[MIT](LICENSE) © 2025 mcp-forge contributors
