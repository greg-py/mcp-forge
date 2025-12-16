# Contributing to Forge

Thank you for your interest in contributing to Forge! This document provides guidelines and instructions for contributing.

## Development Setup

### Prerequisites

- Node.js 18 or higher
- npm 9 or higher

### Getting Started

1. Fork the repository
2. Clone your fork:
   ```bash
   git clone https://github.com/YOUR_USERNAME/mcp-forge.git
   cd mcp-forge
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
4. Build the project:
   ```bash
   npm run build
   ```
5. Run tests:
   ```bash
   npm test
   ```

## Development Workflow

### Available Scripts

| Script | Description |
|--------|-------------|
| `npm run build` | Compile TypeScript to JavaScript |
| `npm run watch` | Watch mode for development |
| `npm test` | Run tests once |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:coverage` | Run tests with coverage report |
| `npm run lint` | Check for linting errors |
| `npm run lint:fix` | Fix linting errors automatically |
| `npm run format` | Format code with Prettier |
| `npm run format:check` | Check code formatting |

### Code Style

- We use ESLint for linting and Prettier for formatting
- Run `npm run lint:fix` before committing
- Run `npm run format` to ensure consistent formatting

### Testing

- All new features should include tests
- Tests are located in the `tests/` directory
- We use Vitest as our test runner

### Commit Messages

We follow [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` - New features
- `fix:` - Bug fixes
- `docs:` - Documentation changes
- `test:` - Adding or updating tests
- `refactor:` - Code changes that don't add features or fix bugs
- `chore:` - Maintenance tasks

Examples:
```
feat: add support for tool descriptions
fix: handle null arguments in middleware
docs: update README with middleware examples
```

## Pull Request Process

1. Create a feature branch from `main`:
   ```bash
   git checkout -b feat/your-feature-name
   ```

2. Make your changes and commit them with descriptive messages

3. Ensure all tests pass:
   ```bash
   npm test
   ```

4. Ensure code is properly formatted and linted:
   ```bash
   npm run lint:fix
   npm run format
   ```

5. Push to your fork and create a Pull Request

6. Wait for review and address any feedback

## Project Structure

```
mcp-forge/
├── src/
│   ├── core/
│   │   ├── Forge.ts      # Main Forge class
│   │   └── errors.ts     # Error handling and logging
│   ├── utils/
│   │   └── schema.ts     # Zod to JSON Schema conversion
│   └── index.ts          # Public API exports
├── tests/                # Test files
├── examples/             # Example usage
└── dist/                 # Compiled output (generated)
```

## Adding New Features

When adding a new feature:

1. **Discuss first** - Open an issue to discuss the feature before implementing
2. **Update types** - Add proper TypeScript types
3. **Add tests** - Include comprehensive tests
4. **Update docs** - Update README.md and JSDoc comments
5. **Update CHANGELOG** - Add entry under `[Unreleased]`

## Reporting Bugs

When reporting bugs, please include:

- Node.js version
- npm version
- Operating system
- Steps to reproduce
- Expected vs actual behavior
- Error messages or logs

## Questions?

Feel free to open an issue for any questions about contributing.
