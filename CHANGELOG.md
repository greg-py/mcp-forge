# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

[Unreleased]: https://github.com/greg-py/mcp-forge/compare/v0.1.1...HEAD
[0.1.1]: https://github.com/greg-py/mcp-forge/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/greg-py/mcp-forge/releases/tag/v0.1.0
