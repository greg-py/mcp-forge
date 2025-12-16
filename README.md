# Forge (mcp-forge)

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-Strict-blue.svg)](https://www.typescriptlang.org/)

Forge is a high-level application framework for the **Model Context Protocol (MCP)**. Think of it as **Express.js** or **NestJS** for building MCP servers.

Forge abstracts away the low-level details of the MCP SDK, allowing you to focus on defining your AI tools holding simple Zod schemas and standard JavaScript functions. It handles:
- Protocol handshake and negotiation.
- JSON-RPC message processing.
- Automatic argument validation using Zod.
- Type-safe argument inference for your handlers.
- Robust error handling.

## Features

- **Type Safety**: Full TypeScript support with argument inference from Zod schemas.
- **MCP Primitives**: Register tools, resources, and prompts with a simple API.
- **Middleware**: Add cross-cutting concerns like logging, authentication, and rate limiting.
- **Multiple Transports**: Run locally with stdio or remotely with HTTP.
- **Validation**: Runtime argument validation using Zod.
- **Error Handling**: Polished error reporting to LLMs to prevent hallucinations.

## Quick Start

### Installation

```bash
npm install mcp-forge zod
```

### Usage

Create a file `server.ts`:

```typescript
import { Forge } from "mcp-forge";
import { z } from "zod";

const app = new Forge({
  name: "my-mcp-server",
  version: "1.0.0"
});

app.tool(
  "echo",
  z.object({
    message: z.string().describe("The message to echo back")
  }),
  async ({ message }) => {
    return `Echo: ${message}`;
  }
);

app.start();
```

run it:

```bash
npx ts-node server.ts
```

## Middleware

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

## Transport Options

By default, Forge uses stdio transport (for local MCP clients like Claude Desktop).

For remote clients, use HTTP transport:

```typescript
await forge.start({ transport: "http", port: 3000 });
```

## Connecting to an MCP Client

Since Forge servers use the Model Context Protocol, you need an MCP client to interact with them. The most common way is to configure **Claude Desktop**.

1.  Open your Claude Desktop configuration file:
    -   macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
    -   Windows: `%APPDATA%\Claude\claude_desktop_config.json`

2.  Add your Forge server to the `mcpServers` object:

```json
{
  "mcpServers": {
    "my-forge-server": {
      "command": "npx",
      "args": [
        "-y",
        "ts-node",
        "/absolute/path/to/your/server.ts"
      ]
    }
  }
}
```

3.  Restart Claude Desktop. You should now see your tools (e.g., `echo`) available to Claude!

## Contributing

Pull requests are welcome. For major changes, please open an issue first to discuss what you would like to change.

## License

[MIT](LICENSE)
