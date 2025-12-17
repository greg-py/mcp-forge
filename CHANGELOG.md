# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.2.3] - 2025-12-16

### Fixed

- Fixed prompts crash by correctly passing `.shape` to SDK `registerPrompt` (reverted from v0.2.2)

### Changed

- **BREAKING**: Updated `peerDependencies.zod` to `^3.25.0 || ^4.0.0` to match SDK v1.25.x requirements
  - Users must upgrade to Zod 3.25+ or Zod 4.0+
- Updated devDependencies Zod to v3.25.0

## [0.2.2] - 2025-12-16

### Fixed

- Incorrect fix for prompts (reverted in v0.2.3)

## [0.2.1] - 2025-12-16

### Fixed

- Fixed compatibility with @modelcontextprotocol/sdk v1.25.1 and later versions
- Zod schemas are now passed directly to the SDK instead of converting to JSON Schema first
- Resolves "v3Schema.safeParseAsync is not a function" error when using newer SDK versions

### Changed

- Moved `zod-to-json-schema` from dependencies to devDependencies (SDK handles conversion internally)

### Deprecated

- `toMcpSchema()` utility is deprecated and will be removed in a future major version
  - The MCP SDK now handles Zod-to-JSON-Schema conversion internally
  - If you need JSON Schema conversion for other purposes, use the `zod-to-json-schema` package directly

## [0.2.0] - 2025-12-16


### Added

- Progress reporting for tool handlers via `ToolContext.reportProgress()`
- `ToolContext` interface providing handler capabilities
- Tool handlers now receive optional second parameter `ctx` for progress reporting
- Backwards compatible: existing handlers without `ctx` parameter continue to work
- `auth()` middleware for pluggable authentication (HTTP transport)
- `AuthOptions` interface with `extractToken` and `validate` hooks
- `headers` and `auth` fields on `MiddlewareContext` for HTTP request data
- Auth is automatically skipped for stdio transport (inherently trusted)

## [0.1.1] - 2025-12-16

### Added

- Built-in middleware library:
  - `rateLimit()` - Token bucket rate limiting with configurable windows
  - `cache()` - In-memory caching with TTL and LRU eviction
  - `timeout()` - Handler timeout protection
  - `metrics()` - Execution timing and statistics collection
  - `logging()` - Structured logging to stderr
  - `retry()` - Automatic retry with exponential backoff
- Plugin system with `forge.plugin()` for modular, reusable tool bundles
- `ForgePlugin` and `ForgePluginFactory` types for plugin development
- `definePlugin()` and `definePluginFactory()` helper functions
- Resource templates with `forge.resourceTemplate()` for dynamic URIs
- Built-in URI template parsing and parameter extraction

### Fixed

- Corrected organization name in documentation links and package metadata

## [0.1.0] - 2025-12-16

### Added

- Initial release of mcp-forge
- `Forge` class for building MCP servers
- Tool registration with Zod schema validation via `.tool()`
- Resource registration via `.resource()`
- Prompt template registration via `.prompt()`
- Middleware system via `.use()` for cross-cutting concerns
- Multiple transport options:
  - Stdio transport (default) for local MCP clients
  - HTTP transport with StreamableHTTP for remote clients
- Type-safe argument inference from Zod schemas
- Automatic JSON Schema conversion for MCP compatibility
- Error formatting for clean LLM-consumable error messages
- Graceful shutdown via `.stop()`
- Comprehensive test suite with Vitest
- GitHub Actions CI/CD workflows

[Unreleased]: https://github.com/greg-py/mcp-forge/compare/v0.2.1...HEAD
[0.2.1]: https://github.com/greg-py/mcp-forge/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/greg-py/mcp-forge/compare/v0.1.1...v0.2.0
[0.1.1]: https://github.com/greg-py/mcp-forge/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/greg-py/mcp-forge/releases/tag/v0.1.0
