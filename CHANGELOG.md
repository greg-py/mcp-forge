# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Built-in middleware library with production-ready middleware:
  - `rateLimit()` - Token bucket rate limiting with configurable windows
  - `cache()` - In-memory caching with TTL and LRU eviction
  - `timeout()` - Handler timeout protection
  - `metrics()` - Execution timing and statistics collection
  - `logging()` - Structured logging to stderr
  - `retry()` - Automatic retry with exponential backoff
- Comprehensive test suite for all middleware (33 new tests)

## [0.1.0] - 2025-12-16

### Added

- Initial release of Forge (mcp-forge)
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
- Comprehensive test suite with Vitest
- GitHub Actions CI/CD workflows

### Dependencies

- `@modelcontextprotocol/sdk` - MCP protocol implementation
- `express` - HTTP server for remote transport
- `zod-to-json-schema` - Schema conversion utility
- `zod` (peer dependency) - Runtime validation

[Unreleased]: https://github.com/username/mcp-forge/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/username/mcp-forge/releases/tag/v0.1.0
